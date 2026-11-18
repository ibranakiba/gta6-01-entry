// Crown Bay — world.js rewritten in recorded session fix9, 18 Nov 2026.
// Crown Bay — the game itself. Owns the scene, the camera, the player, the
// traffic, the police, the missions and the day: every system wired together.
// Screens: title, play, paused, over (wasted / busted / legend).
import * as THREE from 'three';
import { BEST_KEY, CITY, MISSIONS, PLAYER, SAVE_KEY, STEP, VEHICLE_TYPES } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_HORN, ACTION_JUMP, ACTION_MAP, ACTION_PAUSE, ACTION_RELOAD, ACTION_SHOOT, createInput } from './input.js';
import { buildCity, groundHeightAt } from './city.js';
import { createVehicleMesh, driveStep, flyStep, makeVehicle, randomTrafficType, setVehicleLights, trafficStep } from './vehicles.js';
import { animalsStep, createAnimals, createBeachgoers, createClubDancers, createPeds, pedsStep } from './peds.js';
import { createPlayerMesh, createPlayerState, playerStep, shootAt, updatePlayerMesh } from './player.js';
import { addWanted, clearWanted, createPolice, policeStep } from './police.js';
import { createMissions, currentMission, currentStep, missionsStep } from './missions.js';
import { createWeather, weatherStep } from './weather.js';
import { createEffects } from './effects.js';
import { createHud } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const SPAWN = { x: -87, z: 122 };

