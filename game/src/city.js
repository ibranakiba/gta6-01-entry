// Crown Bay — city.js rewritten in recorded session fix7, 18 Nov 2026.
// Crown Bay itself: the 10x10 block grid, its three districts, landmarks,
// roads and sidewalks, traffic lights, street lamps, trees, the beach and sea,
// the airfield, the port, and the Club Lumen interior (built off-map and shown
// only while the player is inside). Returns the colliders, the road graph,
// landmark doors and the animated bits (trees, water, lights) the world ticks.
import * as THREE from 'three';
import { CITY, DISTRICTS, LANDMARKS, PALETTE, STREET_CENTERS } from './config.js';

// Harbor Bridge + Crown Pier (user request 18 Nov, GTA 5 style): the bridge
// runs east along street z = 58 from the city edge over the sea to
// Lighthouse Island; the pier runs east along z = 87 from Crown Beach with
// a ferris wheel at its end. Both are REAL drivable/walkable ground: deck
// heights come from groundHeightAt(), and the sea beyond the city is only
// passable on the bridge road, the island, the pier and the wheel platform
// (eastMaxX()).
export const BRIDGE = {
  z: 58, halfW: 7,
  x0: 292, x1: 470, deckY: 8,
  rampUpEnd: 360, rampDownStart: 420,
  islandX: 470, islandZ: 58, islandR: 34,
};
export const PIER = {
  z: 87, halfW: 4.5,
  x0: 316, x1: 368, deckY: 1.2,
  wheelX: 360, wheelZ: 87, wheelR: 15, hubY: 21,
};

// Ground height at (x, z): 0 everywhere except the bridge road (ramps up
// 292 -> 360, flat deck 360 -> 420, ramps down to the island), the island
// sand and the pier deck. The deck meshes are built to follow this profile
// exactly, so wheels never sink into or float above the road.
export function groundHeightAt(x, z) {
  if (Math.abs(z - BRIDGE.z) <= BRIDGE.halfW) {
    if (x >= BRIDGE.x0 && x < BRIDGE.rampUpEnd) return BRIDGE.deckY * (x - BRIDGE.x0) / (BRIDGE.rampUpEnd - BRIDGE.x0);
    if (x >= BRIDGE.rampUpEnd && x <= BRIDGE.rampDownStart) return BRIDGE.deckY;
    if (x > BRIDGE.rampDownStart && x <= BRIDGE.x1) return 0.12 + (BRIDGE.deckY - 0.12) * (BRIDGE.x1 - x) / (BRIDGE.x1 - BRIDGE.rampDownStart);
  }
  const idx = x - BRIDGE.islandX, idz = z - BRIDGE.islandZ;
  if (idx * idx + idz * idz <= BRIDGE.islandR * BRIDGE.islandR) return 0.12;
  if (Math.abs(z - PIER.z) <= PIER.halfW) {
    if (x >= PIER.x0 && x < 324) return PIER.deckY * (x - PIER.x0) / (324 - PIER.x0);
    if (x >= 324 && x <= PIER.x1) return PIER.deckY;
  }
  return 0;
}

// How far east a move from (curX, curZ) to (nx, nz) may go. Inside the
// city the waterline (seaX - 2) is the wall; east of it only the bridge
// road, the island, the pier and the wheel platform are passable. The
// prospective position decides, so crossing the waterline onto the bridge
// works — and an entity already east but off-region (e.g. fell off the
// bridge into the sea) is frozen in place eastward instead of snapping
// back to shore.
function regionCap(x, z) {
  if (Math.abs(z - BRIDGE.z) <= BRIDGE.halfW + 0.5 && x >= 288 && x <= BRIDGE.x1 + 8) return BRIDGE.islandX + BRIDGE.islandR;
  const idx = x - BRIDGE.islandX, idz = z - BRIDGE.islandZ;
  if (idx * idx + idz * idz <= (BRIDGE.islandR + 3) * (BRIDGE.islandR + 3)) return BRIDGE.islandX + BRIDGE.islandR;
  if (Math.abs(z - PIER.z) <= PIER.halfW + 0.5 && x >= 310 && x <= PIER.x1 + 6) return PIER.x1 + 6;
  const px = x - PIER.wheelX, pz = z - PIER.wheelZ;
  if (px * px + pz * pz <= 100) return PIER.x1 + 6;
  return null;
}
export function eastMaxX(curX, curZ, nx, nz) {
  const cap = regionCap(nx, nz);
  if (cap !== null) return cap;
  if (curX <= CITY.seaX - 2) return CITY.seaX - 2;
  return curX;
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Facade: dark glass with lit windows that glow at night via emissiveMap.
// The daytime map and the emissive map both keep warm-yellow lit windows
// only (user asked 18 Nov: yellow like before, not colourful) — the
// emissive palette is warm yellows, varying in brightness. Unlit windows
// stay black in the emissive map.
const WINDOW_GLOW = ['#ffd98a', '#ffe9b8', '#ffb35a', '#ffcf6e', '#ffd98a', '#ffdf9e'];
function facadeTexture(base, lit, colorful = false) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 8; y += 20) {
      for (let x = 8; x < w - 8; x += 16) {
        if (lit && Math.random() < 0.45) {
          g.fillStyle = colorful ? WINDOW_GLOW[Math.floor(Math.random() * WINDOW_GLOW.length)] : '#ffd98a';
        } else {
          g.fillStyle = colorful ? '#000000' : '#1c2733';
        }
        g.fillRect(x, y, 10, 12);
      }
    }
  });
}

function signTexture(text, bg, fg, sub) {
  return canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = fg;
    g.font = 'bold 52px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, sub ? h / 2 - 16 : h / 2);
    if (sub) {
      g.font = '28px system-ui, sans-serif';
      g.fillText(sub, w / 2, h / 2 + 34);
    }
  });
}

function sandTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#d8c08a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i += 1) {
      const v = Math.random();
      g.fillStyle = v < 0.5 ? 'rgba(180,150,100,0.5)' : 'rgba(240,220,170,0.5)';
      g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }
    for (let i = 0; i < 24; i += 1) {
      g.fillStyle = 'rgba(255,240,200,0.25)';
      g.fillRect(Math.random() * w, Math.random() * h, 6 + Math.random() * 10, 2);
    }
  });
}

function blockCenter(i) { return -261 + i * 58; }

export function districtOf(bx, bz) {
  if (bx >= 8) return 'waterfront';
  if (bx >= 5 && bz <= 4) return 'downtown';
  if (bz >= 6 && bx <= 4) return 'residential';
  if (bx >= 5) return 'downtown';
  return 'residential';
}

