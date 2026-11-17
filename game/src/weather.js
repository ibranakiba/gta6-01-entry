// Crown Bay — weather.js rewritten in recorded session fix8, 18 Nov 2026.
// Crown Bay — the day cycle and the weather, in one place. The clock runs
// a full 24 hours in about ten minutes of play: dawn, noon, a pink-orange
// sunset and a dark-blue night, with the sun, the moon and the street
// lights following it through night01 (0 at noon, 1 at midnight). Weather
// drifts on its own between clear, cloudy and rain; rain is a real
// particle field that follows the player and a matching patter in the
// audio layer. The HUD reads the clock and the period from here, and the
// screenshot scenes set timeHours / weather directly to stage a moment.
import * as THREE from 'three';
import { PALETTE } from './config.js';

const DAY_LENGTH = 600; // seconds of play per full 24 h day
const DAWN_START = 5.5;
const DAWN_END = 7.5;
const DUSK_START = 17.5;
const DUSK_END = 19.5;
const RAIN_DROPS = 900;
const RAIN_AREA = 90;
const RAIN_FALL = 55;

const SKY_MORNING = new THREE.Color(0x9fc3e2);
const SKY_NOON = new THREE.Color(0x87b5d9);
// PALETTE holds hex numbers, but Color.copy/lerp need Color objects:
// passing a hex number silently NaNs the colour (black sky, dead sun),
// so the palette entries weather blends get one Color each, up front.
const SKY_SUNSET = new THREE.Color(PALETTE.skySunset);
const SKY_NIGHT = new THREE.Color(PALETTE.skyNight);
const FOG_DAY = new THREE.Color(PALETTE.fogDay);
const FOG_NIGHT = new THREE.Color(PALETTE.fogNight);
const SUN_DAY = new THREE.Color(PALETTE.sunDay);

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smooth(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

// 0 at noon, 1 deep at night, with soft dawn/dusk ramps on both sides.
function nightFactor(hour) {
  if (hour >= DAWN_END && hour <= DUSK_START) return 0;
  if (hour >= DUSK_END || hour <= DAWN_START) return 1;
  if (hour < DAWN_END) return 1 - smooth(DAWN_START, DAWN_END, hour);
  return smooth(DUSK_START, DUSK_END, hour);
}

// How far the sun has sunk below the horizon at dusk, 0..1 — the sunset
// band is strongest just as night01 starts to climb.
function sunsetFactor(hour) {
  const dusk = smooth(DUSK_START - 1.5, DUSK_END, hour);
  const dawn = 1 - smooth(DAWN_START - 1, DAWN_END, hour);
  return Math.max(dusk * (1 - nightFactor(hour)), dawn * 0.5);
}

export function clockText(hour) {
  const h12 = Math.floor(hour) % 12 === 0 ? 12 : Math.floor(hour) % 12;
  const mins = Math.floor((hour % 1) * 60);
  return `${h12}:${String(mins).padStart(2, '0')}`;
}

export function periodName(hour) {
  return hour < 12 ? 'AM' : 'PM';
}

export function createWeather(scene, rng) {
  // The sun is the only shadow-casting light; the moon is a dim blue
  // fill so night never goes pitch black, and the hemisphere light lifts
  // the ground so the streets stay readable after dark.
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -320;
  sun.shadow.camera.right = 320;
  sun.shadow.camera.top = 320;
  sun.shadow.camera.bottom = -320;
  sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  const moon = new THREE.DirectionalLight(0x8fa8ff, 0);
  moon.position.set(-120, 220, -80);
  scene.add(moon);
  scene.add(moon.target);

  const hemi = new THREE.HemisphereLight(0xbfd8ee, 0x3a4a3a, 0.9);
  scene.add(hemi);

  // Rain: one Points cloud, recycled in a box around the player. The
  // points object itself is the public `rain` handle — the screenshot
  // scenes toggle its .visible, and weatherStep moves it with the player.
  const rainGeo = new THREE.BufferGeometry();
  const drops = new Float32Array(RAIN_DROPS * 3);
  for (let i = 0; i < RAIN_DROPS; i += 1) {
    drops[i * 3] = rng.range(-RAIN_AREA / 2, RAIN_AREA / 2);
    drops[i * 3 + 1] = rng.range(0, 45);
    drops[i * 3 + 2] = rng.range(-RAIN_AREA / 2, RAIN_AREA / 2);
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(drops, 3));
  const rainMat = new THREE.PointsMaterial({
    color: 0xaec6d8, size: 0.14, transparent: true, opacity: 0.55, sizeAttenuation: true,
  });
  const rain = new THREE.Points(rainGeo, rainMat);
  rain.visible = false;
  rain.frustumCulled = false;
  scene.add(rain);

  return {
    scene,
    rng,
    timeHours: 10.5,
    weather: 'clear', // 'clear' | 'cloudy' | 'rain'
    raining: false,
    night01: 0,
    rain,
    sun,
    moon,
    hemi,
    _changeIn: rng.range(40, 110), // seconds until the weather re-rolls
    _sky: new THREE.Color(),
    _fog: new THREE.Color(),
  };
}

function rollWeather(w) {
  const roll = w.rng.next();
  if (w.weather === 'clear') w.weather = roll < 0.55 ? 'clear' : roll < 0.85 ? 'cloudy' : 'rain';
  else if (w.weather === 'cloudy') w.weather = roll < 0.4 ? 'clear' : roll < 0.75 ? 'cloudy' : 'rain';
  else w.weather = roll < 0.55 ? 'cloudy' : 'rain';
  w.raining = w.weather === 'rain';
  w.rain.visible = w.raining;
  w._changeIn = w.rng.range(50, 150);
}

export function weatherStep(w, dt, player) {
  // The clock always runs; rain and clouds roll on their own timer.
  w.timeHours = (w.timeHours + (dt * 24) / DAY_LENGTH) % 24;
  w._changeIn -= dt;
  if (w._changeIn <= 0) rollWeather(w);

  const night = nightFactor(w.timeHours);
  w.night01 = night;
  const sunset = sunsetFactor(w.timeHours);

  // Sky: noon blue -> sunset pink-orange -> night dark blue, with a
  // morning lift so dawn never looks like dusk.
  w._sky.copy(SKY_NOON);
  if (w.timeHours < 9) w._sky.lerp(SKY_MORNING, smooth(7.5, 9, w.timeHours) * 0.6);
  w._sky.lerp(SKY_SUNSET, sunset);
  w._sky.lerp(SKY_NIGHT, night);
  if (w.weather === 'cloudy') w._sky.lerp(new THREE.Color(0x7e8ea0), 0.35);
  if (w.weather === 'rain') w._sky.lerp(new THREE.Color(0x5d6d7d), 0.45);

  w._fog.copy(FOG_DAY);
  w._fog.lerp(FOG_NIGHT, night);
  w._fog.lerp(w._sky, 0.25);

  // Lights follow the same curve: the sun sinks and warms at dusk, the
  // moon takes over at night, the hemisphere never lets the ground go
  // fully dark (the night floor is 0.8, not 0).
  const sunAngle = ((w.timeHours - 6) / 12) * Math.PI;
  w.sun.position.set(Math.cos(sunAngle) * 260, Math.max(25, Math.sin(sunAngle) * 300), 140);
  w.sun.target.position.set(0, 0, 0);
  // Warm the sunlight toward the sunset palette as the sun goes down.
  w.sun.color.copy(SUN_DAY).lerp(SKY_SUNSET, sunset);
  w.sun.intensity = 2.6 * (1 - night) + 0.12;
  w.moon.intensity = 1.5 * night;
  w.hemi.intensity = 0.9 - night * 0.1;
  w.hemi.groundColor.setHex(0x3a4a3a);

  // Rain falls around the player and wraps back to the top of the box.
  if (w.raining) {
    const pos = w.rain.geometry.attributes.position;
    const arr = pos.array;
    const fall = RAIN_FALL * dt;
    for (let i = 0; i < RAIN_DROPS; i += 1) {
      arr[i * 3 + 1] -= fall * (0.8 + (i % 5) * 0.1);
      if (arr[i * 3 + 1] < 0) {
        arr[i * 3 + 1] = 42 + w.rng.next() * 3;
        arr[i * 3] = w.rng.range(-RAIN_AREA / 2, RAIN_AREA / 2);
        arr[i * 3 + 2] = w.rng.range(-RAIN_AREA / 2, RAIN_AREA / 2);
      }
    }
    pos.needsUpdate = true;
    if (player) {
      w.rain.position.set(player.x, 0, player.z);
    }
  }

  return {
    sky: w._sky,
    fog: w._fog,
    night01: night,
    raining: w.raining,
  };
}
