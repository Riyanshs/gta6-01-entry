// People: pedestrians strolling the sidewalks of Verde Bay, and the Los
// Tiburones gang members who show up in the combat missions.

import * as THREE from 'three';
import { CITY } from './config.js';
import { dist2d } from './random.js';

/** A low-poly person: torso, head, legs that swing while walking. */
export function makePersonMesh(shirt, pants) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.8 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.36), shirtMat);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 10), skin);
  head.position.y = 1.78;
  head.castShadow = true;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.22), pantsMat);
  legL.position.set(-0.16, 0.38, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), shirtMat);
  armL.position.set(-0.42, 1.15, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  group.add(armR);
  group.userData = { legL, legR, armL, armR };
  return group;
}

const SHIRTS = [0xf2e3c6, 0x7fb3d5, 0x6fbf73, 0xe8b04b, 0x9b7ec4, 0xd96a4f, 0xffffff];

/** Pedestrians wander the sidewalks, cross at corners, and flee from gunfire. */
export function createPedestrians(scene, rng) {
  const peds = [];
  for (let i = 0; i < 16; i += 1) {
    const mesh = makePersonMesh(SHIRTS[i % SHIRTS.length], 0x2c3542);
    scene.add(mesh);
    peds.push({
      mesh,
      x: rng.range(-180, 180),
      z: rng.range(-180, 180),
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.0, 1.8),
      flee: 0,
      bob: rng.range(0, 6),
    });
  }
  return {
    peds,
    update(dt, danger) {
      for (const ped of peds) {
        if (danger && dist2d(ped.x, ped.z, danger.x, danger.z) < 18) ped.flee = 2.5;
        if (ped.flee > 0) {
          ped.flee -= dt;
          const away = Math.atan2(ped.x - danger.x, ped.z - danger.z);
          ped.heading = away;
          ped.speed = 4.2;
        } else {
          ped.speed = 1.4;
          if (Math.random() < dt * 0.08) ped.heading += (Math.random() - 0.5) * 1.6;
        }
        ped.x += Math.sin(ped.heading) * ped.speed * dt;
        ped.z += Math.cos(ped.heading) * ped.speed * dt;
        ped.x = Math.max(-195, Math.min(195, ped.x));
        ped.z = Math.max(-195, Math.min(195, ped.z));
        ped.bob += dt * ped.speed * 4;
        ped.mesh.position.set(ped.x, 0, ped.z);
        ped.mesh.rotation.y = ped.heading;
        const swing = Math.sin(ped.bob) * 0.45;
        ped.mesh.userData.legL.rotation.x = swing;
        ped.mesh.userData.legR.rotation.x = -swing;
        ped.mesh.userData.armL.rotation.x = -swing;
        ped.mesh.userData.armR.rotation.x = swing;
      }
    },
  };
}

/** Gang enemies: they hold a spot, close in when the player is near, and shoot. */
export function createEnemies(scene) {
  const list = [];
  return {
    list,
    spawn(count, x, z) {
      for (let i = 0; i < count; i += 1) {
        const mesh = makePersonMesh(0xc0392b, 0x1c2733);
        mesh.position.set(x + (Math.random() - 0.5) * 14, 0, z + (Math.random() - 0.5) * 14);
        scene.add(mesh);
        list.push({ mesh, x: mesh.position.x, z: mesh.position.z, health: 50, shootTimer: 1 + Math.random(), alive: true });
      }
    },
    clear() {
      for (const e of list) scene.remove(e.mesh);
      list.length = 0;
    },
    aliveCount() {
      return list.filter((e) => e.alive).length;
    },
    /**
     * Enemies advance and fire. Returns the damage dealt to the player this frame.
     */
    update(dt, px, pz) {
      let damage = 0;
      for (const e of list) {
        if (!e.alive) continue;
        const d = dist2d(e.x, e.z, px, pz);
        if (d < 42) {
          const heading = Math.atan2(px - e.x, pz - e.z);
          e.mesh.rotation.y = heading;
          if (d > 12) {
            e.x += Math.sin(heading) * 3.2 * dt;
            e.z += Math.cos(heading) * 3.2 * dt;
          }
          e.shootTimer -= dt;
          if (e.shootTimer <= 0 && d < 34) {
            e.shootTimer = 1.1 + Math.random() * 0.7;
            if (Math.random() < 0.45) damage += 6;
          }
        }
        e.mesh.position.set(e.x, 0, e.z);
      }
      return damage;
    },
    /** Player shot: nearest alive enemy within range and roughly in front. Returns the enemy hit or null. */
    hitTest(px, pz, heading, range) {
      let best = null;
      let bestD = range;
      for (const e of list) {
        if (!e.alive) continue;
        const d = dist2d(e.x, e.z, px, pz);
        if (d > range) continue;
        const ang = Math.atan2(e.x - px, e.z - pz);
        let diff = Math.abs(ang - heading);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff < 0.35 && d < bestD) {
          best = e;
          bestD = d;
        }
      }
      return best;
    },
  };
}
