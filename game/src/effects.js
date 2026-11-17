// Crown Bay — effects.js rewritten in recorded session fix7, 18 Nov 2026.
// Juice: particle bursts (muzzle flash, impact sparks, crash smoke), a
// screen-shake value the camera reads, and floating cash pickups. One pooled
// Points cloud, no allocation per frame.
import * as THREE from 'three';

export function createEffects(scene) {
  const MAX = 600;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(MAX * 3);
  const col = new Float32Array(MAX * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.32, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }));
  points.frustumCulled = false;
  scene.add(points);
  const parts = [];
  for (let i = 0; i < MAX; i += 1) parts.push({ alive: false, x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, r: 1, g: 1, b: 1 });
  let cursor = 0;
  let shake = 0;

  function spawn(x, y, z, vx, vy, vz, life, r, g, b) {
    const p = parts[cursor];
    cursor = (cursor + 1) % MAX;
    p.alive = true; p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = life; p.max = life; p.r = r; p.g = g; p.b = b;
  }

  return {
    get shake() { return shake; },
    addShake(amount) { shake = Math.min(1.2, shake + amount); },
    muzzle(x, y, z, dir) {
      for (let i = 0; i < 10; i += 1) {
        spawn(x, y, z, dir.x * 14 + (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 3, dir.z * 14 + (Math.random() - 0.5) * 5, 0.14, 1, 0.85, 0.3);
      }
    },
    sparks(x, y, z) {
      for (let i = 0; i < 14; i += 1) {
        spawn(x, y, z, (Math.random() - 0.5) * 9, Math.random() * 6, (Math.random() - 0.5) * 9, 0.4, 1, 0.6, 0.15);
      }
    },
    smoke(x, y, z) {
      for (let i = 0; i < 6; i += 1) {
        spawn(x + (Math.random() - 0.5), y + Math.random() * 0.5, z + (Math.random() - 0.5), (Math.random() - 0.5) * 1.5, 1.5 + Math.random(), (Math.random() - 0.5) * 1.5, 1.1, 0.35, 0.35, 0.35);
      }
    },
    cashBurst(x, y, z) {
      for (let i = 0; i < 18; i += 1) {
        spawn(x, y, z, (Math.random() - 0.5) * 6, 3 + Math.random() * 4, (Math.random() - 0.5) * 6, 0.9, 0.15, 0.85, 0.2);
      }
    },
    step(dt) {
      shake = Math.max(0, shake - dt * 2.2);
      for (let i = 0; i < MAX; i += 1) {
        const p = parts[i];
        if (!p.alive) { pos[i * 3 + 1] = -100; continue; }
        p.life -= dt;
        if (p.life <= 0) { p.alive = false; pos[i * 3 + 1] = -100; continue; }
        p.vy -= 6 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < 0.05) { p.y = 0.05; p.vy = 0; }
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
        const fade = p.life / p.max;
        col[i * 3] = p.r * fade; col[i * 3 + 1] = p.g * fade; col[i * 3 + 2] = p.b * fade;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}
