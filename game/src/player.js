// fix9
// Crown Bay — Rook, on foot. The mesh (a low-poly figure in a red
// cap, jacket and jeans, gun in hand), the state the world carries
// around (cash, health, ammo), the step that walks him through the
// streets, and the shot that decides what a bullet hits.
//
// On foot the player is a circle of radius 0.5 m against the same
// axis-aligned colliders the cars use, so he can slip between a
// parked car and a shopfront but never through a wall. His height
// follows the ground under him — street level, or the bridge deck
// eight metres up — and a jump is a small arc that lands back on it.
import * as THREE from 'three';
import { CITY, PLAYER } from './config.js';
import { eastMaxX, groundHeightAt } from './city.js';

const BODY_RADIUS = 0.5;

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

export function createPlayerMesh() {
  const g = new THREE.Group();
  // Legs: dark jeans, swinging opposite when he walks.
  const legL = box(0.16, 0.78, 0.18, 0x2a2f3a, -0.11, 0.39, 0);
  const legR = box(0.16, 0.78, 0.18, 0x2a2f3a, 0.11, 0.39, 0);
  legL.geometry.translate(0, -0.39, 0);
  legR.geometry.translate(0, -0.39, 0);
  legL.position.y = 0.78;
  legR.position.y = 0.78;
  // Torso: a rust-red jacket over a dark shirt.
  const torso = box(0.46, 0.62, 0.26, 0x8a2f24, 0, 1.09, 0);
  const shirt = box(0.3, 0.4, 0.28, 0x1c1c22, 0, 1.06, 0);
  // Arms: jacket sleeves, the right one holding the pistol forward.
  const armL = box(0.13, 0.58, 0.15, 0x8a2f24, -0.3, 1.12, 0);
  const armR = box(0.13, 0.58, 0.15, 0x8a2f24, 0.3, 1.12, 0.08);
  armL.geometry.translate(0, -0.29, 0);
  armR.geometry.translate(0, -0.29, 0);
  armL.position.y = 1.4;
  armR.position.y = 1.4;
  armR.rotation.x = -1.2;
  // Head: skin, and the red cap Rook is known by.
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xd8a075, roughness: 0.7 }),
  );
  head.position.set(0, 1.62, 0);
  head.castShadow = true;
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.4),
    new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.6 }),
  );
  cap.position.set(0, 1.66, 0);
  const brim = box(0.24, 0.04, 0.2, 0xc8102e, 0, 1.72, 0.2);
  // The pistol, dark, in the right hand.
  const gun = box(0.06, 0.09, 0.3, 0x1a1a1a, 0.3, 1.05, 0.32);
  g.add(legL, legR, torso, shirt, armL, armR, head, cap, brim, gun);
  g.userData.legs = { legL, legR, armL, armR };
  g.userData.walkPhase = 0;
  return g;
}

export function createPlayerState(x, z) {
  return {
    x, z, y: 0,
    heading: 0,
    cash: 0,
    health: PLAYER.health,
    ammo: PLAYER.ammo,
    ammoReserve: PLAYER.ammoReserve,
    reloading: 0,
    inVehicle: null,
    invulnerable: 0,
    vy: 0,
    walkPhase: 0,
    moving: false,
  };
}

// Circle-vs-AABB push-out, the same shape the cars use: cheap, and
// it never lets the player tunnel through a wall in one frame.
function collideCircle(player, nx, nz, colliders) {
  for (const c of colliders) {
    const cx = Math.max(c.x - c.hx, Math.min(nx, c.x + c.hx));
    const cz = Math.max(c.z - c.hz, Math.min(nz, c.z + c.hz));
    const dx = nx - cx;
    const dz = nz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < BODY_RADIUS * BODY_RADIUS) {
      const d = Math.sqrt(d2) || 0.001;
      nx = cx + (dx / d) * BODY_RADIUS;
      nz = cz + (dz / d) * BODY_RADIUS;
    }
  }
  return { x: nx, z: nz };
}

