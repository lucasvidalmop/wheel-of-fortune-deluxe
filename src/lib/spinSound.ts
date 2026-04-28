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

export function stopSpinSound() {
  if (customAudioEl) {
    customAudioEl.pause();
    customAudioEl.currentTime = 0;
    customAudioEl = null;
  }
}
