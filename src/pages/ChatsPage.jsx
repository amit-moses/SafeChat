import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import NewChatModal    from '../components/NewChatModal.jsx'
import CreateGroupModal from '../components/CreateGroupModal.jsx'

const ts = t => {
  if (!t) return ''
  const d = t.toDate ? t.toDate() : new Date(t)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
  return d.toLocaleDateString([], { month:'short', day:'numeric' })
}

const avatar = (name, photo, size=40) => photo
  ? <img src={photo} alt={name} style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover' }} />
  : <div style={{ width:size, height:size, borderRadius:'50%', background:'#4540c8', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:size*0.4 }}>{name?.[0]?.toUpperCase()}</div>

export default function ChatsPage() {
  const { user, profile, logout } = useAuth()
  const navigate = useNavigate()
  const [chats,       setChats]       = useState([])
  const [partnerNames, setPartnerNames] = useState({}) // { uid: { username, photoURL } }
  const [search,      setSearch]      = useState('')
  const [modal,       setModal]       = useState(null) // 'new' | 'group' | null

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, 'chats'),
      where('members', 'array-contains', user.uid),
      orderBy('lastMessage.timestamp', 'desc')
    )
    return onSnapshot(q, snap => {
      const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setChats(loaded)
      // fetch partner user docs for direct chats
      const partnerIds = [...new Set(
        loaded
          .filter(c => c.type !== 'group')
          .map(c => c.members.find(id => id !== user.uid))
          .filter(Boolean)
      )]
      partnerIds.forEach(pid => {
        getDoc(doc(db, 'users', pid)).then(s => {
          if (s.exists()) setPartnerNames(prev => ({ ...prev, [pid]: s.data() }))
        })
      })
    }, () => {
      const q2 = query(collection(db, 'chats'), where('members', 'array-contains', user.uid))
      onSnapshot(q2, s => setChats(s.docs.map(d => ({ id:d.id, ...d.data() }))))
    })
  }, [user])

  const filtered = chats.filter(c => {
    const name = chatName(c, user.uid)
    return name.toLowerCase().includes(search.toLowerCase())
  })

  function chatName(chat, myUid) {
    if (chat.type === 'group') return chat.name
    const otherId = chat.members.find(id => id !== myUid)
    return partnerNames[otherId]?.username || chat.memberNames?.[otherId] || 'Unknown'
  }

  function chatPhoto(chat, myUid) {
    if (chat.type === 'group') return null
    const otherId = chat.members.find(id => id !== myUid)
    return partnerNames[otherId]?.photoURL || chat.memberPhotos?.[otherId] || null
  }

  return (
    <div style={{ minHeight:'100dvh', background:'#eae8f6', display:'flex', justifyContent:'center', fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ width:'100%', maxWidth:480, background:'white', display:'flex', flexDirection:'column', minHeight:'100dvh', boxShadow:'0 0 40px rgba(0,0,0,.1)' }}>

        {/* Header */}
        <div style={{ background:'#4540c8', padding:'16px', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          {avatar(profile?.username, profile?.photoURL, 38)}
          <div style={{ flex:1 }}>
            <div style={{ color:'white', fontWeight:700, fontSize:'1rem' }}>{profile?.username}</div>
            <div style={{ color:'rgba(255,255,255,.65)', fontSize:'0.75rem' }}>{profile?.phone || 'SafeChat'}</div>
          </div>
          <button onClick={logout} style={{ background:'rgba(255,255,255,.15)', border:'none', color:'white', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:'0.8rem' }}>
            Sign out
          </button>
        </div>

        {/* Search */}
        <div style={{ padding:'12px 16px', background:'#f8f7fe', borderBottom:'1px solid #e8e6f5' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search conversations…"
            style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:20, padding:'8px 16px', fontSize:'0.9rem', outline:'none', fontFamily:'inherit' }} />
        </div>

        {/* Chat list */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {filtered.length === 0 && (
            <div style={{ textAlign:'center', padding:'60px 20px', color:'#9ca3af' }}>
              <div style={{ fontSize:'2.5rem', marginBottom:12 }}>💬</div>
              <div style={{ fontWeight:600, marginBottom:6 }}>No conversations yet</div>
              <div style={{ fontSize:'0.85rem' }}>Start a new chat below</div>
            </div>
          )}
          {filtered.map(chat => {
            const name     = chatName(chat, user.uid)
            const photo    = chatPhoto(chat, user.uid)
            const last     = chat.lastMessage
            const isGroup  = chat.type === 'group'
            const hasUnread = last && last.senderId !== user.uid && !last.readBy?.includes(user.uid)
            return (
              <div key={chat.id} onClick={() => navigate(`/chat/${chat.id}`)}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', cursor:'pointer', borderBottom:'1px solid #f3f4f6', transition:'background .15s', background: hasUnread ? '#faf9ff' : 'white' }}
                onMouseEnter={e => e.currentTarget.style.background='#f8f7fe'}
                onMouseLeave={e => e.currentTarget.style.background= hasUnread ? '#faf9ff' : 'white'}>
                <div style={{ position:'relative', flexShrink:0 }}>
                  {avatar(name, photo, 48)}
                  {isGroup && (
                    <div style={{ position:'absolute', bottom:-2, right:-2, background:'#4540c8', color:'white', borderRadius:999, fontSize:'0.6rem', padding:'1px 4px', fontWeight:700 }}>
                      {chat.members.length}
                    </div>
                  )}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:3 }}>
                    <span style={{ fontWeight: hasUnread ? 700 : 600, fontSize:'0.95rem', color:'#111' }}>{name}</span>
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0, marginLeft:8 }}>
                      <span style={{ fontSize:'0.72rem', color: hasUnread ? '#4540c8' : '#9ca3af' }}>{ts(last?.timestamp)}</span>
                      {hasUnread && <div style={{ width:10, height:10, borderRadius:'50%', background:'#4540c8' }} />}
                    </div>
                  </div>
                  <div style={{ fontSize:'0.85rem', color: hasUnread ? '#374151' : '#6b7280', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight: hasUnread ? 600 : 400 }}>
                    {last ? `${last.senderId === user.uid ? 'You: ' : ''}${last.text}` : 'No messages yet'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* FABs */}
        <div style={{ position:'sticky', bottom:0, padding:'16px', display:'flex', gap:10, background:'white', borderTop:'1px solid #e8e6f5' }}>
          <button onClick={() => setModal('new')}
            style={{ flex:1, padding:'11px', background:'linear-gradient(135deg,#4540c8,#7c3aed)', color:'white', border:'none', borderRadius:12, fontWeight:600, cursor:'pointer', fontSize:'0.9rem' }}>
            + New Chat
          </button>
          <button onClick={() => setModal('group')}
            style={{ flex:1, padding:'11px', background:'white', color:'#4540c8', border:'1.5px solid #4540c8', borderRadius:12, fontWeight:600, cursor:'pointer', fontSize:'0.9rem' }}>
            👥 New Group
          </button>
        </div>
      </div>

      {modal === 'new'   && <NewChatModal    onClose={() => setModal(null)} />}
      {modal === 'group' && <CreateGroupModal onClose={() => setModal(null)} />}
    </div>
  )
}
