import { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';

export interface PlinkoBall {
  id: string;
  label: string;
  /** Optional slot the ball should end up in (weighted by configured chances) */
  targetSlot?: number;
}

export interface PlinkoLanding {
  id: string;
  slotIndex: number;
  multiplier: number;
}

interface PlinkoBoardProps {
  /** Number of peg rows. Slots (bins) are always rows + 1, mirroring a real Galton board. */
  rows: number;
  multipliers: number[];
  accent: string;
  /** Increment this value to trigger a new drop */
  dropToken: number;
  balls?: PlinkoBall[];
  onLanded?: (landing: PlinkoLanding) => void;
  onAllLanded?: (landings: PlinkoLanding[]) => void;
  fill?: boolean;
}

const STAGGER_MS = 380;
const PHYSICS_TIME_SCALE = 0.46;
const MAX_UPWARD_VELOCITY = -0.16;
const PEG_CATEGORY = 0x0004;
const BOARD_BG = '#0f2130';

interface BallMeta {
  id: string;
  label: string;
  body: Matter.Body;
  landed: boolean;
  landedAt: number;
  restFrames: number;
  stallFrames: number;
  lastY: number;
  restX: number;
  restY: number;
  slotIndex: number;
  targetSlot?: number;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6) || 'ffcc33', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Heat-map for the multiplier bins: yellow at the lowest value, through
 * orange, to a deep red/pink at the highest — independent of the operator's
 * accent color, matching how every real Plinko board colors its slots. */
const binColor = (t: number) => {
  // t: 0 (lowest multiplier) -> 1 (highest multiplier)
  const hue = 50 - t * 40; // 50 (yellow) -> 10 (red-orange) -> extends below via saturation/lightness
  const sat = 90;
  const light = 52 - t * 12;
  if (t > 0.72) {
    // push the very top tiers toward pink/red like the reference
    const k = (t - 0.72) / 0.28;
    return `hsl(${10 - k * 10}, ${sat}%, ${light - k * 6}%)`;
  }
  return `hsl(${hue}, ${sat}%, ${light}%)`;
};

const PlinkoBoard = ({
  rows, multipliers, accent, dropToken, balls = [], onLanded, onAllLanded, fill = false,
}: PlinkoBoardProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [sizeKey, setSizeKey] = useState('');

  // A real Galton board always has one more bin than peg rows.
  const slots = rows + 1;

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const update = () => {
      const next = `${Math.round(wrap.clientWidth)}x${Math.round(wrap.clientHeight)}`;
      setSizeKey(current => current === next ? current : next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = Math.max(280, wrap.clientWidth || 320);
    const H = Math.max(280, wrap.clientHeight || W);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const [ar, ag, ab] = hexToRgb(accent);
    const A = (a: number) => `rgba(${ar},${ag},${ab},${a})`;

    // A Galton board reads correctly only when its horizontal peg spacing
    // matches its vertical row spacing — otherwise a wide, short container
    // (this one fills its parent) stretches the pyramid into a flat smear.
    // Compute the natural (square-ish) size first, then fit it inside
    // whichever dimension is the tighter constraint, centering the rest.
    const topPadFrac = 0.07;
    const binHFrac = 0.08;
    const naturalRowGap = H * (1 - topPadFrac - binHFrac) / rows;
    const widthNeeded = naturalRowGap * slots;
    const availW = W * 0.94;

    let d: number;
    let topPad: number;
    let binH: number;
    let rowGap: number;
    if (widthNeeded <= availW) {
      d = naturalRowGap;
      topPad = H * topPadFrac;
      binH = Math.max(28, Math.min(46, H * binHFrac));
      rowGap = naturalRowGap;
    } else {
      // Rare (very narrow container): fall back to fitting the width and
      // shrink vertical spacing to match, keeping the pyramid proportional.
      d = availW / slots;
      rowGap = d;
      topPad = H * topPadFrac;
      binH = Math.max(24, H - topPad - rowGap * rows);
    }
    const padX = (W - d * slots) / 2;
    const pegR = Math.max(2.5, Math.min(d * 0.16, rowGap * 0.17));
    const ballR = Math.max(4, Math.min(d * 0.24, rowGap * 0.26));
    const binW = d;

    const binTop = H - binH;
    const centerX = W / 2;
    const rowYPx = (r: number) => topPad + (r + 1) * rowGap;

    const engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.00027 } });
    const world = engine.world;

    // Pure pyramid: row r has r+3 pegs, centered. Last row has rows+2 pegs,
    // sitting directly above the `slots` bins below it (slots = rows + 1).
    const pegPos: { x: number; y: number }[] = [];
    const pegBodies: Matter.Body[] = [];
    for (let r = 0; r < rows; r++) {
      const count = r + 3;
      for (let j = 0; j < count; j++) {
        const x = centerX + (j - (count - 1) / 2) * d;
        const y = rowYPx(r);
        pegBodies.push(Matter.Bodies.circle(x, y, pegR, {
          isStatic: true, restitution: 0.58, friction: 0, label: `peg:${pegPos.length}`,
          collisionFilter: { category: PEG_CATEGORY, mask: 0xffffffff, group: 0 },
        }));
        pegPos.push({ x, y });
      }
    }
    Matter.Composite.add(world, pegBodies);

    Matter.Composite.add(world, Matter.Bodies.rectangle(W / 2, H + 10, W * 3, 20, {
      isStatic: true, restitution: 0.2, friction: 0.08,
    }));
    for (let i = 0; i <= slots; i++) {
      Matter.Composite.add(world, Matter.Bodies.rectangle(padX + i * binW, binTop + binH / 2, 3, binH, {
        isStatic: true, restitution: 0.3, friction: 0.2,
      }));
    }

    const limitAt = (y: number) => {
      const r = Math.max(0, Math.min(rows - 1, Math.floor((y - topPad) / rowGap)));
      return ((r + 3) - 1) / 2 * d;
    };

    const metas: BallMeta[] = [];
    const pegFlash = new Map<number, number>();
    const slotFlash = new Map<number, number>();
    const binHits = new Map<number, number>();
    const landings: PlinkoLanding[] = [];
    const pending: { meta: BallMeta; at: number }[] = [];

    Matter.Events.on(engine, 'collisionStart', (evt) => {
      const now = performance.now();
      for (const pair of evt.pairs) {
        for (const [a] of [[pair.bodyA, pair.bodyB], [pair.bodyB, pair.bodyA]] as const) {
          if (typeof a.label === 'string' && a.label.startsWith('peg:')) {
            pegFlash.set(Number(a.label.slice(4)), now);
          }
        }
      }
    });

    if (dropToken > 0 && balls.length > 0) {
      const now = performance.now();
      balls.forEach((b, i) => {
        const tSlot = typeof b.targetSlot === 'number'
          ? Math.min(slots - 1, Math.max(0, b.targetSlot))
          : undefined;
        const bias = tSlot === undefined
          ? 0
          : Math.max(-d * 0.5, Math.min(d * 0.5, (padX + (tSlot + 0.5) * binW - centerX) * 0.3));
        const body = Matter.Bodies.circle(
          centerX + bias + (Math.random() - 0.5) * d * 0.06,
          topPad * 0.3,
          ballR,
          { restitution: 0.56, friction: 0, frictionAir: 0.002, density: 0.0012, slop: 0.01 },
        );
        Matter.Body.setVelocity(body, { x: (Math.random() - 0.5) * 0.2, y: 0 });

        const meta: BallMeta = {
          id: b.id, label: b.label, body,
          landed: false, landedAt: 0,
          restFrames: 0, stallFrames: 0, lastY: -1,
          restX: 0, restY: 0, slotIndex: 0,
          targetSlot: tSlot,
        };
        metas.push(meta);
        pending.push({ meta, at: now + i * STAGGER_MS });
      });
    }

    const slotIndexOf = (x: number) => Math.min(slots - 1, Math.max(0, Math.floor((x - padX) / binW)));

    let idleSince = 0;

    const step = (t: number) => {
      while (pending.length && pending[0].at <= t) {
        const { meta } = pending.shift()!;
        Matter.Composite.add(world, meta.body);
      }

      Matter.Engine.update(engine, (1000 / 60) * PHYSICS_TIME_SCALE);

      let active = pending.length > 0;
      for (const m of metas) {
        if (m.landed) continue;
        if (!world.bodies.includes(m.body)) continue;
        active = true;

        const p = m.body.position;

        if (m.body.velocity.y < MAX_UPWARD_VELOCITY) {
          Matter.Body.setVelocity(m.body, { x: m.body.velocity.x, y: MAX_UPWARD_VELOCITY });
        }

        if (p.y < binTop - ballR) {
          const lim = limitAt(p.y);
          const off = p.x - centerX;
          if (Math.abs(off) > lim) {
            const sign = Math.sign(off) || 1;
            Matter.Body.setPosition(m.body, { x: centerX + sign * lim, y: p.y });
            Matter.Body.setVelocity(m.body, { x: -sign * (0.25 + Math.abs(m.body.velocity.x) * 0.4), y: m.body.velocity.y });
          }
        }

        if (typeof m.targetSlot === 'number') {
          const progress = Math.min(1, Math.max(0, (p.y - topPad) / Math.max(1, binTop - topPad)));
          // Let the first couple of rows bounce with pure physics before any
          // bias kicks in, so the drop reads as random, not steered.
          if (progress > 0.12 && progress < 0.4) {
            const desiredX = padX + (m.targetSlot + 0.5) * binW;
            const dx = desiredX - p.x;
            const fade = 1 - (progress - 0.12) / 0.28;
            const pull = 0.00000075 * m.body.mass * 11 * fade;
            Matter.Body.applyForce(m.body, p, { x: Math.max(-1, Math.min(1, dx / (binW * 2))) * pull, y: 0 });
          }
        }

        const speed = Math.hypot(m.body.velocity.x, m.body.velocity.y);
        const inBin = p.y > binTop - ballR * 1.1;
        if (inBin && speed < 0.35) m.restFrames += 1; else m.restFrames = 0;

        if (!inBin) {
          if (m.lastY >= 0 && Math.abs(p.y - m.lastY) < 0.12) {
            m.stallFrames += 1;
            if (m.stallFrames > 30) {
              m.stallFrames = 0;
              Matter.Body.setVelocity(m.body, { x: (Math.random() < 0.5 ? -1 : 1) * 0.35, y: 0.2 });
            }
          } else {
            m.stallFrames = 0;
          }
          m.lastY = p.y;
        }

        if (m.restFrames > 7) {
          const slotIndex = slotIndexOf(m.body.position.x);
          m.landed = true;
          m.landedAt = t;
          m.slotIndex = slotIndex;
          m.restX = padX + (slotIndex + 0.5) * binW;
          m.restY = binTop + binH * 0.5;
          Matter.Composite.remove(world, m.body);
          slotFlash.set(slotIndex, t);
          binHits.set(slotIndex, (binHits.get(slotIndex) || 0) + 1);
          const landing = { id: m.id, slotIndex, multiplier: multipliers[slotIndex] };
          landings.push(landing);
          onLanded?.(landing);
          if (landings.length === metas.length) onAllLanded?.([...landings]);
        }
      }

      return active;
    };

    const drawBall = (t: number, m: BallMeta) => {
      let px: number, py: number, alpha = 1;
      if (m.landed) {
        const k = Math.min(1, (t - m.landedAt) / 200);
        px = m.restX;
        py = (m.body.position.y ?? m.restY) + (m.restY - (m.body.position.y ?? m.restY)) * k;
        alpha = 0.95;
      } else {
        px = m.body.position.x;
        py = m.body.position.y;
      }
      ctx.globalAlpha = alpha;

      // Soft contact shadow — the one thing that makes a flat circle read as
      // a ball resting on a surface instead of a sticker pasted on top of it.
      ctx.beginPath();
      ctx.ellipse(px, py + ballR * 0.55, ballR * 0.85, ballR * 0.32, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();

      const shade = ctx.createRadialGradient(
        px - ballR * 0.32, py - ballR * 0.38, ballR * 0.1,
        px, py, ballR * 1.05,
      );
      shade.addColorStop(0, A(1));
      shade.addColorStop(0.55, A(1));
      shade.addColorStop(1, A(0.72));
      ctx.beginPath();
      ctx.arc(px, py, ballR, 0, Math.PI * 2);
      ctx.fillStyle = shade;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px - ballR * 0.32, py - ballR * 0.38, ballR * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();

      if (metas.length <= 4 && !m.landed) {
        const label = m.label.length > 14 ? `${m.label.slice(0, 13)}…` : m.label;
        ctx.font = '800 10px Barlow, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const w = ctx.measureText(label).width + 12;
        const ly = Math.max(10, py - ballR - 12);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        ctx.roundRect(px - w / 2, ly - 8, w, 16, 8);
        ctx.fill();
        ctx.fillStyle = A(1);
        ctx.fillText(label.toUpperCase(), px, ly);
      }
      ctx.globalAlpha = 1;
    };

    const maxMult = Math.max(...multipliers, 0.0001);
    const minMult = Math.min(...multipliers, 0);

    const draw = (t: number) => {
      ctx.fillStyle = BOARD_BG;
      ctx.fillRect(0, 0, W, H);

      // pegs
      for (let i = 0; i < pegPos.length; i++) {
        const { x: px, y: py } = pegPos[i];
        const flash = pegFlash.get(i);
        const heat = flash ? Math.max(0, 1 - (t - flash) / 320) : 0;
        if (heat > 0) {
          const pg = ctx.createRadialGradient(px, py, 0, px, py, pegR * 4);
          pg.addColorStop(0, `rgba(255,255,255,${0.55 * heat})`);
          pg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = pg;
          ctx.beginPath();
          ctx.arc(px, py, pegR * 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(px, py, pegR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.85 + heat * 0.15})`;
        ctx.fill();
      }

      // bins
      for (let i = 0; i < slots; i++) {
        const m = multipliers[i];
        const norm = maxMult === minMult ? 0.5 : (m - minMult) / (maxMult - minMult);
        const flash = slotFlash.get(i);
        const lit = flash ? Math.max(0, 1 - (t - flash) / 700) : 0;
        const hits = binHits.get(i) || 0;
        const x = padX + i * binW + 2;
        const y = binTop + 2 - lit * 4;
        const w = binW - 4;
        const h = binH - 6;
        const r = 5;

        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        ctx.fillStyle = binColor(norm);
        ctx.fill();
        if (lit > 0) {
          ctx.save();
          ctx.shadowColor = 'rgba(255,255,255,0.9)';
          ctx.shadowBlur = 16 * lit;
          ctx.strokeStyle = `rgba(255,255,255,${0.8 * lit})`;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }

        ctx.fillStyle = '#0f1923';
        ctx.font = `800 ${Math.max(9, Math.min(13, binW * 0.34))}px Barlow, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${m}x`, x + w / 2, y + h / 2);
      }

      for (const m of metas) {
        if (m.landed) {
          // Drop into the bin, then vanish — the lit bin border is what
          // marks the outcome, not a ball parked on top of it forever.
          if (t - m.landedAt > 260) continue;
        } else if (!world.bodies.includes(m.body)) continue;
        drawBall(t, m);
      }
    };

    const loop = () => {
      const t = performance.now();
      const active = step(t);
      draw(t);
      if (active) idleSince = 0;
      else if (!idleSince) idleSince = t;
      if (active || !idleSince || t - idleSince < 1200) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      Matter.Events.off(engine, 'collisionStart');
      Matter.Composite.clear(world, false);
      Matter.Engine.clear(engine);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropToken, rows, slots, accent, multipliers.join(','), sizeKey]);

  return (
    <div
      ref={wrapRef}
      className={`relative w-full rounded-2xl overflow-hidden border ${fill ? 'h-full' : ''}`}
      style={{
        ...(fill ? {} : { aspectRatio: '1 / 1' }),
        borderColor: `${accent}25`,
        background: BOARD_BG,
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
};

export default PlinkoBoard;
