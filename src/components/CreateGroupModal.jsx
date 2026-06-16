import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function CreateGroupModal({ onClose }) {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [name,    setName]    = useState('')
  const [phone,   setPhone]   = useState('')
  const [members, setMembers] = useState([]) // { id, username, phone }
  const [err,     setErr]     = useState('')
  const [busy,    setBusy]    = useState(false)

  async function addMember(e) {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      const q = query(collection(db, 'users'), where('phone', '==', phone.trim()))
      const snap = await getDocs(q)
      if (snap.empty) { setErr('User not found'); return }
      const u = { id: snap.docs[0].id, ...snap.docs[0].data() }
      if (u.id === user.uid) { setErr("You're already the group creator"); return }
      if (members.find(m => m.id === u.id)) { setErr('Already added'); return }
      setMembers(p => [...p, u])
      setPhone('')
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  async function createGroup() {
    if (!name.trim() || members.length === 0) { setErr('Add a name and at least 1 member'); return }
    setBusy(true)
    try {
      const allMembers = [user.uid, ...members.map(m => m.id)]
      const memberNames = { [user.uid]: profile?.username }
      const memberPhotos = { [user.uid]: profile?.photoURL||null }
      members.forEach(m => { memberNames[m.id]=m.username; memberPhotos[m.id]=m.photoURL||null })

      const ref = await addDoc(collection(db, 'chats'), {
        type: 'group', name: name.trim(),
        members: allMembers, memberNames, memberPhotos,
        lastMessage: null, groupAdmin: user.uid,
        createdAt: serverTimestamp(),
      })
      navigate(`/chat/${ref.id}`)
      onClose()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'white', borderRadius:16, padding:24, width:'100%', maxWidth:380, fontFamily:"'Segoe UI',system-ui,sans-serif", maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ fontWeight:700, fontSize:'1.1rem', marginBottom:16, color:'#1e1b4b' }}>Create Group</div>

        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:'0.8rem', fontWeight:600, color:'#4b5563', display:'block', marginBottom:5 }}>Group name</label>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Study Group"
            style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'9px 12px', fontSize:'0.9rem', outline:'none' }} />
        </div>

        <form onSubmit={addMember} style={{ marginBottom:14 }}>
          <label style={{ fontSize:'0.8rem', fontWeight:600, color:'#4b5563', display:'block', marginBottom:5 }}>Add members by phone</label>
          <div style={{ display:'flex', gap:8 }}>
            <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+1 555 000 0000"
              style={{ flex:1, border:'1.5px solid #e5e7eb', borderRadius:8, padding:'9px 12px', fontSize:'0.9rem', outline:'none' }} type="tel" />
            <button type="submit" disabled={busy} style={{ padding:'9px 14px', background:'#4540c8', color:'white', border:'none', borderRadius:8, fontWeight:600, cursor:'pointer' }}>
              + Add
            </button>
          </div>
        </form>

        {err && <div style={{ color:'#b91c1c', fontSize:'0.85rem', background:'#fef2f2', padding:'8px 12px', borderRadius:8, marginBottom:10 }}>{err}</div>}

        {/* Members list */}
        {members.length > 0 && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:'0.8rem', fontWeight:600, color:'#4b5563', marginBottom:8 }}>Members ({members.length + 1})</div>
            {/* Self */}
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid #f3f4f6' }}>
              <div style={{ width:34, height:34, borderRadius:'50%', background:'#4540c8', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>{profile?.username?.[0]?.toUpperCase()}</div>
              <span style={{ fontSize:'0.9rem', color:'#374151' }}>{profile?.username} <span style={{ color:'#9ca3af', fontSize:'0.8rem' }}>(you)</span></span>
            </div>
            {members.map(m => (
              <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid #f3f4f6' }}>
                <div style={{ width:34, height:34, borderRadius:'50%', background:'#6d28d9', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>{m.username?.[0]?.toUpperCase()}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'0.9rem', color:'#374151' }}>{m.username}</div>
                  <div style={{ fontSize:'0.75rem', color:'#9ca3af' }}>{m.phone}</div>
                </div>
                <button onClick={() => setMembers(p => p.filter(x => x.id !== m.id))}
                  style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:'1.1rem' }}>✕</button>
              </div>
            ))}
          </div>
        )}

        <button onClick={createGroup} disabled={busy || !name.trim() || members.length === 0}
          style={{ width:'100%', padding:'11px', background:'linear-gradient(135deg,#4540c8,#7c3aed)', color:'white', border:'none', borderRadius:10, fontWeight:700, cursor:'pointer', opacity: busy||!name.trim()||members.length===0 ? .5 : 1, marginBottom:8 }}>
          {busy ? 'Creating…' : `Create Group (${members.length + 1} members)`}
        </button>

        <button onClick={onClose} style={{ width:'100%', padding:'10px', background:'none', border:'1.5px solid #e5e7eb', borderRadius:10, cursor:'pointer', color:'#6b7280', fontWeight:600 }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
