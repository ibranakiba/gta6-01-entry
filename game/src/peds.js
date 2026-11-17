// Crown Bay — peds.js rewritten in recorded session fix7, 18 Nov 2026.
// The people (and animals) of Crown Bay. Pedestrians are all different —
// height, build, skin, clothes, hair, walk speed and behaviour: strollers,
// chatters, crosswalk waiters, and runners who flee gunfire or a police chase.
// Dogs follow owners or roam stray, cats lounge, birds flock and perch, fish
// swim and sometimes jump in the bay.
import * as THREE from 'three';
import { CITY } from './config.js';

const pedBox = new THREE.BoxGeometry(1, 1, 1);
const pedSph = new THREE.SphereGeometry(1, 10, 8);

const SKINS = [0xe8b88a, 0xc98a5a, 0x8a5a34, 0xf0c8a0, 0x6a3a22, 0xd8a878];
const SHIRTS = [0xc8102e, 0x2a6bc8, 0x3a8a5f, 0xe8b800, 0x8a4a8a, 0xd8d8d8, 0x222222, 0xe8641a, 0x00a8a8, 0x7a3cff];
const PANTS = [0x2a3a5a, 0x333333, 0x5a4a3a, 0x4a5a6a, 0x7a2a2a, 0x1a1a1a];
const HAIRS = [0x1a1a1a, 0x4a2a1a, 0x8a6a3a, 0xd8d8d8, 0x6a1a1a, 0x2a2a4a];

function pedMaterial(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
}

// Build one pedestrian mesh. opts: female, club (sparkly outfit), scale.
export function createPedMesh(rng, opts = {}) {
  const group = new THREE.Group();
  const h = opts.scale ?? rng.range(0.92, 1.12);
  const wide = rng.range(0.85, 1.25);
  const skin = pedMaterial(rng.pick(SKINS));
  const shirt = pedMaterial(opts.club ? rng.pick([0xff2ad8, 0x22d8ff, 0xffd23c, 0xffffff, 0xc8102e]) : rng.pick(SHIRTS));
  const pants = pedMaterial(opts.club ? 0x111111 : rng.pick(PANTS));
  const hairM = pedMaterial(rng.pick(HAIRS));

  const legL = new THREE.Mesh(pedBox, pants);
  legL.scale.set(0.14 * wide, 0.8 * h, 0.16); legL.position.set(-0.11 * wide, 0.4 * h, 0);
  const legR = legL.clone(); legR.position.x = 0.11 * wide;
  const torso = new THREE.Mesh(pedBox, shirt);
  torso.scale.set(0.52 * wide, 0.62 * h, 0.28); torso.position.y = 1.11 * h;
  const armL = new THREE.Mesh(pedBox, shirt);
  armL.scale.set(0.12, 0.58 * h, 0.14); armL.position.set(-0.33 * wide, 1.12 * h, 0);
  const armR = armL.clone(); armR.position.x = 0.33 * wide;
  const head = new THREE.Mesh(pedSph, skin);
  head.scale.setScalar(0.21 * h); head.position.y = 1.62 * h;
  const hair = new THREE.Mesh(pedSph, hairM);
  hair.scale.set(0.22 * h, 0.16 * h, 0.22 * h); hair.position.y = 1.72 * h;
  if (opts.female) {
    hair.scale.set(0.23 * h, 0.26 * h, 0.23 * h);
    hair.position.set(0, 1.68 * h, -0.03);
    torso.scale.set(0.5 * wide, 0.6 * h, 0.3);
  }
  for (const m of [legL, legR, torso, armL, armR, head, hair]) { m.castShadow = true; group.add(m); }
  group.userData = { legL, legR, armL, armR, torso, head, h };
  return group;
}

export function createPeds(scene, rng, sidewalkSpots, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const spot = rng.pick(sidewalkSpots);
    const female = rng.chance(0.45);
    const mesh = createPedMesh(rng, { female });
    const x = spot.x + rng.range(-16, 16);
    const z = spot.z + rng.range(-16, 16);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const behaviour = rng.pick(['walk', 'walk', 'walk', 'stand', 'chat', 'wait']);
    peds.push({
      mesh, x, z,
      heading: rng.range(0, Math.PI * 2),
      speed: 0,
      baseSpeed: rng.range(0.9, 1.9),
      state: behaviour,
      target: null,
      waitTimer: rng.range(1, 6),
      walkPhase: rng.range(0, Math.PI * 2),
      scared: 0,
      female,
      club: false,
      paired: null,
    });
  }
  // chatting pairs stand close together
  for (let i = 0; i < peds.length - 1; i += 2) {
    if (peds[i].state === 'chat') {
      peds[i + 1].state = 'chat';
      peds[i + 1].x = peds[i].x + 0.9;
      peds[i + 1].z = peds[i].z + 0.4;
      peds[i].paired = peds[i + 1];
      peds[i + 1].paired = peds[i];
    }
  }
  return peds;
}

