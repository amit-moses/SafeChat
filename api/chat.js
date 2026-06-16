export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { messages, systemPrompt } = req.body
  const apiKey = process.env.GEMINI_API_KEY

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: messages.map(m => ({
            role: m.role === 'model' ? 'model' : 'user',
            parts: [{ text: m.text }],
          })),
          generationConfig: { maxOutputTokens: 200, temperature: 0.8 },
        }),
      }
    )

    const data = await response.json()
    if (!response.ok) return res.status(500).json({ error: data.error?.message })
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "I hear you. Tell me more."
    res.json({ text })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
