import { useEffect, useRef, useState } from 'react';

export interface SectionCell {
  /** fill colour for the block, or null for an empty/air block. */
  color: string | null;
  /** true if the block is inside the optimal pit (drawn with a bright outline). */
  inPit: boolean;
  /** hover readout label. */
  label: string;
}

/** A vertical cross-section of the block model: nx columns × nz benches (z increases downward). Each block is a
 * coloured cell; pit blocks are outlined. Hover reads the block out. Pure canvas — fast + theme-aware. */
export function SectionView({
  nx, nz, cell, height = 300, caption,
}: {
  nx: number; nz: number; cell: (ix: number, iz: number) => SectionCell; height?: number; caption?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const W = wrap.clientWidth || 600;
    const H = height;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const cw = W / nx;
    const ch = H / nz;
    const cs = getComputedStyle(document.documentElement);
    const pitStroke = cs.getPropertyValue('--color-accent').trim() || '#6ea8ff';
    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const c = cell(ix, iz);
        const x = ix * cw;
        const y = iz * ch;
        if (c.color) {
          ctx.fillStyle = c.color;
          ctx.fillRect(x, y, cw + 0.6, ch + 0.6);
        }
        if (c.inPit) {
          ctx.strokeStyle = pitStroke;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
        }
      }
    }
  }, [nx, nz, cell, height]);

  const onMove = (e: React.MouseEvent) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const ix = Math.floor((px / rect.width) * nx);
    const iz = Math.floor((py / height) * nz);
    if (ix < 0 || ix >= nx || iz < 0 || iz >= nz) { setHover(null); return; }
    setHover({ x: px, y: py, text: cell(ix, iz).label });
  };

  return (
    <div className="pf-section" ref={wrapRef} onMouseMove={onMove} onMouseLeave={() => setHover(null)}
         style={{ position: 'relative' }}>
      <canvas ref={ref} style={{ display: 'block', borderRadius: 8 }} />
      {hover && (
        <div className="heatmap-readout" style={{ left: Math.min(hover.x + 10, 9999), top: hover.y + 10 }}>
          {hover.text}
        </div>
      )}
      {caption && <div className="pf-cap">{caption}</div>}
    </div>
  );
}
