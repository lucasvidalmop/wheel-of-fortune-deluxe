// Plays a tick sound each time a case/prize tile crosses the center line
// during the Luckybox reel animation. Uses the CSS cubic-bezier curve to
// compute the exact time of each crossing, then schedules playback.

const TICK_URL = '/sounds/case-tick.mp3';
const POOL_SIZE = 8;

let pool: HTMLAudioElement[] = [];
let poolIdx = 0;
let scheduled: number[] = [];
let unlocked = false;

function ensurePool() {
  if (pool.length > 0) return;
  for (let i = 0; i < POOL_SIZE; i++) {
    const a = new Audio(TICK_URL);
    a.preload = 'auto';
    a.volume = 0.7;
    try { a.load(); } catch { /* noop */ }
    pool.push(a);
  }
}

/**
 * Warm up the audio pool inside a user gesture so the very first tick plays
 * without delay. Browsers block .play() until the user interacts; calling
 * play()+pause() here primes each element so subsequent plays are instant.
 */
export function primeCaseTicks() {
  ensurePool();
  if (unlocked) return;
  unlocked = true;
  for (const a of pool) {
    try {
      a.muted = true;
      const p = a.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          a.pause();
          a.currentTime = 0;
          a.muted = false;
        }).catch(() => { a.muted = false; });
      } else {
        a.pause();
        a.currentTime = 0;
        a.muted = false;
      }
    } catch { /* noop */ }
  }
}

function playTick() {
  ensurePool();
  const a = pool[poolIdx % pool.length];
  poolIdx++;
  try {
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch { /* noop */ }
}

// Preload as soon as the module is imported.
if (typeof window !== 'undefined') {
  ensurePool();
}


// Cubic-bezier solver (matches CSS transition-timing-function).
function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  const A = (a1: number, a2: number) => 1 - 3 * a2 + 3 * a1;
  const B = (a1: number, a2: number) => 3 * a2 - 6 * a1;
  const C = (a1: number) => 3 * a1;
  const calc = (t: number, a1: number, a2: number) =>
    ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t;
  const slope = (t: number, a1: number, a2: number) =>
    3 * A(a1, a2) * t * t + 2 * B(a1, a2) * t + C(a1);

  // Solve calc(t, p1x, p2x) = x for t (Newton-Raphson + bisection fallback).
  function tForX(x: number) {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const cur = calc(t, p1x, p2x) - x;
      const d = slope(t, p1x, p2x);
      if (Math.abs(cur) < 1e-6) return t;
      if (Math.abs(d) < 1e-6) break;
      t = t - cur / d;
    }
    let lo = 0, hi = 1, mid = x;
    for (let i = 0; i < 32; i++) {
      mid = (lo + hi) / 2;
      const v = calc(mid, p1x, p2x);
      if (v < x) lo = mid; else hi = mid;
      if (Math.abs(v - x) < 1e-6) break;
    }
    return mid;
  }

  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return calc(tForX(x), p1y, p2y);
  };
}

const easing = cubicBezier(0.16, 0.84, 0.3, 1);

export function cancelCaseTicks() {
  for (const id of scheduled) clearTimeout(id);
  scheduled = [];
}

/**
 * Schedule a tick sound for every item that crosses the center line while
 * the reel animates from offset 0 to `finalOffset` over `durationMs`.
 */
export function scheduleCaseTicks(opts: {
  durationMs: number;
  finalOffset: number; // typically negative (reel slides left)
  itemWidth: number;
  cardHalf: number;
  itemCount: number;
  halfViewport: number;
}) {
  cancelCaseTicks();
  ensurePool();

  const { durationMs, finalOffset, itemWidth, cardHalf, itemCount, halfViewport } = opts;

  // Item i is centered (in reel-local coords) at i*itemWidth + cardHalf.
  // Displayed center = currentOffset + i*itemWidth + cardHalf.
  // Crossing the viewport center means currentOffset = halfViewport - i*itemWidth - cardHalf.
  const lo = Math.min(0, finalOffset);
  const hi = Math.max(0, finalOffset);

  for (let i = 0; i < itemCount; i++) {
    const targetOffset = halfViewport - i * itemWidth - cardHalf;
    if (targetOffset < lo || targetOffset > hi) continue;
    const progress = finalOffset === 0 ? 0 : targetOffset / finalOffset; // 0..1 of distance covered
    if (progress <= 0 || progress > 1) continue;

    // Invert easing: find x such that easing(x) = progress.
    let xLo = 0, xHi = 1, x = progress;
    for (let k = 0; k < 28; k++) {
      x = (xLo + xHi) / 2;
      const v = easing(x);
      if (v < progress) xLo = x; else xHi = x;
      if (Math.abs(v - progress) < 1e-4) break;
    }
    const delay = x * durationMs;
    if (delay >= 0 && delay <= durationMs) {
      scheduled.push(window.setTimeout(playTick, delay));
    }
  }
}
