export interface Zone { upTo: number; color: string; label: string }

/** Horizontal gauge with coloured zones + a needle. Used for the pit KPIs (strip ratio, value/tonne) — an
 * illustrative readout over the synthetic deposits, not a certified reserve statement. */
export function Gauge({ value, max, zones, unit, title, fmt }: {
  value: number; max: number; zones: Zone[]; unit?: string; title?: string; fmt?: (v: number) => string;
}) {
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  let prev = 0;
  return (
    <div className="gauge">
      {title && <div className="gauge-title">{title}</div>}
      <div className="gauge-track">
        {zones.map((z, i) => {
          const left = pct(prev); const width = `${Math.max(0, Math.min(100, ((z.upTo - prev) / max) * 100))}%`;
          prev = z.upTo;
          return <div key={i} className="gauge-zone" style={{ left, width, background: z.color }} title={z.label} />;
        })}
        <div className="gauge-needle" style={{ left: pct(value) }} />
      </div>
      <div className="gauge-scale">
        <span>0</span>
        <span className="gauge-val">{(fmt ? fmt(value) : value.toFixed(2))}{unit ? ` ${unit}` : ''}</span>
        <span>{fmt ? fmt(max) : max}</span>
      </div>
      <div className="gauge-zones-legend">
        {zones.map((z, i) => <span key={i}><span className="dot" style={{ background: z.color }} />{z.label}</span>)}
      </div>
    </div>
  );
}
