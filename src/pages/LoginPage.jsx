import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'

const C = {
  page:   { minHeight:'100vh', background:'linear-gradient(160deg,#4540c8,#3730a3)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Segoe UI',system-ui,sans-serif", padding:16 },
  card:   { background:'white', borderRadius:20, padding:'40px 36px', width:'100%', maxWidth:400, boxShadow:'0 20px 60px rgba(0,0,0,.25)' },
  logo:   { display:'flex', alignItems:'center', gap:10, justifyContent:'center', marginBottom:28 },
  title:  { fontSize:'1.5rem', fontWeight:800, color:'#1e1b4b', margin:0 },
  tabs:   { display:'flex', background:'#f1f0fb', borderRadius:10, padding:4, marginBottom:24 },
  tab:    { flex:1, padding:'8px 0', border:'none', borderRadius:8, cursor:'pointer', fontSize:'0.9rem', fontWeight:600, transition:'all .2s' },
  label:  { display:'block', fontSize:'0.8rem', fontWeight:600, color:'#4b5563', marginBottom:5 },
  input:  { width:'100%', border:'1.5px solid #e5e7eb', borderRadius:10, padding:'10px 14px', fontSize:'0.95rem', outline:'none', fontFamily:'inherit', transition:'border .2s' },
  btn:    { width:'100%', padding:'12px', background:'linear-gradient(135deg,#4540c8,#7c3aed)', color:'white', border:'none', borderRadius:10, fontSize:'0.95rem', fontWeight:700, cursor:'pointer', marginTop:6 },
  gBtn:   { width:'100%', padding:'11px', background:'white', color:'#374151', border:'1.5px solid #e5e7eb', borderRadius:10, fontSize:'0.95rem', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:10 },
  divider:{ display:'flex', alignItems:'center', gap:10, margin:'14px 0', color:'#9ca3af', fontSize:'0.8rem' },
  err:    { background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:8, padding:'10px 14px', color:'#b91c1c', fontSize:'0.85rem', marginBottom:12 },
  field:  { marginBottom:14 },
}

export default function LoginPage() {
  const { login, register, loginWithGoogle, completeGoogleProfile } = useAuth()
  const [params]   = useSearchParams()
  const needsComplete = params.get('complete') === '1'

  const navigate = useNavigate()
  const [tab, setTab]   = useState(needsComplete ? 'complete' : 'login')
  const [form, setForm] = useState({ username:'', phone:'', password:'', confirm:'' })
  const [err, setErr]   = useState('')
  const [busy, setBusy] = useState(false)

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      if (tab === 'login') {
        await login({ username: form.username, password: form.password })
        navigate('/chats')
      } else if (tab === 'register') {
        if (form.password !== form.confirm) throw new Error("Passwords don't match")
        if (form.password.length < 6) throw new Error('Password must be at least 6 characters')
        await register({ username: form.username, phone: form.phone, password: form.password })
        navigate('/chats')
      } else {
        // complete Google profile
        await completeGoogleProfile({ username: form.username, phone: form.phone })
        navigate('/chats')
      }
    } catch (e) {
      setErr(e.message.replace('Firebase: ', '').replace(/\(auth.*\)\.?/, ''))
    } finally { setBusy(false) }
  }

  async function handleGoogle() {
    setErr(''); setBusy(true)
    try {
      const { needsProfile } = await loginWithGoogle()
      if (needsProfile) {
        setTab('complete')
      } else {
        navigate('/chats')
      }
    } catch (e) {
      setErr(e.message)
    } finally { setBusy(false) }
  }

  return (
    <div style={C.page}>
      <div style={C.card}>
        {/* Logo */}
        <div style={C.logo}>
          <svg viewBox="0 0 24 24" width={32} height={32} fill="#4540c8">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
          </svg>
          <span style={C.title}>SafeChat</span>
        </div>

        {/* Tabs (not shown on complete-profile screen) */}
        {tab !== 'complete' && (
          <div style={C.tabs}>
            {['login','register'].map(t => (
              <button key={t} style={{ ...C.tab, background: tab===t ? 'white' : 'transparent', color: tab===t ? '#4540c8' : '#6b7280', boxShadow: tab===t ? '0 1px 4px rgba(0,0,0,.1)' : 'none' }}
                onClick={() => { setTab(t); setErr('') }}>
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>
        )}

        {tab === 'complete' && (
          <div style={{ textAlign:'center', marginBottom:20 }}>
            <div style={{ fontWeight:700, fontSize:'1.1rem', color:'#1e1b4b' }}>Complete your profile</div>
            <div style={{ fontSize:'0.82rem', color:'#6b7280', marginTop:4 }}>Choose a username to continue</div>
          </div>
        )}

        {err && <div style={C.err}>{err}</div>}

        <form onSubmit={handleSubmit}>
          <div style={C.field}>
            <label style={C.label}>Username</label>
            <input style={C.input} placeholder="e.g. alex123" value={form.username} onChange={set('username')} required />
          </div>

          {(tab === 'register' || tab === 'complete') && (
            <div style={C.field}>
              <label style={C.label}>Phone number</label>
              <input style={C.input} placeholder="+1 555 000 0000" value={form.phone} onChange={set('phone')} type="tel" />
            </div>
          )}

          {tab !== 'complete' && (
            <div style={C.field}>
              <label style={C.label}>Password</label>
              <input style={C.input} type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required />
            </div>
          )}

          {tab === 'register' && (
            <div style={C.field}>
              <label style={C.label}>Confirm password</label>
              <input style={C.input} type="password" placeholder="••••••••" value={form.confirm} onChange={set('confirm')} required />
            </div>
          )}

          <button type="submit" style={{ ...C.btn, opacity: busy ? 0.7 : 1 }} disabled={busy}>
            {busy ? 'Please wait…' : tab === 'login' ? 'Sign In' : tab === 'register' ? 'Create Account' : 'Continue →'}
          </button>
        </form>

        {/* Google sign-in (not on profile completion) */}
        {tab !== 'complete' && (
          <>
            <div style={C.divider}>
              <div style={{ flex:1, height:1, background:'#e5e7eb' }} />
              or
              <div style={{ flex:1, height:1, background:'#e5e7eb' }} />
            </div>
            <button style={{ ...C.gBtn, opacity: busy ? 0.7 : 1 }} onClick={handleGoogle} disabled={busy}>
              <svg viewBox="0 0 24 24" width={20} height={20}>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </>
        )}
      </div>
    </div>
  )
}
