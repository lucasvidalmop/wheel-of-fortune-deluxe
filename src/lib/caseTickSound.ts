// Plays a tick sound each time a case/prize tile crosses the center line
// during the Luckybox reel animation. Uses the Web Audio API so playback is
// instant on mobile (no HTMLAudioElement pool, no first-play delay).

const TICK_URL = '/sounds/case-tick.mp3';

let ctx: AudioContext | null = null;
let buffer: AudioBuffer | null = null;
let bufferPromise: Promise<AudioBuffer | null> | null = null;
let scheduled: number[] = [];
let unlocked = false;
let volume = 0.7;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;
  const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

async function loadBuffer(): Promise<AudioBuffer | null> {
  if (buffer) return buffer;
  if (bufferPromise) return bufferPromise;
  const c = getCtx();
  if (!c) return null;
  bufferPromise = (async () => {
    try {
      const res = await fetch(TICK_URL);
      const arr = await res.arrayBuffer();
      const decoded = await new Promise<AudioBuffer>((resolve, reject) => {
        // Safari needs the callback form.
        try {
          c.decodeAudioData(arr, resolve, reject);
        } catch (e) { reject(e); }
      });
      buffer = decoded;
      return decoded;
    } catch {
      return null;
    }
  })();
  return bufferPromise;
}

/**
 * Warm up audio inside the user gesture so subsequent ticks are instant.
 * Resumes the AudioContext (required on iOS) and triggers buffer decode.
 */
export function primeCaseTicks() {
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') {
    c.resume().catch(() => {});
  }
  if (!unlocked) {
    unlocked = true;
    // Play a 1-sample silent buffer to fully unlock on iOS.
    try {
      const silent = c.createBuffer(1, 1, 22050);
      const src = c.createBufferSource();
      src.buffer = silent;
      src.connect(c.destination);
      src.start(0);
    } catch { /* noop */ }
  }
  loadBuffer();
}

function playTick() {
  const c = getCtx();
  if (!c || !buffer) return;
  try {
    const src = c.createBufferSource();
    src.buffer = buffer;
    const gain = c.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(c.destination);
    src.start(0);
  } catch { /* noop */ }
}

export function cancelCaseTicks() {
  for (const id of scheduled) clearTimeout(id);
  scheduled = [];
}

// Cubic-bezier solver matching the CSS transition easing.
function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  const A = (a1: number, a2: number) => 1 - 3 * a2 + 3 * a1;
  const B = (a1: number, a2: number) => 3 * a2 - 6 * a1;
  const C = (a1: number) => 3 * a1;
  const calc = (t: number, a1: number, a2: number) =>
    ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t;
  const slope = (t: number, a1: number, a2: number) =>
    3 * A(a1, a2) * t * t + 2 * B(a1, a2) * t + C(a1);
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

export function scheduleCaseTicks(opts: {
  durationMs: number;
  finalOffset: number;
  itemWidth: number;
  cardHalf: number;
  itemCount: number;
  halfViewport: number;
}) {
  cancelCaseTicks();
  // Make sure the buffer is decoding (no-op if already loaded).
  loadBuffer();

  const { durationMs, finalOffset, itemWidth, cardHalf, itemCount, halfViewport } = opts;
  const lo = Math.min(0, finalOffset);
  const hi = Math.max(0, finalOffset);

  for (let i = 0; i < itemCount; i++) {
    const targetOffset = halfViewport - i * itemWidth - cardHalf;
    if (targetOffset < lo || targetOffset > hi) continue;
    const progress = finalOffset === 0 ? 0 : targetOffset / finalOffset;
    if (progress <= 0 || progress > 1) continue;

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

// Kick off the buffer fetch on import so it's cached when the user interacts.
if (typeof window !== 'undefined') {
  // Defer slightly so it doesn't compete with critical resources.
  setTimeout(() => { loadBuffer(); }, 800);
}
