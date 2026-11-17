// Crown Bay — weather.js rewritten in recorded session fix7, 18 Nov 2026.
// Time and weather: a full day cycle (morning, noon, golden evening, night),
// a sun and moon that move, sky and fog that follow, street lights at night,
// and weather that drifts between clear, cloudy and rain — rain makes the
// roads wet and slippery and brings its own hiss and falling drops.
//
// Night is lit, not pitch black: the moon is strong (1.5) and the hemisphere
// floor is 0.8, so cars, wheels and pedestrians still read as coloured
// shapes at night instead of black silhouettes. (The user's night photos
// showed the player's car as a pure black blob — moon 0.9 + hemi 0.55
// was not enough for dark paint and dark tyres.)
import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';

const DAY_LENGTH = 480; // seconds for a full 24h cycle

export function createWeather(scene, rng) {
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -90;
  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -90;
  sun.shadow.camera.far = 500;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a4a3a, 0.9);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x8fa8ff, 0.0);
  moon.position.set(-100, 180, -60);
  scene.add(moon);

  // rain: a sheet of falling points that follows the player
  const RAIN_N = 2400;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN_N * 3);
  const rainVel = new Float32Array(RAIN_N);
  for (let i = 0; i < RAIN_N; i += 1) {
    rainPos[i * 3] = rng.range(-60, 60);
    rainPos[i * 3 + 1] = rng.range(0, 40);
    rainPos[i * 3 + 2] = rng.range(-60, 60);
    rainVel[i] = rng.range(28, 42);
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xaac8e8, size: 0.14, transparent: true, opacity: 0.65 }));
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);

  // clouds: a few big soft billboards drifting across the sky
  const clouds = [];
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, roughness: 1 });
  for (let i = 0; i < 10; i += 1) {
    const g = new THREE.Group();
    for (let j = 0; j < 3; j += 1) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), cloudMat);
      s.scale.set(rng.range(12, 26), rng.range(4, 7), rng.range(8, 14));
      s.position.set(j * 14 - 14, rng.range(-1, 1), rng.range(-4, 4));
      g.add(s);
    }
    g.position.set(rng.range(-300, 300), rng.range(90, 140), rng.range(-300, 300));
    scene.add(g);
    clouds.push({ group: g, speed: rng.range(0.6, 1.6) });
  }

  const state = {
    timeHours: 10.5, // start late morning
    weather: 'clear', // clear | cloudy | rain
    weatherTimer: 90,
    raining: false,
    night01: 0,
    sun,
    hemi,
    moon,
    rain,
    clouds,
    rainVel,
  };
  return state;
}

function lerpColor(a, b, t, out) {
  out.copy(a).lerp(b, t);
  return out;
}

export function weatherStep(w, dt, playerPos) {
  w.timeHours = (w.timeHours + (dt / DAY_LENGTH) * 24) % 24;
  const h = w.timeHours;
  // sun elevation: 0 at 6:00, peak at 13:00, 0 at 20:00
  const dayT = (h - 6) / 14; // 0..1 across the day
  const isDay = h > 6 && h < 20;
  const sunElev = isDay ? Math.sin(dayT * Math.PI) : 0;
  const azimuth = (h / 24) * Math.PI * 2 - Math.PI / 2;
  const R = 300;
  w.sun.position.set(Math.cos(azimuth) * R, Math.max(12, sunElev * 260), Math.sin(azimuth) * R);
  w.sun.target.position.set(playerPos.x, 0, playerPos.z);
  // follow the player so shadows stay local
  w.sun.position.x += playerPos.x;
  w.sun.position.z += playerPos.z;
  w.sun.target.updateMatrixWorld();

  // night factor: 1 deep at night, 0 at midday
  let night01 = 0;
  if (h < 5 || h >= 21) night01 = 1;
  else if (h < 7) night01 = 1 - (h - 5) / 2;
  else if (h >= 19) night01 = (h - 19) / 2;
  else if (h >= 17) night01 = (h - 17) / 2 * 0.5;
  w.night01 = night01;

  const sky = new THREE.Color();
  const fog = new THREE.Color();
  if (night01 > 0.85) {
    sky.copy(PALETTE.skyNight); fog.copy(PALETTE.fogNight);
  } else if (h >= 16.5 && h < 19.5) {
    const t = Math.min(1, Math.abs(h - 18) / 1.5);
    lerpColor(PALETTE.skyDay, PALETTE.skySunset, 1 - t * 0.4, sky);
    lerpColor(PALETTE.fogDay, new THREE.Color(0xc89878), 0.6, fog);
  } else {
    sky.copy(PALETTE.skyDay); fog.copy(PALETTE.fogDay);
  }
  if (night01 > 0 && night01 < 0.85) {
    sky.lerp(PALETTE.skyNight, night01 * 0.7);
    fog.lerp(PALETTE.fogNight, night01 * 0.7);
  }
  // weather tints the sky
  if (w.weather === 'rain') { sky.multiplyScalar(0.55); fog.multiplyScalar(0.6); }
  else if (w.weather === 'cloudy') { sky.multiplyScalar(0.8); fog.multiplyScalar(0.85); }

  w.sun.intensity = isDay ? 2.6 * Math.max(0.15, sunElev) * (w.weather === 'rain' ? 0.4 : w.weather === 'cloudy' ? 0.65 : 1) : 0;
  w.moon.intensity = night01 * 1.5;
  w.hemi.intensity = 0.8 + (1 - night01) * 0.35;

  // weather drift
  w.weatherTimer -= dt;
  if (w.weatherTimer <= 0) {
    w.weatherTimer = 60 + Math.random() * 120;
    const r = Math.random();
    w.weather = r < 0.55 ? 'clear' : r < 0.8 ? 'cloudy' : 'rain';
    w.raining = w.weather === 'rain';
    w.rain.visible = w.raining;
  }
  // rain falls around the player
  if (w.raining) {
    const pos = w.rain.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      let y = pos.getY(i) - w.rainVel[i] * dt;
      if (y < 0) {
        y = 38;
        pos.setX(i, playerPos.x + (Math.random() - 0.5) * 120);
        pos.setZ(i, playerPos.z + (Math.random() - 0.5) * 120);
      }
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    w.rain.position.set(0, 0, 0);
  }
  // clouds drift
  for (const c of w.clouds) {
    c.group.position.x += c.speed * dt;
    if (c.group.position.x > 340) c.group.position.x = -340;
    c.group.material = c.group.children[0].material;
  }
  return { sky, fog, night01, hour: h, weather: w.weather, raining: w.raining };
}

export function clockText(h) {
  const hh = Math.floor(h) % 24;
  const mm = Math.floor((h % 1) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function periodName(h) {
  if (h >= 5 && h < 10) return 'Morning';
  if (h >= 10 && h < 16) return 'Midday';
  if (h >= 16 && h < 19) return 'Evening';
  if (h >= 19 || h < 5) return 'Night';
  return 'Day';
}