export function buildCity(scene, rng) {
  const colliders = [];          // {x, z, hx, hz} axis-aligned boxes
  const trees = [];              // {canopy, phase, speed}
  const lamps = [];              // bulb meshes to light at night
  const trafficLights = [];      // {group, red, yellow, green, phase, axis}
  const landmarks = new Map();   // name -> {x, z, hx, hz, door:{x,z}, roofY}
  const parkedSpots = [];        // {x, z, angle}
  const sidewalkSpots = [];      // pedestrian waypoints
  const beachSpots = [];         // {x, z, lying} umbrella + towel spots on the sand
  const waves = [];              // foam strips that roll in/out at the waterline
  let waterMesh = null;
  let ferris = null; // {wheel, gondolas, lightMats} — the Crown Pier ferris wheel
  let lighthouseBeam = null; // rotating beam cone on the island lighthouse
  let clubInterior = null;
  let clubDoor = null;
  let heliPad = null;
  let planeSpot = null;
  let leafPoints = null;

  const cityBox = new THREE.BoxGeometry(1, 1, 1);
  const cityCyl = new THREE.CylinderGeometry(1, 1, 1, 8);
  const citySph = new THREE.SphereGeometry(1, 10, 8);
  const cityCone = new THREE.ConeGeometry(1, 1, 8);

  const sandTex = sandTexture();
  sandTex.wrapS = THREE.RepeatWrapping; sandTex.wrapT = THREE.RepeatWrapping;
  sandTex.repeat.set(2, 30);

  const mats = {
    road: new THREE.MeshStandardMaterial({ color: PALETTE.road, roughness: 0.95 }),
    roadWet: new THREE.MeshStandardMaterial({ color: 0x1e2226, roughness: 0.25, metalness: 0.35 }),
    sidewalk: new THREE.MeshStandardMaterial({ color: PALETTE.sidewalk, roughness: 0.9 }),
    grass: new THREE.MeshStandardMaterial({ color: PALETTE.grass, roughness: 1 }),
    sand: new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1 }),
    water: new THREE.MeshStandardMaterial({ color: PALETTE.water, roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.92 }),
    curb: new THREE.MeshStandardMaterial({ color: 0x6a6d70, roughness: 0.9 }),
    pole: new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.6, metalness: 0.6 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x5a3d24, roughness: 1 }),
    trunkPalm: new THREE.MeshStandardMaterial({ color: 0x7a6248, roughness: 1 }),
    leafOak: new THREE.MeshStandardMaterial({ color: 0x3d6b2e, roughness: 1 }),
    leafOak2: new THREE.MeshStandardMaterial({ color: 0x5a8a3a, roughness: 1 }),
    leafPalm: new THREE.MeshStandardMaterial({ color: 0x2e7a4a, roughness: 1 }),
    leafPalm2: new THREE.MeshStandardMaterial({ color: 0x3a9a5a, roughness: 1 }),
    leafPine: new THREE.MeshStandardMaterial({ color: 0x1e4a2e, roughness: 1 }),
    leafPine2: new THREE.MeshStandardMaterial({ color: 0x2e6a3e, roughness: 1 }),
    white: new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.8 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1a1d20, roughness: 0.8 }),
    runway: new THREE.MeshStandardMaterial({ color: 0x22262a, roughness: 0.95 }),
  };

  function addBox(mat, x, y, z, sx, sy, sz, opts = {}) {
    const m = new THREE.Mesh(cityBox, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    if (opts.ry) m.rotation.y = opts.ry;
    m.castShadow = opts.shadow !== false;
    m.receiveShadow = true;
    (opts.parent || scene).add(m);
    return m;
  }
  function addCyl(mat, x, y, z, rTop, rBot, h, opts = {}) {
    const m = new THREE.Mesh(cityCyl, mat);
    m.position.set(x, y, z);
    m.scale.set(rTop, h, rBot);
    if (opts.ry) m.rotation.y = opts.ry;
    m.castShadow = opts.shadow !== false;
    (opts.parent || scene).add(m);
    return m;
  }
  // A box / cylinder stretched between two points (bridge cables, railings,
  // ferris-wheel legs): length along Y, rotated so +Y points from a to b.
  function beamBox(a, b, w, mat, opts = {}) {
    const dir = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
    const len = dir.length();
    const m = new THREE.Mesh(cityBox, mat);
    m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    m.scale.set(w, len, w);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    m.castShadow = opts.shadow !== false;
    m.receiveShadow = true;
    (opts.parent || scene).add(m);
    return m;
  }
  function beamCyl(a, b, r, mat, opts = {}) {
    const dir = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
    const len = dir.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 6), mat);
    m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    m.scale.set(1, len, 1);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    m.castShadow = false;
    (opts.parent || scene).add(m);
    return m;
  }

  // ---- ground: grass base, city slab, beach, sea ----
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), mats.grass);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(20, -0.05, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  const slab = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2 + 14, CITY.half * 2 + 14), mats.sidewalk);
  slab.rotation.x = -Math.PI / 2;
  slab.position.set(0, 0.01, 0);
  slab.receiveShadow = true;
  scene.add(slab);

  const beach = new THREE.Mesh(new THREE.PlaneGeometry(40, CITY.half * 2 + 14), mats.sand);
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(CITY.beachX + 12, 0.02, 0);
  beach.receiveShadow = true;
  scene.add(beach);

  // wet sand at the waterline + rolling foam: the shore reads as a beach,
  // not a flat yellow strip next to a blue plane
  const wetSand = new THREE.Mesh(new THREE.PlaneGeometry(9, CITY.half * 2 + 14),
    new THREE.MeshStandardMaterial({ color: 0xb89a68, roughness: 0.55 }));
  wetSand.rotation.x = -Math.PI / 2;
  wetSand.position.set(320, 0.03, 0);
  wetSand.receiveShadow = true;
  scene.add(wetSand);

  for (let i = 0; i < 3; i += 1) {
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(2.2, CITY.half * 2 + 14),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 - i * 0.14 }));
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(324 + i * 3.5, 0.06 + i * 0.005, 0);
    scene.add(foam);
    waves.push({ mesh: foam, baseX: 324 + i * 3.5, phase: i * 2.1 });
  }

  waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(300, 900), mats.water);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(CITY.seaX + 160, 0.05, 0);
  waterMesh.receiveShadow = true;
  scene.add(waterMesh);

  // ---- roads: dark strips along every street, centre dashes, crosswalks ----
  const roadMats = [];
  for (const c of STREET_CENTERS) {
    const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2 + 14, CITY.road), mats.road);
    hRoad.rotation.x = -Math.PI / 2; hRoad.position.set(0, 0.03, c); hRoad.receiveShadow = true;
    scene.add(hRoad); roadMats.push(hRoad);
    const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(CITY.road, CITY.half * 2 + 14), mats.road);
    vRoad.rotation.x = -Math.PI / 2; vRoad.position.set(c, 0.03, 0); vRoad.receiveShadow = true;
    scene.add(vRoad); roadMats.push(vRoad);
    // centre dashes: thin (0.3 wide) and short (3 long), running WITH the road
    // so they read as lane paint, not slabs. One geometry per axis.
    const dashMat = new THREE.MeshBasicMaterial({ color: PALETTE.roadLine });
    const hDashGeo = new THREE.PlaneGeometry(3, 0.3); // east-west road: long in x
    const vDashGeo = new THREE.PlaneGeometry(0.3, 3); // north-south road: long in z
    for (let d = -CITY.half; d < CITY.half; d += 12) {
      if (Math.abs(d - c) < 8) continue; // keep intersections clear
      const d1 = new THREE.Mesh(hDashGeo, dashMat);
      d1.rotation.x = -Math.PI / 2; d1.position.set(d, 0.05, c); scene.add(d1);
      const d2 = new THREE.Mesh(vDashGeo, dashMat);
      d2.rotation.x = -Math.PI / 2; d2.position.set(c, 0.05, d); scene.add(d2);
    }
  }
  // crosswalks at every intersection: one textured plane per approach, with
  // seven thin, evenly spaced stripes running WITH traffic and spanning the
  // road width exactly (12 of the 14-wide road), placed just clear of the
  // crossing street so they sit flat on the asphalt, never on the sidewalk.
  function crosswalkTexture(vertical) {
    return canvasTexture(128, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#e8e8e8';
      const bars = 7;
      const gap = (vertical ? w : h) / bars;
      for (let i = 0; i < bars; i += 1) {
        if (vertical) g.fillRect(Math.round(i * gap + 4), 4, Math.round(gap - 8), h - 8);
        else g.fillRect(4, Math.round(i * gap + 4), w - 8, Math.round(gap - 8));
      }
    });
  }
  const crossTexH = crosswalkTexture(false); // stripes long in x, for roads along x
  const crossTexV = crosswalkTexture(true);  // stripes long in z, for roads along z
  const crossMatH = new THREE.MeshBasicMaterial({ map: crossTexH, transparent: true });
  const crossMatV = new THREE.MeshBasicMaterial({ map: crossTexV, transparent: true });
  const crossGeoH = new THREE.PlaneGeometry(4.5, 12); // crosses the east-west road
  const crossGeoV = new THREE.PlaneGeometry(12, 4.5); // crosses the north-south road
  for (const cx of STREET_CENTERS) {
    for (const cz of STREET_CENTERS) {
      const east = new THREE.Mesh(crossGeoH, crossMatH);
      east.rotation.x = -Math.PI / 2; east.position.set(cx + 10, 0.05, cz); scene.add(east);
      const west = new THREE.Mesh(crossGeoH, crossMatH);
      west.rotation.x = -Math.PI / 2; west.position.set(cx - 10, 0.05, cz); scene.add(west);
      const north = new THREE.Mesh(crossGeoV, crossMatV);
      north.rotation.x = -Math.PI / 2; north.position.set(cx, 0.05, cz - 10); scene.add(north);
      const south = new THREE.Mesh(crossGeoV, crossMatV);
      south.rotation.x = -Math.PI / 2; south.position.set(cx, 0.05, cz + 10); scene.add(south);
    }
  }

  // ---- traffic lights at every intersection ----
  const lightMats = {
    red: new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2211, emissiveIntensity: 0 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0x332200, emissive: 0xffbb00, emissiveIntensity: 0 }),
    green: new THREE.MeshStandardMaterial({ color: 0x002200, emissive: 0x22ff66, emissiveIntensity: 0 }),
  };
  for (let i = 0; i < STREET_CENTERS.length; i += 1) {
    for (let j = 0; j < STREET_CENTERS.length; j += 1) {
      const cx = STREET_CENTERS[i], cz = STREET_CENTERS[j];
      const group = new THREE.Group();
      group.position.set(cx + 8.5, 0, cz + 8.5);
      const pole = new THREE.Mesh(cityCyl, mats.pole);
      pole.scale.set(0.12, 5.2, 0.12); pole.position.y = 2.6; pole.castShadow = true;
      group.add(pole);
      const head = new THREE.Mesh(cityBox, mats.dark);
      head.scale.set(0.7, 1.9, 0.5); head.position.set(0, 5.6, 0);
      group.add(head);
      const mk = (mat, y) => {
        const s = new THREE.Mesh(citySph, mat);
        s.scale.setScalar(0.22); s.position.set(0, y, 0.28);
        group.add(s); return s;
      };
      const red = mk(lightMats.red.clone(), 6.15);
      const yellow = mk(lightMats.yellow.clone(), 5.6);
      const green = mk(lightMats.green.clone(), 5.05);
      scene.add(group);
      trafficLights.push({ group, red, yellow, green, phase: (i * 3 + j * 5) % 20, x: cx, z: cz });
      colliders.push({ x: cx + 8.5, z: cz + 8.5, hx: 0.3, hz: 0.3 });
    }
  }

  // ---- street lamps along the roads ----
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffdf8a, emissiveIntensity: 0 });
  for (const c of STREET_CENTERS) {
    for (let d = -CITY.half + 20; d < CITY.half; d += 58) {
      for (const [x, z] of [[c + 7.6, d], [c - 7.6, d + 29]]) {
        const g = new THREE.Group();
        g.position.set(x, 0, z);
        const pole = new THREE.Mesh(cityCyl, mats.pole);
        pole.scale.set(0.09, 6.4, 0.09); pole.position.y = 3.2; pole.castShadow = true;
        g.add(pole);
        const arm = new THREE.Mesh(cityBox, mats.pole);
        arm.scale.set(0.1, 0.1, 1.6); arm.position.set(0, 6.3, 0.7);
        g.add(arm);
        const bulb = new THREE.Mesh(citySph, bulbMat.clone());
        bulb.scale.setScalar(0.28); bulb.position.set(0, 6.2, 1.4);
        g.add(bulb);
        scene.add(g);
        lamps.push(bulb);
        colliders.push({ x, z, hx: 0.25, hz: 0.25 });
      }
    }
  }

  // ---- trees: palm, oak, pine — textured trunks, full canopies, swaying ----
  function makeTree(x, z, kind) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    let canopy;
    if (kind === 'palm') {
      const trunk = new THREE.Mesh(cityCyl, mats.trunkPalm);
      trunk.scale.set(0.22, 7, 0.3); trunk.position.y = 3.5; trunk.castShadow = true;
      g.add(trunk);
      canopy = new THREE.Group();
      for (let i = 0; i < 7; i += 1) {
        const frond = new THREE.Mesh(cityCone, rng.pick([mats.leafPalm, mats.leafPalm2]));
        frond.scale.set(0.5, 3.4, 0.12);
        frond.position.set(Math.cos(i * 0.9) * 1.4, 7.1, Math.sin(i * 0.9) * 1.4);
        frond.rotation.z = Math.cos(i * 0.9) * 1.15;
        frond.rotation.x = -Math.sin(i * 0.9) * 1.15;
        canopy.add(frond);
      }
      g.add(canopy);
    } else if (kind === 'pine') {
      const trunk = new THREE.Mesh(cityCyl, mats.trunk);
      trunk.scale.set(0.28, 3, 0.34); trunk.position.y = 1.5; trunk.castShadow = true;
      g.add(trunk);
      canopy = new THREE.Group();
      for (let i = 0; i < 3; i += 1) {
        const cone = new THREE.Mesh(cityCone, rng.pick([mats.leafPine, mats.leafPine2]));
        cone.scale.set(2.2 - i * 0.55, 3.2, 2.2 - i * 0.55);
        cone.position.y = 3.4 + i * 1.9;
        cone.castShadow = true;
        canopy.add(cone);
      }
      g.add(canopy);
    } else {
      const trunk = new THREE.Mesh(cityCyl, mats.trunk);
      trunk.scale.set(0.3, 3.4, 0.36); trunk.position.y = 1.7; trunk.castShadow = true;
      g.add(trunk);
      canopy = new THREE.Group();
      const blobs = [[0, 4.6, 0, 2.1], [1.2, 3.9, 0.6, 1.4], [-1.1, 4.1, -0.5, 1.5], [0.4, 5.6, -0.6, 1.3]];
      const leafMat = rng.pick([mats.leafOak, mats.leafOak2]);
      for (const [bx, by, bz, r] of blobs) {
        const s = new THREE.Mesh(citySph, leafMat);
        s.scale.setScalar(r); s.position.set(bx, by, bz); s.castShadow = true;
        canopy.add(s);
      }
      g.add(canopy);
    }
    scene.add(g);
    trees.push({ canopy, phase: rng.range(0, Math.PI * 2), speed: rng.range(0.5, 1.1) });
    colliders.push({ x, z, hx: 0.35, hz: 0.35 });
    return g;
  }

  // ---- buildings ----
  // Facade materials are cached per (variant, repeat) so windows keep their
  // real size on buildings of any height instead of stretching into stripes.
  // Facade bases: a loud sunset-city mix — brick red, cream, sky blue,
  // pastel pink, mint, terracotta and blue/green glass next to the old greys.
  const facadeBases = ['#5a6a7a', '#3a4a5a', '#7a5a44', '#8a8a7a', '#4a5a6a', '#a44a3a', '#d8c8a8', '#3a6ea5', '#7ab8a0', '#c88a9a', '#5a8a6a', '#b85a2a'];
  const facadeCache = new Map();
  function facadeMatFor(w, h) {
    const variant = Math.abs(Math.floor(w * 7 + h * 13)) % facadeBases.length;
    const rx = Math.max(1, Math.round(w / 14));
    const ry = Math.max(1, Math.round(h / 12));
    const key = `${variant}:${rx}:${ry}`;
    if (facadeCache.has(key)) return facadeCache.get(key);
    const map = facadeTexture(facadeBases[variant], true);
    map.wrapS = THREE.RepeatWrapping; map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(rx, ry);
    const emap = facadeTexture('#000000', true, true);
    emap.wrapS = THREE.RepeatWrapping; emap.wrapT = THREE.RepeatWrapping;
    emap.repeat.set(rx, ry);
    // emissive white: the emissive map carries the window colours itself
    const m = new THREE.MeshStandardMaterial({ map, emissiveMap: emap, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.7 });
    facadeCache.set(key, m);
    return m;
  }
  // (facadeMats is gone: facades come from facadeMatFor, cached by size.)
  const houseMats = [
    new THREE.MeshStandardMaterial({ color: 0xc9a06a, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0xa88a7a, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x8a9a7a, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x7a8aa0, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0xd8b8a0, roughness: 0.9 }), // cream
    new THREE.MeshStandardMaterial({ color: 0xc87a5a, roughness: 0.9 }), // terracotta
    new THREE.MeshStandardMaterial({ color: 0x8aa8c8, roughness: 0.9 }), // pale blue
    new THREE.MeshStandardMaterial({ color: 0xe8d8b0, roughness: 0.9 }), // pale yellow
  ];

  function building(x, z, w, d, h, mat) {
    const m = new THREE.Mesh(cityBox, mat);
    m.position.set(x, h / 2, z);
    m.scale.set(w, h, d);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    colliders.push({ x, z, hx: w / 2, hz: d / 2 });
    // rooftop parapet + AC box
    if (h > 20) {
      const ac = new THREE.Mesh(cityBox, mats.dark);
      ac.scale.set(2.4, 1.1, 2.4);
      ac.position.set(x + w * 0.2, h + 0.55, z);
      ac.castShadow = true;
      scene.add(ac);
    }
    return m;
  }

  function signPlane(text, bg, fg, x, y, z, ry, w, sub) {
    const tex = signTexture(text, bg, fg, sub);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: false });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), mat);
    p.position.set(x, y, z);
    p.rotation.y = ry;
    scene.add(p);
    return p;
  }

  const landmarkByBlock = new Map();
  for (const lm of LANDMARKS) landmarkByBlock.set(`${lm.bx},${lm.bz}`, lm);

  // Per-block construction. A block is 44 wide, so its edge sits 22 from
  // the block centre and the road starts there — nothing built may reach
  // past ±21 from the centre, or it hangs over the asphalt.
  const BLOCK_EDGE = 21;
  for (let bx = 0; bx < 10; bx += 1) {
    for (let bz = 0; bz < 10; bz += 1) {
      const cx = blockCenter(bx), cz = blockCenter(bz);
      const lm = landmarkByBlock.get(`${bx},${bz}`);
      const district = districtOf(bx, bz);
      if (lm) {
        buildLandmark(lm, cx, cz);
        continue;
      }
      if (district === 'residential') {
        // houses with gardens and trees
        const spots = [[-11, -11], [11, -11], [-11, 11], [11, 11]];
        for (const [ox, oz] of spots) {
          if (rng.chance(0.18)) { makeTree(cx + ox, cz + oz, rng.pick(['oak', 'pine', 'palm'])); continue; }
          const h = rng.range(6, 12);
          building(cx + ox, cz + oz, rng.range(12, 16), rng.range(12, 16), h, rng.pick(houseMats));
          // pitched roof
          const roof = new THREE.Mesh(cityCone, mats.dark);
          roof.scale.set(10, 3.2, 10); roof.position.set(cx + ox, h + 1.6, cz + oz);
          roof.rotation.y = Math.PI / 4; roof.castShadow = true;
          scene.add(roof);
          // garden tree kept inside the block: canopy radius ~2.6, so the
          // trunk must stay within ±18 of the block centre.
          if (rng.chance(0.3)) makeTree(cx + ox + 7, cz + oz + 7, 'oak');
        }
        sidewalkSpots.push({ x: cx, z: cz - 20 });
        continue;
      }
      // downtown / waterfront / mixed: 1-2 towers per block
      const count = rng.chance(0.55) ? 2 : 1;
      for (let k = 0; k < count; k += 1) {
        const ox = count === 1 ? 0 : (k === 0 ? -11 : 11);
        const oz = count === 1 ? 0 : (k === 0 ? -9 : 9);
        const d = DISTRICTS[district];
        const h = rng.range(d.minH, d.maxH) * (district === 'downtown' ? 1 : 0.8);
        // Footprint clamped to the room the offset leaves: the old code let
        // a 30-wide tower sit at offset 11, reaching 26 from the centre —
        // 4 m past the block edge, hanging over the road.
        const bw = rng.range(16, Math.min(30, 2 * (BLOCK_EDGE - Math.abs(ox))));
        const bd = rng.range(16, Math.min(30, 2 * (BLOCK_EDGE - Math.abs(oz))));
        building(cx + ox, cz + oz, bw, bd, h, facadeMatFor(bw, h));
      }
      // street trees on the block corners, pulled 1 m in so the canopy
      // (radius ~2.6) clears the road.
      if (rng.chance(0.8)) makeTree(cx - 19, cz - 19, rng.pick(['palm', 'oak']));
      if (rng.chance(0.6)) makeTree(cx + 19, cz + 19, rng.pick(['palm', 'oak']));
      sidewalkSpots.push({ x: cx, z: cz - 21 });
      sidewalkSpots.push({ x: cx + 21, z: cz });
    }
  }

  // ---- Crown Beach furnishing: the sand strip east of x = 292 ----
  // The landmark block (261, 87) is the approach; the real beach gear sits
  // ON the sand (x 298-322), reachable on foot or by car straight off the
  // easternmost road — no building blocks the way.
  {
    const umbrellaColors = [0xc8102e, 0xffd23c, 0x22d8ff, 0xff2ad8, 0xff5a00, 0x3a8a5f];
    const umbrellaSpots = [[308, 140], [310, 78], [300, 92], [313, 104], [306, 118], [308, 150], [300, 130]];
    for (let i = 0; i < umbrellaSpots.length; i += 1) {
      const [ux, uz] = umbrellaSpots[i];
      addCyl(mats.pole, ux, 1.2, uz, 0.08, 0.08, 2.4);
      const umb = new THREE.Mesh(cityCone, new THREE.MeshStandardMaterial({ color: umbrellaColors[i % umbrellaColors.length], roughness: 0.9 }));
      umb.scale.set(2.8, 1.4, 2.8); umb.position.set(ux, 2.9, uz); umb.castShadow = true;
      scene.add(umb);
      colliders.push({ x: ux, z: uz, hx: 0.2, hz: 0.2 });
      beachSpots.push({ x: ux, z: uz, lying: false });
    }
    // beach chairs between the umbrellas
    const chairColors = [0xff5a00, 0x22d8ff, 0xff2ad8, 0x3a8a5f, 0xffd23c];
    const chairSpots = [[305, 70, 0.4], [311, 82, -0.3], [302, 96, 0.9], [314, 108, 0.2], [307, 122, -0.6]];
    for (let i = 0; i < chairSpots.length; i += 1) {
      const [chx, chz, ry] = chairSpots[i];
      const g = new THREE.Group();
      g.position.set(chx, 0, chz); g.rotation.y = ry;
      const fabric = new THREE.MeshStandardMaterial({ color: chairColors[i % chairColors.length], roughness: 0.9 });
      const seat = new THREE.Mesh(cityBox, fabric);
      seat.scale.set(1.7, 0.12, 0.65); seat.position.y = 0.35; seat.castShadow = true; g.add(seat);
      const back = new THREE.Mesh(cityBox, fabric);
      back.scale.set(0.12, 0.9, 0.65); back.position.set(-0.8, 0.75, 0); back.rotation.z = 0.5; back.castShadow = true; g.add(back);
      for (const [lx, lz] of [[-0.7, 0.25], [-0.7, -0.25], [0.7, 0.25], [0.7, -0.25]]) {
        const leg = new THREE.Mesh(cityBox, mats.dark);
        leg.scale.set(0.08, 0.35, 0.08); leg.position.set(lx, 0.17, lz); g.add(leg);
      }
      scene.add(g);
    }
    // surfboards: two lying flat, one stuck upright in the sand
    const surfColors = [0xff2ad8, 0x22d8ff, 0xffd23c];
    const surfSpots = [[318, 70, 0.5], [317, 96, -0.4], [309, 88, 0]];
    for (let i = 0; i < surfSpots.length; i += 1) {
      const [sx, sz, ry] = surfSpots[i];
      const board = new THREE.Mesh(cityBox, new THREE.MeshStandardMaterial({ color: surfColors[i], roughness: 0.6 }));
      if (i === 2) { board.scale.set(0.12, 2.6, 0.7); board.position.set(sx, 1.3, sz); board.rotation.z = 0.25; }
      else { board.scale.set(2.6, 0.08, 0.7); board.position.set(sx, 0.12, sz); board.rotation.y = ry; }
      board.castShadow = true;
      scene.add(board);
    }
    // towels on the sand — the sunbather spots
    const towelColors = [0xff2ad8, 0x22d8ff, 0xffd23c, 0x3a8a5f];
    const towelSpots = [[304, 74], [312, 86], [303, 100], [313, 112]];
    for (let i = 0; i < towelSpots.length; i += 1) {
      const [tx, tz] = towelSpots[i];
      const towel = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.3),
        new THREE.MeshStandardMaterial({ color: towelColors[i], roughness: 1 }));
      towel.rotation.x = -Math.PI / 2; towel.rotation.z = rng.range(-0.4, 0.4);
      towel.position.set(tx, 0.04, tz); towel.receiveShadow = true;
      scene.add(towel);
      beachSpots.push({ x: tx, z: tz, lying: true });
    }
    // lifeguard tower near the waterline
    {
      const lx = 314, lz = 44;
      for (const [ox, oz] of [[-0.8, -0.8], [-0.8, 0.8], [0.8, -0.8], [0.8, 0.8]]) {
        addBox(mats.white, lx + ox, 1.5, lz + oz, 0.18, 3, 0.18);
      }
      addBox(mats.white, lx, 3.1, lz, 2.4, 0.25, 2.4);
      addBox(new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.8 }), lx, 3.6, lz - 0.9, 2.4, 0.5, 0.15);
      const roof = new THREE.Mesh(cityCone, new THREE.MeshStandardMaterial({ color: 0xffd23c, roughness: 0.9 }));
      roof.scale.set(1.9, 1.1, 1.9); roof.position.set(lx, 4.6, lz); roof.castShadow = true;
      scene.add(roof);
      colliders.push({ x: lx, z: lz, hx: 1.2, hz: 1.2 });
    }
    // palms all along the sand strip (not just the landmark block)
    for (let z = -270; z <= 270; z += 45) {
      if (rng.chance(0.75)) makeTree(297 + rng.range(-1, 4), z + rng.range(-8, 8), 'palm');
    }
    // beach waypoints: strollers wander the sand
    for (let z = -240; z <= 240; z += 60) {
      sidewalkSpots.push({ x: 305 + rng.range(-6, 8), z });
    }
  }

  function buildLandmark(lm, cx, cz) {
    const door = { x: cx, z: cz - 22 };
    landmarks.set(lm.name, { x: cx, z: cz, hx: 20, hz: 20, door, roofY: lm.h });
    if (lm.kind === 'spire') {
      building(cx, cz, 34, 34, lm.h, facadeMatFor(34, lm.h));
      const spire = new THREE.Mesh(cityCyl, new THREE.MeshStandardMaterial({ color: 0xc8c8c8, metalness: 0.8, roughness: 0.3 }));
      spire.scale.set(1.2, 26, 1.2); spire.position.set(cx, lm.h + 13, cz); spire.castShadow = true;
      scene.add(spire);
      // helipad on the roof
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 0.6, 24), mats.dark);
      pad.position.set(cx, lm.h + 0.3, cz); pad.receiveShadow = true;
      scene.add(pad);
      const hMark = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshBasicMaterial({ color: 0xffd23c }));
      hMark.rotation.x = -Math.PI / 2; hMark.rotation.z = Math.PI / 4; hMark.position.set(cx, lm.h + 0.65, cz);
      scene.add(hMark);
      heliPad = { x: cx, y: lm.h + 0.7, z: cz };
      signPlane('CROWN SPIRE', '#101820', '#ffd23c', cx, 12, cz - 17.2, 0, 26);
      return;
    }
    if (lm.kind === 'park') {
      // Meridian Park: lawns, pond, paths, benches, old oaks
      const pond = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), mats.water);
      pond.rotation.x = -Math.PI / 2; pond.position.set(cx + 6, 0.04, cz + 4);
      scene.add(pond);
      for (let i = 0; i < 9; i += 1) makeTree(cx + rng.range(-18, 18), cz + rng.range(-18, 18), rng.pick(['oak', 'pine']));
      for (let i = 0; i < 4; i += 1) {
        addBox(mats.dark, cx - 14 + i * 9, 0.5, cz - 14, 3, 0.9, 1);
      }
      signPlane('MERIDIAN PARK', '#1e4a2e', '#d8f0d8', cx, 4, cz - 21, 0, 20);
      return;
    }
    if (lm.kind === 'beach') {
      for (let i = 0; i < 6; i += 1) makeTree(cx + rng.range(-14, 10), cz + rng.range(-18, 18), 'palm');
      const umbrella = new THREE.Mesh(cityCone, new THREE.MeshStandardMaterial({ color: 0xc8102e }));
      umbrella.scale.set(3, 1.6, 3); umbrella.position.set(cx + 8, 2.4, cz - 6);
      scene.add(umbrella);
      addCyl(mats.pole, cx + 8, 1.2, cz - 6, 0.08, 0.08, 2.4);
      signPlane('CROWN BEACH', '#1a5a7a', '#ffffff', cx, 4, cz - 21, 0, 20);
      return;
    }
    if (lm.kind === 'port') {
      // container stacks + cranes + a cargo ship at the quay
      const contColors = [0xc8102e, 0x2a6bc8, 0xe8a800, 0x3a8a5f, 0x8a4a8a];
      for (let i = 0; i < 14; i += 1) {
        const mat = new THREE.MeshStandardMaterial({ color: rng.pick(contColors), roughness: 0.8 });
        const w = rng.range(6, 10);
        addBox(mat, cx + rng.range(-16, 16), 1.3 + Math.floor(rng.next() * 3) * 2.6, cz + rng.range(-16, 16), w, 2.6, 2.6);
        colliders.push({ x: cx, z: cz, hx: 5, hz: 5 });
      }
      for (let i = 0; i < 2; i += 1) {
        const gx = cx - 12 + i * 24;
        addBox(mats.pole, gx, 14, cz + 16, 1.2, 28, 1.2);
        addBox(mats.pole, gx, 26, cz + 6, 1.2, 1.2, 22);
        colliders.push({ x: gx, z: cz + 16, hx: 1, hz: 1 });
      }
      const ship = new THREE.Group();
      ship.position.set(CITY.seaX + 34, 0.4, cz + 10);
      const hull = new THREE.Mesh(cityBox, new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.6 }));
      hull.scale.set(14, 4, 44); hull.position.y = 1; hull.castShadow = true;
      ship.add(hull);
      for (let i = 0; i < 5; i += 1) {
        const c = new THREE.Mesh(cityBox, new THREE.MeshStandardMaterial({ color: rng.pick(contColors) }));
        c.scale.set(10, 3, 6); c.position.set(0, 4.5, -16 + i * 8);
        ship.add(c);
      }
      scene.add(ship);
      signPlane('PORT CROWN', '#101820', '#ffd23c', cx, 6, cz - 21, 0, 20);
      return;
    }
    if (lm.kind === 'airfield') {
      // runway 09/27 along x, hangars, windsock, parked plane spot
      const runway = new THREE.Mesh(new THREE.PlaneGeometry(180, 16), mats.runway);
      runway.rotation.x = -Math.PI / 2; runway.position.set(cx, 0.04, cz + 8);
      runway.receiveShadow = true;
      scene.add(runway);
      const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      for (let d = -80; d < 80; d += 16) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.8), dashMat);
        dash.rotation.x = -Math.PI / 2; dash.position.set(cx + d, 0.06, cz + 8);
        scene.add(dash);
      }
      // Hangars sit INSIDE the airfield block: the old ones at cx-40 and
      // cx-10 straddled the western street (x = -290). Two 20-wide hangars
      // centred at ±11 stay clear of the roads on both sides.
      for (const hx of [-11, 11]) {
        building(cx + hx, cz - 14, 20, 14, 9, mats.white);
      }
      const sock = new THREE.Mesh(cityCone, new THREE.MeshStandardMaterial({ color: 0xe8641a }));
      sock.scale.set(0.8, 3, 0.8); sock.rotation.z = Math.PI / 2; sock.position.set(cx + 60, 8, cz - 8);
      scene.add(sock);
      addCyl(mats.pole, cx + 60, 4, cz - 8, 0.1, 0.1, 8);
      planeSpot = { x: cx - 70, y: 0, z: cz + 8, angle: Math.PI / 2 };
      signPlane('CROWN BAY AIRFIELD', '#101820', '#ffffff', cx, 5, cz - 22, 0, 30);
      return;
    }
    // generic landmark building with a storefront sign
    const h = lm.h || 16;
    const mat = lm.kind === 'hospital' ? mats.white : facadeMatFor(36, h);
    building(cx, cz, 36, 36, h, mat);
    const signBg = {
      hospital: '#ffffff', police: '#1a2a4a', bank: '#1a3a2a', mall: '#3a2a5a', casino: '#5a1a2a',
      club: '#1a0a2a', bar: '#3a2a1a', hotel: '#2a3a5a', cinema: '#1a1a2a', museum: '#2a2a2a',
      university: '#1a3a5a', motel: '#4a2a1a', dealer: '#2a2a2a', garage: '#3a3a3a', gas: '#5a1a1a',
      diner: '#5a3a1a', coffee: '#3a2a1a', mart: '#1a4a2a', pizza: '#5a1a1a', cafe: '#2a3a3a',
      tattoo: '#1a1a1a', gunshop: '#2a2a1a', hall: '#2a3a4a', arena: '#2a1a3a',
    }[lm.kind] || '#222222';
    signPlane(lm.name.toUpperCase(), signBg, '#ffffff', cx, Math.min(h - 2, 10), cz - 18.2, 0, 30, lm.kind === 'hospital' ? 'ST. MARINA GENERAL' : undefined);
    // neon strip on shop fronts — sunset-city glow, one colour per trade
    const shopNeon = {
      mart: 0x22d8ff, pizza: 0xff5a00, cafe: 0xffd23c, coffee: 0xe8a800, diner: 0xff2ad8,
      bar: 0xffaa00, motel: 0x22d8ff, dealer: 0x7a3cff, garage: 0xffaa00, gas: 0xff2211,
      tattoo: 0xff2ad8, gunshop: 0xffd23c, cinema: 0x22d8ff, mall: 0xff2ad8, hotel: 0xffd23c,
      arena: 0x7a3cff, museum: 0x22d8ff, university: 0x2a6bc8, hall: 0xffd23c, bank: 0x22d8ff,
      police: 0x2244ff, hospital: 0xff5a5a,
    };
    if (shopNeon[lm.kind]) {
      const neon = new THREE.Mesh(cityBox, new THREE.MeshStandardMaterial({ color: 0x111111, emissive: shopNeon[lm.kind], emissiveIntensity: 1.4 }));
      neon.scale.set(30, 0.5, 0.5);
      neon.position.set(cx, Math.min(7.5, h - 1.5), cz - 18.2);
      scene.add(neon);
    }
    // roof-edge neon on tall towers — the skyline reads at night
    if (h >= 30) {
      const roofNeon = new THREE.Mesh(cityBox, new THREE.MeshStandardMaterial({ color: 0x111111, emissive: (shopNeon[lm.kind] ?? 0x22d8ff), emissiveIntensity: 1.6 }));
      roofNeon.scale.set(30, 0.5, 0.5);
      roofNeon.position.set(cx, h + 0.5, cz - 18.2);
      scene.add(roofNeon);
    }
    if (lm.kind === 'hospital') {
      const cross = new THREE.Mesh(cityBox, new THREE.MeshStandardMaterial({ color: 0xc8102e, emissive: 0xc8102e, emissiveIntensity: 0.4 }));
      cross.scale.set(4, 1, 1); cross.position.set(cx, h + 1, cz - 18.2);
      scene.add(cross);
      const cross2 = cross.clone(); cross2.scale.set(1, 4, 1); cross2.position.set(cx, h + 1, cz - 18.2);
      scene.add(cross2);
    }
    if (lm.kind === 'club') {
      // neon glow strip + door the player walks through
      const neon = new THREE.Mesh(cityBox, new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff2ad8, emissiveIntensity: 1.6 }));
      neon.scale.set(30, 0.5, 0.5); neon.position.set(cx, 7.5, cz - 18.2);
      scene.add(neon);
      const neon2 = neon.clone(); neon2.material = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x22d8ff, emissiveIntensity: 1.6 });
      neon2.position.y = 3.4;
      scene.add(neon2);
      clubDoor = { x: cx, z: cz - 19 };
    }
    if (lm.kind === 'casino') {
      const neon = new THREE.Mesh(cityBox, new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffd23c, emissiveIntensity: 1.4 }));
      neon.scale.set(30, 0.5, 0.5); neon.position.set(cx, 7.5, cz - 18.2);
      scene.add(neon);
    }
    if (lm.kind === 'gas') {
      // canopy + pumps
      addBox(mats.white, cx, 5, cz - 12, 24, 0.6, 12);
      for (let i = -1; i <= 1; i += 1) addBox(mats.dark, cx + i * 7, 1.1, cz - 12, 1.2, 2.2, 1);
      for (const px of [-5, 5]) addCyl(mats.pole, cx + px, 2.5, cz - 12, 0.25, 0.25, 5);
      colliders.push({ x: cx, z: cz - 12, hx: 12, hz: 6 });
    }
  }

  // ---- Harbor Bridge: a real suspension bridge over the bay ----
  // East along street z = 58, from the city edge (x = 292) over the sea to
  // Lighthouse Island (x = 470). Deck top follows groundHeightAt exactly:
  // ramp 292 -> 360 up to y = 8, flat deck 360 -> 420, ramp down 420 -> 470.
  function buildHarborBridge() {
    const steel = new THREE.MeshStandardMaterial({ color: 0xb04040, roughness: 0.55, metalness: 0.35 }); // red towers, GTA 5 style
    const cableMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.4, metalness: 0.7 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.6, metalness: 0.5 });
    const deckMat = mats.road;
    // deck segments — top surface follows the ground profile
    const rampAng = Math.atan2(8, 68);
    const rampUp = new THREE.Mesh(cityBox, deckMat);
    rampUp.scale.set(Math.hypot(68, 8), 1.2, 16);
    rampUp.position.set(326, 4 - 0.6, BRIDGE.z);
    rampUp.rotation.z = rampAng;
    rampUp.receiveShadow = true; rampUp.castShadow = true;
    scene.add(rampUp);
    const deck = new THREE.Mesh(cityBox, deckMat);
    deck.scale.set(60, 1.2, 16);
    deck.position.set(390, 8 - 0.6, BRIDGE.z);
    deck.receiveShadow = true; deck.castShadow = true;
    scene.add(deck);
    const downAng = Math.atan2(7.88, 50);
    const rampDown = new THREE.Mesh(cityBox, deckMat);
    rampDown.scale.set(Math.hypot(50, 7.88), 1.2, 16);
    rampDown.position.set(445, (8 + 0.12) / 2 - 0.6, BRIDGE.z);
    rampDown.rotation.z = -downAng;
    rampDown.receiveShadow = true; rampDown.castShadow = true;
    scene.add(rampDown);
    // centre dashes + edge lines on the flat deck
    const dashMat = new THREE.MeshBasicMaterial({ color: PALETTE.roadLine });
    for (let d = 366; d <= 414; d += 12) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.3), dashMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(d, 8.03, BRIDGE.z);
      scene.add(dash);
    }
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xe8e8e8 });
    for (const ez of [BRIDGE.z - 6, BRIDGE.z + 6]) {
      const edge = new THREE.Mesh(new THREE.PlaneGeometry(60, 0.3), edgeMat);
      edge.rotation.x = -Math.PI / 2; edge.position.set(390, 8.03, ez);
      scene.add(edge);
    }
    // railings (parapets) along both edges, following the three segments
    const railSegs = [
      { x: 326, y: 4, ang: rampAng, len: Math.hypot(68, 8) },
      { x: 390, y: 8, ang: 0, len: 60 },
      { x: 445, y: 4.06, ang: -downAng, len: Math.hypot(50, 7.88) },
    ];
    for (const rz of [BRIDGE.z - 8, BRIDGE.z + 8]) {
      for (const s of railSegs) {
        const rail = new THREE.Mesh(cityBox, railMat);
        rail.scale.set(s.len, 1.1, 0.3);
        rail.position.set(s.x, s.y + 0.55, rz);
        rail.rotation.z = s.ang;
        rail.castShadow = true;
        scene.add(rail);
      }
      colliders.push({ x: 326, z: rz, hx: 34, hz: 0.3 });
      colliders.push({ x: 390, z: rz, hx: 30, hz: 0.3 });
      colliders.push({ x: 445, z: rz, hx: 25, hz: 0.3 });
    }
    // towers: two red pylons with a crossbeam over the road
    for (const tx of [370, 410]) {
      for (const tz of [BRIDGE.z - 12, BRIDGE.z + 12]) {
        const leg = new THREE.Mesh(cityBox, steel);
        leg.scale.set(2.5, 42, 2.5);
        leg.position.set(tx, 21, tz);
        leg.castShadow = true;
        scene.add(leg);
      }
      const beam = new THREE.Mesh(cityBox, steel);
      beam.scale.set(2.5, 3, 27);
      beam.position.set(tx, 39.5, BRIDGE.z);
      beam.castShadow = true;
      scene.add(beam);
      const cap = new THREE.Mesh(cityBox, steel);
      cap.scale.set(3.5, 1.5, 27);
      cap.position.set(tx, 42, BRIDGE.z);
      scene.add(cap);
      // cable fan: crossbeam ends -> deck edges (anchor height from the real deck profile)
      for (const sz of [BRIDGE.z - 12, BRIDGE.z + 12]) {
        const top = { x: tx, y: 40, z: sz };
        const edgeZ = sz < BRIDGE.z ? BRIDGE.z - 7.5 : BRIDGE.z + 7.5;
        for (const dx of [-22, -11, 11, 22]) {
          beamCyl(top, { x: tx + dx, y: groundHeightAt(tx + dx, edgeZ) + 0.2, z: edgeZ }, 0.16, cableMat);
        }
      }
    }
    // lamps on the deck (bulbs join the night lamp update)
    const bridgeBulbMat = new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffdf8a, emissiveIntensity: 0 });
    for (let i = 0; i < 8; i += 1) {
      const lx = 310 + i * 20;
      const lz = BRIDGE.z + (i % 2 === 0 ? -6.5 : 6.5);
      const gy = groundHeightAt(lx, lz);
      const pole = new THREE.Mesh(cityCyl, mats.pole);
      pole.scale.set(0.09, 6, 0.09); pole.position.set(lx, gy + 3, lz); pole.castShadow = true;
      scene.add(pole);
      const bulb = new THREE.Mesh(citySph, bridgeBulbMat.clone());
      bulb.scale.setScalar(0.3); bulb.position.set(lx, gy + 6.1, lz);
      scene.add(bulb);
      lamps.push(bulb);
      colliders.push({ x: lx, z: lz, hx: 0.25, hz: 0.25 });
    }
    // entrance gantries + signs at both ends
    for (const gx of [298, 462]) {
      for (const pz of [BRIDGE.z - 8, BRIDGE.z + 8]) {
        const post = new THREE.Mesh(cityBox, steel);
        post.scale.set(0.7, 7.5, 0.7); post.position.set(gx, 3.75, pz); post.castShadow = true;
        scene.add(post);
      }
      const gantry = new THREE.Mesh(cityBox, steel);
      gantry.scale.set(0.7, 1, 17); gantry.position.set(gx, 7.2, BRIDGE.z); gantry.castShadow = true;
      scene.add(gantry);
    }
    signPlane('HARBOR BRIDGE', '#101820', '#ffd23c', 298, 5.4, BRIDGE.z, -Math.PI / 2, 13);
    signPlane('HARBOR BRIDGE', '#101820', '#ffd23c', 462, 5.4, BRIDGE.z, Math.PI / 2, 13);
    // Lighthouse Island: sand disc, loop road, lighthouse, palms
    const island = new THREE.Mesh(new THREE.CylinderGeometry(BRIDGE.islandR, BRIDGE.islandR, 0.5, 36), mats.sand);
    island.position.set(BRIDGE.islandX, -0.13, BRIDGE.islandZ);
    island.receiveShadow = true;
    scene.add(island);
    const loop = new THREE.Mesh(new THREE.RingGeometry(20, 28, 48), mats.road);
    loop.rotation.x = -Math.PI / 2; loop.position.set(BRIDGE.islandX, 0.14, BRIDGE.islandZ);
    loop.receiveShadow = true;
    scene.add(loop);
    // ring of colliders around the island (airtight except the bridge road)
    for (let i = 0; i < 20; i += 1) {
      const a = (i / 20) * Math.PI * 2;
      const rx = BRIDGE.islandX + 33 * Math.cos(a);
      const rz = BRIDGE.islandZ + 33 * Math.sin(a);
      if (Math.abs(rz - BRIDGE.z) <= 7.5 && rx < BRIDGE.islandX) continue; // the bridge road enters here
      colliders.push({ x: rx, z: rz, hx: 6, hz: 6 });
    }
    colliders.push({ x: 440, z: 47.5, hx: 5, hz: 4 }); // flank the road entrance
    colliders.push({ x: 440, z: 68.5, hx: 5, hz: 4 });
    // lighthouse north of the road, inside the loop
    const lhX = BRIDGE.islandX, lhZ = 40;
    const lhWhite = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.7 });
    const lhRed = new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.7 });
    const lh = new THREE.Group();
    lh.position.set(lhX, 0.12, lhZ);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.4, 24, 14), lhWhite);
    tower.position.y = 12; tower.castShadow = true; lh.add(tower);
    for (const by of [6, 14, 22]) {
      const r = 2.4 - 0.6 * (by / 24) + 0.08;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.05, 2.4, 14), lhRed);
      band.position.y = by; lh.add(band);
    }
    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.5, 14), lhWhite);
    gallery.position.y = 24.25; lh.add(gallery);
    const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.6, 12),
      new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffdf8a, emissiveIntensity: 2.2 }));
    lampRoom.position.y = 25.8; lh.add(lampRoom);
    const lhRoof = new THREE.Mesh(cityCone, lhRed);
    lhRoof.scale.set(2.2, 1.8, 2.2); lhRoof.position.y = 28; lh.add(lhRoof);
    scene.add(lh);
    colliders.push({ x: lhX, z: lhZ, hx: 3, hz: 3 });
    // rotating beam: a translucent cone sweeping the bay
    const beamGroup = new THREE.Group();
    beamGroup.position.set(lhX, 25.9, lhZ);
    const beamCone = new THREE.Mesh(
      new THREE.ConeGeometry(3.2, 26, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    beamCone.rotation.z = -Math.PI / 2; // apex at the lamp, opening east
    beamCone.position.x = 13;
    beamGroup.add(beamCone);
    scene.add(beamGroup);
    lighthouseBeam = beamGroup;
    // island palms (inside the loop, clear of the road)
    for (const [px, pz] of [[458, 48], [482, 48], [458, 68], [482, 68]]) makeTree(px, pz, 'palm');
    landmarks.set('Harbor Bridge', { x: 380, z: 58, hx: 90, hz: 10, door: { x: 298, z: 58 }, roofY: 8 });
  }

  // ---- Crown Pier + ferris wheel (Del Perro Pier style) ----
  // East along z = 87 from Crown Beach (x = 316) to the wheel platform
  // (x = 368). Deck top follows groundHeightAt: ramp 316 -> 324 up to
  // y = 1.2, then flat to the wheel.
  function buildCrownPier() {
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.95 });
    const woodDark = new THREE.MeshStandardMaterial({ color: 0x6a4a34, roughness: 0.95 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.5, metalness: 0.6 });
    // ramp up from the sand + flat deck
    const rampAng = Math.atan2(1.2, 8);
    const ramp = new THREE.Mesh(cityBox, wood);
    ramp.scale.set(Math.hypot(8, 1.2), 0.5, 9);
    ramp.position.set(320, 0.6 - 0.25, PIER.z);
    ramp.rotation.z = rampAng;
    ramp.receiveShadow = true; scene.add(ramp);
    const deck = new THREE.Mesh(cityBox, wood);
    deck.scale.set(44, 0.5, 9);
    deck.position.set(346, 1.2 - 0.25, PIER.z);
    deck.receiveShadow = true; deck.castShadow = true;
    scene.add(deck);
    // piles
    for (const px of [322, 334, 346, 358, 366]) {
      for (const pz of [83.5, 90.5]) addCyl(woodDark, px, -0.5, pz, 0.25, 0.3, 3);
    }
    // railings + colliders (both sides + the end)
    for (const rz of [82.5, 91.5]) {
      const rail = new THREE.Mesh(cityBox, woodDark);
      rail.scale.set(50, 1.1, 0.25); rail.position.set(343, 1.2 + 0.55, rz); rail.castShadow = true; scene.add(rail);
      colliders.push({ x: 343, z: rz, hx: 25, hz: 0.3 });
    }
    const endRail = new THREE.Mesh(cityBox, woodDark);
    endRail.scale.set(0.25, 1.1, 9); endRail.position.set(368, 1.75, PIER.z); endRail.castShadow = true; scene.add(endRail);
    colliders.push({ x: 368, z: PIER.z, hx: 0.3, hz: 4.5 });
    // entrance sign on two posts
    for (const pz of [79.5, 94.5]) {
      const post = new THREE.Mesh(cityBox, woodDark);
      post.scale.set(0.4, 4.5, 0.4); post.position.set(318, 2.25, pz); post.castShadow = true; scene.add(post);
    }
    signPlane('CROWN PIER', '#1a3a5a', '#ffffff', 318, 4.5, PIER.z, -Math.PI / 2, 16);
    // ferris wheel at the pier end
    const wheel = new THREE.Group();
    wheel.position.set(PIER.wheelX, PIER.hubY, PIER.wheelZ);
    scene.add(wheel);
    // A-frame legs on both sides of the wheel plane
    for (const fz of [84, 90]) {
      beamBox({ x: 356, y: 1.2, z: fz }, { x: 360, y: 21, z: fz }, 0.8, steel);
      beamBox({ x: 364, y: 1.2, z: fz }, { x: 360, y: 21, z: fz }, 0.8, steel);
    }
    // hub + rims + spokes
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 7, 12), steel);
    hub.rotation.x = Math.PI / 2; // axis along z
    wheel.add(hub);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4, metalness: 0.6 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(15, 0.35, 8, 48), rimMat);
    wheel.add(rim);
    const rim2 = new THREE.Mesh(new THREE.TorusGeometry(9, 0.25, 8, 40), rimMat);
    wheel.add(rim2);
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 15, 6), steel);
      spoke.position.set(Math.cos(a) * 7.5, Math.sin(a) * 7.5, 0);
      spoke.rotation.z = a - Math.PI / 2; // cylinder Y-axis -> radial
      wheel.add(spoke);
    }
    // gondolas: 10 colourful cabins hanging from the rim, kept level
    const gondolaColors = [0xc8102e, 0xffd23c, 0x22d8ff, 0xff2ad8, 0xff5a00, 0x3a8a5f, 0x7a3cff, 0xff8ab0, 0x00e5a0, 0xe8a800];
    const gondolas = [];
    const ferrisLightMats = [];
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2;
      const g = new THREE.Group();
      g.position.set(Math.cos(a) * 15, Math.sin(a) * 15, 0);
      const arm = new THREE.Mesh(cityBox, steel);
      arm.scale.set(0.25, 1.6, 0.25); arm.position.y = -0.8;
      g.add(arm);
      const cabMat = new THREE.MeshStandardMaterial({ color: gondolaColors[i], roughness: 0.6 });
      const cab = new THREE.Mesh(cityBox, cabMat);
      cab.scale.set(2.4, 2.0, 2.2); cab.position.y = -2.6; cab.castShadow = true;
      g.add(cab);
      const roof = new THREE.Mesh(cityCone, cabMat);
      roof.scale.set(1.7, 0.9, 1.7); roof.position.y = -1.2;
      g.add(roof);
      const lm = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: gondolaColors[i], emissiveIntensity: 1 });
      const bulb = new THREE.Mesh(citySph, lm);
      bulb.scale.setScalar(0.3); bulb.position.y = -0.5;
      g.add(bulb);
      ferrisLightMats.push(lm);
      wheel.add(g);
      gondolas.push(g);
    }
    // rim bulbs: a ring of coloured lights around the rim
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2;
      const lm = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: gondolaColors[i % 10], emissiveIntensity: 1 });
      const bulb = new THREE.Mesh(citySph, lm);
      bulb.scale.setScalar(0.35);
      bulb.position.set(Math.cos(a) * 15, Math.sin(a) * 15, 0);
      wheel.add(bulb);
      ferrisLightMats.push(lm);
    }
    // hub light
    const hubLm = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffffff, emissiveIntensity: 1 });
    const hubBulb = new THREE.Mesh(citySph, hubLm);
    hubBulb.scale.setScalar(0.8);
    wheel.add(hubBulb);
    ferrisLightMats.push(hubLm);
    ferris = { wheel, gondolas, lightMats: ferrisLightMats };
    colliders.push({ x: PIER.wheelX, z: PIER.wheelZ, hx: 2, hz: 6 });
    landmarks.set('Crown Pier', { x: 343, z: 87, hx: 25, hz: 6, door: { x: 318, z: 87 }, roofY: 1 });
  }
  buildHarborBridge();
  buildCrownPier();

  // ---- parked cars along the streets ----
  for (const c of STREET_CENTERS) {
    for (let d = -CITY.half + 30; d < CITY.half; d += 58) {
      if (rng.chance(0.7)) parkedSpots.push({ x: c + 5.2, z: d, angle: 0 });
      if (rng.chance(0.7)) parkedSpots.push({ x: c - 5.2, z: d + 29, angle: Math.PI });
      if (rng.chance(0.5)) parkedSpots.push({ x: d, z: c + 5.2, angle: Math.PI / 2 });
      if (rng.chance(0.5)) parkedSpots.push({ x: d + 29, z: c - 5.2, angle: -Math.PI / 2 });
    }
  }

  // ---- falling leaves under trees ----
  const leafCount = 300;
  const leafGeo = new THREE.BufferGeometry();
  const leafPos = new Float32Array(leafCount * 3);
  const leafBase = [];
  for (let i = 0; i < leafCount; i += 1) {
    const t = trees[Math.floor(rng.next() * trees.length)];
    const bx = t ? t.canopy.parent.position.x : 0;
    const bz = t ? t.canopy.parent.position.z : 0;
    leafBase.push({ x: bx + rng.range(-2, 2), z: bz + rng.range(-2, 2), y: rng.range(0, 5), s: rng.range(0.3, 0.9) });
  }
  leafGeo.setAttribute('position', new THREE.BufferAttribute(leafPos, 3));
  leafPoints = new THREE.Points(leafGeo, new THREE.PointsMaterial({ color: 0x6a8a3a, size: 0.22 }));
  leafPoints.frustumCulled = false;
  scene.add(leafPoints);

  // ---- Club Lumen interior (off-map, shown only when inside) ----
  clubInterior = buildClubInterior(scene, rng);

  function update(dt, time, night01, raining) {
    // trees sway
    for (const t of trees) {
      t.canopy.rotation.z = Math.sin(time * t.speed + t.phase) * 0.03;
      t.canopy.rotation.x = Math.cos(time * t.speed * 0.8 + t.phase) * 0.02;
    }
    // water shimmer
    if (waterMesh) waterMesh.position.y = 0.05 + Math.sin(time * 0.7) * 0.05;
    // waves roll in and out at the waterline
    for (const w of waves) {
      w.mesh.position.x = w.baseX + Math.sin(time * 0.55 + w.phase) * 3.2;
      w.mesh.material.opacity = 0.34 + Math.sin(time * 0.55 + w.phase) * 0.16;
    }
    // lamps + window glow at night
    const glow = night01;
    for (const bulb of lamps) bulb.material.emissiveIntensity = glow * 3.0;
    for (const m of facadeCache.values()) m.emissiveIntensity = glow * 0.9;
    // ferris wheel: slow rotation, gondolas stay level, lights glow at night
    if (ferris) {
      ferris.wheel.rotation.z += dt * 0.12;
      for (const g of ferris.gondolas) g.rotation.z = -ferris.wheel.rotation.z;
      const fglow = 0.5 + night01 * 2.0;
      for (const m of ferris.lightMats) m.emissiveIntensity = fglow;
    }
    // lighthouse beam sweeps the bay
    if (lighthouseBeam) lighthouseBeam.rotation.y += dt * 0.5;
    // traffic lights: 20s cycle, offset per intersection
    for (const tl of trafficLights) {
      const phase = (time + tl.phase) % 20;
      const nsGreen = phase < 8;
      const yellow = phase >= 8 && phase < 10;
      const ewGreen = phase >= 10 && phase < 18;
      const ewYellow = phase >= 18;
      tl.red.material.emissiveIntensity = (nsGreen || ewYellow) ? 0 : 2.4;
      tl.green.material.emissiveIntensity = nsGreen ? 2.4 : 0;
      tl.yellow.material.emissiveIntensity = (yellow || ewYellow) ? 2.4 : 0;
      tl.state = nsGreen ? 'ns' : ewGreen ? 'ew' : 'yellow';
    }
    // falling leaves drift down and respawn at the canopy
    if (leafPoints) {
      const pos = leafPoints.geometry.attributes.position;
      for (let i = 0; i < leafCount; i += 1) {
        const b = leafBase[i];
        b.y -= dt * b.s;
        if (b.y < 0.05) b.y = 5;
        pos.setXYZ(i, b.x + Math.sin(time + i) * 0.4, b.y, b.z + Math.cos(time * 0.7 + i) * 0.4);
      }
      pos.needsUpdate = true;
    }
    // wet roads when it rains
    for (const r of roadMats) r.material = raining ? mats.roadWet : mats.road;
  }

  return {
    colliders, trees, lamps, trafficLights, landmarks, parkedSpots, sidewalkSpots,
    beachSpots,
    waterMesh, clubInterior, clubDoor, heliPad, planeSpot, update,
    roadMats, groundHeightAt, eastMaxX, ferris, bridge: BRIDGE, pier: PIER,
    // road graph: streets are lines; traffic drives along them.
    streetCenters: STREET_CENTERS,
  };
}

