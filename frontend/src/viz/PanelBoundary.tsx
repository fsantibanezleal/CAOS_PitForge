import { Component, type ReactNode } from 'react';

// Per-panel error boundary: a crash inside one pit view renders a small inline message instead of unmounting the
// whole App to a blank page. The tab bar stays usable so the user can switch away. Mirrors the RotorVitals
// PanelBoundary (the reference app).
export class PanelBoundary extends Component<{ children: ReactNode; lang?: 'en' | 'es' }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      const es = this.props.lang === 'es';
      return (
        <div className="pf-status" data-kind="error" role="alert">
          <strong>{es ? 'Esta vista no aplica a este caso' : 'This view does not apply to this case'}</strong>
          <p style={{ marginTop: '0.4rem', fontSize: '0.85rem' }}>
            {es
              ? 'No se pudo calcular esta vista sobre el dato actual (p. ej. un modelo de bloques sin la geometría que la herramienta requiere). Seleccionar otra pestaña o caso.'
              : 'This view could not be computed on the current datum (e.g. a block model lacking the geometry the tool needs). Pick another tab or case.'}
          </p>
          <p style={{ opacity: 0.6, fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem' }}>{this.state.error.message}</p>
          <div className="pf-status-actions">
            <button className="chip" onClick={() => this.setState({ error: null })}>{es ? 'Reintentar vista' : 'Retry view'}</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