export function playerStep(player, move, camYaw, run, jump, dt, colliders, bounds) {
  // Wish direction: forward is where the camera looks, strafe is
  // sideways to it. The character turns toward where he is going.
  const fx = Math.cos(camYaw);
  const fz = Math.sin(camYaw);
  const rx = -fz;
  const rz = fx;
  let wx = fx * move.y + rx * move.x;
  let wz = fz * move.y + rz * move.x;
  const len = Math.hypot(wx, wz);
  player.moving = len > 0.05;
  if (player.moving) {
    wx /= len;
    wz /= len;
    player.heading = Math.atan2(wz, wx);
  }
  const speed = run ? PLAYER.run : PLAYER.walk;
  let nx = player.x + wx * speed * dt * (player.moving ? 1 : 0);
  let nz = player.z + wz * speed * dt * (player.moving ? 1 : 0);
  // Stay inside the allowed area: the whole city, or the club room
  // when the bounds say so. The sea is a wall on foot — no swimming.
  if (bounds) {
    nx = Math.max(bounds.minX, Math.min(bounds.maxX, nx));
    nz = Math.max(bounds.minZ, Math.min(bounds.maxZ, nz));
  } else {
    nx = Math.max(-CITY.half - 6, Math.min(CITY.half + 6, nx));
    nz = Math.max(-CITY.half - 6, Math.min(CITY.half + 6, nz));
    // The sea is a wall on foot — except on the bridge road, the
    // island and the pier, where eastMaxX opens the waterline for the
    // prospective position, exactly as the cars use it.
    nx = Math.min(eastMaxX(player.x, player.z, nx, nz), nx);
  }
  const fixed = collideCircle(player, nx, nz, colliders);
  player.x = fixed.x;
  player.z = fixed.z;
  // Height follows the ground (street, bridge deck, island, pier),
  // plus a jump arc that falls back onto it.
  const ground = bounds ? 0 : groundHeightAt(player.x, player.z);
  if (jump && player.y <= ground + 0.01) player.vy = PLAYER.jump;
  player.vy -= 22 * dt;
  player.y += player.vy * dt;
  if (player.y <= ground) {
    player.y = ground;
    player.vy = 0;
  }
  if (player.invulnerable > 0) player.invulnerable -= dt;
  if (player.moving) player.walkPhase += dt * speed * 1.6;
}

// A shot is a narrow cone in front of the player: the nearest target
// inside the cone and inside 60 m is the one the bullet finds. Peds,
// officers and vehicles all count, and the caller decides what the
// hit means.
export function shootAt(player, camYaw, targets) {
  const fx = Math.cos(camYaw);
  const fz = Math.sin(camYaw);
  let best = null;
  let bestD = Infinity;
  for (const t of targets) {
    const dx = t.x - player.x;
    const dz = t.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d > 60 || d < 0.5) continue;
    const along = (dx * fx + dz * fz) / d;
    if (along < 0.985) continue; // outside the ~10-degree cone
    const spread = d * 0.14 + (t.radius || 0.8);
    const side = Math.abs(-dx * fz + dz * fx);
    if (side > spread) continue;
    if (d < bestD) { bestD = d; best = t; }
  }
  return best ? { target: best, distance: bestD } : null;
}

export function updatePlayerMesh(mesh, player) {
  mesh.position.set(player.x, player.y, player.z);
  mesh.rotation.y = -player.heading;
  const legs = mesh.userData.legs;
  if (!legs) return;
  const swing = player.moving ? Math.sin(player.walkPhase) * 0.55 : 0;
  legs.legL.rotation.x = swing;
  legs.legR.rotation.x = -swing;
  legs.armL.rotation.x = -swing * 0.7;
  // A blink of invulnerability after a hit: the figure flickers
  // rather than pretending nothing happened.
  mesh.visible = !(player.invulnerable > 0 && Math.floor(performance.now() / 120) % 2 === 0);
}
