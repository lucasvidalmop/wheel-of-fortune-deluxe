import { useEffect, useRef } from 'react';
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
  rows: number;
  multipliers: number[];
  accent: string;
  /** Increment this value to trigger a new drop */
  dropToken: number;
  balls?: PlinkoBall[];
  onLanded?: (landing: PlinkoLanding) => void;
  onAllLanded?: (landings: PlinkoLanding[]) => void;
}

// Deliberately paced for a live draw: the next participant only enters after
// the previous ball has had time to produce a few visible bounces.
const STAGGER_MS = 900;
// Keep the whole simulation deliberately slow so each collision can be read
// during a live draw instead of the ball looking heavy and falling at once.
const PHYSICS_TIME_SCALE = 0.62;
// A Plinko ball may recoil slightly on contact, but should never shoot back
// several rows. Matter's combined restitution can otherwise create an
// unnatural upward launch when a ball catches two pegs at once.
const MAX_UPWARD_VELOCITY = -0.12;
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
  lastY: number;
  restX: number;
  restY: number;
  slotIndex: number;
  targetSlot?: number;
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

    // ---- geometry (pixels) --------------------------------------------
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

    const padX = W * 0.04;
    const usableW = W - padX * 2;
    const binW = usableW / slots;
    const d = binW;                              // peg spacing == bin width
    const binH = Math.max(34, Math.min(58, H * 0.1));
    const topPad = H * 0.1;
    const boardH = H - topPad - binH;
    const rowGap = boardH / (rows + 1.2);
    // Larger pegs preserve frequent contacts while the ball stays visually
    // compact. This avoids using an oversized ball just to force collisions.
    const pegR = Math.max(3.5, d * 0.18);
    const ballR = Math.max(4.5, d * 0.21);

    const binTop = H - binH;
    const centerX = W / 2;
    const rowYPx = (r: number) => topPad + (r + 1) * rowGap;

    const maxMult = Math.max(...multipliers, 1);
    const minMult = Math.min(...multipliers, 0);

    // ---- engine -------------------------------------------------------
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.00028 } });
    const world = engine.world;

    const pegPos: { x: number; y: number }[] = [];
    const pegBodies: Matter.Body[] = [];
    for (let r = 0; r < rows; r++) {
      const count = r + 3;
      for (let j = 0; j < count; j++) {
        const x = centerX + (j - (count - 1) / 2) * d;
        const y = rowYPx(r);
        pegBodies.push(Matter.Bodies.circle(x, y, pegR, {
          isStatic: true, restitution: 0.56, friction: 0, label: `peg:${pegPos.length}`,

        }));
        pegPos.push({ x, y });
      }
    }
    Matter.Composite.add(world, pegBodies);

    // floor + bin dividers
    Matter.Composite.add(world, Matter.Bodies.rectangle(W / 2, H + 10, W * 3, 20, {
      isStatic: true, restitution: 0.25, friction: 0.06,
    }));
    for (let i = 0; i <= slots; i++) {
      Matter.Composite.add(world, Matter.Bodies.rectangle(padX + i * binW, binTop + binH / 2, 3, binH, {
        isStatic: true, restitution: 0.35, friction: 0.2,
      }));
    }

    // soft triangular boundary (no static walls -> no pockets to get stuck in)
    const limitAt = (y: number) => {
      const r = Math.max(0, Math.min(rows - 1, Math.floor((y - topPad) / rowGap)));
      return ((r + 3) - 1) / 2 * d;
    };

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
          centerX + (Math.random() - 0.5) * d * 0.08,
          topPad * 0.3,
          ballR,
          { restitution: 0.58, friction: 0, frictionAir: 0.003, density: 0.0012, slop: 0.01 },
        );
        Matter.Body.setVelocity(body, { x: (Math.random() - 0.5) * 0.25, y: 0 });

        const meta: BallMeta = {
          id: b.id, label: b.label, body,
          trail: [], squash: 0, landed: false, landedAt: 0,
          restFrames: 0, stallFrames: 0, lastY: -1,
          restX: 0, restY: 0, slotIndex: 0,
          targetSlot: typeof b.targetSlot === 'number'
            ? Math.min(slots - 1, Math.max(0, b.targetSlot))
            : undefined,
        };
        metas.push(meta);
        pending.push({ meta, at: now + i * STAGGER_MS });
      });
    }

    const slotIndexOf = (x: number) =>
      Math.min(slots - 1, Math.max(0, Math.floor((x - padX) / binW)));

    let idleSince = 0;

    const step = (t: number) => {
      while (pending.length && pending[0].at <= t) {
        const { meta } = pending.shift()!;
        Matter.Composite.add(world, meta.body);
      }

      // Run simulation time slower than wall-clock time. Reducing gravity alone
      // made the balls feel floaty but did not sufficiently extend the draw;
      // slowing the whole engine also stretches every bounce and direction change.
      Matter.Engine.update(engine, (1000 / 60) * PHYSICS_TIME_SCALE);

      let active = pending.length > 0;
      for (const m of metas) {
        m.squash *= 0.86;
        if (m.landed) continue;
        if (!world.bodies.includes(m.body)) continue;
        active = true;

        const p = m.body.position;

        // Keep impacts readable without allowing the exaggerated upward
        // ricochets that made balls appear to reverse direction at random.
        // Horizontal deflection remains untouched, preserving the suspense.
        if (m.body.velocity.y < MAX_UPWARD_VELOCITY) {
          Matter.Body.setVelocity(m.body, {
            x: m.body.velocity.x,
            y: MAX_UPWARD_VELOCITY,
          });
        }

        // soft boundary: keep the ball inside the peg triangle
        if (p.y < binTop - ballR) {
          const lim = limitAt(p.y);
          const off = p.x - centerX;
          if (Math.abs(off) > lim) {
            const sign = Math.sign(off) || 1;
            Matter.Body.setPosition(m.body, { x: centerX + sign * lim, y: p.y });
            Matter.Body.setVelocity(m.body, {
              x: -sign * (0.3 + Math.abs(m.body.velocity.x) * 0.4),
              y: m.body.velocity.y,
            });
          }
        }

        m.trail.push({ x: p.x, y: p.y });
        if (m.trail.length > TRAIL) m.trail.shift();

        const speed = Math.hypot(m.body.velocity.x, m.body.velocity.y);
        const inBin = p.y > binTop - ballR * 1.1;
        if (inBin && speed < 0.35) m.restFrames += 1; else m.restFrames = 0;

        // anti-stall: nudge a ball that stopped falling
        if (!inBin) {
          if (m.lastY >= 0 && Math.abs(p.y - m.lastY) < 0.12) {
            m.stallFrames += 1;
            if (m.stallFrames > 34) {
              m.stallFrames = 0;
              Matter.Body.setVelocity(m.body, {
                x: (Math.random() < 0.5 ? -1 : 1) * 0.38,
                y: 0.22,
              });
            }
          } else {
            m.stallFrames = 0;
          }
          m.lastY = p.y;
        }

        if (m.restFrames > 8) {
          const slotIndex = slotIndexOf(p.x);
          m.landed = true;
          m.landedAt = t;
          m.slotIndex = slotIndex;
          m.restX = padX + (slotIndex + 0.5) * binW;
          m.restY = binTop + binH * 0.5;
          Matter.Composite.remove(world, m.body);
          slotFlash.set(slotIndex, t);
          binHits.set(slotIndex, (binHits.get(slotIndex) || 0) + 1);
          spawnSparks(p.x, p.y, 22, 2.1);
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

    const drawBall = (t: number, m: BallMeta) => {
      let px: number, py: number, alpha = 1;
      if (m.landed) {
        const k = Math.min(1, (t - m.landedAt) / 260);
        const last = m.trail[m.trail.length - 1] || { x: m.restX, y: m.restY };
        px = last.x + (m.restX - last.x) * k;
        py = last.y + (m.restY - last.y) * k;
        alpha = 0.9;
      } else {
        px = m.body.position.x;
        py = m.body.position.y;
        for (let i = 0; i < m.trail.length; i++) {
          const p = m.trail[i];
          ctx.globalAlpha = (i / m.trail.length) * 0.26;
          ctx.fillStyle = A(0.9);
          ctx.beginPath();
          ctx.arc(p.x, p.y, ballR * 0.35 + (i / m.trail.length) * ballR * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = alpha;

      const glow = ctx.createRadialGradient(px, py, 0, px, py, ballR * 3);
      glow.addColorStop(0, A(0.4));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(px, py, ballR * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(px, py);
      if (!m.landed) ctx.rotate(m.body.angle);
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

    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);

      const g = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, H * 0.9);
      g.addColorStop(0, A(0.1));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // triangle guides
      ctx.strokeStyle = A(0.12);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(centerX - d, rowYPx(0));
      ctx.lineTo(centerX - ((rows + 2) - 1) / 2 * d, rowYPx(rows - 1));
      ctx.moveTo(centerX + d, rowYPx(0));
      ctx.lineTo(centerX + ((rows + 2) - 1) / 2 * d, rowYPx(rows - 1));
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
        ctx.arc(px, py, pegR + 0.8 + heat * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = heat > 0 ? A(0.95) : 'rgba(255,255,255,0.5)';
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
          ctx.shadowBlur = 22 * lit;
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

      for (const m of metas) {
        if (!m.landed && !world.bodies.includes(m.body)) continue;
        drawBall(t, m);
      }
    };

    const loop = () => {
      const t = performance.now();
      const active = step(t);
      draw(t);
      if (active) idleSince = 0;
      else if (!idleSince) idleSince = t;
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
