// Live in-browser inference of the two learned models (onnxruntime-web). GRACEFUL: until the models are trained
// (science/train_pit.py → grade-nn.onnx + pit-surrogate.onnx), the files are absent; loaders resolve to null and the
// UI shows the honest "pending training" state instead of throwing. The npm package and the CDN wasmPaths are pinned
// to the SAME version (a skew is the classic load-failure trap). WASM EP, single-threaded (GitHub Pages has no
// COOP/COEP for threaded WASM).
import * as ort from 'onnxruntime-web';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';
ort.env.wasm.numThreads = 1;

const base = () => import.meta.env.BASE_URL || '/';
const sessions: Record<string, Promise<ort.InferenceSession | null>> = {};

function get(file: string): Promise<ort.InferenceSession | null> {
  return (sessions[file] ??= (async () => {
    try {
      const head = await fetch(`${base()}${file}`, { method: 'HEAD' });
      if (!head.ok) return null; // model not trained yet
      return await ort.InferenceSession.create(`${base()}${file}`, { executionProviders: ['wasm'] });
    } catch {
      return null;
    }
  })());
}

const locks: Record<string, Promise<unknown>> = {};

async function run(file: string, input: string, output: string, flat: Float32Array, dims: number[]): Promise<Float32Array | null> {
  const s = await get(file);
  if (!s) return null;
  const prev = locks[file] || Promise.resolve();
  const job = prev.then(async () => {
    const out = await s.run({ [input]: new ort.Tensor('float32', flat, dims) });
    return out[output].data as Float32Array;
  });
  locks[file] = job.catch(() => {});
  return job;
}

/** grade-nn: a 27-vec inverse-distance stencil of neighbouring sample grades → the estimated block grade. */
export const runGradeNN = (x27: Float32Array) => run('grade-nn.onnx', 'x', 'y', x27, [1, 27]);

/** Batched grade-nn: n×27 stencils → n estimated grades (one onnxruntime-web call). */
export const runGradeNNBatch = (flat: Float32Array, n: number) =>
  run('grade-nn.onnx', 'x', 'y', flat, [n, 27]);

/** pit-surrogate: 4 raw per-block features → P(block ∈ optimal pit). */
export const runPitSurrogate = (x4: Float32Array) => run('pit-surrogate.onnx', 'x', 'p', x4, [1, 4]);

/** Batched pit-surrogate: n×4 raw features → n probabilities (one onnxruntime-web call). */
export const runPitSurrogateBatch = (flat: Float32Array, n: number) =>
  run('pit-surrogate.onnx', 'x', 'p', flat, [n, 4]);

export const modelsAvailable = async () =>
  (await get('grade-nn.onnx')) != null && (await get('pit-surrogate.onnx')) != null;
