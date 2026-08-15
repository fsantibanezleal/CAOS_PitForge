import { useCallback, useMemo } from 'react';
import uPlot from 'uplot';
import { themeColors, UPlotChart } from './UPlotChart.tsx';

/** Responsive interactive bars for grade-tonnage and value histograms, with a text data fallback. */
export function BarMini({
  values, labels, unit, caption, ariaLabel, valueLabel, interactionHint,
}: {
  values: number[];
  labels: string[];
  unit: string;
  caption?: string;
  ariaLabel: string;
  valueLabel: string;
  interactionHint?: string;
}) {
  const data = useMemo<uPlot.AlignedData>(() => [values.map((_, index) => index), values], [values]);
  const summary = useMemo(() => values.map((value, index) => {
    const label = labels[index] || String(index + 1);
    return `${label}: ${value.toFixed(2)}${unit ? ` ${unit}` : ''}`;
  }).join('; '), [labels, unit, values]);
  const build = useCallback((width: number, height: number): uPlot.Options => {
    const colors = themeColors();
    const labelEvery = Math.max(1, Math.ceil(values.length / Math.max(3, Math.floor(width / 72))));
    return {
      width,
      height,
      scales: { x: { time: false, range: [-0.6, Math.max(0.6, values.length - 0.4)] } },
      axes: [
        {
          stroke: colors.subtle,
          grid: { show: false },
          ticks: { stroke: colors.border },
          values: (_plot, splits) => splits.map((split) => {
            const index = Math.round(split ?? -1);
            return index >= 0 && index < labels.length && index % labelEvery === 0 ? labels[index] : '';
          }),
        },
        { stroke: colors.subtle, grid: { stroke: colors.border }, ticks: { stroke: colors.border } },
      ],
      cursor: { drag: { x: true, y: false } },
      legend: { live: true },
      series: [
        { label: 'index', value: (_plot, value) => labels[Math.round(value ?? -1)] || '--' },
        {
          label: valueLabel,
          stroke: colors.accent,
          fill: colors.accent,
          paths: uPlot.paths.bars?.({ size: [0.82, 80], radius: [0.16, 0] }),
          points: { show: false },
          value: (_plot, value) => value == null ? '--' : `${value.toFixed(2)}${unit ? ` ${unit}` : ''}`,
        },
      ],
    };
  }, [labels, unit, valueLabel, values.length]);

  if (values.length === 0) {
    return <div className="pf-status" data-kind="empty">{ariaLabel}: no data.</div>;
  }

  return (
    <div className="pf-bars">
      <UPlotChart data={data} build={build} height={220} ariaLabel={ariaLabel} summary={summary}
                  interactionHint={interactionHint} />
      {caption && <div className="pf-cap">{caption}</div>}
      <details className="pf-chart-data">
        <summary>{valueLabel}</summary>
        <ul>{values.map((value, index) => (
          <li key={`${labels[index]}-${index}`}><span>{labels[index] || index + 1}</span><b>{value.toFixed(2)} {unit}</b></li>
        ))}</ul>
      </details>
    </div>
  );
}
