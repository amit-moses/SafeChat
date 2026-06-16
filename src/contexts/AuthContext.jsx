import { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signInWithPopup, signOut, onAuthStateChanged, updateProfile,
} from 'firebase/auth'
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, query, collection, where, getDocs } from 'firebase/firestore'
import { auth, db, googleProvider } from '../lib/firebase.js'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

// Firebase Auth requires email — we derive one from username
const fakeEmail = u => `${u.toLowerCase().replace(/\s+/g, '_')}@safechat.local`

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)  // Firestore user doc
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async fbUser => {
      if (fbUser) {
        setUser(fbUser)
        const snap = await getDoc(doc(db, 'users', fbUser.uid))
        if (snap.exists()) {
          setProfile(snap.data())
          // update online status
          await updateDoc(doc(db, 'users', fbUser.uid), {
            isOnline: true, lastSeen: serverTimestamp(),
          })
        } else {
          setProfile(null) // Google user needs profile completion
        }
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })
    // set offline on tab close
    const goOffline = () => {
      if (auth.currentUser)
        updateDoc(doc(db, 'users', auth.currentUser.uid), { isOnline: false, lastSeen: serverTimestamp() })
    }
    window.addEventListener('beforeunload', goOffline)
    return () => { unsub(); window.removeEventListener('beforeunload', goOffline) }
  }, [])

  // ── Register with username + password ────────────────────────────────────────
  async function register({ username, phone, password }) {
    // check username uniqueness
    const q = query(collection(db, 'users'), where('username', '==', username.trim()))
    const snap = await getDocs(q)
    if (!snap.empty) throw new Error('Username already taken')

    const cred = await createUserWithEmailAndPassword(auth, fakeEmail(username), password)
    await updateProfile(cred.user, { displayName: username.trim() })

    const userDoc = {
      username: username.trim(),
      phone: phone.trim(),
      isOnline: true,
      lastSeen: serverTimestamp(),
      blockedCount: 0,
      photoURL: null,
      createdAt: serverTimestamp(),
    }
    await setDoc(doc(db, 'users', cred.user.uid), userDoc)
    setProfile(userDoc)
  }

  // ── Login with username + password ───────────────────────────────────────────
  async function login({ username, password }) {
    await signInWithEmailAndPassword(auth, fakeEmail(username), password)
  }

  // ── Google Sign-In ───────────────────────────────────────────────────────────
  async function loginWithGoogle() {
    const cred = await signInWithPopup(auth, googleProvider)
    const uid  = cred.user.uid
    const snap = await getDoc(doc(db, 'users', uid))
    if (!snap.exists()) return { needsProfile: true, cred }
    await updateDoc(doc(db, 'users', uid), { isOnline: true, lastSeen: serverTimestamp() })
    return { needsProfile: false }
  }

  // ── Complete Google profile (first time) ─────────────────────────────────────
  async function completeGoogleProfile({ username, phone }) {
    if (!auth.currentUser) return
    const uid = auth.currentUser.uid
    const q = query(collection(db, 'users'), where('username', '==', username.trim()))
    const snap = await getDocs(q)
    if (!snap.empty) throw new Error('Username already taken')

    const userDoc = {
      username: username.trim(),
      phone: phone.trim(),
      isOnline: true,
      lastSeen: serverTimestamp(),
      blockedCount: 0,
      photoURL: auth.currentUser.photoURL || null,
      createdAt: serverTimestamp(),
    }
    await setDoc(doc(db, 'users', uid), userDoc)
    setProfile(userDoc)
  }

  async function logout() {
    if (auth.currentUser)
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { isOnline: false, lastSeen: serverTimestamp() })
    await signOut(auth)
  }

  async function incrementBlocked() {
    if (!user) return
    await updateDoc(doc(db, 'users', user.uid), { blockedCount: (profile?.blockedCount || 0) + 1 })
    setProfile(p => ({ ...p, blockedCount: (p?.blockedCount || 0) + 1 }))
  }

  return (
    <AuthCtx.Provider value={{ user, profile, loading, register, login, loginWithGoogle, completeGoogleProfile, logout, incrementBlocked }}>
      {!loading && children}
    </AuthCtx.Provider>
  )
}
