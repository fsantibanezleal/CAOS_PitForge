import { useCallback, useMemo } from 'react';
import type uPlot from 'uplot';
import type { WhittlePoint } from '../lib/contract.types.ts';
import { themeColors, UPlotChart } from './UPlotChart.tsx';

/** The classic Whittle nested-shell curves: pit value + ore tonnage vs the revenue factor, with the current RF
 * marked. Interactive (zoom/crosshair value readout). */
export function WhittleChart({ curve, currentRF, onPickRF, height = 230 }: {
  curve: WhittlePoint[]; currentRF: number; onPickRF?: (rf: number) => void; height?: number;
}) {
  const data = useMemo<uPlot.AlignedData>(() => [
    curve.map((p) => p.rf),
    curve.map((p) => p.pitValue / 1e6),       // $M
    curve.map((p) => p.oreTonnes / 1e6),      // Mt
  ], [curve]);

  const markPlugin = useMemo<uPlot.Plugin>(() => ({
    hooks: {
      draw: (u: uPlot) => {
        const c = themeColors();
        const x = u.valToPos(currentRF, 'x', true);
        const ctx = u.ctx;
        ctx.save();
        ctx.strokeStyle = c.accent;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(x, u.bbox.top);
        ctx.lineTo(x, u.bbox.top + u.bbox.height);
        ctx.stroke();
        ctx.restore();
      },
    },
  }), [currentRF]);

  const build = useCallback((w: number, h: number): uPlot.Options => {
    const c = themeColors();
    return {
      width: w, height: h,
      cursor: { y: false, drag: { x: true, y: false } },
      scales: { x: { time: false }, mt: { auto: true } },
      axes: [
        { stroke: c.subtle, grid: { stroke: c.border, width: 1 }, ticks: { stroke: c.border }, label: 'revenue factor RF' },
        { stroke: c.subtle, grid: { stroke: c.border, width: 1 }, ticks: { stroke: c.border }, label: 'pit value ($M)' },
        { stroke: c.subtle, side: 1, grid: { show: false }, scale: 'mt', label: 'ore (Mt)' },
      ],
      series: [
        { label: 'RF' },
        { label: 'value ($M)', stroke: c.accent, width: 2, points: { show: true, size: 5 } },
        { label: 'ore (Mt)', stroke: c.good, width: 2, scale: 'mt', points: { show: true, size: 4 } },
      ],
    } as uPlot.Options;
  }, []);

  return <UPlotChart data={data} build={build} plugins={[markPlugin]} height={height}
                     onClickX={onPickRF ? (x) => onPickRF(Math.max(0.05, Math.min(1, x))) : undefined} />;
}
