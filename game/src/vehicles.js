// Vehicles: the car meshes (sedan, coupe, truck, taxi, police), the traffic that
// fills the avenues, the police patrol cars that chase and ram, and the police
// helicopter that joins at four stars and up.

import * as THREE from 'three';
import { CITY, CAR } from './config.js';
import { angleDiff, clamp } from './random.js';

const CAR_COLORS = [0xd96a4f, 0x7fb3d5, 0xf2c94c, 0x9b7ec4, 0x6fbf73, 0xe8e8e8, 0x2c3542, 0xe8b04b];

/** A low-poly car: body, cabin, four wheels, headlights. `kind` is sedan|coupe|truck|taxi|police. */
export function makeCarMesh(kind, colorHex) {
  const group = new THREE.Group();
  const bodyColor = kind === 'police' ? 0x1c2733 : colorHex;
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.35, metalness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.1, metalness: 0.7 });
  const isTruck = kind === 'truck';
  const length = isTruck ? 6.4 : kind === 'coupe' ? 4.4 : 4.8;
  const width = isTruck ? 2.6 : 2.0;
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, 0.8, length), bodyMat);
  body.position.y = 0.65;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.85, 0.7, isTruck ? 1.6 : length * 0.45),
    isTruck ? bodyMat : glassMat,
  );
  cabin.position.set(0, 1.35, isTruck ? length * 0.28 : -length * 0.05);
  cabin.castShadow = true;
  group.add(cabin);
  if (isTruck) {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 0.9, length * 0.5), new THREE.MeshStandardMaterial({ color: 0x8a6b48, roughness: 0.9 }));
    bed.position.set(0, 1.3, -length * 0.22);
    group.add(bed);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const wheels = [];
  for (const [wx, wz] of [[-width / 2, length * 0.32], [width / 2, length * 0.32], [-width / 2, -length * 0.32], [width / 2, -length * 0.32]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  for (const wx of [-width * 0.3, width * 0.3]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), lightMat);
    lamp.position.set(wx, 0.7, length / 2 + 0.02);
    group.add(lamp);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0xf2c94c }));
    sign.position.set(0, 1.85, 0);
    group.add(sign);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    bar.position.set(0, 1.78, 0);
    group.add(bar);
    const door = new THREE.Mesh(new THREE.BoxGeometry(width + 0.06, 0.5, 1.2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    door.position.set(0, 0.65, 0);
    group.add(door);
  }
  group.userData.wheels = wheels;
  group.userData.length = length;
  return group;
}

function randomRoadCar(rng) {
  const axis = rng.next() < 0.5 ? 'x' : 'z';
  const line = CITY.roads[Math.floor(rng.next() * CITY.roads.length)];
  const along = rng.range(-180, 180);
  const dir = rng.next() < 0.5 ? 1 : -1;
  const kind = rng.next() < 0.12 ? 'taxi' : 'sedan';
  return { axis, line, along, dir, speed: rng.range(7, 12), kind };
}

/** Traffic: a dozen cars cruising the avenues, turning at random intersections. */
export function createTraffic(scene, rng) {
  const cars = [];
  for (let i = 0; i < 12; i += 1) {
    const spec = randomRoadCar(rng);
    const mesh = makeCarMesh(spec.kind, CAR_COLORS[Math.floor(rng.next() * CAR_COLORS.length)]);
    scene.add(mesh);
    cars.push({ ...spec, mesh, heading: 0 });
  }
  return {
    cars,
    update(dt) {
      for (const car of cars) {
        car.along += car.dir * car.speed * dt;
        if (car.along > 195) car.along = -195;
        if (car.along < -195) car.along = 195;
        // Occasionally turn onto a crossing avenue at an intersection.
        if (Math.abs(car.along % 80) < car.speed * dt && Math.random() < 0.25) {
          const other = car.axis === 'x' ? 'z' : 'x';
          const newLine = CITY.roads[Math.floor(Math.random() * CITY.roads.length)];
          car.axis = other;
          car.line = newLine;
          car.along = car.axis === 'x' ? car.mesh.position.z : car.mesh.position.x;
        }
        const lane = 2.2;
        if (car.axis === 'x') {
          car.mesh.position.set(car.along, 0, car.line + lane * car.dir);
          car.heading = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          car.mesh.position.set(car.line + lane * car.dir, 0, car.along);
          car.heading = car.dir > 0 ? Math.PI : 0;
        }
        car.mesh.rotation.y = car.heading;
        for (const w of car.mesh.userData.wheels) w.rotation.x += (car.speed * dt) / 0.42;
      }
    },
  };
}

