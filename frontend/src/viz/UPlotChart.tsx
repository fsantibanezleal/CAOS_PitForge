import { useEffect, useId, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useThemeStore } from '@fasl-work/caos-app-shell';

/** Interactive uPlot chart: wheel/drag zoom + pan, crosshair value readout, theme-aware, responsive.
 * `build` produces the options for a given width/height (rebuilt on theme/data change). */
export function UPlotChart({
  data, build, plugins = [], height = 200, onClickX, ariaLabel, summary, interactionHint,
}: {
  data: uPlot.AlignedData;
  build: (width: number, height: number) => uPlot.Options;
  plugins?: uPlot.Plugin[];
  height?: number;
  onClickX?: (x: number) => void;
  ariaLabel: string;
  summary: string;
  interactionHint?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const theme = useThemeStore((s) => s.theme);
  const descriptionId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const width = el.clientWidth || 600;
    const opts = build(width, height);
    opts.plugins = [...(opts.plugins ?? []), ...plugins];
    const u = new uPlot(opts, data, el);
    const ro = new ResizeObserver(() => u.setSize({ width: el.clientWidth || width, height }));
    ro.observe(el);
    let click: ((e: MouseEvent) => void) | null = null;
    if (onClickX) {
      click = () => { const left = u.cursor.left ?? -1; if (left >= 0) onClickX(u.posToVal(left, 'x')); };
      el.addEventListener('click', click);
    }
    const xValues = data[0] as (number | null)[];
    const finiteX = xValues.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const fullMin = Math.min(...finiteX);
    const fullMax = Math.max(...finiteX);
    const reset = () => u.setScale('x', { min: fullMin, max: fullMax });
    const zoom = (factor: number, center: number) => {
      const scale = u.scales.x;
      const min = scale.min ?? fullMin;
      const max = scale.max ?? fullMax;
      const nextMin = Math.max(fullMin, center - (center - min) * factor);
      const nextMax = Math.min(fullMax, center + (max - center) * factor);
      if (nextMax > nextMin) u.setScale('x', { min: nextMin, max: nextMax });
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const cursorX = Math.max(0, Math.min(u.bbox.width, event.clientX - rect.left - u.bbox.left));
      zoom(event.deltaY < 0 ? 0.8 : 1.25, u.posToVal(cursorX, 'x'));
    };
    const keys = (event: KeyboardEvent) => {
      const scale = u.scales.x;
      const min = scale.min ?? fullMin;
      const max = scale.max ?? fullMax;
      const span = max - min;
      if (event.key === 'Home') reset();
      else if (event.key === '+' || event.key === '=') zoom(0.8, (min + max) / 2);
      else if (event.key === '-') zoom(1.25, (min + max) / 2);
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        const shift = span * 0.12 * direction;
        const bounded = Math.max(fullMin - min, Math.min(fullMax - max, shift));
        u.setScale('x', { min: min + bounded, max: max + bounded });
      } else return;
      event.preventDefault();
    };
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('keydown', keys);
    el.addEventListener('dblclick', reset);
    return () => {
      ro.disconnect();
      if (click) el.removeEventListener('click', click);
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('keydown', keys);
      el.removeEventListener('dblclick', reset);
      u.destroy();
    };
  }, [theme, data, build, plugins, height, onClickX]);

  return (
    <div className="pf-chart">
      <div ref={ref} className="uplot-host" style={{ width: '100%', height }} role="img" tabIndex={0}
           aria-label={ariaLabel} aria-describedby={descriptionId} />
      <p id={descriptionId} className="pf-sr-only">{summary}</p>
      {interactionHint && <p className="pf-chart-hint">{interactionHint}</p>}
    </div>
  );
}

/** Theme CSS variables resolved for canvas drawing (uPlot strokes are canvas, not CSS). */
export function themeColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
  return {
    fg: v('--color-fg', '#e6edf3'),
    subtle: v('--color-fg-subtle', '#9aa7b4'),
    faint: v('--color-fg-faint', '#6b7682'),
    border: v('--color-border', '#30363d'),
    accent: v('--color-accent', '#6ea8ff'),
    good: v('--color-good', '#3fb950'),
    warn: v('--color-warn', '#d29922'),
    bad: v('--color-bad', '#f85149'),
    surface: v('--color-surface', '#161b22'),
  };
}
