import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['safechat.svg', 'apple-touch-icon-180x180.png'],
        manifest: {
          name: 'AmitMagen SafeChat',
          short_name: 'SafeChat',
          description: 'Safe messaging platform for kids and teens',
          theme_color: '#4540c8',
          background_color: '#4540c8',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: 'pwa-64x64.png',           sizes: '64x64',   type: 'image/png' },
            { src: 'pwa-192x192.png',          sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png',          sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
      {
        name: 'local-api',
        configureServer(server) {
          server.middlewares.use('/api/chat', async (req, res) => {
            if (req.method !== 'POST') { res.statusCode = 405; res.end('Method Not Allowed'); return }
            let body = ''
            req.on('data', chunk => body += chunk)
            req.on('end', async () => {
              try {
                const { messages, systemPrompt } = JSON.parse(body)
                const GEMINI_API_KEY = env.GEMINI_API_KEY

                if (!GEMINI_API_KEY) {
                  console.error('[Gemini] No API key found in .env')
                  res.statusCode = 500
                  res.end(JSON.stringify({ error: 'GEMINI_API_KEY missing from .env' }))
                  return
                }

                const contents = messages.map(m => ({
                  role: m.role === 'model' ? 'model' : 'user',
                  parts: [{ text: m.text }],
                }))

                const reqBody = {
                  system_instruction: { parts: [{ text: systemPrompt }] },
                  contents,
                  generationConfig: { maxOutputTokens: 300, temperature: 0.9 },
                }

                console.log('[Gemini] Sending request, messages:', contents.length)

                const geminiRes = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reqBody) }
                )

                const data = await geminiRes.json()
                console.log('[Gemini] Status:', geminiRes.status, '| Response:', JSON.stringify(data).slice(0, 400))

                if (!geminiRes.ok) {
                  const errMsg = data?.error?.message || 'Gemini API error'
                  console.error('[Gemini] API error:', errMsg)
                  res.statusCode = 500
                  res.end(JSON.stringify({ error: errMsg }))
                  return
                }

                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
                if (!text) {
                  console.error('[Gemini] Empty response:', JSON.stringify(data))
                  res.statusCode = 500
                  res.end(JSON.stringify({ error: 'Gemini returned empty response' }))
                  return
                }

                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ text }))
              } catch (e) {
                console.error('[Gemini] Exception:', e.message)
                res.statusCode = 500
                res.end(JSON.stringify({ error: e.message }))
              }
            })
          })
        },
      },
    ],
  }
})
