import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  collection, doc, onSnapshot, addDoc, updateDoc, getDoc,
  serverTimestamp, query, orderBy, arrayUnion, deleteField, setDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useModel } from '../contexts/ModelContext.jsx'
import ReactionPicker from '../components/ReactionPicker.jsx'

const EMOJIS = ['❤️','😂','😮','😢','👍','🔥']
const ts = t => { if (!t) return ''; const d=t.toDate?t.toDate():new Date(t); return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) }

const SHAKE_CSS = `
  @keyframes sc-shake { 0%,100%{transform:translateX(0)} 15%{transform:translateX(-8px)} 30%{transform:translateX(8px)} 45%{transform:translateX(-5px)} 60%{transform:translateX(5px)} 90%{transform:translateX(2px)} }
  @keyframes sc-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes sc-banner { 0%{opacity:0;transform:translateY(-14px)} 10%{opacity:1;transform:translateY(0)} 75%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-10px)} }
  @keyframes sc-spin { to{transform:rotate(360deg)} }
  .sc-shake{animation:sc-shake .5s ease-in-out}
  .sc-in{animation:sc-in .2s ease-out}
  .sc-banner{animation:sc-banner 3s ease forwards}
  .sc-spin{animation:sc-spin .7s linear infinite}
`

export default function ChatPage() {
  const { id: chatId }   = useParams()
  const navigate         = useNavigate()
  const { user, profile, incrementBlocked } = useAuth()
  const { ready, classify } = useModel()

  const [chat,     setChat]     = useState(null)
  const [messages, setMessages] = useState([])
  const [draft,    setDraft]    = useState('')
  const [busy,     setBusy]     = useState(false)
  const [banner,   setBanner]   = useState(null) // { text, pct }
  const [typing,   setTyping]   = useState([])   // other users typing
  const [partnerInfo, setPartner] = useState(null) // { isOnline, blockedCount, username }
  const [pickerFor, setPickerFor] = useState(null) // messageId with open picker

  const wrapRef    = useRef(null)
  const bottomRef  = useRef(null)
  const bannerTimer = useRef(null)
  const typingTimer = useRef(null)

  // Load chat metadata
  useEffect(() => {
    getDoc(doc(db, 'chats', chatId)).then(s => s.exists() && setChat({ id:s.id, ...s.data() }))
  }, [chatId])

  // Subscribe to messages
  useEffect(() => {
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp'))
    return onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id:d.id, ...d.data() }))
      setMessages(msgs)
      // mark all messages as read
      msgs.forEach(msg => {
        if (!msg.readBy?.includes(user.uid))
          updateDoc(doc(db, 'chats', chatId, 'messages', msg.id), { readBy: arrayUnion(user.uid) }).catch(()=>{})
      })
      // mark lastMessage as read in the chat doc
      updateDoc(doc(db, 'chats', chatId), {
        'lastMessage.readBy': arrayUnion(user.uid)
      }).catch(()=>{})
    })
  }, [chatId, user.uid])

  // Subscribe to typing
  useEffect(() => {
    return onSnapshot(doc(db, 'typing', chatId), snap => {
      const data = snap.data() || {}
      const others = Object.keys(data).filter(uid => uid !== user.uid && data[uid])
      setTyping(others)
    })
  }, [chatId, user.uid])

  // Partner info (direct chats)
  useEffect(() => {
    if (!chat || chat.type === 'group') return
    const partnerId = chat.members.find(id => id !== user.uid)
    if (!partnerId) return
    return onSnapshot(doc(db, 'users', partnerId), snap => {
      if (snap.exists()) setPartner(snap.data())
    })
  }, [chat, user.uid])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages, typing])
  useEffect(() => { return () => clearTypingStatus() }, [])

  // Auto-scroll to bottom on open
  useEffect(() => { setTimeout(() => bottomRef.current?.scrollIntoView(), 100) }, [chatId])

  function chatName() {
    if (!chat) return ''
    if (chat.type === 'group') return chat.name
    return partnerInfo?.username || Object.values(chat.memberNames||{}).find(n => n !== profile?.username) || 'Chat'
  }

  function chatSubtitle() {
    if (chat?.type === 'group') return `${chat.members.length} members`
    if (!partnerInfo) return ''
    return partnerInfo.isOnline ? '🟢 Online' : '⚫ Offline'
  }

  async function clearTypingStatus() {
    try { await updateDoc(doc(db, 'typing', chatId), { [user.uid]: deleteField() }) } catch {}
  }

  function handleInput(e) {
    setDraft(e.target.value)
    // typing indicator
    setDoc(doc(db, 'typing', chatId), { [user.uid]: serverTimestamp() }, { merge:true }).catch(()=>{})
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(clearTypingStatus, 2000)
  }

  function triggerShake() {
    const el = wrapRef.current; if (!el) return
    el.classList.remove('sc-shake'); void el.offsetWidth; el.classList.add('sc-shake')
    setTimeout(() => el.classList.remove('sc-shake'), 600)
  }

  async function send() {
    const text = draft.trim(); if (!text || busy) return
    setBusy(true)
    clearTypingStatus()
    try {
      const { toxic, pct } = await classify(text)
      if (toxic) {
        triggerShake()
        clearTimeout(bannerTimer.current)
        setBanner({ text, pct })
        await incrementBlocked()
        bannerTimer.current = setTimeout(() => { setBanner(null); setDraft('') }, 3000)

        // navigate to counselor after a short delay
        setTimeout(() => navigate('/counselor', { state: { chatId, blockedMsg: text, chatName: chatName() } }), 800)
      } else {
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          text, senderId: user.uid, senderName: profile?.username,
          timestamp: serverTimestamp(), readBy: [user.uid], reactions: {},
        })
        await updateDoc(doc(db, 'chats', chatId), {
          lastMessage: { text, senderId: user.uid, senderName: profile?.username, timestamp: serverTimestamp(), readBy: [user.uid] },
        })
        setDraft('')
      }
    } finally { setBusy(false) }
  }

  async function toggleReaction(msgId, emoji) {
    const msg = messages.find(m => m.id === msgId)
    if (!msg) return
    const current = msg.reactions?.[emoji] || []
    const updated = current.includes(user.uid)
      ? current.filter(id => id !== user.uid)
      : [...current, user.uid]
    await updateDoc(doc(db, 'chats', chatId, 'messages', msgId), { [`reactions.${emoji}`]: updated })
    setPickerFor(null)
  }

  const partnerTyping = typing.length > 0
    ? `${chat?.memberNames?.[typing[0]] || 'Someone'} is typing…`
    : null

  return (
    <div onClick={() => setPickerFor(null)} style={{ height:'100dvh', background:'#eae8f6', display:'flex', justifyContent:'center', fontFamily:"'Segoe UI',system-ui,sans-serif", overflow:'hidden' }}>
      <style>{SHAKE_CSS}</style>
      <div style={{ width:'100%', maxWidth:480, background:'#eae8f6', display:'flex', flexDirection:'column', height:'100%', boxShadow:'0 0 40px rgba(0,0,0,.1)', position:'relative', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background:'#4540c8', padding:'12px 16px', display:'flex', alignItems:'center', gap:12, flexShrink:0, boxShadow:'0 2px 8px rgba(0,0,0,.2)' }}>
          <button onClick={() => navigate('/chats')} style={{ background:'none', border:'none', color:'white', cursor:'pointer', padding:4, display:'flex', alignItems:'center' }}>
            <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div style={{ flex:1 }}>
            <div style={{ color:'white', fontWeight:700, fontSize:'1rem' }}>{chatName()}</div>
            <div style={{ color:'rgba(255,255,255,.7)', fontSize:'0.72rem' }}>{chatSubtitle()}</div>
          </div>
          {profile?.blockedCount > 0 && (
            <div title="Messages you sent that were blocked" style={{ background:'rgba(239,68,68,.25)', color:'#fca5a5', borderRadius:999, padding:'2px 9px', fontSize:'0.72rem', fontWeight:700 }}>
              ⚠️ {profile.blockedCount}
            </div>
          )}
          {!ready && (
            <div style={{ display:'flex', alignItems:'center', gap:6, color:'rgba(255,255,255,.6)', fontSize:'0.72rem' }}>
              <svg className="sc-spin" viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx={12} cy={12} r={9} strokeDasharray="40 20"/></svg>
              Loading AI…
            </div>
          )}
        </div>

        {/* Blocked banner */}
        {banner && (
          <div key={banner.text} className="sc-banner" style={{ background:'#fff5f5', borderBottom:'2px solid #fca5a5', padding:'10px 16px', display:'flex', alignItems:'flex-start', gap:10, flexShrink:0 }}>
            <span style={{ fontSize:'1.1rem' }}>⛔</span>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:'0.87rem', color:'#b91c1c' }}>Message Blocked · {banner.pct}% harmful — Opening support chat…</div>
              <div style={{ fontSize:'0.77rem', color:'#9ca3af', fontStyle:'italic', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>"{banner.text}"</div>
              <div style={{ height:3, borderRadius:2, background:'#fee2e2', overflow:'hidden', marginTop:5 }}>
                <div style={{ height:'100%', width:`${banner.pct}%`, background:'linear-gradient(90deg,#f87171,#ef4444)', borderRadius:2 }} />
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div style={{ flex:1, overflowY:'auto', padding:'10px 0', display:'flex', flexDirection:'column', gap:2, minHeight:0 }}>
          {messages.map(msg => {
            const me = msg.senderId === user.uid
            const allReactions = Object.entries(msg.reactions||{}).filter(([,ids])=>ids.length>0)
            return (
              <div key={msg.id} className="sc-in"
                style={{ display:'flex', flexDirection:'column', alignItems: me ? 'flex-end' : 'flex-start', padding:'2px 12px', position:'relative' }}>
                {chat?.type==='group' && !me && (
                  <div style={{ fontSize:'0.7rem', color:'#6b7280', marginBottom:2, paddingLeft:4 }}>{msg.senderName}</div>
                )}
                <div style={{ position:'relative', maxWidth:'72%' }}
                  onContextMenu={e => { e.preventDefault(); setPickerFor(msg.id) }}>
                  <div style={{ background: me ? '#5551d5' : 'white', color: me ? 'white' : '#111', borderRadius: me ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding:'10px 14px', boxShadow:'0 1px 3px rgba(0,0,0,.1)', cursor:'context-menu' }}>
                    <div style={{ wordBreak:'break-word', fontSize:'0.95rem', lineHeight:1.45 }}>{msg.text}</div>
                    <div style={{ display:'flex', justifyContent:'flex-end', alignItems:'center', gap:4, marginTop:3 }}>
                      <span style={{ fontSize:'0.68rem', opacity:.6 }}>{ts(msg.timestamp)}</span>
                      {me && (
                        <span style={{ fontSize:'0.7rem', color: msg.readBy?.length>1 ? '#60a5fa' : 'rgba(255,255,255,.6)' }}>
                          {msg.readBy?.length>1 ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                  {pickerFor === msg.id && (
                    <ReactionPicker onPick={e => toggleReaction(msg.id,e)} onClose={() => setPickerFor(null)} />
                  )}
                </div>
                {/* Reactions */}
                {allReactions.length > 0 && (
                  <div style={{ display:'flex', gap:4, marginTop:3, flexWrap:'wrap', justifyContent: me ? 'flex-end' : 'flex-start' }}>
                    {allReactions.map(([emoji, ids]) => (
                      <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)}
                        style={{ background: ids.includes(user.uid) ? '#ede9fe' : '#f3f4f6', border: ids.includes(user.uid) ? '1px solid #a78bfa' : '1px solid #e5e7eb', borderRadius:999, padding:'2px 8px', cursor:'pointer', fontSize:'0.8rem', display:'flex', alignItems:'center', gap:3 }}>
                        {emoji} <span style={{ fontSize:'0.72rem', color:'#6b7280' }}>{ids.length}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Typing indicator */}
          {partnerTyping && (
            <div style={{ padding:'4px 16px', display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ display:'flex', gap:3 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width:7, height:7, borderRadius:'50%', background:'#9ca3af', animation:`sc-pulse .8s ease-in-out ${i*.15}s infinite alternate` }} />
                ))}
              </div>
              <span style={{ fontSize:'0.78rem', color:'#9ca3af', fontStyle:'italic' }}>{partnerTyping}</span>
            </div>
          )}
          <div ref={bottomRef} style={{ height:4 }} />
        </div>

        {/* Input */}
        <div style={{ padding:'10px 12px 10px', paddingBottom:'max(10px, env(safe-area-inset-bottom))', background:'#f1effc', borderTop:'1px solid #d8d4f4', flexShrink:0 }}>
          <div ref={wrapRef} style={{ display:'flex', alignItems:'center', background:'white', borderRadius:999, padding:'6px 6px 6px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.1)' }}>
            <input style={{ flex:1, border:'none', outline:'none', fontSize:'1rem', background:'transparent', color: ready?'#111':'#9ca3af', padding:'6px 0', fontFamily:'inherit' }}
              dir="auto"
              placeholder={ready ? 'Type a message…' : 'Loading safety model…'}
              value={draft}
              onChange={handleInput}
              onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()} }}
              disabled={busy}
            />
            <button style={{ width:42, height:42, borderRadius:'50%', background:'linear-gradient(135deg,#5551d5,#7c3aed)', border:'none', cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', opacity: !draft.trim()||busy ? .4 : 1, transition:'opacity .2s' }}
              onClick={send} disabled={!draft.trim()||busy}>
              {busy
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
