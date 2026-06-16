import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import { ModelProvider } from './contexts/ModelContext.jsx'
import LoginPage      from './pages/LoginPage.jsx'
import ChatsPage      from './pages/ChatsPage.jsx'
import ChatPage       from './pages/ChatPage.jsx'
import CounselorPage  from './pages/CounselorPage.jsx'

function Guard({ children }) {
  const { user, profile } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!profile) return <Navigate to="/login?complete=1" replace />
  return children
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
