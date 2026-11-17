// Crown Bay — the short-lived stuff: muzzle flashes, sparks, smoke,
// the burst of cash when a job pays out, and the camera shake that
// sells every impact. Nothing here lives longer than a second or two;
// everything is pooled, so a firefight never allocates mid-frame.
import * as THREE from 'three';

// One reusable pool of tiny bright quads. Each burst grabs a few,
// gives them a velocity and a life, and hands them back when they die.
function makePool(scene, count, size, color) {
  const geo = new THREE.PlaneGeometry(size, size);
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  scene.add(mesh);
  const items = [];
  for (let i = 0; i < count; i += 1) {
    items.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, grow: 0 });
  }
  return { mesh, items };
}

export function createEffects(scene) {
  const sparks = makePool(scene, 90, 0.22, 0xffc23c);
  const puffs = makePool(scene, 60, 0.9, 0x9a9a9a);
  const cash = makePool(scene, 50, 0.3, 0x37d67a);
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.4),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  flash.visible = false;
  scene.add(flash);
  let flashLife = 0;
  let shakeAmount = 0;

  const dummy = new THREE.Object3D();

  function burst(pool, x, y, z, n, speed, up, life, spread = 1) {
    let placed = 0;
    for (const it of pool.items) {
      if (placed >= n) break;
      if (it.alive) continue;
      it.alive = true;
      it.x = x; it.y = y; it.z = z;
      const a = Math.random() * Math.PI * 2;
      const r = (0.4 + Math.random() * 0.6) * speed * spread;
      it.vx = Math.cos(a) * r;
      it.vz = Math.sin(a) * r;
      it.vy = (Math.random() * 0.8 + 0.2) * up;
      it.life = life * (0.6 + Math.random() * 0.7);
      it.max = it.life;
      it.grow = 0;
      placed += 1;
    }
  }

  function writePool(pool, dt) {
    let n = 0;
    for (const it of pool.items) {
      if (!it.alive) continue;
      it.life -= dt;
      if (it.life <= 0) { it.alive = false; continue; }
      it.vy -= 3.5 * dt;
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      it.z += it.vz * dt;
      if (it.y < 0.05) { it.y = 0.05; it.vy = 0; }
      dummy.position.set(it.x, it.y, it.z);
      dummy.lookAt(dummy.position.x + 1, dummy.position.y, dummy.position.z);
      const fade = it.life / it.max;
      const s = 0.6 + (1 - fade) * 0.9;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      pool.mesh.setMatrixAt(n, dummy.matrix);
      n += 1;
    }
    pool.mesh.count = n;
    pool.mesh.instanceMatrix.needsUpdate = true;
    // Fade the whole pool with the average life left: cheap, and it
    // reads as the burst dying rather than popping out one by one.
    let sum = 0;
    let alive = 0;
    for (const it of pool.items) {
      if (!it.alive) continue;
      sum += it.life / it.max;
      alive += 1;
    }
    pool.mesh.material.opacity = alive === 0 ? 0 : Math.min(0.95, (sum / alive) * 1.1);
  }

  return {
    // Camera shake: world.js reads this every frame and jitters the
    // camera by it. It decays on its own in step().
    get shake() { return shakeAmount; },
    addShake(amount) {
      shakeAmount = Math.min(1.2, shakeAmount + amount);
    },
    // A bright flash at the muzzle plus a fan of sparks forward.
    muzzle(x, y, z, dir) {
      flash.position.set(x + dir.x * 0.5, y, z + dir.z * 0.5);
      flash.rotation.y = Math.atan2(dir.x, dir.z);
      flash.visible = true;
      flashLife = 0.07;
      burst(sparks, x, y, z, 7, 9, 2.5, 0.28);
    },
    // A small yellow-white burst where a bullet lands.
    sparks(x, y, z) {
      burst(sparks, x, y, z, 10, 7, 4, 0.4);
    },
    // A single long-lived puff for exhaust and dust: slower, wider,
    // and it hangs in the air a little longer than impact smoke.
    puff(x, y, z) {
      burst(puffs, x, y, z, 3, 0.8, 1.4, 1.8, 1.2);
    },
    // Grey smoke that climbs and spreads: a wrecked or shot-up car.
    smoke(x, y, z) {
      burst(puffs, x, y, z, 8, 1.6, 3.2, 1.4, 1.6);
    },
    // Green notes flying when a mission pays out.
    cashBurst(x, y, z) {
      burst(cash, x, y, z, 26, 5, 6.5, 0.9);
    },
    step(dt) {
      shakeAmount = Math.max(0, shakeAmount - dt * 2.4);
      if (flashLife > 0) {
        flashLife -= dt;
        flash.material.opacity = Math.max(0, flashLife / 0.07) * 0.9;
        if (flashLife <= 0) flash.visible = false;
      }
      writePool(sparks, dt);
      writePool(puffs, dt);
      writePool(cash, dt);
    },
  };
}
