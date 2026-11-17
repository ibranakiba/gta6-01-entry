// Crown Bay — hud.js rewritten in recorded session fix7, 18 Nov 2026.
// HUD: cash, health, wanted stars, clock and weather, the mission objective,
// speed, messages, and a live minimap drawn on a 2D canvas from the real
// street grid — plus the title, pause and game-over screens.
// Screens are DOM overlays in index.html; this module owns their text.
import { CITY, STREET_CENTERS } from './config.js';
import { clockText, periodName } from './weather.js';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    cash: $('hud-cash'),
    healthFill: $('hud-health-fill'),
    healthText: $('hud-health-text'),
    stars: $('hud-stars'),
    clock: $('hud-clock'),
    weather: $('hud-weather'),
    missionTitle: $('hud-mission-title'),
    missionText: $('hud-mission-text'),
    speed: $('hud-speed-num'),
    speedUnit: $('hud-speed-unit'),
    message: $('hud-message'),
    prompt: $('hud-prompt'),
    minimap: $('minimap'),
    title: $('screen-title'),
    pause: $('screen-pause'),
    over: $('screen-over'),
    overTitle: $('over-title'),
    overLines: $('over-lines'),
    overPrompt: $('over-prompt'),
    titleBest: $('title-best'),
    titleSave: $('title-save'),
    crosshair: $('crosshair'),
    vignette: $('vignette'),
  };
  const mm = el.minimap.getContext('2d');
  let messageTimer = 0;
  let lastCash = -1, lastHealth = -1, lastStars = -1, lastClock = '', lastSpeed = -1;

  function show(elName, on) {
    if (el[elName]) el[elName].style.display = on ? '' : 'none';
  }

  return {
    showScreen(name) {
      show('title', name === 'title');
      show('pause', name === 'paused');
      show('over', name === 'over');
      const inGame = name === 'play';
      for (const id of ['hud-cash', 'hud-health', 'hud-stars', 'hud-clock', 'hud-weather', 'hud-mission', 'hud-speed', 'hud-message', 'hud-prompt', 'minimap-wrap']) {
        const n = document.getElementById(id);
        if (n) n.style.display = inGame ? '' : 'none';
      }
      if (el.crosshair) el.crosshair.style.display = inGame ? '' : 'none';
    },
    setTitleBest(text) { if (el.titleBest) el.titleBest.textContent = text; },
    setTitleSave(text) { if (el.titleSave) el.titleSave.textContent = text; },
    setOver(title, lines, prompt) {
      if (el.overTitle) el.overTitle.textContent = title;
      if (el.overLines) el.overLines.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
      if (el.overPrompt) el.overPrompt.textContent = prompt;
    },
    message(text, seconds = 3) {
      if (!el.message) return;
      el.message.textContent = text;
      el.message.style.opacity = '1';
      messageTimer = seconds;
    },
    prompt(text) {
      if (el.prompt) el.prompt.textContent = text || '';
    },
    update(dt, s) {
      // s: {cash, health, wanted, hour, weather, missionTitle, missionText, speedKmh, inVehicle, lowHealth}
      if (s.cash !== lastCash) { lastCash = s.cash; if (el.cash) el.cash.textContent = `$${s.cash.toLocaleString('en-US')}`; }
      const hp = Math.max(0, Math.round(s.health));
      if (hp !== lastHealth) {
        lastHealth = hp;
        if (el.healthFill) el.healthFill.style.width = `${hp}%`;
        if (el.healthFill) el.healthFill.style.background = hp > 50 ? '#3a8a5f' : hp > 25 ? '#e8a800' : '#c8102e';
        if (el.healthText) el.healthText.textContent = `${hp}`;
      }
      if (s.wanted !== lastStars) {
        lastStars = s.wanted;
        if (el.stars) {
          el.stars.textContent = '★'.repeat(s.wanted) + '☆'.repeat(5 - s.wanted);
          el.stars.style.color = s.wanted === 0 ? '#888888' : s.wanted < 3 ? '#e8b800' : '#ff2211';
        }
      }
      const clock = `${clockText(s.hour)} ${periodName(s.hour)}`;
      if (clock !== lastClock) { lastClock = clock; if (el.clock) el.clock.textContent = clock; }
      if (el.weather) el.weather.textContent = s.weather === 'rain' ? '🌧 Rain' : s.weather === 'cloudy' ? '☁ Cloudy' : '☀ Clear';
      if (el.missionTitle) el.missionTitle.textContent = s.missionTitle;
      if (el.missionText) el.missionText.textContent = s.missionText;
      const kmh = Math.round(s.speedKmh);
      if (kmh !== lastSpeed) {
        lastSpeed = kmh;
        if (el.speed) el.speed.textContent = s.inVehicle ? String(kmh) : '';
        if (el.speedUnit) el.speedUnit.textContent = s.inVehicle ? 'km/h' : '';
      }
      if (messageTimer > 0) {
        messageTimer -= dt;
        if (messageTimer <= 0 && el.message) el.message.style.opacity = '0';
      }
      if (el.vignette) el.vignette.style.opacity = s.lowHealth ? '1' : '0';
    },
    drawMinimap(s) {
      // s: {playerX, playerZ, playerHeading, police: [{x,z}], marker: {x,z}|null, inClub}
      // A real map, not a pixel grid: one continuous landmass inside a
      // circular frame, roads as smooth cased lines, sea + beach on the
      // east edge, a dashed route line to the objective. No block squares.
      const W = el.minimap.width, H = el.minimap.height;
      const cx0 = W / 2, cy0 = H / 2, R = W / 2 - 1;
      const minX = -310, maxX = 520, minZ = -310, maxZ = 310;
      // uniform scale so streets stay square on the map
      const scale = Math.min((R * 2 - 4) / (maxX - minX), (R * 2 - 4) / (maxZ - minZ));
      const ox = cx0 - ((maxX - minX) * scale) / 2;
      const oy = cy0 - ((maxZ - minZ) * scale) / 2;
      const sx = (x) => ox + (x - minX) * scale;
      const sz = (z) => oy + (z - minZ) * scale;
      // keep icons inside the circle
      const clampIcon = (x, z) => {
        const dx = x - cx0, dz = z - cy0;
        const d = Math.hypot(dx, dz) || 1;
        const m = Math.min(1, (R - 10) / d);
        return [cx0 + dx * m, cy0 + dz * m];
      };
      const rr = (x, y, w, h, r) => {
        mm.beginPath();
        mm.moveTo(x + r, y);
        mm.arcTo(x + w, y, x + w, y + h, r);
        mm.arcTo(x + w, y + h, x, y + h, r);
        mm.arcTo(x, y + h, x, y, r);
        mm.arcTo(x, y, x + w, y, r);
        mm.closePath();
      };
      const roadLine = (x1, z1, x2, z2) => {
        mm.beginPath(); mm.moveTo(sx(x1), sz(z1)); mm.lineTo(sx(x2), sz(z2)); mm.stroke();
      };

      mm.clearRect(0, 0, W, H);
      mm.save();
      mm.beginPath(); mm.arc(cx0, cy0, R, 0, Math.PI * 2); mm.clip();
      // land: one continuous field
      mm.fillStyle = '#46523f';
      mm.fillRect(0, 0, W, H);
      // Meridian Park: soft green rounded blob (block 4,6)
      mm.fillStyle = '#3d6b2e';
      rr(sx(-51), sz(65), sx(-7) - sx(-51), sz(109) - sz(65), 8);
      mm.fill();
      // beach + sea on the east edge
      mm.fillStyle = '#c9b078';
      mm.fillRect(sx(298), 0, sx(314) - sx(298), H);
      mm.fillStyle = '#1d5f82';
      mm.fillRect(sx(314), 0, W - sx(314), H);
      // Lighthouse Island: sand disc in the sea
      mm.fillStyle = '#c9b078';
      mm.beginPath(); mm.arc(sx(470), sz(58), 34 * scale, 0, Math.PI * 2); mm.fill();
      // roads: dark casing, then a lighter surface — smooth, consistent
      mm.lineCap = 'round'; mm.lineJoin = 'round';
      mm.strokeStyle = '#23282d'; mm.lineWidth = 7;
      for (const c of STREET_CENTERS) { roadLine(-297, c, 297, c); roadLine(c, -297, c, 297); }
      mm.strokeStyle = '#8a9097'; mm.lineWidth = 4.5;
      for (const c of STREET_CENTERS) { roadLine(-297, c, 297, c); roadLine(c, -297, c, 297); }
      // Harbor Bridge: road over the bay to Lighthouse Island
      mm.strokeStyle = '#23282d'; mm.lineWidth = 7;
      roadLine(290, 58, 470, 58);
      mm.strokeStyle = '#8a9097'; mm.lineWidth = 4.5;
      roadLine(290, 58, 470, 58);
      // Crown Pier + ferris wheel
      mm.strokeStyle = '#8a9097'; mm.lineWidth = 4.5;
      roadLine(314, 87, 368, 87);
      mm.fillStyle = '#ff2ad8';
      mm.beginPath(); mm.arc(sx(360), sz(87), 4, 0, Math.PI * 2); mm.fill();
      // airfield runway: dark strip with white centre dashes
      mm.strokeStyle = '#22262a'; mm.lineWidth = 6;
      roadLine(-351, 269, -171, 269);
      mm.strokeStyle = '#ffffff'; mm.lineWidth = 1.2; mm.setLineDash([5, 7]);
      roadLine(-351, 269, -171, 269);
      mm.setLineDash([]);
      // route line to the objective (dashed pink, like a GPS route)
      if (s.marker) {
        mm.strokeStyle = '#ff4d6a'; mm.lineWidth = 3; mm.setLineDash([7, 5]);
        mm.beginPath(); mm.moveTo(sx(s.playerX), sz(s.playerZ)); mm.lineTo(sx(s.marker.x), sz(s.marker.z)); mm.stroke();
        mm.setLineDash([]);
        const [mx, mz] = clampIcon(sx(s.marker.x), sz(s.marker.z));
        const pulse = 6 + Math.sin(performance.now() / 200) * 2;
        mm.fillStyle = '#ffd23c';
        mm.beginPath(); mm.arc(mx, mz, pulse, 0, Math.PI * 2); mm.fill();
        mm.strokeStyle = '#000'; mm.lineWidth = 2;
        mm.beginPath(); mm.arc(mx, mz, pulse, 0, Math.PI * 2); mm.stroke();
      }
      // police
      mm.fillStyle = '#2244ff';
      mm.strokeStyle = '#ffffff'; mm.lineWidth = 1.5;
      for (const p of s.police) {
        const [px, pz] = clampIcon(sx(p.x), sz(p.z));
        mm.beginPath(); mm.arc(px, pz, 4, 0, Math.PI * 2); mm.fill(); mm.stroke();
      }
      // player arrow with a soft halo so it always reads
      const [px, pz] = clampIcon(sx(s.playerX), sz(s.playerZ));
      mm.fillStyle = 'rgba(255,255,255,0.25)';
      mm.beginPath(); mm.arc(px, pz, 11, 0, Math.PI * 2); mm.fill();
      mm.save();
      mm.translate(px, pz);
      mm.rotate(Math.atan2(Math.sin(s.playerHeading), Math.cos(s.playerHeading)) + Math.PI / 2);
      mm.fillStyle = '#ffffff';
      mm.beginPath(); mm.moveTo(0, -8); mm.lineTo(6, 7); mm.lineTo(-6, 7); mm.closePath(); mm.fill();
      mm.strokeStyle = '#000'; mm.lineWidth = 1.5; mm.stroke();
      mm.restore();
      // north
      mm.fillStyle = '#fff';
      mm.font = 'bold 11px system-ui, sans-serif';
      mm.textAlign = 'center';
      mm.fillText('N', cx0, 16);
      mm.beginPath(); mm.moveTo(cx0, 19); mm.lineTo(cx0 - 4, 26); mm.lineTo(cx0 + 4, 26); mm.closePath(); mm.fill();
      mm.restore();
      // frame ring
      mm.strokeStyle = 'rgba(255,255,255,0.55)'; mm.lineWidth = 3;
      mm.beginPath(); mm.arc(cx0, cy0, R - 1.5, 0, Math.PI * 2); mm.stroke();
    },
  };
}
