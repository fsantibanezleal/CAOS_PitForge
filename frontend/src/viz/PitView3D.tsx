import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { viridis } from './colormap.ts';
import type { BlockModel } from '../opt/types.ts';
import { idx } from '../opt/types.ts';

/** Genuinely-3D ultimate-pit viewer. The orebody is drawn as voxels coloured by grade (viridis); the blocks the
 * optimiser extracts (the pit) are shown solid, the rest faded, so the pit grows/shrinks as the revenue factor /
 * price / slope change. Orbit to rotate; z increases downward (the pit opens from the surface). Uses an
 * InstancedMesh so the whole ~7 000-block model renders in one draw call. */
export function PitView3D({ model, inPit, gradeMax, mode = 'pit', height = 360, shellOf, nShells = 12, present }: {
  model: BlockModel;
  inPit: Uint8Array;
  gradeMax: number;
  mode?: 'pit' | 'grade' | 'shells';
  height?: number;
  shellOf?: Int32Array;
  nShells?: number;
  /** sparse published models: 1 where a block exists; absent cells are never drawn. */
  present?: Uint8Array;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { nx, ny, nz } = model.dims;
    const W = el.clientWidth || 640;
    const H = height;
    const cs = getComputedStyle(document.documentElement);
    const bg = cs.getPropertyValue('--color-bg').trim() || '#0d1117';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(bg);
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(W, H);
    el.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff, 0.78));
    const dir = new THREE.DirectionalLight(0xffffff, 0.75);
    dir.position.set(2, 5, 3);
    scene.add(dir);

    // centre the model at the origin; scale so the longest axis ≈ 2 units.
    const span = Math.max(nx, ny, nz);
    const s = 2 / span;
    const cx = (nx - 1) / 2;
    const cy = (ny - 1) / 2;
    const cz = (nz - 1) / 2;

    const geo = new THREE.BoxGeometry(s * 0.92, s * 0.92, s * 0.92);
    const N = nx * ny * nz;
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.0, vertexColors: false }), N);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    let shown = 0;
    for (let iz = 0; iz < nz; iz++) {
      for (let iy = 0; iy < ny; iy++) {
        for (let ix = 0; ix < nx; ix++) {
          const i = idx(model.dims, ix, iy, iz);
          if (present && !present[i]) continue;         // sparse models: draw only existing blocks
          const out = !inPit[i];
          if (mode === 'pit' && out) continue;          // pit mode: only the extracted blocks
          if (mode === 'shells' && (!shellOf || shellOf[i] < 0)) continue;
          // y is up; mining z (down) maps to -y so the pit opens downward from the top.
          dummy.position.set((ix - cx) * s, -(iz - cz) * s, (iy - cy) * s);
          dummy.updateMatrix();
          mesh.setMatrixAt(shown, dummy.matrix);
          let rgb: [number, number, number];
          if (mode === 'shells' && shellOf) {
            const h = (shellOf[i] / Math.max(1, nShells)) * 0.8;
            color.setHSL(0.62 - h, 0.7, 0.55);
            rgb = [color.r, color.g, color.b];
          } else {
            const t = Math.min(1, model.grade[i] / (gradeMax || 1));
            rgb = viridis(t);
          }
          const fade = mode === 'grade' && out ? 0.25 : 1;
          mesh.setColorAt(shown, color.setRGB(rgb[0] * fade + (1 - fade) * 0.5, rgb[1] * fade + (1 - fade) * 0.5, rgb[2] * fade + (1 - fade) * 0.5));
          shown++;
        }
      }
    }
    mesh.count = shown;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);

    // a faint wire box for the full model extent (spatial reference)
    const box = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(nx * s, nz * s, ny * s)),
      new THREE.LineBasicMaterial({ color: 0x586070, transparent: true, opacity: 0.25 }),
    );
    scene.add(box);

    camera.position.set(2.4, 1.9, 2.6);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1; // settles in ~120 frames, inside the interaction budget below
    controls.target.set(0, 0, 0);

    // On-demand rendering (portfolio standard, no compute bomb): render only while the user
    // interacts (+ a bounded damping tail), halt entirely on hidden tabs, repaint on restore.
    // The damping itself fires 'change' every frame, so those self-inflicted changes must not
    // refill the budget, only external input does, or the loop never terminates.
    let raf = 0;
    let deadline = 0; // wall-clock budget: robust to any frame rate
    let inFrame = false;
    const frame = () => {
      inFrame = true;
      controls.update();
      inFrame = false;
      renderer.render(scene, camera);
      if (performance.now() < deadline && !document.hidden) raf = requestAnimationFrame(frame);
      else raf = 0;
    };
    const kick = (ms: number) => {
      deadline = Math.max(deadline, performance.now() + ms);
      if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
    };
    controls.addEventListener('start', () => kick(3000));               // gesture + damping tail
    controls.addEventListener('change', () => { if (!inFrame) kick(1000); }); // wheel/programmatic
    const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else kick(200); };
    document.addEventListener('visibilitychange', onVis);
    const onRestored = () => kick(200);
    renderer.domElement.addEventListener('webglcontextrestored', onRestored);
    kick(200); // first paint

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth || W;
      renderer.setSize(w, H);
      camera.aspect = w / H;
      camera.updateProjectionMatrix();
      kick(100);
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      renderer.domElement.removeEventListener('webglcontextrestored', onRestored);
      ro.disconnect();
      controls.dispose();
      geo.dispose();
      mesh.material.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [model, inPit, gradeMax, mode, height, shellOf, nShells, present]);

  return <div className="pf-3d" ref={ref} style={{ width: '100%', height, borderRadius: 10, overflow: 'hidden' }} />;
}
