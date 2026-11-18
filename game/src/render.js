// Rendering: the three.js renderer, the third-person / chase cameras, the
// particles, and every pixel of the HUD — cash, health, wanted stars, mission
// objective, speed, weapon, radio, the minimap, toasts and the shop panel.

import * as THREE from 'three';
import { CITY, GAME_TITLE, CITY_NAME } from './config.js';
import { clamp, angleDiff, lerp } from './random.js';

const MINIMAP_SIZE = 180;

function el(id) {
  return document.getElementById(id);
}

export function createRenderer(canvas, game) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = game.scene;
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);

  // Particles as one THREE.Points cloud, rebuilt every frame from game state.
  const MAX_PARTICLES = 300;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(MAX_PARTICLES * 3);
  const pCol = new Float32Array(MAX_PARTICLES * 3);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const pMat = new THREE.PointsMaterial({ size: 0.6, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  scene.add(points);

  const minimap = el('minimap');
  const mctx = minimap ? minimap.getContext('2d') : null;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  function updateCamera(dt) {
    const { player, state } = game;
    if (state.screen === 'title') {
      const t = performance.now() / 1000;
      const a = t * 0.05;
      camera.position.set(Math.cos(a) * 130, 55, Math.sin(a) * 130);
      camera.lookAt(0, 5, 20);
      return;
    }
    if (player.inCar && player.car) {
      // Chase camera: ease the yaw behind the car.
      state.camYaw += angleDiff(state.camYaw, player.heading) * Math.min(1, dt * 2.2);
      const dist = 13;
      const height = 5.2;
      const fx = Math.sin(state.camYaw);
      const fz = Math.cos(state.camYaw);
      camera.position.set(
        player.x - fx * dist,
        height,
        player.z - fz * dist,
      );
      camera.lookAt(player.x + fx * 6, 1.6, player.z + fz * 6);
      return;
    }
    const dist = 9.5;
    const height = 3.4 + state.camPitch * 6;
    const fx = Math.sin(state.camYaw);
    const fz = Math.cos(state.camYaw);
    camera.position.set(player.x - fx * dist, height, player.z - fz * dist);
    camera.lookAt(player.x + fx * 4, 1.6, player.z + fz * 4);
  }

  function updateParticles() {
    const list = game.particles;
    const color = new THREE.Color();
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      if (i < list.length) {
        const p = list[i];
        pPos[i * 3] = p.x;
        pPos[i * 3 + 1] = p.y;
        pPos[i * 3 + 2] = p.z;
        color.setHex(p.color);
        const fade = clamp(p.life / p.maxLife, 0, 1);
        pCol[i * 3] = color.r * fade;
        pCol[i * 3 + 1] = color.g * fade;
        pCol[i * 3 + 2] = color.b * fade;
      } else {
        pPos[i * 3 + 1] = -100;
      }
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
    pGeo.setDrawRange(0, Math.max(list.length, 1));
  }

  function drawMinimap() {
    if (!mctx) return;
    const S = MINIMAP_SIZE;
    const toMap = (v) => ((v + 210) / 420) * S;
    mctx.clearRect(0, 0, S, S);
    mctx.fillStyle = 'rgba(20, 28, 40, 0.85)';
    mctx.fillRect(0, 0, S, S);
    // Ocean + beach.
    mctx.fillStyle = '#1d7f9e';
    mctx.fillRect(0, toMap(210), S, S - toMap(210));
    mctx.fillStyle = '#e8cf9a';
    mctx.fillRect(0, toMap(185), S, toMap(210) - toMap(185));
    // Roads.
    mctx.strokeStyle = '#5a6270';
    mctx.lineWidth = 4;
    for (const line of CITY.roads) {
      mctx.beginPath();
      mctx.moveTo(toMap(line), 0);
      mctx.lineTo(toMap(line), S);
      mctx.stroke();
      mctx.beginPath();
      mctx.moveTo(0, toMap(line));
      mctx.lineTo(S, toMap(line));
      mctx.stroke();
    }
    // Safehouse + shop.
    mctx.fillStyle = '#2e86ff';
    mctx.fillRect(toMap(CITY.safehouse.x) - 3, toMap(CITY.safehouse.z) - 3, 6, 6);
    mctx.fillStyle = '#f2c94c';
    mctx.fillRect(toMap(CITY.shop.x) - 3, toMap(CITY.shop.z) - 3, 6, 6);
    // Mission marker.
    const mark = game.missions.marker();
    if (mark) {
      mctx.fillStyle = '#ffd700';
      mctx.beginPath();
      mctx.arc(toMap(mark.x), toMap(mark.z), 6, 0, Math.PI * 2);
      mctx.fill();
      mctx.strokeStyle = '#fff';
      mctx.lineWidth = 1.5;
      mctx.stroke();
    }
    // Traffic.
    mctx.fillStyle = '#ffffff';
    for (const car of game.traffic.cars) {
      mctx.fillRect(toMap(car.mesh.position.x) - 1.5, toMap(car.mesh.position.z) - 1.5, 3, 3);
    }
    // Enemies.
    mctx.fillStyle = '#ff4444';
    for (const e of game.enemies.list) {
      if (e.alive) mctx.fillRect(toMap(e.x) - 2, toMap(e.z) - 2, 4, 4);
    }
    // Police.
    mctx.fillStyle = '#4488ff';
    for (const c of game.police.cars) {
      mctx.beginPath();
      mctx.arc(toMap(c.x), toMap(c.z), 3.5, 0, Math.PI * 2);
      mctx.fill();
    }
    if (game.police.heli.visible) {
      mctx.fillStyle = '#88aaff';
      mctx.beginPath();
      mctx.arc(toMap(game.police.heli.position.x), toMap(game.police.heli.position.z), 5, 0, Math.PI * 2);
      mctx.fill();
    }
    // Player arrow.
    const { player } = game;
    mctx.save();
    mctx.translate(toMap(player.x), toMap(player.z));
    mctx.rotate(Math.PI - player.heading);
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.moveTo(0, -7);
    mctx.lineTo(5, 5);
    mctx.lineTo(-5, 5);
    mctx.closePath();
    mctx.fill();
    mctx.restore();
  }

  function drawHud() {
    const hud = game.getHud();
    const setText = (id, text) => {
      const n = el(id);
      if (n) n.textContent = text;
    };
    setText('hud-cash', `$${hud.cash.toLocaleString('en-US')}`);
    setText('hud-mission', hud.missionName);
    setText('hud-objective', hud.objective);
    setText('hud-weapon', `${hud.weapon}  ${hud.ammo}`);
    setText('hud-speed', hud.inCar ? `${hud.speed} km/h` : '');
    setText('hud-station', hud.station);
    setText('hud-toast', hud.message);
    const healthBar = el('hud-health-fill');
    if (healthBar) {
      healthBar.style.width = `${hud.health}%`;
      healthBar.style.background = hud.health > 50 ? '#6fbf73' : hud.health > 25 ? '#f2c94c' : '#e5534b';
    }
    const stars = el('hud-stars');
    if (stars) {
      stars.textContent = '★'.repeat(hud.wanted) + '☆'.repeat(5 - hud.wanted);
      stars.style.color = hud.wanted > 0 ? '#ffd700' : 'rgba(255,255,255,0.35)';
    }
    const bust = el('hud-bust');
    if (bust) bust.style.width = `${hud.bustProgress * 100}%`;
    const prompt = el('hud-prompt');
    if (prompt) {
      let text = '';
      if (hud.shopOpen) text = '';
      else if (hud.nearHouse) text = 'Press E — Save game at safehouse';
      else if (hud.nearShop) text = 'Press E — Verde Arms gun shop';
      else if (!hud.inCar) text = 'E — enter car   •   Click — shoot   •   1/2/3 — weapons';
      else text = 'E — exit car   •   Space — handbrake';
      prompt.textContent = text;
    }
    const shop = el('shop');
    if (shop) shop.style.display = hud.shopOpen ? 'block' : 'none';
    const title = el('title-screen');
    if (title) title.style.display = game.state.screen === 'title' ? 'flex' : 'none';
    const hudRoot = el('hud');
    if (hudRoot) hudRoot.style.display = game.state.screen === 'play' ? 'block' : 'none';
    drawMinimap();
  }

  return {
    render(dt) {
      updateCamera(dt);
      updateParticles();
      renderer.render(scene, camera);
      drawHud();
    },
    resize,
  };
}
