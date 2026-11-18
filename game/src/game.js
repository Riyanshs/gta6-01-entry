// Verde Bay's rules: on-foot and driving movement, car theft, the wanted
// system and police, combat, missions, the shop and safehouse, saving, and the
// particles that make it feel alive. The scene is built by city.js, vehicles.js
// and people.js; this module owns the state and steps it forward.

import * as THREE from 'three';
import { CITY, PLAYER, CAR, WEAPONS, WANTED, SAVE_KEY, STEP } from './config.js';
import { buildCity } from './city.js';
import { makeCarMesh, createTraffic, createPolice } from './vehicles.js';
import { makePersonMesh, createPedestrians, createEnemies } from './people.js';
import { createMissionRunner, getMission } from './missions.js';
import { createAudio } from './audio.js';
import { clamp, dist2d, angleDiff } from './random.js';

const WEAPON_KEYS = ['fist', 'pistol', 'smg'];
const MAG = { pistol: 12, smg: 30 };

function collideCircle(colliders, x, z, r) {
  let px = x;
  let pz = z;
  for (const c of colliders) {
    const cx = clamp(px, c.minX, c.maxX);
    const cz = clamp(pz, c.minZ, c.maxZ);
    const dx = px - cx;
    const dz = pz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        px = cx + (dx / d) * r;
        pz = cz + (dz / d) * r;
      } else {
        pz = c.maxZ + r;
      }
    }
  }
  return { x: px, z: pz };
}

