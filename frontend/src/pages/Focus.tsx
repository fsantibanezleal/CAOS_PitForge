// ADR-0070 scenario focus view: one selected deposit, full page, nothing competing with the pit.
//
// ADDITIVE. The App (Tool.tsx) keeps every tab and all its explanation; this route is a second way to look
// at the SAME deposit through the SAME exact optimiser, for operating it rather than reading about it. It
// renders OUTSIDE <AppShell> on purpose: the shell header and footer are exactly the chrome a focus view
// exists to escape.
//
// Style per the ADR-0070 spec: fixed full-viewport two-column grid with the rail on the right; stage at
// least 80% of the viewport; the economic state NAMED on the stage in one plain sentence; KPIs overlaid as
// a HUD rather than stacked as cards; a visible return that lands back on the App; starts on the case the
// URL names.

import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useShellLang } from '@fasl-work/caos-app-shell';
import { CASES, caseModel, caseName, caseProvenance } from '../opt/cases.ts';
import { defaultRevenueFactors, nestedPitShells, solveUltimatePit } from '../opt/index.ts';
import type { EconParams } from '../opt/types.ts';

const PitView3D = lazy(() => import('../viz/PitView3D.tsx').then((module) => ({ default: module.PitView3D })));

/** What the strip ratio MEANS, said on the stage.
 *
 *  The bands are the ones the engine itself already reasons about: a pit whose waste:ore ratio is very low
 *  is barely stripping (the shell is sitting on outcropping ore), and one above ~4:1 is spending most of
 *  its movement on waste, which is where the revenue factor stops buying tonnes. These are descriptive
 *  bands over `PitResult.stripRatio`, not an economic threshold from a reference, and the wording says so
 *  rather than implying a published cut-off. */
function pitState(strip: number, value: number, es: boolean): { label: string; text: string } {
  if (value <= 0) {
    return {
      label: es ? 'Sin rajo económico' : 'No economic pit',
      text: es
        ? 'Con esta economía ningún conjunto de bloques cerrado bajo las restricciones de talud tiene valor positivo: el óptimo exacto es el rajo vacío.'
        : 'Under this economics no set of blocks closed under the slope constraints has positive value: the exact optimum is the empty pit.',
    };
  }
  if (strip < 1) {
    return {
      label: es ? 'Descapote bajo' : 'Low stripping',
      text: es
        ? 'El rajo mueve menos estéril que mineral. La envolvente sigue el cuerpo mineralizado de cerca y casi todo el movimiento paga.'
        : 'The pit moves less waste than ore. The shell hugs the orebody closely and nearly all the movement pays for itself.',
    };
  }
  if (strip > 4) {
    return {
      label: es ? 'Dominado por el estéril' : 'Waste-dominated',
      text: es
        ? 'Más de cuatro toneladas de estéril por tonelada de mineral: el límite lo pone el descapote, y subir el factor de ingreso agrega más estéril que metal.'
        : 'More than four tonnes of waste per tonne of ore: stripping is what bounds this pit, and raising the revenue factor buys more waste than metal.',
    };
  }
  return {
    label: es ? 'Descapote normal' : 'Normal stripping',
    text: es
      ? 'La razón estéril:mineral está en el rango habitual de un rajo abierto, donde el óptimo exacto todavía responde al precio.'
      : 'The waste:ore ratio sits in the usual open-pit range, where the exact optimum still responds to price.',
  };
}

