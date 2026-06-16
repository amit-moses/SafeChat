import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'

const SAGE_CSS = `
  @keyframes sc-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes sc-spin { to{transform:rotate(360deg)} }
  @keyframes dot { 0%,80%,100%{opacity:.2} 40%{opacity:1} }
  .sc-in{animation:sc-in .2s ease-out}
  .sc-spin{animation:sc-spin .7s linear infinite}
  .dot0{animation:dot 1.2s .0s infinite}
  .dot1{animation:dot 1.2s .2s infinite}
  .dot2{animation:dot 1.2s .4s infinite}
`

const SYSTEM_PROMPT = (msg) => `You are Sage, a warm and empathetic AI counselor on SafeChat — a safe messaging platform for kids and teens.

A user just tried to send a message that was flagged as potentially harmful: "${msg}"

Your mission:
1. Greet the user warmly and acknowledge they seem upset or frustrated
2. Gently ask what's going on — why they wanted to send that kind of message
3. Listen and validate their feelings without judgment
4. Guide them toward healthier ways to express themselves
5. Keep responses SHORT (2-4 sentences), warm, and age-appropriate
6. Do NOT repeat or reference the harmful words directly
7. After a few exchanges, gently let them know they can return to their chat when ready
8. If the user writes in Hebrew, respond in Hebrew. If English, respond in English.

Start by introducing yourself briefly and asking how the user is feeling right now.`