export function createGame(scene, rng) {
  const audio = createAudio();
  const { colliders } = buildCity(scene, rng);
  const traffic = createTraffic(scene, rng);
  const police = createPolice(scene);
  const peds = createPedestrians(scene, rng);
  const enemies = createEnemies(scene);
  const missions = createMissionRunner();

  const playerMesh = makePersonMesh(0x2e86ff, 0x1c2733);
  scene.add(playerMesh);

  // Parked cars the player can steal, plus mission cars spawned on demand.
  const parked = [];
  function parkCar(kind, color, x, z, heading) {
    const mesh = makeCarMesh(kind, color);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    const car = { mesh, kind, color, x, z, heading, speed: 0, parked: true, mission: false };
    parked.push(car);
    return car;
  }
  parkCar('sedan', 0xd96a4f, -40, 82, 0.4);
  parkCar('coupe', 0xf2c94c, 44, 4, 1.6);
  parkCar('sedan', 0x7fb3d5, 84, -76, -0.8);
  parkCar('sedan', 0xe8e8e8, -84, -4, 2.2);
  parkCar('sedan', 0x6fbf73, 4, 84, 0.1);
  parkCar('coupe', 0x9b7ec4, 124, 44, -1.2);
  parkCar('sedan', 0xe8b04b, -124, -84, 0.9);
  parkCar('truck', 0x8a6b48, 166, 116, 0.3);

  // The mission marker: a glowing yellow beacon column.
  const markerGeo = new THREE.CylinderGeometry(1.2, 1.2, 60, 12, 1, true);
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xf2c94c, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  const marker = new THREE.Mesh(markerGeo, markerMat);
  marker.position.y = 30;
  marker.visible = false;
  scene.add(marker);

  const particles = [];
  function spawnParticles(x, y, z, n, color, spread, up) {
    for (let i = 0; i < n; i += 1) {
      particles.push({
        x, y, z,
        vx: (Math.random() - 0.5) * spread,
        vy: Math.random() * up,
        vz: (Math.random() - 0.5) * spread,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1,
        color,
        size: 0.25 + Math.random() * 0.35,
      });
    }
    if (particles.length > 300) particles.splice(0, particles.length - 300);
  }

  const state = {
    screen: 'title',
    cash: 250,
    health: PLAYER.maxHealth,
    wanted: 0,
    wantedTimer: 0,
    bustTimer: 0,
    weaponIndex: 0,
    owned: { fist: true, pistol: false, smg: false },
    ammo: { pistol: 0, smg: 0 },
    mag: { pistol: MAG.pistol, smg: MAG.smg },
    camYaw: 0,
    camPitch: 0.32,
    time: 0,
    message: '',
    messageTimer: 0,
    busted: false,
    wasted: false,
    shopOpen: false,
    missionStepKey: '',
    radioOn: true,
  };

  const player = {
    x: CITY.safehouse.x + 6, z: CITY.safehouse.z + 8,
    heading: 0, speed: 0, inCar: false, car: null, shootCooldown: 0,
  };

  function toast(text) {
    state.message = text;
    state.messageTimer = 4;
  }

  function addWanted(n, reason) {
    const before = state.wanted;
    state.wanted = clamp(state.wanted + n, 0, WANTED.max);
    if (state.wanted > before) {
      toast(`Wanted level ${state.wanted} — ${reason}`);
      audio.blip(220);
    }
    police.setCount(state.wanted, player.x, player.z);
  }

  function nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of parked) {
      const d = dist2d(player.x, player.z, car.x, car.z);
      if (d < bestD) {
        best = car;
        bestD = d;
      }
    }
    for (const car of traffic.cars) {
      const d = dist2d(player.x, player.z, car.mesh.position.x, car.mesh.position.z);
      if (d < bestD) {
        best = { traffic: car, x: car.mesh.position.x, z: car.mesh.position.z, mesh: car.mesh, kind: car.kind, parked: false };
        bestD = d;
      }
    }
    return best;
  }

  function enterCar(car) {
    if (car.traffic) {
      // The driver bails out: the car leaves the traffic flow and is yours now.
      const idx = traffic.cars.indexOf(car.traffic);
      if (idx !== -1) traffic.cars.splice(idx, 1);
      const stolen = { mesh: car.mesh, kind: car.kind, color: 0, x: car.x, z: car.z, heading: car.mesh.rotation.y, speed: 0, parked: false, mission: false };
      parked.push(stolen);
      player.car = stolen;
      addWanted(1, 'car stolen');
      toast('You jacked a moving car!');
    } else {
      player.car = car;
      if (car.parked) {
        addWanted(1, 'car stolen');
        toast('Car stolen — the cops noticed.');
      }
    }
    player.inCar = true;
    player.heading = player.car.heading;
    playerMesh.visible = false;
    audio.blip(660);
  }

  function exitCar() {
    if (!player.car) return;
    player.inCar = false;
    player.x = player.car.x + Math.sin(player.car.heading + Math.PI / 2) * 2.5;
    player.z = player.car.z + Math.cos(player.car.heading + Math.PI / 2) * 2.5;
    player.heading = player.car.heading;
    playerMesh.visible = true;
    player.car = null;
  }

  function ensureMissionAssets() {
    const step = missions.step();
    if (!step) return;
    const key = `${missions.missionIndex}:${missions.step ? missions.current().steps.indexOf(step) : -1}`;
    if (key === state.missionStepKey) return;
    state.missionStepKey = key;
    if ((step.type === 'enterCar' || step.type === 'stealCar') && step.at) {
      const near = parked.some((c) => dist2d(c.x, c.z, step.at.x, step.at.z) < 6);
      if (!near) {
        const car = parkCar(step.truck ? 'truck' : step.car === 'coupe' ? 'coupe' : 'sedan', step.truck ? 0x8a6b48 : 0xd96a4f, step.at.x, step.at.z, 0.5);
        car.mission = true;
      }
    }
    if (step.type === 'kill' && step.at) {
      enemies.spawn(step.count || 3, step.at.x, step.at.z);
    }
    if (step.type === 'wanted') {
      addWanted(step.level || 2, 'the job went loud');
    }
  }

  function shoot() {
    const key = WEAPON_KEYS[state.weaponIndex];
    const def = WEAPONS[key];
    if (player.shootCooldown > 0) return;
    player.shootCooldown = def.rate;
    if (key === 'fist') {
      const hit = enemies.hitTest(player.x, player.z, player.heading, def.range);
      if (hit) {
        hit.health -= def.damage;
        if (hit.health <= 0 && hit.alive) {
          hit.alive = false;
          hit.mesh.visible = false;
          missions.onKill();
          state.cash += 50;
          toast('Tiburone down — +$50');
        }
      }
      return;
    }
    if (state.ammo[key] <= 0 && state.mag[key] <= 0) {
      toast('Out of ammo — buy more at Verde Arms');
      return;
    }
    if (state.mag[key] <= 0) {
      state.mag[key] = Math.min(MAG[key], state.ammo[key]);
      state.ammo[key] -= state.mag[key];
      toast('Reloaded');
      return;
    }
    state.mag[key] -= 1;
    audio.gunshot();
    const mx = player.x + Math.sin(player.heading) * 1.2;
    const mz = player.z + Math.cos(player.heading) * 1.2;
    spawnParticles(mx, 1.4, mz, 4, 0xffd98a, 1, 1);
    const hit = enemies.hitTest(player.x, player.z, player.heading, def.range);
    if (hit) {
      hit.health -= def.damage;
      spawnParticles(hit.x, 1.2, hit.z, 6, 0xc0392b, 2, 2);
      if (hit.health <= 0 && hit.alive) {
        hit.alive = false;
        hit.mesh.visible = false;
        missions.onKill();
        state.cash += 50;
        toast('Tiburone down — +$50');
      }
    }
  }

  function respawn(reason) {
    player.x = CITY.safehouse.x + 6;
    player.z = CITY.safehouse.z + 8;
    player.heading = 0;
    state.health = PLAYER.maxHealth;
    state.wanted = 0;
    state.bustTimer = 0;
    police.clear();
    if (player.inCar) {
      player.inCar = false;
      player.car = null;
      playerMesh.visible = true;
    }
    const lost = Math.min(state.cash, Math.max(100, Math.floor(state.cash * 0.1)));
    state.cash -= lost;
    if (reason === 'busted') {
      state.busted = true;
      toast(`BUSTED! The VCPD took $${lost}. Back at the safehouse.`);
    } else {
      state.wasted = true;
      toast(`WASTED! You woke up at the safehouse, $${lost} lighter.`);
    }
  }

  function saveGame() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        x: player.x, z: player.z, cash: state.cash, health: state.health,
        missionIndex: missions.missionIndex, wanted: state.wanted,
        owned: state.owned, ammo: state.ammo, mag: state.mag,
      }));
      toast('Game saved at the safehouse.');
    } catch {
      toast('Save failed — storage unavailable.');
    }
  }

  function loadSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      player.x = s.x;
      player.z = s.z;
      state.cash = s.cash;
      state.health = s.health;
      state.wanted = 0;
      state.owned = s.owned;
      state.ammo = s.ammo;
      state.mag = s.mag;
      missions.startMission(s.missionIndex || 0);
      state.missionStepKey = '';
      police.clear();
      return true;
    } catch {
      return false;
    }
  }

  function hasSave() {
    try {
      return !!window.localStorage.getItem(SAVE_KEY);
    } catch {
      return false;
    }
  }

  function startNewGame() {
    state.cash = 250;
    state.health = PLAYER.maxHealth;
    state.wanted = 0;
    state.owned = { fist: true, pistol: false, smg: false };
    state.ammo = { pistol: 0, smg: 0 };
    state.mag = { pistol: MAG.pistol, smg: MAG.smg };
    player.x = CITY.safehouse.x + 6;
    player.z = CITY.safehouse.z + 8;
    player.inCar = false;
    player.car = null;
    playerMesh.visible = true;
    missions.startMission(0);
    state.missionStepKey = '';
    state.screen = 'play';
    state.busted = false;
    state.wasted = false;
    enemies.clear();
    police.clear();
    toast('Welcome to Verde Bay, Leo. Carmen is waiting — follow the yellow marker.');
  }

  function buy(item) {
    if (item === 'pistol' && !state.owned.pistol && state.cash >= WEAPONS.pistol.price) {
      state.cash -= WEAPONS.pistol.price;
      state.owned.pistol = true;
      state.ammo.pistol += 24;
      toast('Bought the P-9 Pistol.');
    } else if (item === 'smg' && !state.owned.smg && state.cash >= WEAPONS.smg.price) {
      state.cash -= WEAPONS.smg.price;
      state.owned.smg = true;
      state.ammo.smg += 60;
      toast('Bought the VB-10 SMG.');
    } else if (item === 'ammo' && state.cash >= 100) {
      state.cash -= 100;
      if (state.owned.pistol) state.ammo.pistol += 24;
      if (state.owned.smg) state.ammo.smg += 60;
      toast('Bought ammo.');
    } else {
      toast('Not enough cash, or you already own it.');
    }
    audio.blip(880);
  }

  function stepPlayer(dt, ctl) {
    state.camYaw -= ctl.lookDX * 0.0032;
    state.camPitch = clamp(state.camPitch + ctl.lookDY * 0.002, 0.08, 0.9);
    if (ctl.weaponSlot >= 0 && ctl.weaponSlot <= 2) {
      const key = WEAPON_KEYS[ctl.weaponSlot];
      if (state.owned[key]) state.weaponIndex = ctl.weaponSlot;
    }
    if (ctl.reload) {
      const key = WEAPON_KEYS[state.weaponIndex];
      if (key !== 'fist' && state.ammo[key] > 0) {
        const need = MAG[key] - state.mag[key];
        const take = Math.min(need, state.ammo[key]);
        state.mag[key] += take;
        state.ammo[key] -= take;
      }
    }
    player.shootCooldown = Math.max(0, player.shootCooldown - dt);

    if (player.inCar && player.car) {
      const car = player.car;
      const steer = -ctl.strafe;
      if (ctl.fwd > 0) car.speed += CAR.accel * dt;
      else if (ctl.fwd < 0) car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.reverseAccel) * dt;
      else car.speed -= Math.sign(car.speed) * CAR.drag * dt;
      if (ctl.handbrake) car.speed -= Math.sign(car.speed) * 22 * dt;
      car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
      if (Math.abs(car.speed) < 0.05 && ctl.fwd === 0) car.speed = 0;
      car.heading += steer * CAR.steer * dt * clamp(Math.abs(car.speed) / 8, 0, 1) * Math.sign(car.speed || 1);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      // The city has edges: keep the car inside Verde Bay.
      if (car.x < -198 || car.x > 198 || car.z < -198 || car.z > 232) {
        car.x = clamp(car.x, -198, 198);
        car.z = clamp(car.z, -198, 232);
        car.speed *= 0.4;
      }
      const fixed = collideCircle(colliders, car.x, car.z, 1.6);
      if (fixed.x !== car.x || fixed.z !== car.z) {
        car.x = fixed.x;
        car.z = fixed.z;
        car.speed *= 0.4;
        spawnParticles(car.x, 0.8, car.z, 5, 0xaaaaaa, 3, 2);
      }
      // Bumping traffic slows you down.
      for (const t of traffic.cars) {
        const d = dist2d(car.x, car.z, t.mesh.position.x, t.mesh.position.z);
        if (d < 3.4) {
          car.speed *= 0.6;
          car.x -= Math.sin(car.heading) * 0.4;
          car.z -= Math.cos(car.heading) * 0.4;
        }
      }
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      for (const w of car.mesh.userData.wheels) w.rotation.x += (car.speed * dt) / 0.42;
      if (ctl.handbrake && Math.abs(car.speed) > 8) {
        spawnParticles(car.x, 0.3, car.z, 2, 0xdddddd, 1, 1);
      }
      if (ctl.interact) exitCar();
      player.x = car.x;
      player.z = car.z;
      player.heading = car.heading;
      audio.setEngine(Math.abs(car.speed) / CAR.maxSpeed, true);
      return;
    }

    // On foot.
    audio.setEngine(0, false);
    const speed = ctl.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const sin = Math.sin(state.camYaw);
    const cos = Math.cos(state.camYaw);
    let mx = (sin * ctl.fwd + cos * ctl.strafe) * speed;
    let mz = (cos * ctl.fwd - sin * ctl.strafe) * speed;
    const moving = mx !== 0 || mz !== 0;
    if (moving) {
      const len = Math.hypot(mx, mz);
      mx /= len;
      mz /= len;
      player.heading = Math.atan2(mx, mz);
    }
    let nx = player.x + mx * dt * (moving ? speed : 0);
    let nz = player.z + mz * dt * (moving ? speed : 0);
    const fixed = collideCircle(colliders, nx, nz, PLAYER.radius);
    nx = fixed.x;
    nz = fixed.z;
    nx = clamp(nx, -198, 198);
    nz = clamp(nz, -198, 232);
    // Running over a pedestrian is a crime.
    for (const ped of peds.peds) {
      if (dist2d(nx, nz, ped.x, ped.z) < 1.1) {
        addWanted(1, 'you hit a pedestrian');
        ped.x += (ped.x - nx) * 2;
        ped.z += (ped.z - nz) * 2;
      }
    }
    player.x = nx;
    player.z = nz;
    playerMesh.position.set(player.x, 0, player.z);
    playerMesh.rotation.y = player.heading;
    const bob = moving ? Math.sin(state.time * 10) * 0.12 : 0;
    playerMesh.userData.legL.rotation.x = bob;
    playerMesh.userData.legR.rotation.x = -bob;
    if (ctl.interact) {
      const nearShop = dist2d(player.x, player.z, CITY.shop.x, CITY.shop.z) < 12;
      const nearHouse = dist2d(player.x, player.z, CITY.safehouse.x, CITY.safehouse.z) < 12;
      if (nearHouse) {
        saveGame();
      } else if (nearShop) {
        state.shopOpen = !state.shopOpen;
      } else {
        const car = nearestCar(4.2);
        if (car) enterCar(car);
      }
    }
    if ((ctl.shoot || ctl.shooting) && state.screen === 'play') {
      player.heading = state.camYaw;
      shoot();
    }
  }

  function update(dt, ctl) {
    state.time += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.screen !== 'play') return;
    ensureMissionAssets();
    stepPlayer(dt, ctl);

    traffic.update(dt);
    const danger = state.wanted > 0 || player.shootCooldown > 0 ? { x: player.x, z: player.z } : null;
    peds.update(dt, danger);
    const dmg = enemies.update(dt, player.x, player.z);
    if (dmg > 0) {
      state.health -= dmg;
      spawnParticles(player.x, 1.2, player.z, 3, 0xc0392b, 2, 2);
      if (state.health <= 0) respawn('wasted');
    }

    // Wanted: police chase, decay out of sight, busted when caught on foot.
    if (state.wanted > 0) {
      const res = police.update(dt, { x: player.x, z: player.z, onFoot: !player.inCar, speed: player.car ? Math.abs(player.car.speed) : 0 });
      player.x += res.ramX;
      player.z += res.ramZ;
      if (player.car) {
        player.car.x = player.x;
        player.car.z = player.z;
      }
      if (res.bust > 0) {
        state.bustTimer += res.bust;
        if (state.bustTimer > WANTED.bustSeconds) respawn('busted');
      } else {
        state.bustTimer = Math.max(0, state.bustTimer - dt);
      }
      const nearestCop = police.cars.reduce((m, c) => Math.min(m, dist2d(player.x, player.z, c.x, c.z)), 999);
      if (nearestCop > 45) {
        state.wantedTimer += dt;
        if (state.wantedTimer > WANTED.decaySeconds) {
          state.wanted -= 1;
          state.wantedTimer = 0;
          police.setCount(state.wanted, player.x, player.z);
          toast(state.wanted === 0 ? 'You lost the heat.' : `Wanted level ${state.wanted}`);
        }
      } else {
        state.wantedTimer = 0;
      }
      audio.setSiren(true);
    } else {
      audio.setSiren(false);
    }

    // Missions.
    const ev = missions.update({ x: player.x, z: player.z, inCar: player.inCar, wanted: state.wanted });
    if (ev === 'stepDone') {
      toast('Objective complete.');
      audio.blip(990);
    } else if (ev === 'missionDone' || ev === 'allDone') {
      const done = getMission(missions.missionIndex - 1);
      if (done) {
        state.cash += done.reward;
        toast(`Mission complete: ${done.name} — +$${done.reward}`);
      }
      audio.blip(1320);
      if (ev === 'allDone') toast('STORY COMPLETE — you are the King of Verde Bay!');
      enemies.clear();
    }

    // Mission marker.
    const mark = missions.marker();
    if (mark) {
      marker.visible = true;
      marker.position.set(mark.x, 30, mark.z);
      marker.rotation.y += dt;
    } else {
      marker.visible = false;
    }

    // Health regen, slow.
    if (state.health > 0 && state.health < PLAYER.maxHealth) state.health = Math.min(PLAYER.maxHealth, state.health + dt * 1.5);

    // Particles.
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 2 * dt;
    }
  }

  return {
    scene, state, player, missions, audio, particles, parked, traffic, police, enemies, peds,
    update,
    startNewGame,
    loadSave,
    hasSave,
    saveGame,
    buy,
    getHud() {
      const m = missions.current();
      const key = WEAPON_KEYS[state.weaponIndex];
      return {
        cash: state.cash,
        health: Math.max(0, Math.round(state.health)),
        wanted: state.wanted,
        objective: missions.objectiveText(),
        missionName: m ? `${m.id}. ${m.name}` : 'Free Roam',
        missionGiver: m ? m.giver : '',
        missionBrief: m ? m.brief : '',
        speed: player.inCar && player.car ? Math.round(Math.abs(player.car.speed) * 3.6) : 0,
        inCar: player.inCar,
        weapon: WEAPONS[key].name,
        ammo: key === 'fist' ? '—' : `${state.mag[key]} / ${state.ammo[key]}`,
        station: state.radioOn ? audio.stationName : 'Radio off',
        message: state.messageTimer > 0 ? state.message : '',
        busted: state.busted,
        wasted: state.wasted,
        shopOpen: state.shopOpen,
        nearShop: dist2d(player.x, player.z, CITY.shop.x, CITY.shop.z) < 12,
        nearHouse: dist2d(player.x, player.z, CITY.safehouse.x, CITY.safehouse.z) < 12,
        bustProgress: clamp(state.bustTimer / WANTED.bustSeconds, 0, 1),
      };
    },
  };
}
