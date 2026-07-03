import { useEffect, useState } from 'react';
import { solveRealCase, type RealCase, type RealSolveState } from '../opt/realCases.ts';

const fInt = (v: number) => v.toLocaleString('en-US');

/** The real-source main panel: instance facts (public summary data) + the live solve state.
 *  When #13 lands the 'solved' state, the standard tabs take over and this panel becomes the
 *  loading/error surface only. */
export function RealCasePanel({ rc, es }: { rc: RealCase; es: boolean }) {
  const [state, setState] = useState<RealSolveState>({ status: 'idle' });

  useEffect(() => {
    let alive = true;
    setState({ status: 'fetching', instance: rc.id });
    solveRealCase(rc).then((s) => { if (alive) setState(s); });
    return () => { alive = false; };
  }, [rc]);

  return (
    <div className="pf-vizstack">
      <div className="pf-plot-t">{es ? `Instancia real · ${rc.name}` : `Real instance · ${rc.name}`}</div>
      <div className="pf-kpis">
        <Kpi label={es ? 'bloques' : 'blocks'} value={fInt(rc.nBlocks)} />
        <Kpi label={es ? 'arcos de precedencia' : 'precedence arcs'} value={fInt(rc.nPrecs)} />
        <Kpi label={es ? 'óptimo UPIT publicado' : 'published UPIT optimum'} value={fInt(rc.publishedOptimum)} />
        <Kpi label={es ? 'carril' : 'gate'} value={rc.gate} />
      </div>
      <p className="pf-note">{es ? rc.provenance_es : rc.provenance_en}</p>
      {state.status === 'pending-13' && (
        <p className="pf-note">{es
          ? 'El solve exacto en vivo sobre esta instancia (descarga en runtime + parsers .blocks/.prec/.upit + solveUpitExplicit) se conecta en la siguiente iteración; el resultado debe reproducir el óptimo publicado.'
          : 'The exact live solve on this instance (runtime fetch + .blocks/.prec/.upit parsers + solveUpitExplicit) is wired in the next iteration; the result must reproduce the published optimum.'}</p>
      )}
      {state.status === 'fetching' && <p className="pf-note">{es ? 'descargando…' : 'fetching…'}</p>}
      {state.status === 'solving' && <p className="pf-note">{es ? 'resolviendo (min-cut exacto)…' : 'solving (exact min-cut)…'}</p>}
      {state.status === 'error' && <p className="pf-note">⚠ {state.message}</p>}
      <p className="pf-cap">{es
        ? 'Los archivos MineLib se descargan en runtime a memoria del navegador y nunca se redistribuyen con la app (la licencia sólo permite descarga con fines académicos).'
        : 'MineLib files are fetched at runtime into browser memory and never redistributed with the app (the license only grants download for academic purposes).'}</p>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <div className="pf-kpi"><div className="pf-kpi-v">{value}</div><div className="pf-kpi-l">{label}</div></div>;
}