// The nightclub interior: dance floor, bar, DJ booth, coloured spotlights,
// a mirror ball. Built at (0, 0, 420) — south of the city, out of the way.
function buildClubInterior(scene, rng) {
  const group = new THREE.Group();
  group.position.set(0, 0, 420);
  group.visible = false;
  const dark = new THREE.MeshStandardMaterial({ color: 0x14101c, roughness: 0.9 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a24, roughness: 0.25, metalness: 0.5 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 26), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(36, 26), dark);
  ceil.rotation.x = Math.PI / 2; ceil.position.y = 8;
  group.add(ceil);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1c1426, roughness: 0.85 });
  const mkWall = (w, h, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    m.position.set(x, y, z); m.rotation.y = ry;
    group.add(m);
  };
  mkWall(36, 8, 0, 4, -13, 0);
  mkWall(36, 8, 0, 4, 13, Math.PI);
  mkWall(26, 8, -18, 4, 0, Math.PI / 2);
  mkWall(26, 8, 18, 4, 0, -Math.PI / 2);
  // dance floor: glowing tiles
  const tileColors = [0xff2ad8, 0x22d8ff, 0xffd23c, 0x7a3cff];
  for (let i = 0; i < 6; i += 1) {
    for (let j = 0; j < 4; j += 1) {
      const tile = new THREE.Mesh(
        new THREE.PlaneGeometry(2.4, 2.4),
        new THREE.MeshStandardMaterial({ color: 0x111111, emissive: tileColors[(i + j) % 4], emissiveIntensity: 0.9 }),
      );
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(-6 + i * 2.6, 0.02, -4.5 + j * 2.6);
      group.add(tile);
    }
  }
  // bar along the east wall
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 12), new THREE.MeshStandardMaterial({ color: 0x3a1a2a, roughness: 0.4 }));
  bar.position.set(15.5, 0.55, 0);
  group.add(bar);
  const barTop = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 12.4), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x22d8ff, emissiveIntensity: 0.5 }));
  barTop.position.set(15.5, 1.16, 0);
  group.add(barTop);
  for (let i = 0; i < 5; i += 1) {
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.7, 10), new THREE.MeshStandardMaterial({ color: 0xc8102e }));
    stool.position.set(14, 0.35, -5 + i * 2.5);
    group.add(stool);
  }
  // DJ booth
  const booth = new THREE.Mesh(new THREE.BoxGeometry(4, 1.4, 2), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x7a3cff, emissiveIntensity: 0.7 }));
  booth.position.set(0, 0.7, -11.5);
  group.add(booth);
  // mirror ball
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 0.9, roughness: 0.15 }));
  ball.position.set(0, 6.4, 0);
  group.add(ball);
  const ballStem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0x888888 }));
  ballStem.position.set(0, 7.4, 0);
  group.add(ballStem);
  // coloured spotlights (real lights, only 3 — the interior is small)
  const spotColors = [0xff2ad8, 0x22d8ff, 0xffd23c];
  const spots = [];
  for (let i = 0; i < 3; i += 1) {
    const s = new THREE.SpotLight(spotColors[i], 60, 30, 0.7, 0.5, 1.2);
    s.position.set(-8 + i * 8, 7.5, -8);
    s.target.position.set(-4 + i * 4, 0, 2);
    group.add(s); group.add(s.target);
    spots.push(s);
  }
  const amb = new THREE.AmbientLight(0x604a80, 2.0);
  group.add(amb);
  const pinkGlow = new THREE.PointLight(0xff2ad8, 40, 26, 1.4);
  pinkGlow.position.set(-8, 5, 0);
  group.add(pinkGlow);
  const cyanGlow = new THREE.PointLight(0x22d8ff, 40, 26, 1.4);
  cyanGlow.position.set(8, 5, 0);
  group.add(cyanGlow);
  // neon sign inside: real text, not a blank pink board
  const signTex = signTexture('CLUB LUMEN', '#1a0a2a', '#ff2ad8', 'DANCE · DRINKS · ALL NIGHT');
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), new THREE.MeshBasicMaterial({ map: signTex }));
  sign.position.set(0, 6.2, -12.8);
  group.add(sign);
  scene.add(group);
  return { group, spots, ball, doorLocal: { x: 0, z: 12.5 }, contactLocal: { x: 2, z: -2 } };
}
