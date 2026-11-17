// Crown Bay — police.js rewritten in recorded session fix8, 18 Nov 2026.
// Crown Bay — the CBPD: the wanted system and everyone who enforces it.
// Heat is the real number (it rises with every crime and cools off when
// the player stays out of sight); the wanted level is just heat read
// through five thresholds, so a stolen car is one star and shooting an
// officer is two. Cruisers spawn off-screen and chase in real cars —
// they drive with the same arcade physics as the player, so they take
// corners, get stuck on walls and can be outrun. On foot, officers chase
// at wanted 2 and up; if one grabs the player, it's BUSTED. When the
// heat is gone the cars peel off and the city goes quiet again.
import * as THREE from 'three';
import { CITY } from './config.js';
import { driveStep, makeVehicle } from './vehicles.js';

// Heat at which each star lights up (index = wanted level).
const HEAT_STARS = [0, 1, 20, 55, 85, 120];
const OFFICER_MIN_WANTED = 2;
const CATCH_DIST = 1.7;
// An officer needs a full second of contact before the cuffs come out —
// long enough for the player to break free by sprinting away.
const CATCH_TIME = 1.0;
const SPAWN_DIST = 62;
const DESPAWN_DIST = 150;
const OFFICER_SPEED = 7.2;

function wantedFromHeat(heat) {
  let level = 0;
  for (let i = 1; i < HEAT_STARS.length; i += 1) {
    if (heat >= HEAT_STARS[i]) level = i;
  }
  return level;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function makeOfficerMesh() {
  // A CBPD officer on foot: navy uniform, peaked cap, white shirt front.
  // Built from boxes so it reads at a distance and costs almost nothing.
  const group = new THREE.Group();
  const navy = new THREE.MeshStandardMaterial({ color: 0x1c2f55, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd8a878, roughness: 0.8 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.7 });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const legL = new THREE.Mesh(box, dark);
  legL.scale.set(0.14, 0.78, 0.16); legL.position.set(-0.11, 0.39, 0);
  const legR = legL.clone(); legR.position.x = 0.11;
  const torso = new THREE.Mesh(box, navy);
  torso.scale.set(0.52, 0.62, 0.3); torso.position.y = 1.1;
  const shirt = new THREE.Mesh(box, white);
  shirt.scale.set(0.2, 0.5, 0.05); shirt.position.set(0, 1.12, 0.17);
  const armL = new THREE.Mesh(box, navy);
  armL.scale.set(0.12, 0.58, 0.14); armL.position.set(-0.33, 1.1, 0);
  const armR = armL.clone(); armR.position.x = 0.33;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), skin);
  head.position.y = 1.58;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.09, 12), dark);
  cap.position.y = 1.74;
  const brim = new THREE.Mesh(box, dark);
  brim.scale.set(0.3, 0.03, 0.2); brim.position.set(0, 1.7, 0.2);
  for (const m of [legL, legR, torso, shirt, armL, armR, head, cap, brim]) {
    m.castShadow = true;
    group.add(m);
  }
  group.userData = { legL, legR, armL, armR };
  return group;
}

export function createPolice(scene) {
  return {
    scene,
    wanted: 0,
    heat: 0,
    cars: [],
    officers: [],
    _spawnIn: 0,
    _officerIn: 0,
    _grab: 0,
    _coolTick: 0,
  };
}

export function addWanted(police, amount, reason) {
  const before = police.wanted;
  police.heat = Math.max(0, police.heat + amount);
  police.wanted = wantedFromHeat(police.heat);
  return {
    changed: police.wanted > before,
    wanted: police.wanted,
    reason: reason || '',
  };
}

export function clearWanted(police, scene) {
  for (const c of police.cars) scene.remove(c.mesh);
  for (const o of police.officers) scene.remove(o.mesh);
  police.cars.length = 0;
  police.officers.length = 0;
  police.heat = 0;
  police.wanted = 0;
  police._grab = 0;
}

function spawnSpotNear(rng, player, dist) {
  // Drop the cruiser on a street at roughly `dist` from the player, in a
  // random direction — close enough to be seen coming, far enough that it
  // does not pop into existence on top of the player.
  const angle = rng.next() * Math.PI * 2;
  const x = clamp(player.x + Math.cos(angle) * dist, -CITY.half, CITY.half);
  const z = clamp(player.z + Math.sin(angle) * dist, -CITY.half, CITY.half);
  return { x, z, heading: Math.atan2(player.z - z, player.x - x) };
}

function removeCar(police, scene, car) {
  scene.remove(car.mesh);
  const i = police.cars.indexOf(car);
  if (i >= 0) police.cars.splice(i, 1);
}

function removeOfficer(police, scene, officer) {
  scene.remove(officer.mesh);
  const i = police.officers.indexOf(officer);
  if (i >= 0) police.officers.splice(i, 1);
}

