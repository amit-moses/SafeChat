import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function NewChatModal({ onClose }) {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [phone,  setPhone]  = useState('')
  const [found,  setFound]  = useState(null)
  const [err,    setErr]    = useState('')
  const [busy,   setBusy]   = useState(false)

  async function search(e) {
    e.preventDefault()
    setErr(''); setFound(null); setBusy(true)
    try {
      const q = query(collection(db, 'users'), where('phone', '==', phone.trim()))
      const snap = await getDocs(q)
      if (snap.empty) { setErr('No user found with that phone number'); return }
      const u = { id: snap.docs[0].id, ...snap.docs[0].data() }
      if (u.id === user.uid) { setErr("That's your own number!"); return }
      setFound(u)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  async function openChat() {
    if (!found) return
    setBusy(true)
    try {
      const chatId = [user.uid, found.id].sort().join('_')
      const ref = doc(db, 'chats', chatId)
      const snap = await getDoc(ref)
      if (!snap.exists()) {
        await setDoc(ref, {
          type: 'direct', name: '',
          members: [user.uid, found.id],
          memberNames: { [user.uid]: profile?.username, [found.id]: found.username },
          memberPhotos: { [user.uid]: profile?.photoURL||null, [found.id]: found.photoURL||null },
          lastMessage: null,
          createdAt: serverTimestamp(),
        })
      }
      navigate(`/chat/${chatId}`)
      onClose()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'white', borderRadius:16, padding:24, width:'100%', maxWidth:360, fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
        <div style={{ fontWeight:700, fontSize:'1.1rem', marginBottom:16, color:'#1e1b4b' }}>New Chat</div>
        <form onSubmit={search}>
          <label style={{ fontSize:'0.8rem', fontWeight:600, color:'#4b5563', display:'block', marginBottom:5 }}>Search by phone number</label>
          <div style={{ display:'flex', gap:8 }}>
            <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+1 555 000 0000"
              style={{ flex:1, border:'1.5px solid #e5e7eb', borderRadius:8, padding:'9px 12px', fontSize:'0.9rem', outline:'none' }} type="tel" required />
            <button type="submit" disabled={busy} style={{ padding:'9px 14px', background:'#4540c8', color:'white', border:'none', borderRadius:8, fontWeight:600, cursor:'pointer' }}>
              {busy ? '…' : 'Find'}
            </button>
          </div>
        </form>

        {err && <div style={{ marginTop:10, color:'#b91c1c', fontSize:'0.85rem', background:'#fef2f2', padding:'8px 12px', borderRadius:8 }}>{err}</div>}

        {found && (
          <div style={{ marginTop:14, display:'flex', alignItems:'center', gap:12, padding:'12px', background:'#f8f7fe', borderRadius:10 }}>
            <div style={{ width:44, height:44, borderRadius:'50%', background:'#4540c8', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'1.1rem', flexShrink:0 }}>
              {found.photoURL ? <img src={found.photoURL} style={{ width:44, height:44, borderRadius:'50%' }} /> : found.username?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:600 }}>{found.username}</div>
              <div style={{ fontSize:'0.8rem', color:'#6b7280' }}>{found.phone}</div>
            </div>
            <button onClick={openChat} style={{ padding:'8px 14px', background:'#4540c8', color:'white', border:'none', borderRadius:8, fontWeight:600, cursor:'pointer' }}>
              Chat →
            </button>
          </div>
        )}

        <button onClick={onClose} style={{ marginTop:12, width:'100%', padding:'10px', background:'none', border:'1.5px solid #e5e7eb', borderRadius:8, cursor:'pointer', color:'#6b7280', fontWeight:600 }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
