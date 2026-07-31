import { useEffect, useRef } from 'react';
import Matter from 'matter-js';

export interface PlinkoBall {
  id: string;
  label: string;
}

export interface PlinkoLanding {
  id: string;
  slotIndex: number;
  multiplier: number;
}

interface PlinkoBoardProps {
  rows: number;
  multipliers: number[];
  accent: string;
  /** Increment this value to trigger a new drop */
  dropToken: number;
  balls?: PlinkoBall[];
  onLanded?: (landing: PlinkoLanding) => void;
  onAllLanded?: (landings: PlinkoLanding[]) => void;
}

const STAGGER_MS = 220;
const TRAIL = 16;

interface BallMeta {
  id: string;
  label: string;
  body: Matter.Body;
  trail: { x: number; y: number }[];
  squash: number;
  landed: boolean;
  landedAt: number;
  restFrames: number;
  stallFrames: number;
}

interface Spark {
  x: number; y: number; vx: number; vy: number; life: number; size: number;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6) || 'ffcc33', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const PlinkoBoard = ({
  rows, multipliers, accent, dropToken, balls = [], onLanded, onAllLanded,
}: PlinkoBoardProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const slots = multipliers.length;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const [ar, ag, ab] = hexToRgb(accent);
    const A = (a: number) => `rgba(${ar},${ag},${ab},${a})`;

    // ---- world sizing -------------------------------------------------
    const W = Math.max(280, wrap.clientWidth);
    const H = Math.max(280, wrap.clientHeight || W);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const padX = W * 0.05;
    const usableW = W - padX * 2;
    const d = usableW / slots;                 // horizontal peg spacing
    const binH = Math.max(34, H * 0.11);
    const topPad = H * 0.11;
    const boardH = H - topPad - binH;
    const rowGap = boardH / (rows + 1.2);
    const pegR = Math.max(2.6, d * 0.09);
    const ballR = Math.max(5, d * 0.28);
    const binTop = H - binH;
    const centerX = padX + usableW / 2;
    const rowYPx = (r: number) => topPad + (r + 1) * rowGap;

    const maxMult = Math.max(...multipliers, 1);
    const minMult = Math.min(...multipliers, 0);

    // ---- engine -------------------------------------------------------
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.0011 } });
    const world = engine.world;

    const pegBodies: Matter.Body[] = [];
    const pegPos: { x: number; y: number }[] = [];
    for (let r = 0; r < rows; r++) {
      const count = r + 2;
      for (let j = 0; j < count; j++) {
        const x = centerX + (j - (count - 1) / 2) * d;
        const y = rowYPx(r);
        const peg = Matter.Bodies.circle(x, y, pegR, {
          isStatic: true,
          restitution: 0.45,
          friction: 0.02,
          label: `peg:${pegPos.length}`,
        });
        pegBodies.push(peg);
        pegPos.push({ x, y });
      }
    }
    Matter.Composite.add(world, pegBodies);

    // walls + funnel
    const wallOpts = { isStatic: true, restitution: 0.2, friction: 0.02 };
    Matter.Composite.add(world, [
      Matter.Bodies.rectangle(padX - 12, H / 2, 24, H * 2, wallOpts),
      Matter.Bodies.rectangle(W - padX + 12, H / 2, 24, H * 2, wallOpts),
      Matter.Bodies.rectangle(W / 2, H + 10, W * 2, 20, wallOpts),
    ]);

    // bin dividers
    const binW = usableW / slots;
    for (let i = 0; i <= slots; i++) {
      const x = padX + i * binW;
      Matter.Composite.add(world, Matter.Bodies.rectangle(x, binTop + binH / 2, 3, binH, {
        isStatic: true, restitution: 0.1, friction: 0.3,
      }));
    }

    // ---- runtime state ------------------------------------------------
    const metas: BallMeta[] = [];
    const sparks: Spark[] = [];
    const pegFlash = new Map<number, number>();
    const slotFlash = new Map<number, number>();
    const binHits = new Map<number, number>();
    const landings: PlinkoLanding[] = [];
    const pending: { meta: BallMeta; at: number }[] = [];

    const spawnSparks = (px: number, py: number, count: number, power: number) => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = (0.4 + Math.random()) * power;
        sparks.push({
          x: px, y: py,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s - power * 0.6,
          life: 1,
          size: 1 + Math.random() * 2.2,
        });
      }
    };

    Matter.Events.on(engine, 'collisionStart', (evt) => {
      const now = performance.now();
      for (const pair of evt.pairs) {
        for (const [a, b] of [[pair.bodyA, pair.bodyB], [pair.bodyB, pair.bodyA]] as const) {
          if (typeof a.label === 'string' && a.label.startsWith('peg:')) {
            const idx = Number(a.label.slice(4));
            pegFlash.set(idx, now);
            const meta = metas.find(m => m.body === b);
            if (meta) {
              meta.squash = 1;
              const p = pegPos[idx];
              if (p) spawnSparks(p.x, p.y, 3, 0.8);
            }
          }
        }
      }
    });

    if (dropToken > 0 && balls.length > 0) {
      const now = performance.now();
      balls.forEach((b, i) => {
        const body = Matter.Bodies.circle(
          centerX + (Math.random() - 0.5) * d * 0.35,
          topPad * 0.25,
          ballR,
          {
            restitution: 0.55,
            friction: 0.008,
            frictionAir: 0.012,
            density: 0.0016,
            slop: 0.02,
          },
        );
        Matter.Body.setVelocity(body, { x: (Math.random() - 0.5) * 1.2, y: 0 });
        const meta: BallMeta = {
          id: b.id, label: b.label, body,
          trail: [], squash: 0, landed: false, landedAt: 0, restFrames: 0, stallFrames: 0,
        };
        metas.push(meta);
        pending.push({ meta, at: now + i * STAGGER_MS });
      });
    }

    const slotIndexOf = (x: number) =>
      Math.min(slots - 1, Math.max(0, Math.floor((x - padX) / binW)));

    let idleSince = 0;

    const step = (t: number) => {
      // spawn staggered balls
      while (pending.length && pending[0].at <= t) {
        const { meta } = pending.shift()!;
        Matter.Composite.add(world, meta.body);
      }

      Matter.Engine.update(engine, 1000 / 60);

      let active = pending.length > 0;
      for (const m of metas) {
        m.squash *= 0.86;
        if (m.landed) continue;
        if (!m.body.parent || !world.bodies.includes(m.body)) continue;
        active = true;
        const p = m.body.position;
        m.trail.push({ x: p.x, y: p.y });
        if (m.trail.length > TRAIL) m.trail.shift();

        const speed = Math.hypot(m.body.velocity.x, m.body.velocity.y);
        const inBin = p.y > binTop + ballR * 0.4;
        if (inBin && speed < 0.55) {
          m.restFrames += 1;
        } else {
          m.restFrames = 0;
        }
        // anti-stall: a ball balanced on a peg gets a nudge
        if (!inBin && speed < 0.35) {
          m.stallFrames += 1;
          if (m.stallFrames > 10) {
            m.stallFrames = 0;
            Matter.Body.setVelocity(m.body, {
              x: (Math.random() < 0.5 ? -1 : 1) * (0.9 + Math.random() * 0.7),
              y: 0.6,
            });
          }
        } else if (!inBin) {
          m.stallFrames = 0;
        }

        if (m.restFrames > 8) {
          m.landed = true;
          m.landedAt = t;
          const slotIndex = slotIndexOf(p.x);
          slotFlash.set(slotIndex, t);
          binHits.set(slotIndex, (binHits.get(slotIndex) || 0) + 1);
          spawnSparks(p.x, p.y, 24, 2.2);
          const landing = { id: m.id, slotIndex, multiplier: multipliers[slotIndex] };
          landings.push(landing);
          onLanded?.(landing);
          if (landings.length === metas.length) onAllLanded?.([...landings]);
        }
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.vy += 0.12;
        s.x += s.vx;
        s.y += s.vy;
        s.life -= 0.035;
        if (s.life <= 0) sparks.splice(i, 1);
      }
      if (sparks.length > 0) active = true;

      return active;
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);

      const g = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, H * 0.9);
      g.addColorStop(0, A(0.1));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // side rails
      ctx.strokeStyle = A(0.14);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padX, topPad * 0.4);
      ctx.lineTo(padX, binTop);
      ctx.moveTo(W - padX, topPad * 0.4);
      ctx.lineTo(W - padX, binTop);
      ctx.stroke();

      // pegs
      for (let i = 0; i < pegPos.length; i++) {
        const { x: px, y: py } = pegPos[i];
        const flash = pegFlash.get(i);
        const heat = flash ? Math.max(0, 1 - (t - flash) / 420) : 0;
        if (heat > 0) {
          const pg = ctx.createRadialGradient(px, py, 0, px, py, 16);
          pg.addColorStop(0, A(0.55 * heat));
          pg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = pg;
          ctx.beginPath();
          ctx.arc(px, py, 16, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(px, py, pegR + 1 + heat * 1.6, 0, Math.PI * 2);
        ctx.fillStyle = heat > 0 ? A(0.95) : 'rgba(255,255,255,0.55)';
        ctx.fill();
      }

      // bins
      for (let i = 0; i < slots; i++) {
        const m = multipliers[i];
        const heatScale = maxMult === minMult ? 1 : (m - minMult) / (maxMult - minMult);
        const flash = slotFlash.get(i);
        const lit = flash ? Math.max(0, 1 - (t - flash) / 900) : 0;
        const hits = binHits.get(i) || 0;
        const held = hits > 0 ? 0.3 : 0;
        const x = padX + i * binW + 2;
        const y = binTop + 2 - lit * 3;
        const w = binW - 4;
        const h = binH - 6;
        const r = 6;

        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();

        const bg = ctx.createLinearGradient(x, y, x, y + h);
        bg.addColorStop(0, A(0.08 + heatScale * 0.4 + lit * 0.5 + held));
        bg.addColorStop(1, A(0.03 + heatScale * 0.16 + lit * 0.3 + held * 0.5));
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.strokeStyle = A(0.2 + heatScale * 0.45 + lit * 0.5 + held);
        ctx.lineWidth = 1;
        ctx.stroke();
        if (lit > 0) {
          ctx.save();
          ctx.shadowColor = A(0.9 * lit);
          ctx.shadowBlur = 24 * lit;
          ctx.stroke();
          ctx.restore();
        }

        ctx.fillStyle = lit > 0.5 ? '#ffffff' : A(0.85);
        ctx.font = `800 ${Math.max(9, Math.min(14, binW * 0.4))}px Barlow, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${m}x`, x + w / 2, y + h / 2);

        if (hits > 0) {
          const bw = 16;
          ctx.fillStyle = A(0.95);
          ctx.beginPath();
          ctx.roundRect(x + w / 2 - bw / 2, y - 9, bw, 15, 7);
          ctx.fill();
          ctx.fillStyle = '#08131a';
          ctx.font = '800 10px Barlow, system-ui, sans-serif';
          ctx.fillText(String(hits), x + w / 2, y - 1.5);
        }
      }

      // sparks
      for (const s of sparks) {
        ctx.globalAlpha = Math.max(0, s.life);
        ctx.fillStyle = A(0.9);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // balls
      const showLabels = metas.length <= 4;
      for (const m of metas) {
        if (!world.bodies.includes(m.body)) continue;
        const px = m.body.position.x;
        const py = m.body.position.y;

        for (let i = 0; i < m.trail.length; i++) {
          const p = m.trail[i];
          ctx.globalAlpha = (i / m.trail.length) * 0.28;
          ctx.fillStyle = A(0.9);
          ctx.beginPath();
          ctx.arc(p.x, p.y, ballR * 0.35 + (i / m.trail.length) * ballR * 0.55, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        const glow = ctx.createRadialGradient(px, py, 0, px, py, ballR * 3.2);
        glow.addColorStop(0, A(0.42));
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, ballR * 3.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(m.body.angle);
        ctx.scale(1 + m.squash * 0.2, 1 - m.squash * 0.24);
        const bg = ctx.createRadialGradient(-ballR * 0.35, -ballR * 0.4, 0, 0, 0, ballR);
        bg.addColorStop(0, '#ffffff');
        bg.addColorStop(0.45, A(1));
        bg.addColorStop(1, A(0.7));
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(0, 0, ballR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (showLabels && !m.landed) {
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
      }
    };

    const loop = () => {
      const t = performance.now();
      const active = step(t);
      draw(t);
      if (active) {
        idleSince = 0;
      } else if (!idleSince) {
        idleSince = t;
      }
      if (active || !idleSince || t - idleSince < 1500) {
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
  }, [dropToken, rows, slots, accent, multipliers.join(',')]);

  return (
    <div
      ref={wrapRef}
      className="relative w-full rounded-2xl overflow-hidden border"
      style={{
        aspectRatio: '1 / 1',
        borderColor: `${accent}25`,
        background: 'linear-gradient(180deg, hsl(var(--card)), rgba(0,0,0,0.45))',
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
};

export default PlinkoBoard;