export function policeStep(police, dt, scene, rng, player, vehicles, colliders, onBusted) {
  if (police.wanted <= 0) {
    // No heat: any stragglers drive off and the street goes quiet.
    if (police.cars.length || police.officers.length) clearWanted(police, scene);
    return;
  }

  // Heat cools fastest when no cruiser can see the player (out of sight,
  // out of mind); it barely cools while a chase is on.
  const nearestCar = police.cars.reduce((best, c) => {
    const d = Math.hypot(c.x - player.x, c.z - player.z);
    return best === null || d < best ? d : best;
  }, null);
  const seen = nearestCar !== null && nearestCar < 55;
  police.heat = Math.max(0, police.heat - dt * (seen ? 0.4 : 1.4));
  const level = wantedFromHeat(police.heat);
  if (level !== police.wanted) police.wanted = level;
  if (police.wanted <= 0) {
    clearWanted(police, scene);
    return;
  }

  // --- cruisers: one per star, up to five, chasing in real cars -------
  police._spawnIn -= dt;
  if (police.cars.length < police.wanted && police._spawnIn <= 0) {
    const spot = spawnSpotNear(rng, player, SPAWN_DIST + rng.range(0, 25));
    const car = makeVehicle(scene, 'police', spot.x, spot.z, spot.heading, 0x20262f, {});
    car.sirenPhase = rng.next() * 2;
    police.cars.push(car);
    police._spawnIn = 1.2;
  }
  for (let i = police.cars.length - 1; i >= 0; i -= 1) {
    const car = police.cars[i];
    // A wrecked cruiser is out of the chase for good.
    if (car.damage >= 100) {
      removeCar(police, scene, car);
      continue;
    }
    // Lost the player far behind? Pull the cruiser back into the fight.
    const dist = Math.hypot(car.x - player.x, car.z - player.z);
    if (dist > DESPAWN_DIST) {
      const spot = spawnSpotNear(rng, player, SPAWN_DIST);
      car.x = spot.x; car.z = spot.z; car.heading = spot.heading;
      car.speed = 0;
      car.mesh.position.set(car.x, car.y, car.z);
      continue;
    }
    // Steer toward the player: heading is CCW-positive and D steers
    // right, so a positive heading error means steer right (same sign
    // the player's own driving uses — negating it once made the whole
    // force drive away from the player).
    const target = Math.atan2(player.z - car.z, player.x - car.x);
    let dh = target - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const steer = clamp(dh * 2, -1, 1);
    const throttle = dist > 8 ? 1 : 0.6;
    driveStep(car, { x: steer, y: throttle }, dt, colliders, false, vehicles);
  }

  // --- officers on foot, wanted 2 and up -------------------------------
  police._officerIn -= dt;
  const wantOfficers = Math.min(police.wanted - 1, 3);
  if (police.officers.length < wantOfficers && police._officerIn <= 0) {
    const spot = spawnSpotNear(rng, player, 22 + rng.range(0, 10));
    const mesh = makeOfficerMesh();
    mesh.position.set(spot.x, 0, spot.z);
    scene.add(mesh);
    police.officers.push({
      x: spot.x, z: spot.z, speed: 0, state: 'chase', mesh, walkPhase: rng.next() * 6, downFor: 0,
    });
    police._officerIn = 2.5;
  }
  let grabbing = false;
  for (let i = police.officers.length - 1; i >= 0; i -= 1) {
    const o = police.officers[i];
    if (o.state === 'down') {
      // A downed officer stays down; the street crew clears them away.
      o.downFor += dt;
      if (o.downFor > 12) removeOfficer(police, scene, o);
      continue;
    }
    const dx = player.x - o.x;
    const dz = player.z - o.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const stepLen = OFFICER_SPEED * dt;
    o.x += (dx / dist) * Math.min(stepLen, dist);
    o.z += (dz / dist) * Math.min(stepLen, dist);
    o.speed = OFFICER_SPEED;
    o.walkPhase += dt * 9;
    o.mesh.position.set(o.x, 0, o.z);
    o.mesh.rotation.y = -Math.atan2(dz, dx) + Math.PI / 2;
    const swing = Math.sin(o.walkPhase) * 0.45;
    const u = o.mesh.userData;
    if (u.legL) { u.legL.rotation.x = swing; u.legR.rotation.x = -swing; }
    if (u.armL) { u.armL.rotation.x = -swing * 0.8; u.armR.rotation.x = swing * 0.8; }
    if (dist < CATCH_DIST && !player.inVehicle) grabbing = true;
  }

  // Grabbed: an officer holds the player for just under a second, then
  // the cuffs come out. Running breaks the grab instantly.
  if (grabbing) {
    police._grab += dt;
    if (police._grab >= CATCH_TIME && onBusted) onBusted();
  } else {
    police._grab = 0;
  }
}