/** Police: patrol cars that spawn near the player and chase, plus a helicopter. */
export function createPolice(scene) {
  const cars = [];
  const heliGroup = new THREE.Group();
  const heliBody = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 1.6, 5),
    new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.4, metalness: 0.4 }),
  );
  heliBody.castShadow = true;
  heliGroup.add(heliBody);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.1, 0.5), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  rotor.position.y = 1.1;
  heliGroup.add(rotor);
  const spot = new THREE.SpotLight(0xfff2c0, 80, 90, 0.35, 0.5);
  spot.position.set(0, -0.5, 0);
  heliGroup.add(spot);
  heliGroup.add(spot.target);
  heliGroup.visible = false;
  scene.add(heliGroup);
  let heliAngle = 0;

  return {
    cars,
    heli: heliGroup,
    count() {
      return cars.length;
    },
    /** Spawn (or remove) patrol cars so the count matches `wanted`. */
    setCount(wanted, nearX, nearZ) {
      const want = Math.min(wanted, 5);
      while (cars.length < want) {
        const mesh = makeCarMesh('police', 0x1c2733);
        scene.add(mesh);
        const angle = Math.random() * Math.PI * 2;
        const dist = 35 + Math.random() * 25;
        cars.push({
          mesh,
          x: nearX + Math.cos(angle) * dist,
          z: nearZ + Math.sin(angle) * dist,
          heading: angle,
          speed: 0,
          sirenPhase: Math.random() * 6,
        });
      }
      while (cars.length > want) {
        const car = cars.pop();
        scene.remove(car.mesh);
      }
      heliGroup.visible = wanted >= 4;
    },
    clear() {
      while (cars.length > 0) {
        const car = cars.pop();
        scene.remove(car.mesh);
      }
      heliGroup.visible = false;
    },
    /**
     * Chase the target. Returns { bust: 0..1 progress, ram: {x,z} impulse }.
     * `target` is {x, z, onFoot, speed}.
     */
    update(dt, target) {
      let bust = 0;
      let ramX = 0;
      let ramZ = 0;
      for (const car of cars) {
        const dx = target.x - car.x;
        const dz = target.z - car.z;
        const dist = Math.hypot(dx, dz) || 1;
        const wantHeading = Math.atan2(dx, dz);
        car.heading += clamp(angleDiff(car.heading, wantHeading), -2.4 * dt, 2.4 * dt);
        const topSpeed = target.onFoot ? 16 : CAR.maxSpeed + 3;
        car.speed = clamp(car.speed + (topSpeed - car.speed) * dt * 0.8, 0, topSpeed);
        car.x += Math.sin(car.heading) * car.speed * dt;
        car.z += Math.cos(car.heading) * car.speed * dt;
        car.mesh.position.set(car.x, 0, car.z);
        car.mesh.rotation.y = car.heading;
        for (const w of car.mesh.userData.wheels) w.rotation.x += (car.speed * dt) / 0.42;
        car.sirenPhase += dt * 6;
        const bar = car.mesh.children.find((c) => c.geometry && c.geometry.type === 'BoxGeometry' && c.position.y > 1.7);
        if (bar) bar.material.color.setHex(Math.sin(car.sirenPhase) > 0 ? 0xff2222 : 0x2266ff);
        if (dist < 4.5) {
          if (target.onFoot) {
            bust = Math.max(bust, dt);
          } else {
            // Ram the player's car sideways.
            ramX += (dx / dist) * 6 * dt;
            ramZ += (dz / dist) * 6 * dt;
          }
        }
      }
      if (heliGroup.visible) {
        heliAngle += dt * 0.35;
        heliGroup.position.set(target.x + Math.cos(heliAngle) * 26, 42, target.z + Math.sin(heliAngle) * 26);
        heliGroup.lookAt(target.x, 0, target.z);
        rotor.rotation.y += dt * 18;
        spot.target.position.set(target.x - heliGroup.position.x, -42, target.z - heliGroup.position.z);
      }
      return { bust, ramX, ramZ };
    },
  };
}
