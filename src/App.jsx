import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import { ModelProvider, useModel } from './contexts/ModelContext.jsx'
import LoginPage      from './pages/LoginPage.jsx'
import ChatsPage      from './pages/ChatsPage.jsx'
import ChatPage       from './pages/ChatPage.jsx'
import CounselorPage  from './pages/CounselorPage.jsx'

function Guard({ children }) {
  const { user, profile } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!profile) return <Navigate to="/login?complete=1" replace />
  return <ModelGate>{children}</ModelGate>
}

function ModelGate({ children }) {
  const { ready, progress } = useModel()
  if (ready) return children

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e1b4b, #4540c8)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      gap: 24,
    }}>
      <img src="/safechat.svg" alt="SafeChat" style={{ width: 80, height: 80, filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.4))' }} />
      <div style={{ color: 'white', fontWeight: 700, fontSize: '1.4rem', letterSpacing: 0.5 }}>
        AmitMagen SafeChat
      </div>
      <Spinner />
    </div>
  )
}

function Spinner() {
  return (
    <svg viewBox="0 0 40 40" width={36} height={36} style={{ animation: 'spin 0.9s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3.5" />
      <circle cx="20" cy="20" r="16" fill="none" stroke="white" strokeWidth="3.5"
        strokeDasharray="60 44" strokeLinecap="round" />
    </svg>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ModelProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login"     element={<LoginPage />} />
            <Route path="/chats"     element={<Guard><ChatsPage /></Guard>} />
            <Route path="/chat/:id"  element={<Guard><ChatPage /></Guard>} />
            <Route path="/counselor" element={<Guard><CounselorPage /></Guard>} />
            <Route path="*"          element={<Navigate to="/chats" replace />} />
          </Routes>
        </BrowserRouter>
      </ModelProvider>
    </AuthProvider>
  )
}
