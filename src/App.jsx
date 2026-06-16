import { useState, useEffect, useRef } from 'react'
import * as ort from 'onnxruntime-web'

// ── Tokenizer ─────────────────────────────────────────────────────────────────

function buildVocab(txt) {
  const v = {}
  txt.split('\n').forEach((l, i) => { const t = l.trim(); if (t) v[t] = i })
  return v
}

function tokenize(text, vocab) {
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

function softmax(a) {
  const m = Math.max(...a), e = a.map(x => Math.exp(x - m)), s = e.reduce((a, b) => a + b)
  return e.map(x => x / s)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BOT_REPLIES = [
  "How's it going? 😊", "Haha, that's funny!", "Totally agree!",
  "Cool, tell me more 🙂", "Yeah, I know what you mean.",
  "Sounds great!", "What are you up to today? 😄",
  "Interesting... 🤔", "Really? That's awesome!",
  "I was just thinking the same thing!", "No way! 😮",
]

let _id = 10
const uid = () => ++_id
const ts = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

// ── CSS ───────────────────────────────────────────────────────────────────────

const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box }
  body { margin: 0; font-family: 'Segoe UI', system-ui, sans-serif }

  @keyframes sc-shake {
    0%,100% { transform: translateX(0) }
    15% { transform: translateX(-8px) }
    30% { transform: translateX(8px) }
    45% { transform: translateX(-5px) }
    60% { transform: translateX(5px) }
    75% { transform: translateX(-2px) }
    90% { transform: translateX(2px) }
  }
  @keyframes sc-in {
    from { opacity: 0; transform: translateY(8px) }
    to   { opacity: 1; transform: translateY(0) }
  }
  @keyframes sc-spin {
    to { transform: rotate(360deg) }
  }
  @keyframes sc-shield-pulse {
    0%,100% { transform: scale(1);    filter: drop-shadow(0 0 0px rgba(255,255,255,0)) }
    50%      { transform: scale(1.07); filter: drop-shadow(0 0 18px rgba(255,255,255,0.45)) }
  }
  @keyframes sc-progress {
    0%   { width: 0% }
    20%  { width: 30% }
    50%  { width: 58% }
    75%  { width: 75% }
    90%  { width: 84% }
    100% { width: 91% }
  }
  @keyframes sc-banner-life {
    0%   { opacity: 0; transform: translateY(-14px) }
    10%  { opacity: 1; transform: translateY(0) }
    75%  { opacity: 1; transform: translateY(0) }
    100% { opacity: 0; transform: translateY(-10px) }
  }

  .sc-shake  { animation: sc-shake 0.5s ease-in-out }
  .sc-in     { animation: sc-in 0.22s ease-out }
  .sc-spin   { animation: sc-spin 0.7s linear infinite }
  .sc-shield { animation: sc-shield-pulse 2.2s ease-in-out infinite }
  .sc-bar    { animation: sc-progress 18s ease-out forwards }
  .sc-banner { animation: sc-banner-life 3s ease forwards }
`

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [msgs, setMsgs] = useState([
    { id: uid(), from: 'them', text: "Hey! 👋 How's everything?", time: '17:15' },
  ])
  const [draft, setDraft]             = useState('')
  const [modelReady, setReady]        = useState(false)
  const [loadingDone, setLoadingDone] = useState(false)
  const [busy, setBusy]               = useState(false)
  const [blockedBanner, setBanner]    = useState(null) // { text, pct }
  const [dots, setDots]               = useState('.')

  const sess        = useRef(null)
  const vocab       = useRef(null)
  const inputRef    = useRef(null)
  const wrapRef     = useRef(null)
  const bottomRef   = useRef(null)
  const bannerTimer = useRef(null)

  // Animated loading dots
  useEffect(() => {
    if (modelReady) return
    const id = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 500)
    return () => clearInterval(id)
  }, [modelReady])

  // Load ONNX model + vocab
  useEffect(() => {
    ;(async () => {
      try {
        ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/'
        // model.onnx is in Git LFS — Vercel doesn't pull LFS, so in production
        // we fetch it directly from GitHub's LFS media CDN.
        const modelUrl = import.meta.env.PROD
          ? 'https://media.githubusercontent.com/media/amit-moses/SafeChat/master/public/model/model.onnx'
          : '/model/model.onnx'
        const res = await fetch('/model/vocab.txt')
        vocab.current = buildVocab(await res.text())
        sess.current  = await ort.InferenceSession.create(modelUrl, {
          executionProviders: ['wasm'],
        })
        setReady(true)
        setTimeout(() => setLoadingDone(true), 550) // allow fade-out to finish
      } catch (e) { console.error(e) }
    })()
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function classify(text) {
    if (!sess.current) return { toxic: false, pct: 0 }
    const { inputIds, attentionMask } = tokenize(text, vocab.current)
    const T = arr => new ort.Tensor('int64', BigInt64Array.from(arr.map(BigInt)), [1, 128])
    const out = await sess.current.run({ input_ids: T(inputIds), attention_mask: T(attentionMask) })
    const p = softmax(Array.from(out[Object.keys(out)[0]].data).map(Number))
    return { toxic: p[1] > 0.5, pct: Math.round(p[1] * 100) }
  }

  function triggerShake() {
    const el = wrapRef.current; if (!el) return
    el.classList.remove('sc-shake')
    void el.offsetWidth
    el.classList.add('sc-shake')
    setTimeout(() => el.classList.remove('sc-shake'), 600)
  }

  async function send() {
    const text = draft.trim(); if (!text || busy || !modelReady) return
    setBusy(true)
    try {
      const { toxic, pct } = await classify(text)
      if (toxic) {
        triggerShake()
        clearTimeout(bannerTimer.current)
        setBanner({ text, pct })
        bannerTimer.current = setTimeout(() => {
          setBanner(null)
          setDraft('')
        }, 3000)
      } else {
        setMsgs(p => [...p, { id: uid(), from: 'me', text, time: ts() }])
        setDraft('')
        if (Math.random() > 0.35) {
          setTimeout(() => setMsgs(p => [...p, {
            id: uid(), from: 'them',
            text: BOT_REPLIES[~~(Math.random() * BOT_REPLIES.length)],
            time: ts(),
          }]), 1000 + Math.random() * 1500)
        }
      }
    } finally { setBusy(false) }
  }

  return (
    <div style={S.root}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ ...S.phone, position: 'relative', overflow: 'hidden' }}>

        {/* ── Header ─────────────────────────────────────────── */}
        <div style={S.header}>
          <div style={S.avatar}><ShieldIcon size={22} /></div>
          <div style={{ flex: 1 }}>
            <div style={S.hTitle}>SafeChat</div>
            <div style={S.hSub}>Protected · Safe for children</div>
          </div>
          <div style={{
            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
            background: modelReady ? '#4ade80' : '#9ca3af',
            boxShadow: modelReady ? '0 0 0 3px rgba(74,222,128,.25)' : 'none',
            transition: 'background .4s, box-shadow .4s',
          }} />
        </div>

        {/* ── Blocked banner (top, auto-dismisses after 3s) ─── */}
        {blockedBanner && (
          <div key={blockedBanner.text + blockedBanner.pct} className="sc-banner" style={S.banner}>
            <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>⛔</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#b91c1c' }}>
                Message Blocked · {blockedBanner.pct}% probability of harmful content
              </div>
              <div style={{
                fontSize: '0.78rem', color: '#9ca3af', marginTop: 3,
                fontStyle: 'italic', overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                "{blockedBanner.text}"
              </div>
              {/* Toxicity bar */}
              <div style={S.bannerBar}>
                <div style={{ ...S.bannerBarFill, width: `${blockedBanner.pct}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* ── Chat area ───────────────────────────────────────── */}
        <div style={S.chat}>
          {msgs.map(m => <Bubble key={m.id} msg={m} />)}
          <div ref={bottomRef} style={{ height: 4 }} />
        </div>

        {/* ── Input bar ───────────────────────────────────────── */}
        <div style={S.bar}>
          <div ref={wrapRef} style={S.inputWrap}>
            <input
              ref={inputRef}
              style={{ ...S.input, color: modelReady ? '#111' : '#9ca3af' }}
              dir="auto"
              placeholder={modelReady ? 'Type a message...' : 'Loading safety model…'}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              disabled={!modelReady || busy}
            />
            <button
              style={{ ...S.sendBtn, opacity: !draft.trim() || busy || !modelReady ? 0.4 : 1 }}
              onClick={send}
              disabled={!draft.trim() || busy || !modelReady}
            >
              {busy
                ? <svg className="sc-spin" viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round"><circle cx={12} cy={12} r={9} strokeDasharray="40 20" /></svg>
                : <svg viewBox="0 0 24 24" width={20} height={20} fill="white"><path d="M2 21L23 12 2 3v7l15 2-15 2z" /></svg>
              }
            </button>
          </div>
        </div>

        {/* ── Loading overlay (fades out when model ready) ────── */}
        {!loadingDone && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 50,
            background: 'linear-gradient(160deg, #4540c8 0%, #3730a3 100%)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 0,
            transition: 'opacity .5s ease, transform .5s ease',
            opacity: modelReady ? 0 : 1,
            transform: modelReady ? 'scale(1.04)' : 'scale(1)',
            pointerEvents: modelReady ? 'none' : 'all',
          }}>
            {/* Pulsing shield */}
            <div className="sc-shield" style={{ marginBottom: 28 }}>
              <ShieldIcon size={80} />
            </div>

            {/* Title */}
            <div style={{ color: 'white', textAlign: 'center', marginBottom: 36 }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 6 }}>
                SafeChat
              </div>
              <div style={{ fontSize: '0.85rem', opacity: 0.65 }}>
                Protected · Safe for children
              </div>
            </div>

            {/* Progress bar + label */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 180, height: 4,
                background: 'rgba(255,255,255,.2)',
                borderRadius: 2, overflow: 'hidden',
              }}>
                <div className="sc-bar" style={{ height: '100%', background: 'white', borderRadius: 2 }} />
              </div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,.55)', letterSpacing: '0.02em' }}>
                Loading safety model{dots}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Bubble ────────────────────────────────────────────────────────────────────

