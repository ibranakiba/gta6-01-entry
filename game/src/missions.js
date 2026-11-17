// Crown Bay — missions.js rewritten in recorded session fix7, 18 Nov 2026.
// Story: Rook, fresh in Crown Bay, runs jobs for the fixer Marla Voss.
// Five missions, each a chain of steps with a live objective marker. Steps are
// checked against the world (landmark doors, being in a car, wanted level,
// being inside the club, flying away) and pay cash on completion.
import { MISSIONS } from './config.js';

export function createMissions() {
  return {
    list: MISSIONS,
    current: 0, // index into MISSIONS, or -1 when the story is done
    step: 0,
    done: [],
    marker: null, // {x, z, y, label} or null
    contactSpawned: false,
  };
}

export function currentMission(m) {
  if (m.current < 0 || m.current >= m.list.length) return null;
  return m.list[m.current];
}

export function currentStep(m) {
  const mission = currentMission(m);
  if (!mission) return null;
  return mission.steps[m.step] ?? null;
}

// Resolve a step's target into a world position for the marker + minimap.
export function stepTargetPos(step, ctx) {
  if (!step) return null;
  const t = step.target;
  if (t === 'anyCar') {
    // nearest parked/traffic car to the player
    let best = null, bd = 1e9;
    for (const v of ctx.vehicles) {
      if (v.police || v.type === 'helicopter' || v.type === 'plane') continue;
      const d = Math.hypot(v.x - ctx.player.x, v.z - ctx.player.z);
      if (d < bd) { bd = d; best = v; }
    }
    return best ? { x: best.x, z: best.z, y: 1, label: 'Car' } : null;
  }
  if (t === 'wanted:3') return { x: ctx.player.x, z: ctx.player.z, y: 1, label: 'Cause trouble!' };
  if (t === 'club:contact') return { x: 2, z: 418, y: 1, label: 'Contact' };
  if (t === 'flyaway') return { x: 420, z: 0, y: 80, label: 'Fly east, out to sea' };
  if (t.startsWith('landmark:')) {
    const name = t.slice('landmark:'.length);
    const lm = ctx.landmarks.get(name);
    if (!lm) return null;
    return { x: lm.door.x, z: lm.door.z, y: 1, label: name };
  }
  return null;
}

// Advance the mission state machine. Returns events for the world to act on.
export function missionsStep(m, ctx) {
  const mission = currentMission(m);
  if (!mission) return { events: [] };
  const step = mission.steps[m.step];
  const events = [];
  if (!step) return { events };
  const t = step.target;
  const near = (x, z, r) => Math.hypot(ctx.player.x - x, ctx.player.z - z) < r;
  let done = false;
  if (t === 'anyCar') done = !!ctx.player.inVehicle;
  else if (t === 'wanted:3') done = ctx.wanted >= 3;
  else if (t === 'club:contact') done = ctx.inClub && near(2, 418, 4);
  else if (t === 'flyaway') {
    const v = ctx.player.inVehicle;
    done = !!v && (v.type === 'helicopter' || v.type === 'plane') && (v.x > 380 || v.y > 60);
  } else if (t.startsWith('landmark:')) {
    const name = t.slice('landmark:'.length);
    const lm = ctx.landmarks.get(name);
    if (lm) {
      // bank robbery needs the player to be inside the bank door; spire needs the roof
      if (name === 'Crown Spire' && mission.id === 'm5' && m.step === 1) {
        const pad = ctx.heliPad;
        done = pad && Math.hypot(ctx.player.x - pad.x, ctx.player.z - pad.z) < 8 && ctx.player.y > 140;
      } else {
        done = near(lm.door.x, lm.door.z, 7);
      }
    }
  }
  if (done) {
    m.step += 1;
    events.push({ type: 'step', mission, stepIndex: m.step });
    if (m.step >= mission.steps.length) {
      ctx.player.cash += mission.reward;
      m.done.push(mission.id);
      events.push({ type: 'complete', mission, reward: mission.reward });
      m.current += 1;
      m.step = 0;
      if (m.current >= m.list.length) {
        m.current = -1;
        events.push({ type: 'story-done' });
      }
    }
  }
  // refresh the marker
  const nextStep = currentStep(m);
  m.marker = nextStep ? stepTargetPos(nextStep, ctx) : null;
  return { events };
}
