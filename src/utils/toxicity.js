import * as ort from 'onnxruntime-web'
import { buildVocab, tokenize, softmax } from './tokenizer.js'

let session = null
let vocab   = null

// Model source resolution:
//  - VITE_MODEL_URL (if set) wins — point it at any host (e.g. Firebase Storage).
//  - Otherwise in production load from the GitHub LFS CDN (the bundled file on
//    Vercel is only a ~134-byte LFS pointer, so it can't be served locally).
//  - In dev, load the real file straight from /public/model.
const MODEL_URL =
  import.meta.env.VITE_MODEL_URL ||
  (import.meta.env.PROD
    ? 'https://media.githubusercontent.com/media/amit-moses/SafeChat/master/public/model/model.onnx'
    : '/model/model.onnx')

export async function loadModel(onProgress) {
  if (session && vocab) return
  ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/'
  onProgress?.('vocab')
  const res = await fetch('/model/vocab.txt')
  vocab = buildVocab(await res.text())
  onProgress?.('model')
  session = await ort.InferenceSession.create(MODEL_URL, { executionProviders: ['wasm'] })
}

export async function classify(text) {
  if (!session || !vocab) throw new Error('Model not loaded')
  const { inputIds, attentionMask } = tokenize(text, vocab)
  const T = arr => new ort.Tensor('int64', BigInt64Array.from(arr.map(BigInt)), [1, 128])
  const out = await session.run({ input_ids: T(inputIds), attention_mask: T(attentionMask) })
  const p = softmax(Array.from(out[Object.keys(out)[0]].data).map(Number))
  return { toxic: p[1] > 0.5, pct: Math.round(p[1] * 100) }
}
