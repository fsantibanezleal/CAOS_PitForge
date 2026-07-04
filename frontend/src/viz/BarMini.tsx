/** A tiny inline bar chart (no extra deps), grade–tonnage curves + value histograms. */
export function BarMini({ values, labels, unit, caption }: { values: number[]; labels: string[]; unit: string; caption?: string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="pf-bars">
      <div className="pf-bars-row">
        {values.map((v, i) => (
          <div key={i} className="pf-bar" title={`${labels[i]} ${v.toFixed(2)} ${unit}`}>
            <i style={{ height: `${(v / max) * 100}%` }} />
          </div>
        ))}
      </div>
      {caption && <div className="pf-cap">{caption}</div>}
    </div>
  );
}