function nearestSidewalk(p, sidewalkSpots, rng) {
  return rng.pick(sidewalkSpots);
}

// Beachgoers: sunbathers lying on towels + loungers standing by the
// umbrellas. They lie flat (rotation.x = -PI/2, restY lifts the body off
// the sand) and stand up if they get scared — pedsStep resets lieFlat
// when fleeing, so a scared sunbather gets up and runs like everyone else.
export function createBeachgoers(scene, rng, spots) {
  const peds = [];
  for (const s of spots) {
    const female = rng.chance(0.5);
    const mesh = createPedMesh(rng, { female });
    mesh.position.set(s.x + rng.range(-0.3, 0.3), 0, s.z + rng.range(-0.3, 0.3));
    if (s.lying) mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);
    peds.push({
      mesh, x: s.x, z: s.z,
      heading: rng.range(0, Math.PI * 2),
      speed: 0,
      baseSpeed: rng.range(0.9, 1.5),
      state: 'stand',
      target: null,
      waitTimer: rng.range(1, 6),
      walkPhase: rng.range(0, Math.PI * 2),
      scared: 0,
      female,
      club: false,
      paired: null,
      lieFlat: !!s.lying,
      restY: s.lying ? 0.32 : 0,
    });
  }
  return peds;
}

// Scare source: {x, z, radius}. Peds inside flee; the scare decays.
// inClub: the player is inside Club Lumen — club peds use interior bounds.
export function pedsStep(peds, dt, time, sidewalkSpots, rng, scare, playerPos, inClub) {
  const clubBounds = { minX: -16, maxX: 16, minZ: 408, maxZ: 432 };
  for (const p of peds) {
    if (p.club && !inClub) continue;
    if (!p.club && inClub) continue;
    // flee?
    let fleeing = false;
    if (scare && Math.hypot(p.x - scare.x, p.z - scare.z) < scare.radius) {
      p.scared = 3;
    }
    if (p.scared > 0) {
      p.scared -= dt;
      fleeing = true;
      // a lying sunbather gets up and runs
      if (p.lieFlat) { p.mesh.rotation.x = 0; p.restY = 0; p.lieFlat = false; }
      const dx = p.x - (scare ? scare.x : playerPos.x);
      const dz = p.z - (scare ? scare.z : playerPos.z);
      const d = Math.hypot(dx, dz) || 1;
      p.heading = Math.atan2(dz / d, dx / d);
      p.speed = p.baseSpeed * 3.2;
    } else if (p.state === 'walk') {
      if (!p.target || Math.hypot(p.target.x - p.x, p.target.z - p.z) < 1.5) {
        const s = nearestSidewalk(p, sidewalkSpots, rng);
        p.target = { x: s.x + rng.range(-14, 14), z: s.z + rng.range(-14, 14) };
      }
      const dx = p.target.x - p.x, dz = p.target.z - p.z;
      const d = Math.hypot(dx, dz) || 1;
      p.heading = Math.atan2(dz, dx);
      p.speed = p.baseSpeed;
    } else if (p.state === 'wait') {
      // waiting at a crosswalk: stand still, then cross when the timer ends
      p.waitTimer -= dt;
      p.speed = 0;
      if (p.waitTimer <= 0) {
        p.state = 'walk';
        p.waitTimer = rng.range(3, 8);
      }
    } else if (p.state === 'dance') {
      p.speed = 0;
      p.dancePhase = (p.dancePhase ?? 0) + dt * 6;
    } else {
      p.speed = 0; // stand / chat
    }
    p.x += Math.cos(p.heading) * p.speed * dt;
    p.z += Math.sin(p.heading) * p.speed * dt;
    if (p.club) {
      p.x = Math.max(clubBounds.minX, Math.min(clubBounds.maxX, p.x));
      p.z = Math.max(clubBounds.minZ, Math.min(clubBounds.maxZ, p.z));
    } else {
      p.x = Math.max(-CITY.half - 4, Math.min(CITY.seaX - 4, p.x));
      p.z = Math.max(-CITY.half - 4, Math.min(CITY.half + 4, p.z));
    }
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = -p.heading + Math.PI / 2;
    // walk cycle: legs and arms swing
    const u = p.mesh.userData;
    if (p.state === 'dance') {
      const ph = p.dancePhase;
      u.armL.rotation.x = Math.sin(ph) * 1.2;
      u.armR.rotation.x = -Math.sin(ph) * 1.2;
      u.armL.rotation.z = 0.6 + Math.sin(ph * 0.5) * 0.4;
      u.armR.rotation.z = -0.6 - Math.sin(ph * 0.5) * 0.4;
      u.torso.rotation.y = Math.sin(ph * 0.5) * 0.3;
      p.mesh.position.y = Math.abs(Math.sin(ph)) * 0.12;
    } else {
      p.walkPhase += dt * p.speed * 5;
      const swing = Math.sin(p.walkPhase) * (p.speed > 0.1 ? 0.55 : 0);
      u.legL.rotation.x = swing;
      u.legR.rotation.x = -swing;
      u.armL.rotation.x = -swing * 0.8;
      u.armR.rotation.x = swing * 0.8;
      u.armL.rotation.z = 0.08;
      u.armR.rotation.z = -0.08;
      u.torso.rotation.y = 0;
      p.mesh.position.y = (p.restY ?? 0) + Math.abs(Math.sin(p.walkPhase)) * 0.03;
    }
    // face a chat partner
    if (p.state === 'chat' && p.paired) {
      p.mesh.rotation.y = Math.atan2(p.paired.x - p.x, p.paired.z - p.z);
    }
  }
}

