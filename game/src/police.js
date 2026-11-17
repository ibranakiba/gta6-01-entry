// Crown Bay — police.js rewritten in recorded session fix7, 18 Nov 2026.
// The wanted system and the CBPD. Stars 0-5: crime in sight of police or
// pedestrians raises heat; hiding and time lower it. Police cruisers spawn on
// the streets and chase, ramming the player's car; on foot, officers chase and
// a slow player who stays close gets busted. Sirens wail while they hunt.
import * as THREE from 'three';
import { CITY, STREET_CENTERS } from './config.js';
import { makeVehicle, driveStep } from './vehicles.js';
import { createPedMesh } from './peds.js';

export function createPolice(scene) {
  return {
    wanted: 0,
    heat: 0, // 0..100, stars = floor(heat / 20)
    cars: [],
    officers: [],
    busted: false,
    decayTimer: 0,
  };
}

export function addWanted(police, amount, reason) {
  police.heat = Math.min(100, police.heat + amount);
  const stars = Math.min(5, Math.floor(police.heat / 20));
  const changed = stars !== police.wanted;
  police.wanted = stars;
  return { stars, changed, reason };
}

function spawnPoliceCar(scene, police, rng, playerPos) {
  // spawn on a street ~70 units away from the player
  const angle = rng.range(0, Math.PI * 2);
  let x = playerPos.x + Math.cos(angle) * 70;
  let z = playerPos.z + Math.sin(angle) * 70;
  x = Math.max(-CITY.half, Math.min(CITY.half, x));
  z = Math.max(-CITY.half, Math.min(CITY.half, z));
  // snap to the nearest street
  let best = STREET_CENTERS[0], bd = 1e9;
  for (const c of STREET_CENTERS) {
    if (Math.abs(z - c) < bd) { bd = Math.abs(z - c); best = c; }
  }
  z = best + (Math.random() < 0.5 ? 3.4 : -3.4);
  const car = makeVehicle(scene, 'police', x, z, Math.atan2(playerPos.z - z, playerPos.x - x), 0x20262f, { police: true });
  car.sirenPhase = Math.random() * 6;
  police.cars.push(car);
  return car;
}

function spawnOfficer(scene, police, rng, playerPos) {
  const mesh = createPedMesh(rng, {});
  // navy uniform
  mesh.userData.torso.material = new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.8 });
  mesh.userData.legL.material = new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.8 });
  mesh.userData.legR.material = mesh.userData.legL.material;
  const x = playerPos.x + (Math.random() - 0.5) * 40;
  const z = playerPos.z + (Math.random() - 0.5) * 40;
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  const officer = { mesh, x, z, heading: 0, speed: 0, walkPhase: 0, state: 'walk', baseSpeed: 3.4, scared: 0, club: false, paired: null, target: null };
  police.officers.push(officer);
  return officer;
}

export function policeStep(police, dt, scene, rng, player, vehicles, colliders, onBusted) {
  // heat decays when the player is out of sight of police
  police.decayTimer -= dt;
  if (police.decayTimer <= 0) {
    police.decayTimer = 1;
    const nearPolice = police.cars.some((c) => Math.hypot(c.x - player.x, c.z - player.z) < 40)
      || police.officers.some((o) => Math.hypot(o.x - player.x, o.z - player.z) < 25);
    if (!nearPolice && police.heat > 0) police.heat = Math.max(0, police.heat - 1.2);
    police.wanted = Math.min(5, Math.floor(police.heat / 20));
  }
  // desired police presence scales with stars
  const wantCars = police.wanted === 0 ? 0 : Math.min(6, police.wanted + 1);
  const wantOfficers = police.wanted === 0 ? 0 : Math.min(5, police.wanted);
  while (police.cars.length < wantCars) spawnPoliceCar(scene, police, rng, player);
  while (police.officers.length < wantOfficers) spawnOfficer(scene, police, rng, player);
  // remove extras when the heat drops
  while (police.cars.length > wantCars) {
    const c = police.cars.pop();
    scene.remove(c.mesh);
  }
  while (police.officers.length > wantOfficers) {
    const o = police.officers.pop();
    scene.remove(o.mesh);
  }
  // chase: cruisers steer at the player and ram; officers run at the player
  const playerVehicle = player.inVehicle;
  const px = playerVehicle ? playerVehicle.x : player.x;
  const pz = playerVehicle ? playerVehicle.z : player.z;
  for (const car of police.cars) {
    const dx = px - car.x, dz = pz - car.z;
    const dist = Math.hypot(dx, dz) || 1;
    const wantHeading = Math.atan2(dz, dx);
    let dh = wantHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, dh * 2));
    const move = { x: steer, y: dist > 4 ? 1 : 0.4 };
    driveStep(car, move, dt, colliders, false, vehicles);
    // ram damage when very close and moving fast — throttled so a chase lasts
    if (dist < car.radius + 1.5 && playerVehicle && Math.abs(car.speed) > 4) {
      playerVehicle.damage = (playerVehicle.damage || 0) + dt * 4;
    }
  }
  for (const o of police.officers) {
    const dx = px - o.x, dz = pz - o.z;
    const dist = Math.hypot(dx, dz) || 1;
    o.heading = Math.atan2(dz, dx);
    o.speed = dist > 2 ? 3.6 : 0;
    o.x += Math.cos(o.heading) * o.speed * dt;
    o.z += Math.sin(o.heading) * o.speed * dt;
    o.walkPhase += dt * o.speed * 1.6;
    o.mesh.position.set(o.x, 0, o.z);
    o.mesh.rotation.y = -o.heading + Math.PI / 2;
    const u = o.mesh.userData;
    const swing = Math.sin(o.walkPhase) * (o.speed > 0.1 ? 0.55 : 0);
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.8;
    u.armR.rotation.x = swing * 0.8;
    // busted: an officer stays within arm's reach of a slow player
    if (!playerVehicle && dist < 2.2 && player.speed < 2) {
      player.bustedTimer += dt;
      if (player.bustedTimer > 2 && !police.busted) {
        police.busted = true;
        onBusted();
      }
    } else {
      player.bustedTimer = Math.max(0, player.bustedTimer - dt);
    }
  }
  return police.wanted;
}

export function clearWanted(police, scene) {
  police.heat = 0;
  police.wanted = 0;
  police.busted = false;
  for (const c of police.cars) scene.remove(c.mesh);
  for (const o of police.officers) scene.remove(o.mesh);
  police.cars = [];
  police.officers = [];
}
