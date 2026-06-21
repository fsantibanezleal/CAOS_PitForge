// Perceptually-uniform-ish viridis ramp (avoids the jet trap) — shared by the 2-D section + the 3-D pit.
const STOPS: [number, number, number][] = [
  [0.27, 0.0, 0.33], [0.23, 0.32, 0.55], [0.13, 0.57, 0.55], [0.37, 0.79, 0.38], [0.99, 0.91, 0.14],
];

export function viridis(t: number): [number, number, number] {
  t = Math.max(0, Math.min(1, t));
  const x = t * 4;
  const i = Math.min(3, Math.floor(x));
  const f = x - i;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export const viridisCss = (t: number): string => {
  const [r, g, b] = viridis(t);
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
};

/** A distinct hue per nested-shell index (pushback phases) — a qualitative ramp. */
export function shellColor(shell: number, nShells: number): string {
  if (shell < 0) return 'transparent';
  const h = (shell / Math.max(1, nShells)) * 280; // blue→red sweep
  return `hsl(${200 - h}, 70%, 55%)`;
}
