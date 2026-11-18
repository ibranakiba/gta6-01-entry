// fix9
// Crown Bay — a small seeded random source. The whole city is built
// from one of these, so the same seed always grows the same Crown Bay:
// the same towers on the same blocks, the same traffic in the same
// streets. Screenshots stay reproducible, and a saved game can rebuild
// the world it was played in.
//
// The generator is mulberry32: tiny, fast, and good enough for a city
// full of cosmetic choices. It is not for cryptography and never will be.

export function createRandom(seed) {
  // Normalise whatever seed arrives (a number, a string, nothing at
  // all) into one unsigned 32-bit state.
  let s = 0;
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    s = seed >>> 0;
  } else if (typeof seed === 'string') {
    for (let i = 0; i < seed.length; i += 1) {
      s = (Math.imul(s, 31) + seed.charCodeAt(i)) | 0;
    }
    s >>>= 0;
  } else {
    s = (Math.random() * 0xffffffff) >>> 0;
  }
  // A zero state would freeze mulberry32 on its first output, so nudge it.
  if (s === 0) s = 0x9e3779b9;

  function next() {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    // A float in [0, 1).
    next,
    // A float in [min, max).
    range(min, max) {
      return min + next() * (max - min);
    },
    // A whole number in [min, max] (both ends included).
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    // One element of an array, uniformly.
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    // True with probability p (0..1).
    chance(p) {
      return next() < p;
    },
    // A value picked from a weighted table: [[value, weight], ...].
    weighted(pairs) {
      let total = 0;
      for (const [, w] of pairs) total += w;
      let roll = next() * total;
      for (const [value, w] of pairs) {
        roll -= w;
        if (roll <= 0) return value;
      }
      return pairs[pairs.length - 1][0];
    },
  };
}
