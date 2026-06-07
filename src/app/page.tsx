'use client'

import { useState, useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

const API = 'http://172.20.10.2:8000'
const SENSITIVE_PATHS = ['/etc/passwd', '/etc/shadow', '/etc/gshadow']

interface KernelEvent {
  timestamp: string
  process: string
  pid: number
  filename: string | null
}

interface KernelStats {
  total: number
  top_process: string
  suspicious: number
  uptime: string
}

interface Message {
  role: 'user' | 'ai'
  text: string
}

const INITIAL_MESSAGE: Message = {
  role: 'ai',
  text: "Tracing live. I'm watching open(), execve() and connect() syscalls across all PIDs.\n\nTwo reads of /etc/shadow flagged in the last minute — both from unknown_4471. Ask me anything about what's running.",
}

function isSensitive(filename: string | undefined | null) {
  if (!filename) return false
  return SENSITIVE_PATHS.some(p => filename.includes(p))
}

function formatUptime(raw: string): string {
  const days = parseInt(raw.match(/(\d+)\s+day/)?.[1] ?? '0', 10)
  const hours = parseInt(
    raw.match(/(\d+)\s+hour/)?.[1] ?? raw.match(/(\d+):/)?.[1] ?? '0',
    10
  )
  return `${days}d ${String(hours).padStart(2, '0')}h`
}

function StatBlock({
  label,
  value,
  sub,
  red = false,
  noBorder = false,
}: {
  label: string
  value: string
  sub: string
  red?: boolean
  noBorder?: boolean
}) {
  return (
    <div
      style={{
        flex: 1,
        padding: '14px 24px',
        borderRight: noBorder ? 'none' : '1px solid #1f1f1f',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ fontSize: 9, color: '#6b7280', letterSpacing: '0.12em', marginBottom: 6, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: red ? '#dc2626' : '#f9fafb', lineHeight: 1.1, marginBottom: 3 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#6b7280' }}>{sub}</div>
    </div>
  )
}

export default function KernelMonitor() {
  const [events, setEvents] = useState<KernelEvent[]>([])
  const [stats, setStats] = useState<KernelStats | null>(null)
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const [eventsData, statsData] = await Promise.all([
          fetch(`${API}/events`).then(r => r.json()),
          fetch(`${API}/stats`).then(r => r.json()),
        ])
        setEvents(eventsData.events ?? [])
        setStats(statsData)
      } catch {
        // backend unreachable — retain last known state
      }
    }
    poll()
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async (text?: string) => {
    const q = (text ?? question).trim()
    if (!q || loading) return
    setQuestion('')
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setLoading(true)
    try {
      const res = await fetch(`${API}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'ai', text: data.answer }])
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'ai', text: 'Could not reach the kernel monitor backend. Make sure it is running on 172.20.10.2:8000.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        background: '#0a0a0a',
        color: '#f9fafb',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* ── TOP BAR ── */}
      <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid #1f1f1f', flexShrink: 0 }}>
        {/* Wordmark */}
        <div
          style={{
            padding: '12px 24px',
            borderRight: '1px solid #1f1f1f',
            minWidth: 170,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div style={{ fontSize: 9, color: '#6b7280', letterSpacing: '0.12em', marginBottom: 5 }}>
            EBPF · SYSCALL TRACE
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '0.04em', lineHeight: 1.15 }}>
            KERNEL
            <br />
            MONITOR
          </div>
        </div>

        {/* Stats */}
        <StatBlock
          label="Events Today"
          value={stats?.total?.toLocaleString() ?? '—'}
          sub="total syscalls traced"
        />
        <StatBlock
          label="Most Active Process"
          value={stats?.top_process ?? '—'}
          sub="highest file open rate"
        />
        <StatBlock
          label="Suspicious Events"
          value={stats?.suspicious?.toLocaleString() ?? '—'}
          sub="sensitive path access"
          red
        />
        <StatBlock
          label="System Uptime"
          value={stats?.uptime ? formatUptime(stats.uptime) : '—'}
          sub={stats?.uptime ?? ''}
          noBorder
        />
      </div>

      {/* ── MAIN PANELS ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        {/* ── LEFT: EVENT FEED (40%) ── */}
        <div
          style={{
            width: '40%',
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid #1f1f1f',
            overflow: 'hidden',
          }}
        >
          {/* Feed header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '7px 16px',
              borderBottom: '1px solid #1f1f1f',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
              <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <span
                  className="animate-ping"
                  style={{
                    position: 'absolute',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#dc2626',
                    opacity: 0.75,
                  }}
                />
                <span
                  style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', position: 'relative', flexShrink: 0 }}
                />
              </span>
              <span style={{ color: '#dc2626', fontWeight: 700, letterSpacing: '0.08em' }}>LIVE</span>
              <span style={{ color: '#374151', margin: '0 1px' }}>/</span>
              <span style={{ color: '#9ca3af', letterSpacing: '0.05em' }}>EVENT FEED</span>
            </div>
            <Badge
              variant="outline"
              style={{
                fontSize: 10,
                color: '#6b7280',
                borderColor: '#1f1f1f',
                background: '#111111',
                fontFamily: 'var(--font-mono), "JetBrains Mono", monospace',
              }}
            >
              {events.length} events
            </Badge>
          </div>

          {/* Column headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '180px 160px 1fr',
              padding: '5px 16px',
              borderBottom: '1px solid #1f1f1f',
              flexShrink: 0,
            }}
          >
            {(['TIMESTAMP', 'PROCESS', 'FILE'] as const).map(h => (
              <span key={h} style={{ fontSize: 9, color: '#4b5563', letterSpacing: '0.1em' }}>
                {h}
              </span>
            ))}
          </div>

          {/* Scrollable event rows */}
          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            <ScrollArea className="h-full">
              {events.map((ev, i) => {
                const alert = isSensitive(ev.filename)
                return (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '180px 160px 1fr',
                      padding: '3px 16px',
                      background: alert ? 'rgba(220,38,38,0.10)' : 'transparent',
                      borderBottom: '1px solid #0f0f0f',
                      fontFamily: 'var(--font-mono), "JetBrains Mono", monospace',
                      fontSize: 11,
                      alignItems: 'center',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                    }}
                  >
                    <span style={{ color: alert ? '#f87171' : '#6b7280' }}>{ev.timestamp}</span>
                    <span style={{ color: alert ? '#fca5a5' : '#f9fafb', fontWeight: alert ? 600 : 400 }}>
                      {ev.process}[{ev.pid}]
                    </span>
                    <span style={{ color: alert ? '#f87171' : '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {alert && <span style={{ color: '#dc2626', fontWeight: 700 }}>!</span>}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.filename ?? ''}</span>
                    </span>
                  </div>
                )
              })}
            </ScrollArea>
          </div>
        </div>

        {/* ── RIGHT: AI CHAT (60%) ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Chat header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 20px',
              borderBottom: '1px solid #1f1f1f',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Kernel Assistant</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#4ade80' }}>
                <span
                  style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', display: 'inline-block', flexShrink: 0 }}
                />
                monitoring active
              </div>
            </div>
            <span
              style={{
                fontFamily: 'var(--font-mono), "JetBrains Mono", monospace',
                fontSize: 11,
                color: '#6b7280',
              }}
            >
              claude-sentinel
            </span>
          </div>

          {/* Message area */}
          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            <ScrollArea className="h-full">
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.map((msg, i) =>
                  msg.role === 'ai' ? (
                    <div key={i} style={{ alignSelf: 'flex-start', maxWidth: '82%' }}>
                      <div
                        style={{
                          border: '1px solid #dc2626',
                          background: '#0c0404',
                          padding: '12px 16px',
                          fontSize: 13,
                          lineHeight: 1.65,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 9,
                            color: '#dc2626',
                            fontWeight: 700,
                            letterSpacing: '0.14em',
                            marginBottom: 8,
                          }}
                        >
                          KERNEL ASSISTANT
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap', color: '#f9fafb' }}>{msg.text}</div>
                      </div>
                    </div>
                  ) : (
                    <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '70%' }}>
                      <div
                        style={{
                          background: '#111111',
                          border: '1px solid #1f1f1f',
                          padding: '8px 14px',
                          fontSize: 13,
                          lineHeight: 1.55,
                          color: '#f9fafb',
                        }}
                      >
                        {msg.text}
                      </div>
                    </div>
                  )
                )}

                {loading && (
                  <div style={{ alignSelf: 'flex-start', maxWidth: '82%' }}>
                    <div
                      style={{
                        border: '1px solid #dc2626',
                        background: '#0c0404',
                        padding: '12px 16px',
                        fontSize: 13,
                      }}
                    >
                      <div style={{ fontSize: 9, color: '#dc2626', fontWeight: 700, letterSpacing: '0.14em', marginBottom: 8 }}>
                        KERNEL ASSISTANT
                      </div>
                      <div style={{ color: '#6b7280' }}>processing…</div>
                    </div>
                  </div>
                )}

                <div ref={chatBottomRef} />
              </div>
            </ScrollArea>
          </div>

          {/* Input bar */}
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid #1f1f1f',
              flexShrink: 0,
              background: '#0a0a0a',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span
                style={{
                  color: '#dc2626',
                  fontFamily: 'var(--font-mono), "JetBrains Mono", monospace',
                  fontSize: 14,
                  flexShrink: 0,
                  userSelect: 'none',
                }}
              >
                &gt;
              </span>
              <input
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder="ask your kernel..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#f9fafb',
                  fontFamily: 'var(--font-mono), "JetBrains Mono", monospace',
                  fontSize: 13,
                  caretColor: '#dc2626',
                  minWidth: 0,
                }}
              />
              <button
                onClick={() => send()}
                style={{
                  background: 'transparent',
                  border: '1px solid #1f1f1f',
                  color: '#9ca3af',
                  fontFamily: 'system-ui, sans-serif',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  padding: '5px 14px',
                  cursor: 'pointer',
                  flexShrink: 0,
                  height: 32,
                }}
              >
                SEND ↵
              </button>
            </div>

            <div style={{ fontSize: 11, color: '#374151' }}>
              Try:{' '}
              <button
                onClick={() => send('who touched /etc/passwd?')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6b7280',
                  cursor: 'pointer',
                  fontSize: 11,
                  padding: 0,
                  fontFamily: 'inherit',
                }}
              >
                &quot;who touched /etc/passwd?&quot;
              </button>
              {' · '}
              <button
                onClick={() => send('what is unknown_4471 doing?')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6b7280',
                  cursor: 'pointer',
                  fontSize: 11,
                  padding: 0,
                  fontFamily: 'inherit',
                }}
              >
                &quot;what is unknown_4471 doing?&quot;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
