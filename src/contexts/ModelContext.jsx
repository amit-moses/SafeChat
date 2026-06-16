import { createContext, useContext, useEffect, useState } from 'react'
import { loadModel, classify as _classify } from '../utils/toxicity.js'

const ModelCtx = createContext(null)
export const useModel = () => useContext(ModelCtx)

export function ModelProvider({ children }) {
  const [ready, setReady] = useState(false)
  const [progress, setProgress] = useState('Starting…')

  useEffect(() => {
    loadModel(step => setProgress(step === 'vocab' ? 'Loading vocabulary…' : 'Loading AI model…'))
      .then(() => setReady(true))
      .catch(e => console.error('Model load failed:', e))
  }, [])

  async function classify(text) {
    if (!ready) return { toxic: false, pct: 0 }
    return _classify(text)
  }

  return (
    <ModelCtx.Provider value={{ ready, progress, classify }}>
      {children}
    </ModelCtx.Provider>
  )
}
