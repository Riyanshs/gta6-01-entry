// Verde Bay itself: sunset sky, ocean and beach to the south, a grid of avenues
// and streets, buildings with lit windows, palms, lamps, the marina and pier,
// the safehouse and the gun shop. All geometry is procedural three.js boxes and
// cylinders with canvas-painted textures — no imported art.

import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';

/** A facade texture: coloured wall with a grid of glowing windows. */
function facadeTexture(base, rng) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(0, 0, 128, 10);
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const lit = rng.next() < 0.55;
      g.fillStyle = lit ? '#ffd98a' : '#2c3542';
      g.fillRect(14 + col * 28, 26 + row * 28, 18, 16);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A shop / sign texture with painted text. */
function signTexture(text, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = fg;
  g.font = 'bold 64px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function box(w, h, d, color, x, y, z, opts) {
  const mat = opts && opts.map
    ? new THREE.MeshStandardMaterial({ map: opts.map, roughness: 0.9 })
    : new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Build the city into `scene`. Returns colliders (building AABBs), road lines for
 * traffic, and the key places (safehouse, shop, marina, pier, warehouse, bank).
 */
export function buildCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // Sunset sky + fog.
  scene.background = new THREE.Color(0xff9e5e);
  scene.fog = new THREE.Fog(0xff9e5e, 180, 520);

  const hemi = new THREE.HemisphereLight(0xffd9a0, 0x3a4a6b, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.2);
  sun.position.set(-120, 90, -160);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220;
  sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 600;
  scene.add(sun);
  const sunBall = new THREE.Mesh(
    new THREE.SphereGeometry(14, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }),
  );
  sunBall.position.set(-260, 55, -380);
  scene.add(sunBall);

  // Ground, beach and ocean.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2 + 80, CITY.half * 2 + 80),
    new THREE.MeshStandardMaterial({ color: PALETTE.grass, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -20;
  ground.receiveShadow = true;
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2 + 80, 70),
    new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, CITY.beachZ + 15);
  sand.receiveShadow = true;
  group.add(sand);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 300),
    new THREE.MeshStandardMaterial({ color: PALETTE.ocean, roughness: 0.25, metalness: 0.1 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.05, CITY.oceanZ + 120);
  group.add(ocean);

  // Roads: dark strips along every road line, with sidewalk borders.
  const roadMat = new THREE.MeshStandardMaterial({ color: PALETTE.asphalt, roughness: 1 });
  const walkMat = new THREE.MeshStandardMaterial({ color: PALETTE.sidewalk, roughness: 1 });
  for (const line of CITY.roads) {
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadWidth, CITY.half * 2), roadMat);
    ns.rotation.x = -Math.PI / 2;
    ns.position.set(line, 0.03, 0);
    ns.receiveShadow = true;
    group.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2, CITY.roadWidth), roadMat);
    ew.rotation.x = -Math.PI / 2;
    ew.position.set(0, 0.03, line);
    ew.receiveShadow = true;
    group.add(ew);
    const nsWalk = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadWidth + 6, CITY.half * 2), walkMat);
    nsWalk.rotation.x = -Math.PI / 2;
    nsWalk.position.set(line, 0.015, 0);
    group.add(nsWalk);
    const ewWalk = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2, CITY.roadWidth + 6), walkMat);
    ewWalk.rotation.x = -Math.PI / 2;
    ewWalk.position.set(0, 0.015, line);
    group.add(ewWalk);
    // Centre dashes.
    for (let t = -190; t <= 190; t += 16) {
      const dash = new THREE.Mesh(
        new THREE.PlaneGeometry(0.6, 4),
        new THREE.MeshBasicMaterial({ color: 0xf2c94c }),
      );
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(line, 0.05, t);
      group.add(dash);
      const dash2 = dash.clone();
      dash2.position.set(t, 0.05, line);
      dash2.rotation.z = Math.PI / 2;
      group.add(dash2);
    }
  }

  // Buildings: one per block, varied heights and colours, windows glowing.
  const paletteHex = ['#e8b04b', '#d96a4f', '#7fb3d5', '#f2e3c6', '#9b7ec4', '#6fbf73'];
  for (let ix = 0; ix < CITY.roads.length - 1; ix += 1) {
    for (let iz = 0; iz < CITY.roads.length - 1; iz += 1) {
      const cx = (CITY.roads[ix] + CITY.roads[ix + 1]) / 2;
      const cz = (CITY.roads[iz] + CITY.roads[iz + 1]) / 2;
      if (cz > 160) continue; // beach stays open
      const w = rng.range(22, 34);
      const d = rng.range(22, 34);
      const h = rng.range(14, 52);
      const tex = facadeTexture(paletteHex[Math.floor(rng.next() * paletteHex.length)], rng);
      const b = box(w, h, d, 0xffffff, cx, h / 2, cz, { map: tex });
      group.add(b);
      colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
      // Rooftop box.
      group.add(box(w * 0.3, 3, d * 0.3, 0x555c66, cx, h + 1.5, cz));
    }
  }

  // Palm trees along the beach and avenues.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6b48, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f9e4d, roughness: 1 });
  function palm(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 9, 6), trunkMat);
    trunk.position.set(x, 4.5, z);
    trunk.castShadow = true;
    group.add(trunk);
    for (let i = 0; i < 5; i += 1) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 5, 4), leafMat);
      const a = (i / 5) * Math.PI * 2;
      leaf.position.set(x + Math.cos(a) * 1.6, 9.6, z + Math.sin(a) * 1.6);
      leaf.rotation.z = Math.cos(a) * 0.9;
      leaf.rotation.x = -Math.sin(a) * 0.9;
      group.add(leaf);
    }
  }
  for (let x = -190; x <= 190; x += 24) palm(x, 178);
  for (const line of CITY.roads) {
    palm(line + 10, -170);
    palm(line - 10, 170);
  }

  // Street lamps.
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x2c3542, roughness: 0.6, metalness: 0.4 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const line of CITY.roads) {
    for (const t of [-120, -40, 40, 120]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), lampMat);
      pole.position.set(line + 7, 3, t);
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), glowMat);
      bulb.position.set(line + 7, 6.2, t);
      group.add(bulb);
    }
  }

  // Safehouse: a small white house with a red roof and a garage.
  const sh = CITY.safehouse;
  group.add(box(14, 7, 10, 0xf2e3c6, sh.x, 3.5, sh.z));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(11, 4, 4), new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.9 }));
  roof.position.set(sh.x, 9, sh.z);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);
  const shSign = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 2.5),
    new THREE.MeshBasicMaterial({ map: signTexture('SAFEHOUSE', '#2e86ff', '#ffffff') }),
  );
  shSign.position.set(sh.x, 6.2, sh.z - 5.2);
  group.add(shSign);
  colliders.push({ minX: sh.x - 7, maxX: sh.x + 7, minZ: sh.z - 5, maxZ: sh.z + 5 });

  // Gun shop "VERDE ARMS" with a yellow sign.
  const sp = CITY.shop;
  group.add(box(16, 8, 12, 0x3a3f47, sp.x, 4, sp.z));
  const shopSign = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 3.5),
    new THREE.MeshBasicMaterial({ map: signTexture('VERDE ARMS', '#f2c94c', '#1c2733') }),
  );
  shopSign.position.set(sp.x, 7, sp.z - 6.2);
  group.add(shopSign);
  colliders.push({ minX: sp.x - 8, maxX: sp.x + 8, minZ: sp.z - 6, maxZ: sp.z + 6 });

  // Bank, warehouse, marina and pier.
  group.add(box(20, 16, 14, 0xdfe6ee, CITY.bank.x, 8, CITY.bank.z));
  colliders.push({ minX: CITY.bank.x - 10, maxX: CITY.bank.x + 10, minZ: CITY.bank.z - 7, maxZ: CITY.bank.z + 7 });
  const bankSign = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 3),
    new THREE.MeshBasicMaterial({ map: signTexture('BANK OF VERDE', '#dfe6ee', '#1c2733') }),
  );
  bankSign.position.set(CITY.bank.x, 13, CITY.bank.z - 7.2);
  group.add(bankSign);

  group.add(box(24, 10, 16, 0x8a6b48, CITY.warehouse.x, 5, CITY.warehouse.z));
  colliders.push({ minX: CITY.warehouse.x - 12, maxX: CITY.warehouse.x + 12, minZ: CITY.warehouse.z - 8, maxZ: CITY.warehouse.z + 8 });

  // Pier: wooden deck into the sand, with a lighthouse at the marina.
  const pier = box(8, 1, 26, 0x8a6b48, CITY.pier.x, 0.6, CITY.pier.z);
  group.add(pier);
  const light = new THREE.Mesh(
    new THREE.CylinderGeometry(2, 3, 18, 10),
    new THREE.MeshStandardMaterial({ color: 0xf2e3c6, roughness: 0.8 }),
  );
  light.position.set(CITY.marina.x, 9, CITY.marina.z - 12);
  light.castShadow = true;
  group.add(light);
  const lightTop = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.4, 3, 10),
    new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.8 }),
  );
  lightTop.position.set(CITY.marina.x, 19, CITY.marina.z - 12);
  group.add(lightTop);

  return { colliders, group };
}
