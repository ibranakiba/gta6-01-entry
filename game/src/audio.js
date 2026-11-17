// Crown Bay — audio.js rewritten in recorded session fix8, 18 Nov 2026.
// Crown Bay — every sound in the game, built on plain WebAudio: engine
// hum, sirens, gunfire, horns, rain, club music and the little stings for
// wanted level, missions and cash. Nothing is loaded from disk — every
// sound is synthesized, so the game stays fully offline and the audio
// context only starts after the player's first gesture (the browser
// requires that), which is exactly what unlock() is for.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let rainSrc = null;
  let rainGain = null;
  let rainOn = false;
  let clubTimer = null;
  let clubStep = 0;
  let clubBpm = 122;
  let unlocked = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return !!ctx;
  }

  // A short burst of filtered noise — the raw material for gunshots,
  // thuds, reload clicks and rain.
  function noiseBuffer(seconds) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || !unlocked) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + dur);
      g.gain.setValueAtTime(vol, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(g); g.connect(master);
      osc.start(now); osc.stop(now + dur + 0.02);
    } catch { /* audio is cosmetic — never break the game */ }
  }

  function noiseHit(dur, filterFreq, vol, type = 'lowpass') {
    if (!ensure() || !unlocked) return;
    try {
      const now = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(dur + 0.05);
      const f = ctx.createBiquadFilter();
      f.type = type; f.frequency.value = filterFreq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(now); src.stop(now + dur + 0.05);
    } catch { /* cosmetic */ }
  }

  function startEngine() {
    if (!ensure() || engineOsc) return;
    try {
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    } catch { engineOsc = null; }
  }

  function startRain() {
    if (!ensure() || rainSrc) return;
    try {
      rainSrc = ctx.createBufferSource();
      rainSrc.buffer = noiseBuffer(2);
      rainSrc.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.4;
      rainGain = ctx.createGain();
      rainGain.gain.value = 0;
      rainSrc.connect(f); f.connect(rainGain); rainGain.connect(master);
      rainSrc.start();
    } catch { rainSrc = null; }
  }

  // Club Lumen's loop: a four-on-the-floor kick + a walking bass line.
  // Scheduled a bar ahead so it stays steady even on a slow frame.
  function clubTick() {
    if (!ctx || !unlocked) return;
    const now = ctx.currentTime;
    const beat = 60 / clubBpm / 2; // eighth notes
    const bassNotes = [55, 0, 55, 65.41, 0, 55, 49, 58.27];
    for (let i = 0; i < 8; i += 1) {
      const t = now + i * beat;
      // kick on every quarter
      if (i % 2 === 0) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(120, t);
        o.frequency.exponentialRampToValueAtTime(38, t + 0.12);
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + 0.16);
      }
      const n = bassNotes[(clubStep + i) % bassNotes.length];
      if (n) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'square';
        o.frequency.value = n;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + beat * 0.9);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + beat);
      }
    }
    clubStep = (clubStep + 8) % bassNotes.length;
  }

  return {
    unlock() {
      if (!ensure()) return;
      unlocked = true;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      startEngine();
      startRain();
    },

    // One-shot effects -------------------------------------------------
    gunshot() { noiseHit(0.16, 1800, 0.6, 'highpass'); blip(160, 0.1, 'square', 0.25, 60); },
    horn() { blip(370, 0.28, 'square', 0.22); blip(466, 0.28, 'square', 0.18); },
    thud() { blip(90, 0.22, 'sine', 0.55, 40); noiseHit(0.12, 300, 0.3); },
    reload() { blip(1400, 0.05, 'square', 0.15); setTimeout(() => blip(900, 0.06, 'square', 0.18), 90); },
    wantedUp() { blip(440, 0.14, 'sawtooth', 0.22, 660); setTimeout(() => blip(660, 0.2, 'sawtooth', 0.22, 880), 130); },
    missionDone() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.25), i * 110)); },
    cash() { blip(1320, 0.09, 'sine', 0.22); setTimeout(() => blip(1760, 0.14, 'sine', 0.22), 80); },

    stopAll() {
      if (engineGain) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      if (sirenGain) sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      if (rainGain) rainGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      this.setClub(false);
    },

    // Continuous layers -------------------------------------------------
    // ratio 0..1 of top speed; on=false fades the engine out (on foot).
    setEngine(ratio, on) {
      if (!ensure() || !unlocked) return;
      startEngine();
      if (!engineOsc) return;
      try {
        const now = ctx.currentTime;
        engineOsc.frequency.setTargetAtTime(52 + ratio * 165, now, 0.08);
        engineFilter.frequency.setTargetAtTime(380 + ratio * 900, now, 0.1);
        engineGain.gain.setTargetAtTime(on ? 0.05 + ratio * 0.075 : 0, now, 0.09);
      } catch { /* cosmetic */ }
    },

    // Two-tone siren that wails while a cruiser is near and wanted > 0.
    setSiren(on, dt) {
      if (!ensure() || !unlocked) return;
      if (!sirenOsc) {
        try {
          sirenOsc = ctx.createOscillator();
          sirenOsc.type = 'triangle';
          sirenOsc.frequency.value = 720;
          sirenGain = ctx.createGain();
          sirenGain.gain.value = 0;
          sirenOsc.connect(sirenGain);
          sirenGain.connect(master);
          sirenOsc.start();
        } catch { sirenOsc = null; return; }
      }
      try {
        const now = ctx.currentTime;
        if (on) {
          sirenTimer += dt;
          // A wail just under half a second per tone reads as an urgent
          // American-style siren without turning into a blur.
          if (sirenTimer > 0.38) {
            sirenTimer = 0;
            sirenHigh = !sirenHigh;
            sirenOsc.frequency.setTargetAtTime(sirenHigh ? 960 : 700, now, 0.05);
          }
          sirenGain.gain.setTargetAtTime(0.05, now, 0.1);
        } else {
          sirenGain.gain.setTargetAtTime(0, now, 0.15);
        }
      } catch { /* cosmetic */ }
    },

    setRain(raining) {
      if (!ensure() || !unlocked) return;
      startRain();
      if (!rainSrc) return;
      if (raining === rainOn) return;
      rainOn = raining;
      try {
        rainGain.gain.setTargetAtTime(raining ? 0.05 : 0, ctx.currentTime, 0.4);
      } catch { /* cosmetic */ }
    },

    // Club music on/off; bpm lets the floor feel faster or slower.
    setClub(on, bpm = 122) {
      if (on) {
        clubBpm = bpm;
        if (!ensure() || !unlocked) return;
        if (clubTimer) return;
        clubStep = 0;
        clubTick();
        clubTimer = setInterval(clubTick, (60 / clubBpm) * 4 * 1000);
      } else if (clubTimer) {
        clearInterval(clubTimer);
        clubTimer = null;
      }
    },
  };
}
