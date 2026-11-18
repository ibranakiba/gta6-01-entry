// fix9
// Crown Bay — the HUD: everything the player reads while playing.
// Cash and health, the wanted stars, the clock and the weather, the
// current job, the speed, the transient messages, and the round
// minimap that shows the real streets. The screens (title, pause,
// game over) are toggled here too.
//
// The HUD builds its own DOM when the page does not already provide
// it, and reuses the page's elements when it does — the minimap
// canvas, for example, lives in the page as #minimap, and this module
// draws on it rather than making a second one.
import { CITY, STREET_CENTERS } from './config.js';

function makeDiv(id, css) {
  const el = document.createElement('div');
  el.id = id;
  el.style.cssText = css;
  document.body.appendChild(el);
  return el;
}

function findOrMake(id, css) {
  return document.getElementById(id) || makeDiv(id, css);
}

export function createHud() {
  // --- readouts -------------------------------------------------------
  const bar = findOrMake(
    'cb-hud-bar',
    'position:fixed;top:14px;left:14px;z-index:20;pointer-events:none;color:#fff;font-family:system-ui,sans-serif;text-shadow:0 1px 3px rgba(0,0,0,.8);',
  );
  bar.innerHTML = '<div id="cb-cash" style="font-size:22px;font-weight:700;">$0</div>'
    + '<div style="width:170px;height:12px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.5);border-radius:6px;margin-top:6px;overflow:hidden;">'
    + '<div id="cb-health-fill" style="height:100%;width:100%;background:#37d67a;"></div></div>'
    + '<div id="cb-ammo" style="font-size:13px;margin-top:5px;opacity:.9;"></div>';
  const cashEl = document.getElementById('cb-cash');
  const healthFill = document.getElementById('cb-health-fill');
  const ammoEl = document.getElementById('cb-ammo');

  const clockEl = findOrMake(
    'cb-clock',
    'position:fixed;top:14px;right:14px;z-index:20;pointer-events:none;color:#fff;font-family:system-ui,sans-serif;font-size:15px;text-align:right;text-shadow:0 1px 3px rgba(0,0,0,.8);',
  );
  const wantedEl = findOrMake(
    'cb-wanted',
    'position:fixed;top:52px;left:50%;transform:translateX(-50%);z-index:20;pointer-events:none;font-size:26px;letter-spacing:6px;color:#ffd23c;text-shadow:0 2px 6px rgba(0,0,0,.9);',
  );
  const missionEl = findOrMake(
    'cb-mission',
    'position:fixed;top:96px;left:14px;z-index:20;pointer-events:none;color:#ffe9a8;font-family:system-ui,sans-serif;font-size:14px;max-width:300px;text-shadow:0 1px 3px rgba(0,0,0,.85);',
  );
  const speedEl = findOrMake(
    'cb-speed',
    'position:fixed;bottom:16px;right:16px;z-index:20;pointer-events:none;color:#fff;font-family:system-ui,sans-serif;font-size:26px;font-weight:700;text-shadow:0 1px 4px rgba(0,0,0,.8);',
  );
  const messageEl = findOrMake(
    'cb-message',
    'position:fixed;bottom:84px;left:50%;transform:translateX(-50%);z-index:20;pointer-events:none;color:#fff;background:rgba(10,10,20,.72);font-family:system-ui,sans-serif;font-size:15px;padding:8px 16px;border-radius:8px;opacity:0;transition:opacity .25s;max-width:70vw;text-align:center;',
  );
  const promptEl = findOrMake(
    'cb-prompt',
    'position:fixed;bottom:44px;left:50%;transform:translateX(-50%);z-index:20;pointer-events:none;color:#fff;font-family:system-ui,sans-serif;font-size:14px;text-shadow:0 1px 3px rgba(0,0,0,.9);',
  );

  // --- minimap ----------------------------------------------------------
  // The page owns the canvas when it has one (#minimap, inside
  // #minimap-wrap); otherwise the HUD makes its own round one in the
  // bottom-left corner. The world resizes it by id when the player
  // asks for the big map (M), so the id must stay 'minimap'.
  let mapCanvas = document.getElementById('minimap');
  // The page's own wrap starts hidden (display:none in the markup):
  // the canvas draws either way, but nobody sees it until the wrap
  // shows. Unhide it here — the title/pause/over overlays sit above
  // it, so it only reads while playing.
  const pageWrap = document.getElementById('minimap-wrap');
  if (pageWrap) pageWrap.style.display = 'block';
  if (!mapCanvas) {
    const wrap = document.getElementById('minimap-wrap') || makeDiv(
      'minimap-wrap',
      'position:fixed;left:14px;bottom:14px;z-index:20;width:220px;height:220px;border-radius:50%;overflow:hidden;border:3px solid rgba(255,255,255,.75);box-shadow:0 2px 10px rgba(0,0,0,.5);',
    );
    mapCanvas = document.createElement('canvas');
    mapCanvas.id = 'minimap';
    mapCanvas.width = 220;
    mapCanvas.height = 220;
    wrap.appendChild(mapCanvas);
  }
  const mapCtx = mapCanvas.getContext('2d');

  // --- screens ----------------------------------------------------------
  // A screen is any element that carries data-screen="title" (or an
  // id like screen-title); the page's own overlays use the same hook,
  // so the HUD never builds a second title screen on top of the
  // page's START button — it reuses the one that is already there.
  function screenEl(name) {
    return document.querySelector(`[data-screen="${name}"]`)
      || document.getElementById(`screen-${name}`)
      || document.querySelector(`.screen-${name}`);
  }
  function ensureScreen(name) {
    let el = screenEl(name);
    if (el) return el;
    // Created hidden: showScreen decides when a screen appears, so
    // a screen the page never asked for never flashes over the game.
    el = document.createElement('div');
    el.setAttribute('data-screen', name);
    el.style.cssText = 'position:fixed;inset:0;z-index:30;display:none;flex-direction:column;align-items:center;justify-content:center;background:rgba(6,8,18,.72);color:#fff;font-family:system-ui,sans-serif;text-align:center;';
    document.body.appendChild(el);
    return el;
  }

  // The title screen is the page's own overlay when it has one (the
  // one with the START button); the HUD's copy is only a fallback.
  function titleScreen() {
    return screenEl('title') || document.querySelector('.screen') || ensureScreen('title');
  }

  let messageTimer = 0;

  function clockText(hour) {
    const h = Math.floor(hour) % 24;
    const m = Math.floor((hour % 1) * 60);
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    const period = hour < 5 || hour >= 18 ? 'night' : hour < 11 ? 'morning' : hour < 15 ? 'midday' : hour < 18 ? 'afternoon' : 'evening';
    return `${hh}:${mm} · ${period}`;
  }

  const hud = {
    message(text, seconds = 3) {
      messageEl.textContent = text;
      messageEl.style.opacity = '1';
      messageTimer = seconds;
    },
    prompt(text) {
      promptEl.textContent = text || '';
    },
    showScreen(name) {
      // Every overlay hides; only the named one shows. 'play' shows
      // none of them, so the game itself is the whole screen. The
      // title resolves to the page's own overlay (with its START
      // button) whenever it has one.
      document.querySelectorAll('[data-screen], .screen').forEach((el) => {
        el.style.display = 'none';
      });
      if (name === 'play') return;
      const el = name === 'title' ? titleScreen() : ensureScreen(name);
      el.style.display = 'flex';
    },
    setOver(title, lines, hint) {
      const el = ensureScreen('over');
      const body = lines.map((line) => `<p style="margin:4px 0;font-size:16px;opacity:.92;">${line}</p>`).join('');
      el.innerHTML = `<h1 style="font-size:44px;margin:0 0 10px;letter-spacing:4px;">${title}</h1>${body}`
        + `<p style="margin-top:18px;font-size:14px;opacity:.75;">${hint || ''}</p>`;
    },
    setTitleBest(text) {
      let el = document.getElementById('title-best');
      if (!el) {
        const screen = titleScreen();
        el = document.createElement('div');
        el.id = 'title-best';
        el.style.cssText = 'font-size:15px;opacity:.85;margin-top:10px;';
        screen.appendChild(el);
      }
      el.textContent = text;
    },
    setTitleSave(text) {
      let el = document.getElementById('title-save');
      if (!el) {
        const screen = titleScreen();
        el = document.createElement('div');
        el.id = 'title-save';
        el.style.cssText = 'font-size:14px;opacity:.7;margin-top:4px;';
        screen.appendChild(el);
      }
      el.textContent = text;
    },
    update(dt, stats) {
      if (messageTimer > 0) {
        messageTimer -= dt;
        if (messageTimer <= 0) messageEl.style.opacity = '0';
      }
      cashEl.textContent = `$${Math.floor(stats.cash).toLocaleString('en-US')}`;
      const hp = Math.max(0, Math.min(100, stats.health));
      healthFill.style.width = `${hp}%`;
      healthFill.style.background = hp < 30 ? '#e83c3c' : hp < 60 ? '#e8a83c' : '#37d67a';
      bar.style.opacity = stats.lowHealth && Math.floor(performance.now() / 400) % 2 === 0 ? '0.55' : '1';
      // The ammo readout lives here so the bar stays honest when the
      // player is on foot; the world passes it through stats when it
      // has one, and the line simply stays blank while driving.
      ammoEl.textContent = stats.ammoText || '';
      clockEl.textContent = `${clockText(stats.hour)}${stats.weather ? ` · ${stats.weather}` : ''}`;
      wantedEl.textContent = stats.wanted > 0 ? '★'.repeat(Math.min(5, stats.wanted)) : '';
      missionEl.innerHTML = `<div style="font-weight:700;font-size:15px;">${stats.missionTitle}</div>`
        + `<div style="opacity:.9;">${stats.missionText}</div>`;
      speedEl.textContent = stats.inVehicle && stats.speedKmh > 1 ? `${Math.round(stats.speedKmh)} km/h` : '';
    },
    drawMinimap(args) {
      const size = mapCanvas.width || 220;
      const ctx = mapCtx;
      if (!ctx) return;
      const half = CITY.half + 230; // the frame covers the city plus the bay
      const toMap = (x, z) => [
        ((x + half) / (half * 2)) * size,
        ((z + half) / (half * 2)) * size,
      ];
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      // The bay: everything east of the beach is water.
      const [seaX] = toMap(CITY.seaX, 0);
      ctx.fillStyle = '#1b6a8a';
      ctx.fillRect(seaX, 0, size - seaX, size);
      // Land: one continuous shape, never a grid of squares.
      ctx.fillStyle = '#3d6a35';
      ctx.fillRect(0, 0, seaX, size);
      ctx.fillStyle = '#c9b183';
      const [beachX] = toMap(CITY.beachX - 8, 0);
      ctx.fillRect(beachX, 0, Math.max(2, seaX - beachX), size);
      // Meridian Park, a rounded green blob on the west side.
      const [parkX, parkY] = toMap(-174, 116);
      ctx.fillStyle = '#2f7a2e';
      ctx.beginPath();
      ctx.arc(parkX, parkY, size * 0.045, 0, Math.PI * 2);
      ctx.fill();
      // Streets: dark casing under a pale surface, round caps, so the
      // roads read as smooth lines rather than a checkerboard.
      ctx.lineCap = 'round';
      for (const c of STREET_CENTERS) {
        const [x1, y1] = toMap(c, -CITY.half);
        const [x2, y2] = toMap(c, CITY.half);
        ctx.strokeStyle = '#20242a';
        ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.strokeStyle = '#c8c2b2';
        ctx.lineWidth = 4.5;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        const [hx1, hy1] = toMap(-CITY.half, c);
        const [hx2, hy2] = toMap(CITY.half, c);
        ctx.strokeStyle = '#20242a';
        ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(hx1, hy1); ctx.lineTo(hx2, hy2); ctx.stroke();
        ctx.strokeStyle = '#c8c2b2';
        ctx.lineWidth = 4.5;
        ctx.beginPath(); ctx.moveTo(hx1, hy1); ctx.lineTo(hx2, hy2); ctx.stroke();
      }
      // The Harbor Bridge, east across the bay, and the pier.
      const [b1x, b1y] = toMap(292, 58);
      const [b2x, b2y] = toMap(470, 58);
      ctx.strokeStyle = '#c8c2b2';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(b1x, b1y); ctx.lineTo(b2x, b2y); ctx.stroke();
      const [p1x, p1y] = toMap(316, 87);
      const [p2x, p2y] = toMap(368, 87);
      ctx.strokeStyle = '#8a6a4a';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.lineTo(p2x, p2y); ctx.stroke();
      // Route to the objective: a pink dotted line from the player.
      if (args.marker) {
        const [mx, my] = toMap(args.marker.x, args.marker.z);
        const [px, py] = toMap(args.playerX, args.playerZ);
        ctx.strokeStyle = '#ff5a8a';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(mx, my); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#ffd23c';
        ctx.beginPath(); ctx.arc(mx, my, 5 + Math.sin(performance.now() / 280) * 1.5, 0, Math.PI * 2); ctx.fill();
      }
      // Police: blue dots with a white ring.
      for (const p of args.police || []) {
        const [x, y] = toMap(p.x, p.z);
        ctx.fillStyle = '#2a6ad8';
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      // The player: a white arrow with a soft halo, always on top.
      const [px, py] = toMap(args.playerX, args.playerZ);
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-args.playerHeading);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.closePath();
      ctx.fill();
      ctx.restore();
      // North, top-right.
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('N ▲', size - 10, 18);
      ctx.restore();
      // The round frame.
      ctx.strokeStyle = 'rgba(255,255,255,.8)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 1.5, 0, Math.PI * 2); ctx.stroke();
    },
  };
  return hud;
}
