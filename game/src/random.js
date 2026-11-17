// Crown Bay — random.js rewritten in recorded session fix7, 18 Nov 2026.
// Seeded random: one deterministic stream per seed so a screenshot seed replays
// the same city, traffic and pedestrians. mulberry32, small and fast.
export function createRandom(seed) {
  let a = seed >>> 0;
  function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range(min, max) { return min + next() * (max - min); },
    int(min, max) { return Math.floor(min + next() * (max - min + 1)); },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    chance(p) { return next() < p; },
    // Gaussian-ish value in [-1, 1] for natural variation (heights, speeds).
    gauss() { return (next() + next() + next() - 1.5) / 1.5; },
  };
}
