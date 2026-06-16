export function buildVocab(txt) {
  const v = {}
  txt.split('\n').forEach((l, i) => { const t = l.trim(); if (t) v[t] = i })
  return v
}

export function tokenize(text, vocab) {
  const CLS = 101, SEP = 102, UNK = 100, MAX = 128
  const words = text.toLowerCase().match(/\w+|[^\w\s]/g) || []
  const ids = []
  for (const w of words) {
    if (ids.length >= MAX - 2) break
    let rem = w, parts = [], fail = false
    while (rem.length) {
      let ok = false
      for (let e = rem.length; e > 0; e--) {
        const c = parts.length ? '##' + rem.slice(0, e) : rem.slice(0, e)
        if (vocab[c] !== undefined) { parts.push(vocab[c]); rem = rem.slice(e); ok = true; break }
      }
      if (!ok) { fail = true; break }
    }
    ids.push(...(fail ? [UNK] : parts))
  }
  const clip = ids.slice(0, MAX - 2)
  const inputIds = [CLS, ...clip, SEP]
  while (inputIds.length < MAX) inputIds.push(0)
  return { inputIds, attentionMask: inputIds.map(x => x ? 1 : 0) }
}

export function softmax(a) {
  const m = Math.max(...a), e = a.map(x => Math.exp(x - m)), s = e.reduce((a, b) => a + b)
  return e.map(x => x / s)
}
