import { useRef, useState } from 'react';
import {
  buildUserModel, type ContractLiveReport, parseCsv, type UserModel, validateBlocksLive,
} from '../lib/contractLive.ts';

// the committed example (data/examples/blockmodel.csv), inlined so the panel can offer it offline.
const EXAMPLE_CSV = `ix,iy,iz,tonnage,density,grade
0,0,0,2700,2.7,0.001
1,0,0,2700,2.7,0.002
2,0,0,2700,2.7,0.004
0,0,1,2700,2.7,0.006
1,0,1,2700,2.7,0.012
2,0,1,2700,2.7,0.009
0,0,2,2700,2.7,0.001
1,0,2,2700,2.7,0.02
2,0,2,2700,2.7,0.003
`;

/** Contract-1 drag-drop: drop a block-model CSV → validate (reject/flag, never coerce) → build the
 *  dense model → the whole App re-solves on it with the current Controls econ. */
export function UploadPanel({ es, active, onUse, onClear }: {
  es: boolean;
  /** true while the App is solving the uploaded model. */
  active: boolean;
  onUse: (m: UserModel) => void;
  onClear: () => void;
}) {
  const [report, setReport] = useState<ContractLiveReport | null>(null);
  const [pending, setPending] = useState<UserModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const ingest = (name: string, text: string) => {
    setFileName(name);
    setError(null);
    setPending(null);
    try {
      const rows = parseCsv(text);
      if (rows.length === 0) throw new Error(es ? 'CSV vacío o sin filas de datos' : 'empty CSV / no data rows');
      const rep = validateBlocksLive(rows);
      setReport(rep);
      if (rep.accepted.length > 0) setPending(buildUserModel(rep.accepted, name));
    } catch (e) {
      setReport(null);
      setError(String((e as Error)?.message ?? e));
    }
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    f.text().then((t) => ingest(f.name, t)).catch((e) => setError(String(e)));
  };

  const downloadExample = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([EXAMPLE_CSV], { type: 'text/csv' }));
    a.download = 'blockmodel-example.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="pf-vizstack">
      <div className="pf-plot-t">{es
        ? 'Modelo de bloques propio, Contrato 1 en vivo: valida, nunca coerciona; el App entero se re-resuelve sobre el modelo cargado'
        : 'Your block model, Contract 1 live: validates, never coerces; the whole App re-solves on the uploaded model'}</div>

      <div
        className={`pf-drop ${over ? 'over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files?.[0]); }}
        onClick={() => inputRef.current?.click()}
        role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') inputRef.current?.click(); }}
      >
        {es ? 'Soltar aquí un CSV {ix,iy,iz,tonnage,density,grade} o hacer clic para elegirlo'
            : 'Drop a {ix,iy,iz,tonnage,density,grade} CSV here or click to pick one'}
        <input ref={inputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
               onChange={(e) => onFile(e.target.files?.[0] ?? undefined)} />
      </div>
      <div className="pf-chips">
        <button className="chip" onClick={downloadExample}>{es ? 'descargar CSV de ejemplo' : 'download example CSV'}</button>
        <button className="chip" onClick={() => ingest('blockmodel-example.csv', EXAMPLE_CSV)}>{es ? 'probar con el ejemplo' : 'try the example'}</button>
        {active && <button className="chip on" onClick={onClear}>{es ? '✕ volver a los casos' : '✕ back to the cases'}</button>}
      </div>

      {error && <p className="pf-note">⚠ {error}</p>}

      {report && (
        <>
          <div className="pf-cap"><b>{fileName}</b> · {es ? 'reporte Contrato 1' : 'Contract 1 report'}</div>
          <div className="pf-kpis">
            <Kpi label={es ? 'aceptadas' : 'accepted'} value={`${report.accepted.length}`} />
            <Kpi label={es ? 'rechazadas' : 'rejected'} value={`${report.rejected.length}`} />
            <Kpi label={es ? 'marcadas' : 'flagged'} value={`${report.flagged.length}`} />
            {pending && <Kpi label={es ? 'caja del modelo' : 'model box'} value={`${pending.dims.nx}×${pending.dims.ny}×${pending.dims.nz}`} />}
          </div>
          {report.rejected.length > 0 && (
            <div className="pf-note">
              <b>{es ? 'Rechazadas (nunca coercionadas):' : 'Rejected (never coerced):'}</b>
              <ul className="pf-list">
                {report.rejected.slice(0, 8).map((r) => <li key={r.row}>{es ? 'fila' : 'row'} {r.row + 2}: {r.reason}</li>)}
                {report.rejected.length > 8 && <li>… +{report.rejected.length - 8}</li>}
              </ul>
            </div>
          )}
          {report.flagged.length > 0 && (
            <div className="pf-note">
              <b>{es ? 'Marcadas (aceptadas, con advertencia):' : 'Flagged (accepted, with a warning):'}</b>
              <ul className="pf-list">
                {report.flagged.slice(0, 8).map((f, k) => <li key={k}>({f.index.join(',')}): {f.flags.join('; ')}</li>)}
                {report.flagged.length > 8 && <li>… +{report.flagged.length - 8}</li>}
              </ul>
            </div>
          )}
          {pending && !active && (
            <button className="chip on" onClick={() => onUse(pending)}>
              {es ? `▶ resolver el App sobre este modelo (${pending.nRows} bloques)` : `▶ solve the App on this model (${pending.nRows} blocks)`}
            </button>
          )}
          {active && <p className="pf-note">{es
            ? 'El App está resuelto sobre el modelo cargado con la economía actual de Controles: todos los tabs (3D, sección, Whittle, shells, resumen, ley–tonelaje, valor) leen de él.'
            : 'The App is solved on the uploaded model with the current Controls econ: every tab (3D, section, Whittle, shells, summary, grade–tonnage, value) reads from it.'}</p>}
        </>
      )}

      <p className="pf-cap">{es
        ? 'Reglas (espejo exacto del pipeline Python): rechaza columnas faltantes, valores no numéricos, NaN/Inf, tonelaje≤0, densidad≤0, ley∉[0,1]; marca ley>0.5 y duplicados. La economía viene de los Controles (el CSV no la trae).'
        : 'Rules (exact mirror of the Python pipeline): rejects missing columns, non-numeric values, NaN/Inf, tonnage≤0, density≤0, grade∉[0,1]; flags grade>0.5 and duplicates. Econ comes from the Controls (the CSV carries none).'}</p>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <div className="pf-kpi"><div className="pf-kpi-v">{value}</div><div className="pf-kpi-l">{label}</div></div>;
}
