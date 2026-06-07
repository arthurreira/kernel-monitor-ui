'use client'
import { useState } from 'react'

const ROG_IP = '172.20.10.2'

export default function Home() {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<{role: string, text: string}[]>([])
  const [loading, setLoading] = useState(false)

  async function ask() {
    if (!question.trim()) return
    const q = question
    setQuestion('')
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setLoading(true)

    const res = await fetch(`http://${ROG_IP}:8000/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q })
    })
    const data = await res.json()
    setMessages(prev => [...prev, { role: 'ai', text: data.answer }])
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono p-4">
      <h1 className="text-2xl font-bold mb-4">🔍 Kernel Monitor AI</h1>
      <div className="h-[70vh] overflow-y-auto mb-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-white' : 'text-green-400'}>
            <span className="font-bold">{m.role === 'user' ? 'you' : 'ai'}: </span>
            {m.text}
          </div>
        ))}
        {loading && <div className="text-yellow-400">thinking...</div>}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 bg-gray-900 border border-green-400 rounded p-2 text-white"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ask()}
          placeholder="ask about your system..."
        />
        <button
          onClick={ask}
          className="bg-green-400 text-black px-4 rounded font-bold"
        >
          ask
        </button>
      </div>
    </div>
  )
}