function Bubble({ msg }) {
  const me = msg.from === 'me'
  return (
    <div className="sc-in" style={{
      display: 'flex',
      justifyContent: me ? 'flex-end' : 'flex-start',
      padding: '2px 12px',
    }}>
      <div style={me ? S.bMe : S.bThem}>
        <div style={{ wordBreak: 'break-word' }}>{msg.text}</div>
        <div style={S.bTime}>{msg.time}{me && ' ✓'}</div>
      </div>
    </div>
  )
}

// ── Shield SVG ────────────────────────────────────────────────────────────────

function ShieldIcon({ size = 24 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="white">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
      <path d="M10 14.4l-2.8-2.8-1.1 1.1 3.9 3.9 8-8-1.1-1.1L10 14.4z"
        fill="rgba(69,64,200,0.9)" />
    </svg>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  root: {
    minHeight: '100vh',
    background: '#dddaf0',
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  phone: {
    width: '100%', maxWidth: 480,
    display: 'flex', flexDirection: 'column',
    background: '#eae8f6',
    boxShadow: '0 0 40px rgba(0,0,0,.15)',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 16px',
    background: '#4540c8', color: 'white',
    flexShrink: 0,
    boxShadow: '0 2px 8px rgba(0,0,0,.2)',
  },
  avatar: {
    width: 44, height: 44, borderRadius: '50%',
    background: 'rgba(255,255,255,.18)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  hTitle: { fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.2 },
  hSub:   { fontSize: '0.74rem', opacity: 0.8 },

  // Blocked banner (top)
  banner: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '12px 16px',
    background: '#fff5f5',
    borderBottom: '2px solid #fca5a5',
    flexShrink: 0,
  },
  bannerBar: {
    marginTop: 6, height: 3, borderRadius: 2,
    background: '#fee2e2', overflow: 'hidden',
  },
  bannerBarFill: {
    height: '100%',
    background: 'linear-gradient(90deg,#f87171,#ef4444)',
    borderRadius: 2,
    transition: 'width .3s ease',
  },

  // Chat
  chat: {
    flex: 1, overflowY: 'auto',
    padding: '10px 0',
    display: 'flex', flexDirection: 'column', gap: 4,
    minHeight: 0,
  },

  // Bubbles
  bMe: {
    background: '#5551d5', color: 'white',
    borderRadius: '18px 18px 4px 18px',
    padding: '10px 14px', maxWidth: '72%',
    fontSize: '0.95rem', lineHeight: 1.45,
    boxShadow: '0 1px 3px rgba(0,0,0,.15)',
  },
  bThem: {
    background: 'white', color: '#111',
    borderRadius: '18px 18px 18px 4px',
    padding: '10px 14px', maxWidth: '72%',
    fontSize: '0.95rem', lineHeight: 1.45,
    boxShadow: '0 1px 3px rgba(0,0,0,.08)',
  },
  bTime: { fontSize: '0.68rem', opacity: 0.6, textAlign: 'right', marginTop: 4 },

  // Input bar
  bar: {
    padding: '10px 12px 16px',
    background: '#f1effc',
    borderTop: '1px solid #d8d4f4',
    flexShrink: 0,
  },
  inputWrap: {
    display: 'flex', alignItems: 'center',
    background: 'white', borderRadius: 999,
    padding: '6px 6px 6px 18px',
    boxShadow: '0 1px 4px rgba(0,0,0,.1)',
  },
  input: {
    flex: 1, border: 'none', outline: 'none',
    fontSize: '0.95rem', background: 'transparent',
    padding: '6px 0', fontFamily: 'inherit',
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: '50%',
    background: 'linear-gradient(135deg,#5551d5,#7c3aed)',
    border: 'none', cursor: 'pointer', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'opacity .2s',
  },
}
