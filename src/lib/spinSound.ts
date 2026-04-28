// Generates a roulette spinning sound using Web Audio API
// Simulates the "tick tick tick" of a spinning wheel that slows down

let audioCtx: AudioContext | null = null;
let customAudioEl: HTMLAudioElement | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

/** Preload a custom audio URL and return its duration in ms. */
export function getCustomAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', () => {
      resolve(Math.round(audio.duration * 1000));
    });
    audio.addEventListener('error', () => resolve(5000)); // fallback
    // timeout fallback
    setTimeout(() => resolve(5000), 3000);
  });
}

const DEFAULT_SPIN_SOUND_URL = '/sounds/spinning-wheel.mp3';

export function playSpinSound(durationMs = 5000, customUrl?: string, volume = 0.85) {
  stopSpinSound();

  // Only play if a custom URL is configured. No fallback sound — the operator
  // must upload their own audio in the Battle config panel.
  if (!customUrl) return;

  try {
    customAudioEl = new Audio(customUrl);
    customAudioEl.currentTime = 0;
    customAudioEl.volume = Math.min(1, Math.max(0, volume));
    customAudioEl.play().catch(() => {});
    // Stop the audio when the spin animation ends so it doesn't keep playing.
    if (durationMs > 0) {
      const el = customAudioEl;
      window.setTimeout(() => {
        if (el && customAudioEl === el) {
          try {
            el.pause();
            el.currentTime = 0;
          } catch { /* noop */ }
        }
      }, durationMs);
    }
  } catch {
    // ignore
  }
}

  try {
    const ctx = getAudioContext();
    const totalTicks = 60;
    const startTime = ctx.currentTime;

    for (let i = 0; i < totalTicks; i++) {
      const progress = i / totalTicks;
      const delay = (durationMs / 1000) * (1 - Math.pow(1 - progress, 2.5));

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const freq = 800 + (1 - progress) * 1200;
      osc.frequency.setValueAtTime(freq, startTime + delay);
      osc.type = 'sine';

      const tickDuration = 0.02 + progress * 0.04;
      const volume = 0.08 + (1 - progress) * 0.12;

      gain.gain.setValueAtTime(0, startTime + delay);
      gain.gain.linearRampToValueAtTime(volume, startTime + delay + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + delay + tickDuration);

      osc.start(startTime + delay);
      osc.stop(startTime + delay + tickDuration + 0.01);
    }

    const finalTime = startTime + durationMs / 1000 - 0.1;
    const ding = ctx.createOscillator();
    const dingGain = ctx.createGain();
    ding.connect(dingGain);
    dingGain.connect(ctx.destination);
    ding.frequency.setValueAtTime(1200, finalTime);
    ding.type = 'sine';
    dingGain.gain.setValueAtTime(0, finalTime);
    dingGain.gain.linearRampToValueAtTime(0.15, finalTime + 0.01);
    dingGain.gain.exponentialRampToValueAtTime(0.001, finalTime + 0.5);
    ding.start(finalTime);
    ding.stop(finalTime + 0.6);
  } catch {
    // Audio not supported
  }
}

export function stopSpinSound() {
  if (customAudioEl) {
    customAudioEl.pause();
    customAudioEl.currentTime = 0;
    customAudioEl = null;
  }
}
