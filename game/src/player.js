// Crown Bay — player.js rewritten in recorded session fix7, 18 Nov 2026.
// Rook — the player on foot. A low-poly figure in a black jacket, moved with
// WASD relative to the camera, with jump, sprint and a pistol. Collides with
// building boxes (circle vs AABB) and stays inside the city.
import * as THREE from 'three';
import { CITY, PLAYER } from './config.js';
import { eastMaxX, groundHeightAt } from './city.js';
import { createPedMesh } from './peds.js';

const plBox = new THREE.BoxGeometry(1, 1, 1);

export function createPlayerMesh() {
  // Rook: black jacket, dark jeans, backwards cap — distinct from any ped.
  const group = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.7 });
  const jeans = new THREE.MeshStandardMaterial({ color: 0x2a3a5a, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd8a878, roughness: 0.8 });
  const capM = new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.7 });
  const legL = new THREE.Mesh(plBox, jeans);
  legL.scale.set(0.15, 0.8, 0.17); legL.position.set(-0.12, 0.4, 0);
  const legR = legL.clone(); legR.position.x = 0.12;
  const torso = new THREE.Mesh(plBox, jacket);
  torso.scale.set(0.55, 0.64, 0.3); torso.position.y = 1.12;
  const armL = new THREE.Mesh(plBox, jacket);
  armL.scale.set(0.13, 0.6, 0.15); armL.position.set(-0.35, 1.12, 0);
  const armR = armL.clone(); armR.position.x = 0.35;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), skin);
  head.position.y = 1.62;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), capM);
  cap.position.y = 1.66;
  const brim = new THREE.Mesh(plBox, capM);
  brim.scale.set(0.3, 0.04, 0.22); brim.position.set(0, 1.68, 0.26);
  // pistol in the right hand
  const gun = new THREE.Mesh(plBox, new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.7 }));
  gun.scale.set(0.08, 0.1, 0.34); gun.position.set(0.35, 0.86, 0.14);
  for (const m of [legL, legR, torso, armL, armR, head, cap, brim, gun]) { m.castShadow = true; group.add(m); }
  group.userData = { legL, legR, armL, armR, torso, gun };
  return group;
}

export function createPlayerState(x, z) {
  return {
    x, z, y: 0, vy: 0,
    heading: 0, // facing, radians (0 = +x)
    speed: 0,
    health: PLAYER.health,
    cash: 0,
    ammo: 12,
    ammoReserve: 60,
    reloading: 0,
    inVehicle: null, // vehicle object or null
    invulnerable: 0,
    walkPhase: 0,
    grounded: true,
    bustedTimer: 0,
  };
}

// Move on foot. move {x: strafe, y: forward} relative to camera yaw.
// bounds: the rectangle the player may walk in (city by default, the club
// interior while inside — the club sits south of the city, past the clamp).
export function playerStep(p, move, camYaw, run, jump, dt, colliders, bounds) {
  const b = bounds || { minX: -CITY.half - 6, maxX: CITY.seaX - 2, minZ: -CITY.half - 6, maxZ: CITY.half + 6 };
  const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
  // camera forward on the ground plane: (cos, sin) when yaw is measured from +x
  const fx = cos, fz = sin;
  const rx = -sin, rz = cos;
  let mx = fx * move.y + rx * move.x;
  let mz = fz * move.y + rz * move.x;
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    mx /= len; mz /= len;
    p.heading = Math.atan2(mz, mx);
    p.speed = speed;
  } else {
    p.speed = 0;
  }
  let nx = p.x + mx * p.speed * dt;
  let nz = p.z + mz * p.speed * dt;
  // circle vs AABB push-out
  const r = PLAYER.radius;
  for (const c of colliders) {
    const cx = Math.max(c.x - c.hx, Math.min(nx, c.x + c.hx));
    const cz = Math.max(c.z - c.hz, Math.min(nz, c.z + c.hz));
    const dx = nx - cx, dz = nz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      const d = Math.sqrt(d2) || 0.001;
      nx = cx + (dx / d) * r;
      nz = cz + (dz / d) * r;
    }
  }
  // east of the waterline only the bridge road, the island, the pier and
  // the wheel platform are walkable (eastMaxX on the prospective position)
  const maxX = bounds ? b.maxX : eastMaxX(p.x, p.z, nx, nz);
  nx = Math.max(b.minX, Math.min(maxX, nx));
  nz = Math.max(b.minZ, Math.min(b.maxZ, nz));
  p.x = nx; p.z = nz;
  // jump / gravity (ground height: bridge deck, ramps, pier, island)
  const gy = groundHeightAt(p.x, p.z);
  if (jump && p.grounded) { p.vy = PLAYER.jumpSpeed; p.grounded = false; }
  if (!p.grounded) {
    p.vy -= PLAYER.gravity * dt;
    p.y += p.vy * dt;
    if (p.y <= gy) { p.y = gy; p.vy = 0; p.grounded = true; }
  } else {
    p.y = gy;
  }
  if (p.invulnerable > 0) p.invulnerable -= dt;
  // walk cycle
  p.walkPhase += dt * p.speed * 1.6;
  return p;
}

export function updatePlayerMesh(mesh, p) {
  mesh.position.set(p.x, p.y, p.z);
  mesh.rotation.y = -p.heading + Math.PI / 2;
  const u = mesh.userData;
  const swing = Math.sin(p.walkPhase) * (p.speed > 0.1 ? 0.5 : 0);
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.8;
  u.armR.rotation.x = swing * 0.8;
  u.gun.visible = true;
}

// Hitscan pistol: nearest damageable thing in a cone in front of the player.
// targets: [{x, z, y, radius, kind, ref}] — returns the hit target or null.
export function shootAt(p, camYaw, targets, maxDist = 60) {
  const fx = Math.cos(camYaw), fz = Math.sin(camYaw);
  let best = null, bestD = maxDist;
  for (const t of targets) {
    const dx = t.x - p.x, dz = t.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > bestD || d < 0.5) continue;
    const dot = (dx * fx + dz * fz) / d; // 1 = straight ahead
    if (dot < 0.86) continue; // ~30 degree cone
    // lateral distance from the shot line
    const lat = Math.abs(-dx * fz + dz * fx);
    if (lat > (t.radius ?? 1) + 0.6) continue;
    best = t; bestD = d;
  }
  return best ? { target: best, dist: bestD } : null;
}
