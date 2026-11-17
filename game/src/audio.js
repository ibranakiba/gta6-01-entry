// Crown Bay — audio.js rewritten in recorded session fix7, 18 Nov 2026.
// Procedural sound, all WebAudio, no audio files: engine hum follows speed, a
// two-tone CBPD siren, horn, gunshot, cash-register chime, footsteps-free ambient
// city hum, rain hiss, and a four-on-the-floor club loop inside Club Lumen.
// Everything starts on the first user gesture (browsers demand it).
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
  let clubNodes = null;
  let rainGain = null;
  let rainSrc = null;
  let ambientGain = null;
  let started = false;

  function ensure() {
    if (started) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine: two detuned saws through a lowpass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 58;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();
      engineOsc._mate = engineOsc2;
      // Siren: triangle, alternates 700 / 950 Hz.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      // Ambient city hum: brown-ish noise through a lowpass, very quiet.
      const ambBuf = makeNoiseBuffer(2);
      const ambSrc = ctx.createBufferSource();
      ambSrc.buffer = ambBuf;
      ambSrc.loop = true;
      const ambFilter = ctx.createBiquadFilter();
      ambFilter.type = 'lowpass';
      ambFilter.frequency.value = 320;
      ambientGain = ctx.createGain();
      ambientGain.gain.value = 0.05;
      ambSrc.connect(ambFilter);
      ambFilter.connect(ambientGain);
      ambientGain.connect(master);
      ambSrc.start();
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function makeNoiseBuffer(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02; // brown-ish
      data[i] = last * 3.2;
    }
    return buf;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const buf = makeNoiseBuffer(dur + 0.05);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  return {
    /** Call from any user gesture. Safe to call repeatedly. */
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    get ready() { return started; },
    setEngine(speed01, on) {
      if (!ctx) return;
      const t = ctx.currentTime;
      engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.075 : 0, t, 0.08);
      const f = 52 + speed01 * 130;
      engineOsc.frequency.setTargetAtTime(f, t, 0.05);
      engineOsc._mate.frequency.setTargetAtTime(f * 1.01, t, 0.05);
      engineFilter.frequency.setTargetAtTime(320 + speed01 * 900, t, 0.1);
    },
    setSiren(on, dt) {
      if (!ctx) return;
      sirenTimer -= dt;
      if (sirenTimer <= 0) {
        sirenTimer = 0.42;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.setTargetAtTime(sirenHigh ? 950 : 660, ctx.currentTime, 0.03);
      }
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.1);
    },
    horn() { if (ctx) { blip(370, 0.28, 'square', 0.16); blip(466, 0.28, 'square', 0.12); } },
    gunshot() { if (ctx) noiseBurst(0.14, 0.5, 2400); },
    reload() { if (ctx) { blip(900, 0.06, 'square', 0.1); setTimeout(() => blip(620, 0.06, 'square', 0.1), 120); } },
    cash() { if (ctx) { blip(1318, 0.12, 'sine', 0.18); setTimeout(() => blip(1760, 0.2, 'sine', 0.18), 110); } },
    thud() { if (ctx) noiseBurst(0.18, 0.4, 300); },
    wantedUp() { if (ctx) { blip(220, 0.16, 'square', 0.14); setTimeout(() => blip(165, 0.24, 'square', 0.14), 150); } },
    missionDone() {
      if (!ctx) return;
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'sine', 0.16), i * 110));
    },
    setRain(on) {
      if (!ctx) return;
      if (on && !rainSrc) {
        rainSrc = ctx.createBufferSource();
        rainSrc.buffer = makeNoiseBuffer(2);
        rainSrc.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 900;
        rainGain = ctx.createGain();
        rainGain.gain.value = 0;
        rainSrc.connect(f);
        f.connect(rainGain);
        rainGain.connect(master);
        rainSrc.start();
      }
      if (rainGain) rainGain.gain.setTargetAtTime(on ? 0.05 : 0, ctx.currentTime, 0.4);
    },
    // Club Lumen: kick + bass + hats, scheduled per beat while inside.
    setClub(on, bpm) {
      if (!ctx) return;
      if (on && !clubNodes) {
        const beat = 60 / (bpm || 122);
        const kick = () => { blip(150, 0.16, 'sine', 0.5, 42); };
        const bass = (f) => { blip(f, 0.22, 'sawtooth', 0.1); };
        const hat = () => { noiseBurst(0.03, 0.05, 8000); };
        const seq = [55, 0, 55, 65.4, 55, 0, 49, 58.3];
        let i = 0;
        const timer = setInterval(() => {
          if (!clubNodes) return;
          kick();
          if (seq[i % 8]) bass(seq[i % 8] * 2);
          if (i % 2 === 1) hat();
          i += 1;
        }, beat * 500);
        clubNodes = { timer };
      } else if (!on && clubNodes) {
        clearInterval(clubNodes.timer);
        clubNodes = null;
      }
    },
    stopAll() {
      if (!ctx) return;
      if (engineGain) engineGain.gain.value = 0;
      if (sirenGain) sirenGain.gain.value = 0;
      if (rainGain) rainGain.gain.value = 0;
      this.setClub(false);
    },
  };
}