export default function CounselorPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user, profile } = useAuth()
  const { chatId, blockedMsg, chatName } = location.state || {}

  const [messages, setMessages] = useState([])
  const [draft,    setDraft]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [canReturn, setCanReturn] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages, loading])

  // Sage opens the conversation — show the blocked message as the first user bubble
  useEffect(() => {
    if (!blockedMsg) return
    const firstUserMsg = { role:'user', text: blockedMsg }
    setMessages([firstUserMsg])
    setLoading(true)
    callGemini([firstUserMsg], blockedMsg)
      .then(text => setMessages([firstUserMsg, { role:'model', text }]))
      .catch(e => {
        console.error('[Counselor] init error:', e.message)
        setMessages([firstUserMsg, { role:'model', text: `⚠️ ${e.message}` }])
      })
      .finally(() => setLoading(false))
  }, [blockedMsg])

  async function callGemini(history, blockedMessage) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt: SYSTEM_PROMPT(blockedMessage || blockedMsg),
        messages: history.length ? history : [{ role:'user', text: blockedMessage }],
      }),
    })
    const data = await res.json()
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`)
    if (!data.text) throw new Error('Empty response from Gemini')
    return data.text
  }

  async function send() {
    const text = draft.trim(); if (!text || loading) return
    const newHistory = [...messages, { role:'user', text }]
    setMessages(newHistory)
    setDraft('')
    setLoading(true)
    try {
      const reply = await callGemini(newHistory, blockedMsg)
      setMessages(h => [...h, { role:'model', text: reply }])
      setCanReturn(true) // show return button after first exchange
    } catch(e) {
      console.error('[Counselor] send error:', e.message)
      setMessages(h => [...h, { role:'model', text: `⚠️ Error: ${e.message}` }])
      setCanReturn(true)
    } finally { setLoading(false) }
  }

  return (
    <div style={{ height:'100dvh', background:'#f0fdf9', display:'flex', justifyContent:'center', fontFamily:"'Segoe UI',system-ui,sans-serif", overflow:'hidden' }}>
      <style>{SAGE_CSS}</style>
      <div style={{ width:'100%', maxWidth:480, display:'flex', flexDirection:'column', height:'100%', boxShadow:'0 0 40px rgba(0,0,0,.1)', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#0d9488,#0891b2)', padding:'14px 16px', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          <div style={{ width:42, height:42, borderRadius:'50%', background:'rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.3rem', flexShrink:0 }}>
            🧠
          </div>
          <div style={{ flex:1 }}>
            <div style={{ color:'white', fontWeight:700, fontSize:'1rem' }}>Sage · Wellness Chat</div>
            <div style={{ color:'rgba(255,255,255,.7)', fontSize:'0.73rem' }}>SafeChat AI Counselor · Private & confidential</div>
          </div>
        </div>

        {/* Info banner */}
        <div style={{ background:'#ccfbf1', padding:'10px 16px', display:'flex', gap:8, alignItems:'flex-start', borderBottom:'1px solid #99f6e4', flexShrink:0 }}>
          <span>💬</span>
          <div style={{ fontSize:'0.8rem', color:'#065f46' }}>
            Your message was flagged before sending. Sage is here to help you process your feelings.
            {chatName && <> When you're ready, you can <strong>return to {chatName}</strong>.</>}
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflowY:'auto', padding:'16px 12px', display:'flex', flexDirection:'column', gap:10, minHeight:0 }}>
          {messages.map((m, i) => {
            const isModel = m.role === 'model'
            return (
              <div key={i} className="sc-in" style={{ display:'flex', justifyContent: isModel ? 'flex-start' : 'flex-end', alignItems:'flex-end', gap:8 }}>
                {isModel && (
                  <div style={{ width:32, height:32, borderRadius:'50%', background:'#0d9488', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', flexShrink:0 }}>
                    🧠
                  </div>
                )}
                <div style={{
                  maxWidth:'75%',
                  background: isModel ? 'white' : '#5551d5',
                  color: isModel ? '#111' : 'white',
                  borderRadius: isModel ? '18px 18px 18px 4px' : '18px 18px 4px 18px',
                  padding:'10px 14px',
                  boxShadow:'0 1px 4px rgba(0,0,0,.08)',
                  fontSize:'0.95rem', lineHeight:1.5,
                }}>
                  {m.text}
                </div>
              </div>
            )
          })}

          {loading && (
            <div className="sc-in" style={{ display:'flex', justifyContent:'flex-start', alignItems:'flex-end', gap:8 }}>
              <div style={{ width:32, height:32, borderRadius:'50%', background:'#0d9488', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem' }}>🧠</div>
              <div style={{ background:'white', borderRadius:'18px 18px 18px 4px', padding:'12px 16px', boxShadow:'0 1px 4px rgba(0,0,0,.08)', display:'flex', gap:4, alignItems:'center' }}>
                <div className="dot0" style={{ width:8, height:8, borderRadius:'50%', background:'#0d9488' }} />
                <div className="dot1" style={{ width:8, height:8, borderRadius:'50%', background:'#0d9488' }} />
                <div className="dot2" style={{ width:8, height:8, borderRadius:'50%', background:'#0d9488' }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} style={{ height:4 }} />
        </div>

        {/* Return to chat button */}
        {canReturn && chatId && (
          <div style={{ padding:'0 16px 8px', flexShrink:0 }}>
            <button onClick={() => navigate(`/chat/${chatId}`)}
              style={{ width:'100%', padding:'11px', background:'white', color:'#0d9488', border:'2px solid #0d9488', borderRadius:12, fontWeight:700, cursor:'pointer', fontSize:'0.9rem' }}>
              ↩ Return to {chatName || 'Chat'}
            </button>
          </div>
        )}

        {/* Input */}
        <div style={{ padding:'10px 12px 10px', paddingBottom:'max(10px, env(safe-area-inset-bottom))', background:'#f0fdf9', borderTop:'1px solid #ccfbf1', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', background:'white', borderRadius:999, padding:'6px 6px 6px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.08)', border:'1px solid #99f6e4' }}>
            <input style={{ flex:1, border:'none', outline:'none', fontSize:'1rem', background:'transparent', color:'#111', padding:'6px 0', fontFamily:'inherit' }}
              dir="auto"
              placeholder="Share how you're feeling…"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()} }}
              disabled={loading}
            />
            <button style={{ width:42, height:42, borderRadius:'50%', background:'linear-gradient(135deg,#0d9488,#0891b2)', border:'none', cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', opacity: !draft.trim()||loading ? .4 : 1 }}
              onClick={send} disabled={!draft.trim()||loading}>
              {loading
                ? <svg className="sc-spin" viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round"><circle cx={12} cy={12} r={9} strokeDasharray="40 20"/></svg>
                : <svg viewBox="0 0 24 24" width={20} height={20} fill="white"><path d="M2 21L23 12 2 3v7l15 2-15 2z"/></svg>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
