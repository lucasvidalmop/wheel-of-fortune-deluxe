// Generates a roulette spinning sound using Web Audio API
// Simulates the "tick tick tick" of a spinning wheel that slows down

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

export function playSpinSound(durationMs = 5000) {
  try {
    const ctx = getAudioContext();
    const totalTicks = 60;
    const startTime = ctx.currentTime;

    for (let i = 0; i < totalTicks; i++) {
      // Exponential slowdown: ticks get further apart
      const progress = i / totalTicks;
      const delay = (durationMs / 1000) * (1 - Math.pow(1 - progress, 2.5));

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      // Higher pitch at start, lower at end
      const freq = 800 + (1 - progress) * 1200;
      osc.frequency.setValueAtTime(freq, startTime + delay);
      osc.type = 'sine';

      // Short tick sound
      const tickDuration = 0.02 + progress * 0.04;
      const volume = 0.08 + (1 - progress) * 0.12;

      gain.gain.setValueAtTime(0, startTime + delay);
      gain.gain.linearRampToValueAtTime(volume, startTime + delay + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + delay + tickDuration);

      osc.start(startTime + delay);
      osc.stop(startTime + delay + tickDuration + 0.01);
    }

    // Final "ding" sound when wheel stops
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
    // Audio not supported - silently ignore
  }
}
