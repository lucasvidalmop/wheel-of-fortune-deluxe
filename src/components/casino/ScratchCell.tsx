import { useEffect, useRef, useState } from 'react';

interface Props {
  revealed: boolean;
  onReveal: () => void;
  accent: string;
  children: React.ReactNode;
}

/**
 * Scratch-off cell. Renders an HTML canvas overlay on top of `children`.
 * The user can drag (mouse or touch) to erase the overlay. Once ~55% has
 * been scratched, the cell is auto-revealed.
 */
export default function ScratchCell({ revealed, onReveal, accent, children }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const drawing = useRef(false);
  const checked = useRef(false);
  const [autoHide, setAutoHide] = useState(false);

  // Init canvas with the scratch coating
  useEffect(() => {
    if (revealed) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = wrap.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    // Coating: silver gradient with subtle noise
    const grad = ctx.createLinearGradient(0, 0, rect.width, rect.height);
    grad.addColorStop(0, '#6a6a6a');
    grad.addColorStop(0.5, '#3a3a3a');
    grad.addColorStop(1, '#1f1f1f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, rect.width, rect.height);
    // Sparkle/noise
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#000000';
      ctx.fillRect(Math.random() * rect.width, Math.random() * rect.height, 1.2, 1.2);
    }
    ctx.globalAlpha = 1;
    // Hint text
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('RASPE', rect.width / 2, rect.height / 2 - 6);
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText('?', rect.width / 2, rect.height / 2 + 12);
  }, [revealed]);

  const eraseAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
  };

  const checkCoverage = () => {
    if (checked.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Sample a small grid
    const w = canvas.width, h = canvas.height;
    const step = 8;
    let cleared = 0, total = 0;
    try {
      const data = ctx.getImageData(0, 0, w, h).data;
      for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
          const i = (y * w + x) * 4 + 3;
          if (data[i] < 30) cleared++;
          total++;
        }
      }
    } catch {
      return;
    }
    if (total > 0 && cleared / total > 0.5) {
      checked.current = true;
      setAutoHide(true);
      setTimeout(() => onReveal(), 250);
    }
  };

  const onDown = (e: React.PointerEvent) => {
    if (revealed) return;
    e.preventDefault();
    drawing.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    eraseAt(e.clientX, e.clientY);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current || revealed) return;
    e.preventDefault();
    eraseAt(e.clientX, e.clientY);
  };
  const onUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    checkCoverage();
  };

  return (
    <div ref={wrapRef} className="absolute inset-0 select-none" style={{ touchAction: 'none' }}>
      {children}
      {!revealed && (
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          onPointerCancel={onUp}
          onDragStart={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
          className={`absolute inset-0 touch-none select-none cursor-grab active:cursor-grabbing transition-opacity duration-300 ${autoHide ? 'opacity-0' : 'opacity-100'}`}
          style={{ borderRadius: 'inherit', boxShadow: `inset 0 0 18px ${accent}22`, WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
        />
      )}
    </div>
  );
}