export default function Focus() {
  const { caseId } = useParams();
  const es = useShellLang() === 'es';
  const theCase = useMemo(() => CASES.find((c) => c.id === caseId) ?? CASES[0], [caseId]);

  const [priceMul, setPriceMul] = useState(1);
  const [slopeDeg, setSlopeDeg] = useState<number>(theCase.econ.slopeAngleDeg);
  const [rf, setRf] = useState(1);
  const [mode, setMode] = useState<'pit' | 'shells'>('pit');

  // Selecting a different deposit must actually change the deposit: the controls re-seed from the case, or
  // the chips move the URL and the title while the block model stays exactly as it was.
  const seedSig = theCase.id;
  const [seenSig, setSeenSig] = useState(seedSig);
  if (seenSig !== seedSig) {
    setSeenSig(seedSig);
    setPriceMul(1); setRf(1); setSlopeDeg(theCase.econ.slopeAngleDeg);
  }

  const model = useMemo(() => caseModel(theCase), [theCase]);
  const econ: EconParams = useMemo(
    () => ({ ...theCase.econ, price: theCase.econ.price * priceMul * rf, slopeAngleDeg: slopeDeg }),
    [theCase, priceMul, rf, slopeDeg],
  );

  // The SAME exact optimiser the App runs: Lerchs-Grossmann as a min-cut (Picard reduction, Dinic).
  // A focus view that ran a cheaper approximation would be showing a different answer from the App.
  const r = useMemo(() => solveUltimatePit(model, econ), [model, econ]);
  const shells = useMemo(
    () => (mode === 'shells' ? nestedPitShells(model, theCase.econ, defaultRevenueFactors()) : null),
    [mode, model, theCase],
  );
  const gradeMax = useMemo(() => {
    let m = 0;
    for (let i = 0; i < model.grade.length; i++) if (model.grade[i] > m) m = model.grade[i];
    return m || 1;
  }, [model]);

  const st = pitState(r.stripRatio, r.pitValue, es);
  const money = (v: number) => (Math.abs(v) >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : `${(v / 1e6).toFixed(1)}M`);
  const tonnes = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}Mt` : `${(v / 1e3).toFixed(0)}kt`);

  const hud = [
    { v: `$${money(r.pitValue)}`, l: es ? 'valor del rajo' : 'pit value', tone: 'accent' },
    { v: r.stripRatio.toFixed(2), l: es ? 'razón E:M' : 'strip ratio', tone: 'blue' },
    { v: tonnes(r.oreTonnes), l: es ? 'mineral' : 'ore' },
    { v: tonnes(r.wasteTonnes), l: es ? 'estéril' : 'waste' },
    { v: tonnes(r.metalTonnes), l: es ? 'metal' : 'metal' },
    { v: `${r.nBlocks}`, l: es ? 'bloques' : 'blocks in pit' },
  ];

  return (
    <div className="pff">
      <div className="pff-stage">
        <Suspense fallback={<div className="pf-status" role="status">{es ? 'Cargando vista 3D…' : 'Loading 3D view…'}</div>}>
          <PitView3D model={model} inPit={r.inPit} gradeMax={gradeMax}
                     mode={mode} height={0}
                     shellOf={shells?.shellOf} nShells={shells ? defaultRevenueFactors().length : 12} es={es} />
        </Suspense>

        <div className="pff-badge">
          <div className="pff-badge-t">{st.label}</div>
          <div className="pff-badge-d">{st.text}</div>
        </div>

        <div className="pff-hud">
          {hud.map((h) => (
            <div className="pff-hud-item" key={h.l}>
              <div className={`pff-hud-v${h.tone ? ' ' + h.tone : ''}`}>{h.v}</div>
              <div className="pff-hud-l">{h.l}</div>
            </div>
          ))}
        </div>

        <Link className="pff-exit" to="/">{es ? 'Volver a la app' : 'Back to the app'}</Link>
      </div>

      <aside className="pff-rail">
        <div className="pff-rail-h">
          <div>
            <div className="pff-title">{caseName(theCase, es)}</div>
            <div className="pff-sub">{theCase.id} · {caseProvenance(theCase, es)}</div>
          </div>
        </div>

        <div className="pff-seg">
          <button className={mode === 'pit' ? 'on' : ''} onClick={() => setMode('pit')}>{es ? 'Rajo óptimo' : 'Optimal pit'}</button>
          <button className={mode === 'shells' ? 'on' : ''} onClick={() => setMode('shells')}>{es ? 'Shells' : 'Shells'}</button>
        </div>

        <label className="pff-ctl">
          <span className="pff-ctl-l">{es ? 'Precio' : 'Price'}<b>{(priceMul * 100).toFixed(0)}%</b></span>
          <input type="range" min={0.4} max={2} step={0.05} value={priceMul}
                 onChange={(e) => setPriceMul(+e.target.value)} />
        </label>

        <label className="pff-ctl">
          <span className="pff-ctl-l">{es ? 'Factor de ingreso' : 'Revenue factor'}<b>{rf.toFixed(2)}</b></span>
          <input type="range" min={0.3} max={1.4} step={0.05} value={rf}
                 onChange={(e) => setRf(+e.target.value)} />
        </label>

        <label className="pff-ctl">
          <span className="pff-ctl-l">{es ? 'Talud' : 'Slope'}<b>{slopeDeg}°</b></span>
          <input type="range" min={30} max={60} step={1} value={slopeDeg}
                 onChange={(e) => setSlopeDeg(+e.target.value)} />
        </label>

        <div className="pff-note">
          {es
            ? 'El rajo se resuelve EXACTO en cada cambio: Lerchs-Grossmann como corte mínimo (reducción de Picard, max-flow de Dinic), el mismo motor que corre la App. El factor de ingreso escala el precio para trazar la familia de shells anidados de Whittle; bajarlo produce el núcleo de alto valor que se mina primero.'
            : 'The pit is re-solved EXACTLY on every change: Lerchs-Grossmann as a min-cut (Picard reduction, Dinic max-flow), the same engine the App runs. The revenue factor scales price to trace Whittle’s nested-shell family; lowering it yields the high-value core that is mined first.'}
        </div>

        <div className="pff-cases">
          {CASES.slice(0, 12).map((c) => (
            <Link key={c.id} to={`/focus/${c.id}`} className={c.id === theCase.id ? 'on' : ''}>{c.id}</Link>
          ))}
        </div>
      </aside>
    </div>
  );
}