// ---- animals ----
export function createAnimals(scene, rng, peds) {
  const animals = { dogs: [], cats: [], birds: [], fish: [] };
  const dogMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.9 });
  const dogMat2 = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
  const dogMat3 = new THREE.MeshStandardMaterial({ color: 0xd8c8a8, roughness: 0.9 });

  function makeDog(x, z, owner) {
    const g = new THREE.Group();
    const m = rng.pick([dogMat, dogMat2, dogMat3]);
    const body = new THREE.Mesh(pedBox, m);
    body.scale.set(0.85, 0.4, 0.32); body.position.y = 0.45; body.castShadow = true;
    const head = new THREE.Mesh(pedBox, m);
    head.scale.set(0.3, 0.3, 0.28); head.position.set(0.55, 0.62, 0);
    const ear = new THREE.Mesh(pedBox, m);
    ear.scale.set(0.1, 0.18, 0.1); ear.position.set(0.48, 0.8, 0.1);
    const tail = new THREE.Mesh(pedBox, m);
    tail.scale.set(0.3, 0.08, 0.08); tail.position.set(-0.55, 0.62, 0); tail.rotation.z = 0.6;
    const legGeo = new THREE.BoxGeometry(0.09, 0.35, 0.09);
    const legs = [];
    for (const [lx, lz] of [[0.3, 0.1], [0.3, -0.1], [-0.3, 0.1], [-0.3, -0.1]]) {
      const leg = new THREE.Mesh(legGeo, m);
      leg.position.set(lx, 0.18, lz);
      legs.push(leg); g.add(leg);
    }
    g.add(body, head, ear, tail);
    g.position.set(x, 0, z);
    scene.add(g);
    const dog = { mesh: g, x, z, heading: rng.range(0, Math.PI * 2), speed: 0, owner, legs, tail, phase: rng.range(0, 6), stray: !owner };
    animals.dogs.push(dog);
    return dog;
  }
  // dogs with owners (walk beside a ped) and strays
  for (let i = 0; i < 8; i += 1) {
    const owner = peds[Math.floor(rng.next() * peds.length)];
    if (owner) makeDog(owner.x + 1, owner.z + 0.5, owner);
  }
  for (let i = 0; i < 6; i += 1) {
    makeDog(rng.range(-200, 200), rng.range(-200, 200), null);
  }
  // cats: sidewalks and rooftops
  const catMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 });
  const catMat2 = new THREE.MeshStandardMaterial({ color: 0xd88a2a, roughness: 0.9 });
  for (let i = 0; i < 10; i += 1) {
    const g = new THREE.Group();
    const m = rng.pick([catMat, catMat2]);
    const body = new THREE.Mesh(pedBox, m);
    body.scale.set(0.5, 0.22, 0.2); body.position.y = 0.28; body.castShadow = true;
    const head = new THREE.Mesh(pedSph, m);
    head.scale.setScalar(0.14); head.position.set(0.3, 0.42, 0);
    const tail = new THREE.Mesh(pedBox, m);
    tail.scale.set(0.3, 0.06, 0.06); tail.position.set(-0.35, 0.4, 0); tail.rotation.z = 0.9;
    g.add(body, head, tail);
    const x = rng.range(-220, 220), z = rng.range(-220, 220);
    g.position.set(x, 0, z);
    scene.add(g);
    animals.cats.push({ mesh: g, x, z, heading: rng.range(0, Math.PI * 2), phase: rng.range(0, 6), wait: rng.range(0, 5) });
  }
  // birds: a flock circling the bay + perched birds on lamp posts
  const birdMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
  for (let i = 0; i < 20; i += 1) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(pedBox, birdMat);
    body.scale.set(0.35, 0.12, 0.14);
    const wingL = new THREE.Mesh(pedBox, birdMat);
    wingL.scale.set(0.25, 0.03, 0.5); wingL.position.set(0, 0.06, 0.3);
    const wingR = wingL.clone(); wingR.position.z = -0.3;
    g.add(body, wingL, wingR);
    scene.add(g);
    animals.birds.push({
      mesh: g, wingL, wingR,
      cx: rng.range(100, 280), cz: rng.range(-200, 200),
      r: rng.range(20, 60), h: rng.range(25, 60),
      speed: rng.range(0.15, 0.4), phase: rng.range(0, Math.PI * 2),
      perched: false,
    });
  }
  for (let i = 0; i < 5; i += 1) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(pedBox, birdMat);
    body.scale.set(0.3, 0.12, 0.12);
    g.add(body);
    const x = rng.range(-200, 200), z = rng.range(-200, 200);
    g.position.set(x, 6.5, z);
    scene.add(g);
    animals.birds.push({ mesh: g, wingL: null, wingR: null, cx: x, cz: z, r: 0, h: 6.5, speed: 0, phase: 0, perched: true, px: x, pz: z });
  }
  // fish in the bay (and a river pond in Meridian Park is covered by the same set)
  const fishMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.4, metalness: 0.5 });
  const fishMat2 = new THREE.MeshStandardMaterial({ color: 0xe8a800, roughness: 0.4, metalness: 0.5 });
  for (let i = 0; i < 36; i += 1) {
    const g = new THREE.Group();
    const m = rng.pick([fishMat, fishMat2]);
    const body = new THREE.Mesh(pedBox, m);
    body.scale.set(0.5, 0.14, 0.14);
    const tail = new THREE.Mesh(pedBox, m);
    tail.scale.set(0.2, 0.2, 0.04); tail.position.set(-0.32, 0, 0);
    g.add(body, tail);
    const x = CITY.seaX + rng.range(4, 90);
    const z = rng.range(-260, 260);
    g.position.set(x, -0.6, z);
    scene.add(g);
    animals.fish.push({
      mesh: g, x, z, cx: x, cz: z, r: rng.range(2, 10),
      speed: rng.range(0.3, 0.9), phase: rng.range(0, Math.PI * 2),
      jump: rng.chance(0.25) ? rng.range(4, 12) : 0, jumpT: rng.range(0, 10),
    });
  }
  return animals;
}

