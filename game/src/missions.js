// Crown Bay — the job list. Rook works for the fixer Marla Voss:
// five jobs, each a short chain of objectives, each paying cash when
// it lands. The runner below is deliberately small — it only knows how
// to test one objective at a time and how to point the player at the
// next one. The jobs themselves live in the tuning table (config.js),
// so rebalancing a payout never touches this file.
//
// An objective is done when its test passes:
//   vehicle  — the player is sitting in any vehicle
//   goto     — the player is close to a named landmark on the map
//   club     — the player has stepped inside Club Lumen
//   helipad  — the player is standing on the Crown Spire helipad
// The world hands the runner a context each frame: the player, the
// vehicles, the landmark map, the wanted level, whether the player is
// in the club, and where the helipad is.
import { MISSIONS } from './config.js';

function distance2d(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

// Resolve the beacon for the objective the player is working on:
// a landmark's door on the map, the helipad on the Spire roof, or
// nothing at all when the job only needs a car.
function targetFor(step, ctx) {
  if (!step) return null;
  if (step.type === 'goto' && step.at) {
    const lm = ctx.landmarks ? ctx.landmarks.get(step.at) : null;
    if (lm) return { x: lm.x, z: lm.z };
    return null;
  }
  if (step.type === 'helipad' && ctx.heliPad) {
    return { x: ctx.heliPad.x, z: ctx.heliPad.z };
  }
  return null;
}

function stepDone(step, ctx) {
  if (!step) return false;
  const player = ctx.player;
  if (step.type === 'vehicle') return !!player.inVehicle;
  if (step.type === 'club') return !!ctx.inClub;
  if (step.type === 'helipad') {
    if (!ctx.heliPad) return false;
    return distance2d(player.x, player.z, ctx.heliPad.x, ctx.heliPad.z) < 5;
  }
  if (step.type === 'goto' && step.at) {
    const lm = ctx.landmarks ? ctx.landmarks.get(step.at) : null;
    if (!lm) return false;
    // Landmarks are big; arriving at the door counts, not the centre.
    // A wide landmark (the port, the airfield) gets a wider net so the
    // player is not asked to find one exact paving stone.
    const tx = lm.door ? lm.door.x : lm.x;
    const tz = lm.door ? lm.door.z : lm.z;
    const reach = Math.max(7, (lm.hx || 10) + 2);
    return distance2d(player.x, player.z, tx, tz) < reach;
  }
  return false;
}

export function createMissions() {
  return {
    done: [],
    current: 0,
    step: 0,
    marker: null,
  };
}

export function currentMission(missions) {
  return MISSIONS[missions.current] ?? null;
}

export function currentStep(missions) {
  const mission = currentMission(missions);
  if (!mission) return null;
  return mission.steps[missions.step] ?? null;
}

// One frame of job logic. Returns the events the world should react
// to: a step ticking over, a job paying out, or the whole story ending.
export function missionsStep(missions, ctx) {
  const events = [];
  const mission = currentMission(missions);
  if (!mission) return { events };

  const step = currentStep(missions);
  // Keep the beacon on the current objective.
  missions.marker = targetFor(step, ctx);
  if (!step) return { events };

  if (!stepDone(step, ctx)) return { events };

  // This objective is done: move to the next one in the job.
  missions.step += 1;
  const next = currentStep(missions);
  if (next) {
    missions.marker = targetFor(next, ctx);
    events.push({ type: 'step' });
    return { events };
  }

  // The whole job is done: pay out, mark it, and open the next job.
  const reward = mission.reward || 0;
  ctx.player.cash += reward;
  missions.done.push(mission.id);
  missions.current += 1;
  missions.step = 0;
  const following = currentMission(missions);
  missions.marker = targetFor(currentStep(missions), ctx);
  events.push({ type: 'complete', mission, reward });
  if (!following) {
    events.push({ type: 'story-done' });
  }
  return { events };
}