export function createGame(canvas, seed) {
  const rng = createRandom(seed);
  // preserveDrawingBuffer keeps the last presented frame readable by the
  // compositor (and by screenshot/capture tooling). Without it, headless
  // SwiftShader builds can present a stale/blank region of the canvas
  // (a dark square where the frame was never composited). Negligible cost
  // for a low-poly scene, and it makes the game capture-friendly.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5d9);
  scene.fog = new THREE.Fog(0x9db8cc, 120, 620);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

  const audio = createAudio();
  const input = createInput(canvas);
  const hud = createHud();
  const city = buildCity(scene, rng);
  const weather = createWeather(scene, rng);
  const effects = createEffects(scene);
  const police = createPolice(scene);
  const missions = createMissions();

  // --- player ---
  const playerMesh = createPlayerMesh();
  scene.add(playerMesh);
  const player = createPlayerState(SPAWN.x, SPAWN.z);
  playerMesh.position.set(player.x, 0, player.z);

  // --- vehicles: traffic, parked, aircraft ---
  // Dense streets: 60 moving cars (was 34) + 34 parked (was 26) so the
  // roads feel alive in all three districts without choking the renderer
  // (traffic cars share geometries; see vehicles.js).
  const vehicles = [];
  for (let i = 0; i < 60; i += 1) {
    const type = randomTrafficType(rng);
    const street = rng.pick(city.streetCenters);
    const along = rng.range(-280, 280);
    const onX = rng.chance(0.5);
    const x = onX ? along : street;
    const z = onX ? street : along;
    const def = VEHICLE_TYPES[type];
    const v = makeVehicle(scene, type, x, z, rng.range(0, Math.PI * 2), rng.pick(def.colors), { traffic: true });
    vehicles.push(v);
  }
  for (let i = 0; i < 34; i += 1) {
    const spot = city.parkedSpots[i % city.parkedSpots.length];
    const type = randomTrafficType(rng);
    const def = VEHICLE_TYPES[type];
    const v = makeVehicle(scene, type, spot.x, spot.z, spot.angle, rng.pick(def.colors), { parked: true });
    vehicles.push(v);
  }
  // aircraft: heli on the Crown Spire roof + one at the airfield, plane on the runway
  const spire = city.landmarks.get('Crown Spire');
  const heli1 = makeVehicle(scene, 'helicopter', city.heliPad.x, city.heliPad.z, 0, 0xd8d8d8, { y: city.heliPad.y });
  const heli2 = makeVehicle(scene, 'helicopter', -232, -261 + 9 * 58 + 30, Math.PI / 2, 0xc8102e, { y: 0.7 });
  const plane = makeVehicle(scene, 'plane', city.planeSpot.x, city.planeSpot.z, city.planeSpot.angle, 0xd8d8d8, { y: 0 });
  vehicles.push(heli1, heli2, plane);

  // CBPD patrol heli: an NPC helicopter with a pilot in the cockpit that
  // flies a loop over downtown — never parked, never stealable (it is NOT
  // in `vehicles`, so the player can never enter it). When wanted > 0 it
  // breaks off the loop, hovers over the player and aims its searchlight.
  const patrolHeli = makeVehicle(scene, 'helicopter', -58, -232, 0, 0xc8102e, { y: 62, pilot: true, police: true });
  patrolHeli.patrol = true;
  patrolHeli.routeIndex = 0;
  // loop along street centres (clear of every tower, incl. the 150 m Spire
  // which sits inside the loop, never on it)
  const patrolRoute = [{ x: -58, z: -232 }, { x: 174, z: -232 }, { x: 174, z: 58 }, { x: -58, z: 58 }];
  // police searchlight: real spotlight + visible beam cone, only while wanted
  const searchlight = new THREE.SpotLight(0xffffff, 0, 130, 0.42, 0.45, 1.0);
  scene.add(searchlight);
  scene.add(searchlight.target);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(1, 1, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  beam.visible = false;
  scene.add(beam);

  // --- people and animals ---
  // 130 pedestrians (was 72): the sidewalks read as a crowd now, spread
  // over every district via the shared sidewalkSpots pool.
  const peds = createPeds(scene, rng, city.sidewalkSpots, 130);
  // Crown Beach sunbathers + loungers (stand up and flee if scared)
  peds.push(...createBeachgoers(scene, rng, city.beachSpots));
  const dancers = createClubDancers(scene, rng, 10);
  const animals = createAnimals(scene, rng, peds);

  // --- headlight (one spotlight, follows the driven vehicle) ---
  // Strong (380) and on from dusk (night01 > 0.15): at night the beam is
  // the main thing that makes the road ahead — and the car itself — readable.
  const headlight = new THREE.SpotLight(0xffeeb0, 0, 90, 0.6, 0.5, 1.0);
  scene.add(headlight);
  scene.add(headlight.target);

  // --- objective beacon ---
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.55 });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true), beaconMat);
  beacon.position.set(0, 30, 0);
  scene.add(beacon);
  const beaconTop = new THREE.Mesh(new THREE.OctahedronGeometry(1.1), new THREE.MeshBasicMaterial({ color: 0xffd23c }));
  scene.add(beaconTop);

  const state = {
    screen: SCREEN_TITLE,
    elapsed: 0,
    time: 0,
    camYaw: Math.PI * 0.75,
    camPitch: 0.32,
    camDist: 8,
    camFreeUntil: 0, // chase-cam: mouse look holds the camera until this time
    inClub: false,
    overReason: null,
    best: 0,
    saveTimer: 0,
    messageCooldown: 0,
    scare: null,
    autoSave: 0,
    mapBig: false,
  };

  function readBest() {
    try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { return 0; }
  }
  function saveBest(value) {
    try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* private mode */ }
  }
  state.best = readBest();

  function saveGame() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: player.cash,
        missionsDone: missions.done,
        current: missions.current,
        step: missions.step,
        x: player.x, z: player.z,
        timeHours: weather.timeHours,
        health: player.health,
      }));
    } catch { /* private mode */ }
  }
  function loadGame() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      player.cash = s.cash || 0;
      player.health = s.health || 100;
      player.x = s.x ?? SPAWN.x;
      player.z = s.z ?? SPAWN.z;
      weather.timeHours = s.timeHours ?? 10.5;
      missions.done = s.missionsDone || [];
      missions.current = s.current ?? 0;
      missions.step = s.step ?? 0;
      return true;
    } catch { return false; }
  }
  const hasSave = (() => { try { return !!window.localStorage.getItem(SAVE_KEY); } catch { return false; } })();

  function nearestVehicle(maxDist) {
    let best = null, bd = maxDist;
    for (const v of vehicles) {
      if (v.police) continue;
      const d = Math.hypot(v.x - player.x, v.z - player.z);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  function enterVehicle(v) {
    player.inVehicle = v;
    v.parked = false;
    v.traffic = false;
    v.ai = null;
    playerMesh.visible = false;
    const isAircraft = v.def.kind === 'heli' || v.def.kind === 'plane';
    hud.message(isAircraft ? `Flying the ${v.def.label}` : `Driving the ${v.def.label}`, 2.5);
    if (v.type !== 'bicycle' && !v._stolen) {
      v._stolen = true;
      const seen = police.cars.some((c) => Math.hypot(c.x - v.x, c.z - v.z) < 60)
        || peds.some((p) => Math.hypot(p.x - v.x, p.z - v.z) < 22);
      if (seen) {
        const r = addWanted(police, 12, 'Grand theft auto');
        if (r.changed) { hud.message('Wanted! The CBPD saw you steal that car.', 3); audio.wantedUp(); }
      }
    }
  }

  function exitVehicle() {
    const v = player.inVehicle;
    if (!v) return;
    player.inVehicle = null;
    const side = 2.6;
    player.x = v.x + Math.cos(v.heading + Math.PI / 2) * side;
    player.z = v.z + Math.sin(v.heading + Math.PI / 2) * side;
    player.y = groundHeightAt(player.x, player.z);
    playerMesh.visible = true;
    v.speed = 0;
  }

  function tryShoot() {
    // face the crosshair: the character turns toward the aim direction so
    // the gun, the muzzle flash and the shot all line up with the crosshair.
    player.heading = state.camYaw;
    if (player.reloading > 0) return;
    if (player.ammo <= 0) {
      hud.message('Out of ammo — press R to reload', 2);
      audio.reload();
      return;
    }
    player.ammo -= 1;
    audio.gunshot();
    const muzzleX = player.x + Math.cos(player.heading) * 0.8;
    const muzzleZ = player.z + Math.sin(player.heading) * 0.8;
    effects.muzzle(muzzleX, 1.3, muzzleZ, { x: Math.cos(player.heading), z: Math.sin(player.heading) });
    effects.addShake(0.12);
    state.scare = { x: player.x, z: player.z, radius: 30 };
    const targets = [];
    for (const p of peds) if (!p.club) targets.push({ x: p.x, z: p.z, radius: 0.8, kind: 'ped', ref: p });
    for (const o of police.officers) targets.push({ x: o.x, z: o.z, radius: 0.8, kind: 'officer', ref: o });
    for (const v of vehicles) targets.push({ x: v.x, z: v.z, radius: v.radius, kind: 'vehicle', ref: v });
    const hit = shootAt(player, state.camYaw, targets);
    if (hit) {
      const t = hit.target;
      effects.sparks(t.x, 1.2, t.z);
      if (t.kind === 'ped') {
        t.ref.state = 'down';
        t.ref.mesh.rotation.x = -Math.PI / 2;
        t.ref.mesh.position.y = 0.3;
        const r = addWanted(police, 25, 'Shooting a pedestrian');
        if (r.changed) audio.wantedUp();
      } else if (t.kind === 'officer') {
        const r = addWanted(police, 30, 'Shooting an officer');
        if (r.changed) audio.wantedUp();
        t.ref.speed = 0;
        t.ref.state = 'down';
        t.ref.mesh.rotation.x = -Math.PI / 2;
      } else if (t.kind === 'vehicle') {
        t.ref.damage = (t.ref.damage || 0) + 18;
        if (t.ref.damage > 60) effects.smoke(t.x, 1.5, t.z);
        const r = addWanted(police, 6, 'Shooting a car');
        if (r.changed) audio.wantedUp();
      }
    }
  }

  function endGame(reason) {
    state.screen = SCREEN_OVER;
    state.overReason = reason;
    audio.stopAll();
    const score = player.cash + missions.done.length * 1000;
    if (score > state.best) { state.best = score; saveBest(score); }
    if (reason === 'wasted') {
      hud.setOver('WASTED', [`Rook didn't make it out of Crown Bay.`, `Cash: $${player.cash.toLocaleString('en-US')} — Missions done: ${missions.done.length}/5`, `Best score: $${state.best.toLocaleString('en-US')}`], 'Press Enter to try again');
    } else if (reason === 'busted') {
      hud.setOver('BUSTED', [`The CBPD caught up with Rook.`, `Cash kept: $${Math.floor(player.cash / 2).toLocaleString('en-US')} (half seized)`, `Missions done: ${missions.done.length}/5`], 'Press Enter to keep playing');
    } else if (reason === 'legend') {
      hud.setOver('CROWN BAY LEGEND', [`All five jobs done. The Big Score is yours.`, `Final cash: $${player.cash.toLocaleString('en-US')}`, `Best score: $${state.best.toLocaleString('en-US')}`], 'Press Enter to keep playing');
    }
    hud.showScreen('over');
    saveGame();
  }

  function startGame(fresh) {
    if (fresh) {
      player.cash = 0;
      player.health = PLAYER.health;
      player.x = SPAWN.x; player.z = SPAWN.z; player.y = 0;
      player.inVehicle = null;
      playerMesh.visible = true;
      missions.current = 0;
      missions.step = 0;
      missions.done = [];
      clearWanted(police, scene);
      weather.timeHours = 10.5;
    }
    state.screen = SCREEN_PLAY;
    hud.showScreen('play');
    audio.unlock();
    hud.message('Welcome to Crown Bay. Marla Voss is waiting — check your mission.', 5);
  }

  function updateCamera(dt) {
    const target = player.inVehicle ? player.inVehicle : player;
    const tx = target.x, tz = target.z;
    const ty = (target.y ?? 0) + (player.inVehicle ? 2.2 : 1.6);
    const dist = player.inVehicle ? 11 : 8;
    state.camDist += (dist - state.camDist) * Math.min(1, dt * 4);
    let cx = tx - Math.cos(state.camYaw) * Math.cos(state.camPitch) * state.camDist;
    let cz = tz - Math.sin(state.camYaw) * Math.cos(state.camPitch) * state.camDist;
    const cy = ty + Math.sin(state.camPitch) * state.camDist + 1.2;
    // Over-the-shoulder on foot: the camera looks past the player at the
    // aim point ahead, from a shoulder offset — the character drops to
    // the lower left of the frame and the crosshair (screen centre) points
    // at what the shot will actually hit, instead of sitting on the
    // player's head. In a vehicle nothing changes (chase cam as before).
    let lx = tx, ly = ty, lz = tz;
    if (!player.inVehicle) {
      const fx = Math.cos(state.camYaw), fz = Math.sin(state.camYaw);
      lx = tx + fx * 6; lz = tz + fz * 6; ly = 1.5;
      cx += -fz * 1.3; cz += fx * 1.3; // camera over the right shoulder
    }
    const shake = effects.shake;
    camera.position.set(
      cx + (Math.random() - 0.5) * shake,
      Math.max(0.6, cy + (Math.random() - 0.5) * shake),
      cz + (Math.random() - 0.5) * shake,
    );
    camera.lookAt(lx, ly, lz);
  }

  function step(dt) {
    state.elapsed += dt;
    state.time += dt;
    const actions = input.takeActions();
    const look = input.takeLook();
    state.camYaw -= look.x * 0.0032;
    state.camPitch = Math.max(-0.15, Math.min(1.1, state.camPitch + look.y * 0.0028));

    if (state.screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame(false);
      // slow orbit over the city behind the title
      state.camYaw += dt * 0.03;
      const cx = 60, cz = -60;
      camera.position.set(cx + Math.cos(state.time * 0.05) * 160, 90, cz + Math.sin(state.time * 0.05) * 160);
      camera.lookAt(60, 20, -40);
      weatherStep(weather, dt, { x: 0, z: 0 });
      scene.background.copy(new THREE.Color(0x87b5d9));
      return;
    }
    if (state.screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        state.screen = SCREEN_PLAY;
        hud.showScreen('play');
      }
      return;
    }
    if (state.screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) {
        if (state.overReason === 'legend') { state.screen = SCREEN_PLAY; hud.showScreen('play'); }
        else startGame(true);
      }
      return;
    }

    // --- play ---
    if (actions & ACTION_PAUSE) {
      state.screen = SCREEN_PAUSED;
      hud.showScreen('paused');
      return;
    }
    if (actions & ACTION_MAP) {
      state.mapBig = !state.mapBig;
      const mm = document.getElementById('minimap');
      if (mm) { mm.style.width = state.mapBig ? '420px' : '220px'; mm.style.height = state.mapBig ? '420px' : '220px'; }
    }
    if (actions & ACTION_HORN && player.inVehicle) audio.horn();
    if (actions & ACTION_RELOAD && player.ammo < 12 && player.ammoReserve > 0) {
      player.reloading = 0.9;
      audio.reload();
    }
    if (player.reloading > 0) {
      player.reloading -= dt;
      if (player.reloading <= 0) {
        const need = 12 - player.ammo;
        const take = Math.min(need, player.ammoReserve);
        player.ammo += take;
        player.ammoReserve -= take;
      }
    }
    if ((actions & ACTION_SHOOT) && !player.inVehicle) tryShoot();
    else if ((actions & ACTION_SHOOT) && player.inVehicle) audio.horn();

    const move = input.move();
    const run = input.run();

    // --- enter / exit vehicle ---
    if (actions & ACTION_ENTER) {
      if (player.inVehicle) exitVehicle();
      else {
        const v = nearestVehicle(4.5);
        if (v) enterVehicle(v);
        else hud.prompt('No vehicle nearby');
      }
    }

    // --- club door ---
    if (!state.inClub && city.clubDoor && !player.inVehicle) {
      const d = Math.hypot(player.x - city.clubDoor.x, player.z - city.clubDoor.z);
      if (d < 3.5) {
        state.inClub = true;
        player.x = 0; player.z = 420 + 10;
        city.clubInterior.group.visible = true;
        for (const dancer of dancers) dancer.mesh.visible = true;
        audio.setClub(true, 122);
        hud.message('Club Lumen — the dance floor is yours.', 3);
      } else if (d < 8) hud.prompt('Press E to enter Club Lumen');
      else hud.prompt('');
    }
    if (state.inClub) {
      const d = Math.hypot(player.x - 0, player.z - (420 + 12.5));
      if (d < 2.5) {
        state.inClub = false;
        player.x = city.clubDoor.x; player.z = city.clubDoor.z + 3;
        city.clubInterior.group.visible = false;
        for (const dancer of dancers) dancer.mesh.visible = false;
        audio.setClub(false);
        hud.message('Back on the streets of Crown Bay.', 2.5);
      }
    }

    // --- movement ---
    const wet = weather.raining;
    if (player.inVehicle) {
      const v = player.inVehicle;
      if (v.def.kind === 'heli' || v.def.kind === 'plane') {
        flyStep(v, move, dt, run, city.colliders);
        player.x = v.x; player.z = v.z; player.y = v.y;
      } else {
        const hit = driveStep(v, move, dt, city.colliders, wet, vehicles);
        if (hit) { audio.thud(); effects.addShake(0.2); }
        player.x = v.x; player.z = v.z; player.y = v.y;
        if (v.damage >= 100) {
          effects.smoke(v.x, 1.5, v.z);
          hud.message('Vehicle wrecked — get out and find another.', 3);
          exitVehicle();
        }
      }
      player.heading = v.heading;
      audio.setEngine(Math.abs(v.speed) / v.def.top, true);
      // headlight
      headlight.position.set(v.x + Math.cos(v.heading) * v.def.len / 2, 1.2, v.z + Math.sin(v.heading) * v.def.len / 2);
      headlight.target.position.set(v.x + Math.cos(v.heading) * 30, 0, v.z + Math.sin(v.heading) * 30);
      headlight.intensity = weather.night01 > 0.15 ? 380 : 0;
    } else {
      const bounds = state.inClub ? { minX: -16, maxX: 16, minZ: 408, maxZ: 432 } : undefined;
      playerStep(player, move, state.camYaw, run, !!(actions & ACTION_JUMP), dt, city.colliders, bounds);
      updatePlayerMesh(playerMesh, player);
      audio.setEngine(0, false);
      headlight.intensity = 0;
    }

    // --- vehicle lights (night + braking) ---
    // Police cruisers are NOT in `vehicles` (they spawn dynamically into
    // police.cars), so they get their own pass — otherwise their light
    // bar never flashes at all (the siren was silently dead).
    for (const v of vehicles) {
      setVehicleLights(v, weather.night01, v.brake, v.indicator !== 0 && Math.sin(state.time * 8) > 0);
    }
    for (const c of police.cars) {
      setVehicleLights(c, weather.night01, c.brake, false);
    }

    // --- CBPD patrol heli: loop over downtown, chase + searchlight when wanted ---
    {
      const ph = patrolHeli;
      const u = ph.mesh.userData;
      if (u.rotor) {
        u.rotor.rotation.y += dt * 22;
        u.rotor2.rotation.y += dt * 22;
        if (u.tailRotor) u.tailRotor.rotation.z += dt * 30;
        if (u.rotorBlur) u.rotorBlur.visible = true;
      }
      setVehicleLights(ph, weather.night01, false, false); // flashes the roof light bar + strobe
      const chasing = police.wanted > 0;
      let tx, tz;
      if (chasing) { tx = player.x; tz = player.z; }
      else {
        const wp = patrolRoute[ph.routeIndex];
        tx = wp.x; tz = wp.z;
        if (Math.hypot(wp.x - ph.x, wp.z - ph.z) < 12) ph.routeIndex = (ph.routeIndex + 1) % patrolRoute.length;
      }
      const targetHeading = Math.atan2(tz - ph.z, tx - ph.x);
      let dh = targetHeading - ph.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      ph.heading += Math.max(-1.1 * dt, Math.min(1.1 * dt, dh));
      const speed = chasing ? 20 : 14;
      ph.x += Math.cos(ph.heading) * speed * dt;
      ph.z += Math.sin(ph.heading) * speed * dt;
      const targetY = (chasing ? 55 : 62) + Math.sin(state.time * 0.9) * 1.2;
      ph.y += (targetY - ph.y) * Math.min(1, dt * 0.8);
      ph.mesh.position.set(ph.x, ph.y, ph.z);
      ph.mesh.rotation.y = -ph.heading;
      ph.mesh.rotation.z = Math.max(-0.18, Math.min(0.18, dh * 0.4)); // bank into turns
      ph.mesh.rotation.x = 0;
      searchlight.intensity = chasing ? 500 : 0;
      beam.visible = chasing;
      if (chasing) {
        searchlight.position.set(ph.x, ph.y - 1, ph.z);
        searchlight.target.position.set(player.x, 0, player.z);
        const len = Math.hypot(ph.x - player.x, ph.y, ph.z - player.z);
        beam.position.set((ph.x + player.x) / 2, ph.y / 2, (ph.z + player.z) / 2);
        beam.scale.set(6, len, 6);
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(ph.x - player.x, ph.y, ph.z - player.z).normalize());
      }
    }

    // --- traffic, people, animals ---
    for (const v of vehicles) {
      if (v.traffic) trafficStep(v, dt, city.trafficLights, vehicles);
      if (v.def.kind === 'heli' && v.mesh.userData.rotor && !player.inVehicle) {
        // parked helis keep their rotors still; the one being flown spins in flyStep
      }
    }
    pedsStep(peds, dt, state.time, city.sidewalkSpots, rng, state.scare, player, state.inClub);
    if (state.inClub) pedsStep(dancers, dt, state.time, city.sidewalkSpots, rng, null, player, true);
    animalsStep(animals, dt, state.time, player, state.scare);
    if (state.scare) { state.scare.radius = Math.max(0, state.scare.radius - dt * 10); if (state.scare.radius <= 0) state.scare = null; }

    // --- police ---
    const sirenNear = police.cars.some((c) => Math.hypot(c.x - player.x, c.z - player.z) < 70);
    audio.setSiren(police.wanted > 0 && sirenNear, dt);
    policeStep(police, dt, scene, rng, player, vehicles, city.colliders, () => endGame('busted'));

    // --- health: ram damage on foot, slow regen ---
    if (!player.inVehicle) {
      for (const c of police.cars) {
        if (Math.hypot(c.x - player.x, c.z - player.z) < 2.5 && player.invulnerable <= 0) {
          player.health -= 18;
          player.invulnerable = 1;
          effects.addShake(0.5);
          audio.thud();
        }
      }
      for (const v of vehicles) {
        if (v.traffic && Math.abs(v.speed) > 6 && Math.hypot(v.x - player.x, v.z - player.z) < v.radius + 0.7 && player.invulnerable <= 0) {
          player.health -= 22;
          player.invulnerable = 1;
          effects.addShake(0.6);
          audio.thud();
          const r = addWanted(police, 8, 'Hit by a car');
          if (r.changed) audio.wantedUp();
        }
      }
    }
    if (player.health < 100 && player.invulnerable <= 0) player.health = Math.min(100, player.health + dt * 1.5);
    if (player.health <= 0) { endGame('wasted'); return; }

    // --- missions ---
    const mres = missionsStep(missions, {
      player, vehicles, landmarks: city.landmarks, wanted: police.wanted,
      inClub: state.inClub, heliPad: city.heliPad,
    });
    for (const ev of mres.events) {
      if (ev.type === 'step') hud.message(`Objective updated: ${currentStep(missions)?.text ?? ''}`, 3);
      if (ev.type === 'complete') {
        audio.missionDone();
        audio.cash();
        effects.cashBurst(player.x, 1.5, player.z);
        hud.message(`Mission complete: ${ev.mission.title} — +$${ev.reward.toLocaleString('en-US')}`, 5);
        saveGame();
      }
      if (ev.type === 'story-done') { endGame('legend'); return; }
    }

    // --- weather + city life ---
    const winfo = weatherStep(weather, dt, player);
    scene.background.copy(winfo.sky);
    scene.fog.color.copy(winfo.fog);
    scene.fog.near = winfo.raining ? 60 : 120;
    scene.fog.far = winfo.raining ? 380 : 620;
    city.update(dt, state.time, winfo.night01, winfo.raining);
    audio.setRain(winfo.raining);
    effects.step(dt);

    // --- objective beacon ---
    if (missions.marker) {
      beacon.visible = true;
      beacon.position.set(missions.marker.x, 30, missions.marker.z);
      beaconTop.position.set(missions.marker.x, 2 + Math.sin(state.time * 2) * 0.5, missions.marker.z);
      beaconTop.rotation.y += dt * 2;
      beacon.material.opacity = 0.35 + Math.sin(state.time * 3) * 0.15;
    } else beacon.visible = false;

    // --- club interior lights sweep ---
    if (state.inClub) {
      const spots = city.clubInterior.spots;
      spots.forEach((s, i) => {
        s.target.position.set(Math.sin(state.time * 1.3 + i * 2) * 8, 0, Math.cos(state.time * 1.1 + i * 2) * 5);
      });
      city.clubInterior.ball.rotation.y += dt * 0.8;
    }

    // --- HUD ---
    const mission = currentMission(missions);
    const stepObj = currentStep(missions);
    hud.update(dt, {
      cash: player.cash,
      health: player.health,
      wanted: police.wanted,
      hour: weather.timeHours,
      weather: weather.weather,
      missionTitle: mission ? `★ ${mission.title}` : 'All missions complete',
      missionText: stepObj ? stepObj.text : 'Free roam — explore Crown Bay',
      speedKmh: player.inVehicle ? Math.abs(player.inVehicle.speed) * 3.6 : 0,
      inVehicle: !!player.inVehicle,
      lowHealth: player.health < 30,
    });
    hud.drawMinimap({
      playerX: player.x, playerZ: player.z,
      playerHeading: player.inVehicle ? player.inVehicle.heading : player.heading,
      police: [...police.cars, ...police.officers],
      marker: missions.marker,
      inClub: state.inClub,
    });

    // --- chase-cam auto-follow while driving ---
    // The camera eases back behind the vehicle so the road ahead is always
    // in view without touching the mouse: no more driving blind into a wall
    // after a turn. Dragging the mouse buys 2.5 s of free look; after that
    // the camera re-centres on its own, faster when the vehicle is moving.
    // On foot nothing changes — the camera stays where the player left it.
    if (player.inVehicle) {
      if (look.x !== 0 || look.y !== 0) state.camFreeUntil = state.elapsed + 2.5;
      if (state.elapsed >= state.camFreeUntil) {
        const target = player.inVehicle.heading;
        let diff = target - state.camYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const moving = Math.min(1, Math.abs(player.inVehicle.speed) / 12);
        const rate = 1.0 + moving * 2.4;
        state.camYaw += diff * Math.min(1, dt * rate);
      }
    }

    // --- camera ---
    updateCamera(dt);

    // --- autosave ---
    state.autoSave += dt;
    if (state.autoSave > 30) { state.autoSave = 0; saveGame(); }

    // --- resize ---
    if (renderer.domElement.width !== Math.floor(window.innerWidth * Math.min(window.devicePixelRatio || 1, 2))) {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }
  }

  function render() {
    renderer.render(scene, camera);
  }

  function reset() {
    player.x = SPAWN.x; player.z = SPAWN.z; player.y = 0;
    player.health = PLAYER.health;
    player.cash = 0;
    player.inVehicle = null;
    playerMesh.visible = true;
    playerMesh.position.set(player.x, 0, player.z);
    missions.current = 0; missions.step = 0; missions.done = [];
    clearWanted(police, scene);
    weather.timeHours = 10.5;
    state.screen = SCREEN_TITLE;
    state.inClub = false;
    state.camYaw = Math.PI * 0.75;
    state.camPitch = 0.32;
    state.camFreeUntil = 0;
  }

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === SCREEN_PLAY) {
      state.screen = SCREEN_PAUSED;
      hud.showScreen('paused');
    }
  });

  return {
    state, player, missions, police, weather, city, vehicles, peds, animals,
    patrolHeli,
    scene, camera, renderer, audio, input, hud, effects,
    step, render, reset, startGame, endGame, saveGame, loadGame, hasSave,
    enterVehicle, exitVehicle,
    setBestText() {
      hud.setTitleBest(state.best > 0 ? `Best score: $${state.best.toLocaleString('en-US')}` : 'A new story in Crown Bay — no score yet.');
      hud.setTitleSave(hasSave ? 'A saved game is waiting — press Enter to continue.' : 'No saved game yet.');
    },
  };
}