export function animalsStep(animals, dt, time, playerPos, scare) {
  // dogs
  for (const d of animals.dogs) {
    let tx, tz, wantSpeed;
    if (d.owner) { tx = d.owner.x; tz = d.owner.z; wantSpeed = 2.2; }
    else {
      if (!d.target || Math.hypot(d.target.x - d.x, d.target.z - d.z) < 2) {
        d.target = { x: d.x + (Math.random() - 0.5) * 60, z: d.z + (Math.random() - 0.5) * 60 };
      }
      tx = d.target.x; tz = d.target.z; wantSpeed = 1.4;
    }
    const dx = tx - d.x, dz = tz - d.z;
    const dist = Math.hypot(dx, dz);
    if (d.owner && dist < 1.2) { d.speed = 0; }
    else if (dist > 0.1) {
      d.heading = Math.atan2(dz, dx);
      d.speed = wantSpeed;
    }
    // flee gunfire
    if (scare && Math.hypot(d.x - scare.x, d.z - scare.z) < scare.radius) {
      d.heading = Math.atan2(d.z - scare.z, d.x - scare.x);
      d.speed = 5;
    }
    d.x += Math.cos(d.heading) * d.speed * dt;
    d.z += Math.sin(d.heading) * d.speed * dt;
    d.mesh.position.set(d.x, 0, d.z);
    d.mesh.rotation.y = -d.heading;
    d.phase += dt * d.speed * 6;
    d.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(d.phase + (i % 2) * Math.PI) * 0.5 * Math.min(1, d.speed); });
    d.tail.rotation.z = 0.6 + Math.sin(time * 6) * 0.3;
  }
  // cats: mostly sit, occasionally stroll
  for (const c of animals.cats) {
    c.wait -= dt;
    if (c.wait <= 0) {
      c.wait = Math.random() * 6 + 2;
      c.heading = Math.random() * Math.PI * 2;
      c.stroll = Math.random() * 4;
    }
    if (c.stroll > 0) {
      c.stroll -= dt;
      c.x += Math.cos(c.heading) * 0.8 * dt;
      c.z += Math.sin(c.heading) * 0.8 * dt;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = -c.heading;
    }
  }
  // birds
  for (const b of animals.birds) {
    if (b.perched) {
      // take off if the player gets close
      if (playerPos && Math.hypot(b.px - playerPos.x, b.pz - playerPos.z) < 6) {
        b.perched = false;
        b.cx = b.px; b.cz = b.pz; b.r = 20; b.h = 20; b.speed = 0.4; b.phase = 0;
      }
      continue;
    }
    b.phase += dt * b.speed;
    const x = b.cx + Math.cos(b.phase) * b.r;
    const z = b.cz + Math.sin(b.phase) * b.r;
    const y = b.h + Math.sin(time * 1.3 + b.phase) * 2;
    b.mesh.position.set(x, y, z);
    b.mesh.rotation.y = -Math.atan2(Math.cos(b.phase), -Math.sin(b.phase)) + Math.PI / 2;
    if (b.wingL) {
      const flap = Math.sin(time * 10 + b.phase) * 0.7;
      b.wingL.rotation.x = flap;
      b.wingR.rotation.x = -flap;
    }
  }
  // fish: swim in circles just under the surface, some leap
  for (const f of animals.fish) {
    f.phase += dt * f.speed;
    const x = f.cx + Math.cos(f.phase) * f.r;
    const z = f.cz + Math.sin(f.phase) * f.r;
    let y = -0.6;
    if (f.jump > 0) {
      f.jumpT -= dt;
      if (f.jumpT <= 0) {
        f.jumpT = f.jump;
        f.jumpAnim = 0;
      }
    }
    if (f.jumpAnim !== undefined && f.jumpAnim < 1) {
      f.jumpAnim += dt * 1.4;
      const t = f.jumpAnim;
      y = -0.6 + Math.sin(t * Math.PI) * 1.6;
    }
    f.mesh.position.set(x, y, z);
    f.mesh.rotation.y = -Math.atan2(Math.cos(f.phase), -Math.sin(f.phase));
    f.mesh.rotation.z = f.jumpAnim !== undefined && f.jumpAnim < 1 ? Math.sin(f.jumpAnim * Math.PI) * 0.5 : 0;
  }
}

// Club dancers: stylish women in club outfits dancing on the floor.
export function createClubDancers(scene, rng, count) {
  const dancers = [];
  for (let i = 0; i < count; i += 1) {
    const mesh = createPedMesh(rng, { female: true, club: true });
    const x = rng.range(-5, 5);
    const z = 420 + rng.range(-4, 4);
    mesh.position.set(x, 0, z);
    mesh.visible = false;
    scene.add(mesh);
    dancers.push({ mesh, x, z, state: 'dance', dancePhase: rng.range(0, 6), baseSpeed: 0, scared: 0, club: true, walkPhase: 0, heading: rng.range(0, 6), paired: null });
  }
  // one bartender behind the bar
  const bar = createPedMesh(rng, { female: rng.chance(0.5) });
  bar.position.set(15.5, 0, 428);
  bar.visible = false;
  scene.add(bar);
  dancers.push({ mesh: bar, x: 15.5, z: 428, state: 'stand', dancePhase: 0, baseSpeed: 0, scared: 0, club: true, walkPhase: 0, heading: -Math.PI / 2, paired: null });
  return dancers;
}
