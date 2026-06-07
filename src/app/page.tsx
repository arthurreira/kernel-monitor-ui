'use client'

import { useState, useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'
import { Warning, RadioButton } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

interface Health {
  cpu: number
  ram_used: number
  ram_total: number
  model: string
  backend: string
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
        borderRight: noBorder ? 'none' : '1px solid var(--km-border)',
      }}
    >
      <div style={{ fontSize: 9, color: 'var(--km-text-3)', letterSpacing: '0.12em', marginBottom: 6, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: red ? '#dc2626' : 'var(--km-text)', lineHeight: 1.1, marginBottom: 3 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--km-text-3)' }}>{sub}</div>
    </div>
  )
}

export default function KernelMonitor() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const [events, setEvents] = useState<KernelEvent[]>([])
  const [stats, setStats] = useState<KernelStats | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const [processFilter, setProcessFilter] = useState('')
  const [fileFilter, setFileFilter] = useState('')
  const [suspiciousOnly, setSuspiciousOnly] = useState(false)
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedRow, setSelectedRow] = useState<number | null>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  const filteredEvents = events.filter(ev => {
    if (suspiciousOnly && !isSensitive(ev.filename)) return false
    if (processFilter && !ev.process?.toLowerCase().includes(processFilter.toLowerCase())) return false
    if (fileFilter && !ev.filename?.toLowerCase().includes(fileFilter.toLowerCase())) return false
    return true
  })

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
    const pollHealth = async () => {
      try {
        const data = await fetch(`${API}/health`).then(r => r.json())
        setHealth(data)
      } catch {
        // retain last known health
      }
    }
    pollHealth()
    const interval = setInterval(pollHealth, 5000)
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

  const investigateRow = (ev: KernelEvent, idx: number) => {
    setSelectedRow(idx)
    send(`What is ${ev.process} doing with ${ev.filename ?? 'unknown file'}?`)
  }

  const isDark = theme === 'dark'

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        background: 'var(--km-bg)',
        color: 'var(--km-text)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── TOP BAR ── */}
      <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid var(--km-border)', flexShrink: 0 }}>
        {/* Wordmark + theme toggle */}
        <div
          style={{
            padding: '12px 24px',
            borderRight: '1px solid var(--km-border)',
            minWidth: 170,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <div style={{ fontSize: 9, color: 'var(--km-text-3)', letterSpacing: '0.12em' }}>
            EBPF · SYSCALL TRACE
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '0.04em', lineHeight: 1.15 }}>
              KERNEL
              <br />
              MONITOR
            </div>
            {mounted && (
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                style={{ marginBottom: 2, fontSize: 14 }}
              >
                {isDark ? '☀' : '●'}
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <StatBlock label="Events Today" value={stats?.total?.toLocaleString() ?? '—'} sub="total syscalls traced" />
        <StatBlock label="Most Active Process" value={stats?.top_process ?? '—'} sub="highest file open rate" />
        <StatBlock label="Suspicious Events" value={stats?.suspicious?.toLocaleString() ?? '—'} sub="sensitive path access" red />
        <StatBlock label="System Uptime" value={stats?.uptime ? formatUptime(stats.uptime) : '—'} sub={stats?.uptime ?? ''} noBorder />
      </div>

      {/* ── MAIN PANELS ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        {/* ── LEFT: EVENT FEED (40%) ── */}
        <div style={{ width: '40%', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--km-border)', overflow: 'hidden' }}>

          {/* Feed header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '7px 16px',
              borderBottom: '1px solid var(--km-border)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
              <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <RadioButton
                  className="animate-ping"
                  size={12}
                  weight="fill"
                  color="#dc2626"
                  style={{ position: 'absolute', opacity: 0.6 }}
                />
                <RadioButton size={12} weight="fill" color="#dc2626" style={{ position: 'relative', flexShrink: 0 }} />
              </span>
              <span style={{ color: '#dc2626', fontWeight: 700, letterSpacing: '0.08em' }}>LIVE</span>
              <span style={{ color: 'var(--km-text-dim)', margin: '0 1px' }}>/</span>
              <span style={{ color: 'var(--km-text-2)', letterSpacing: '0.05em' }}>EVENT FEED</span>
            </div>
            <Badge
              variant="outline"
              style={{
                fontSize: 10,
                color: 'var(--km-text-3)',
                borderColor: 'var(--km-border)',
                background: 'var(--km-surface)',
                fontFamily: 'var(--font-mono), "JetBrains Mono", monospace',
              }}
            >
              {filteredEvents.length} events
            </Badge>
          </div>

          {/* Filter bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 16px',
              borderBottom: '1px solid var(--km-border)',
              flexShrink: 0,
            }}
          >
            <Input
              value={processFilter}
              onChange={e => setProcessFilter(e.target.value)}
              placeholder="filter by process..."
              className="font-mono text-[11px] h-7"
              style={{ caretColor: '#dc2626' }}
            />
            <Input
              value={fileFilter}
              onChange={e => setFileFilter(e.target.value)}
              placeholder="filter by file..."
              className="font-mono text-[11px] h-7"
              style={{ caretColor: '#dc2626' }}
            />
            <Button
              variant={suspiciousOnly ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => setSuspiciousOnly(v => !v)}
              className="shrink-0 text-[10px] font-bold tracking-wide"
            >
              <Warning size={12} weight="fill" />
              suspicious
            </Button>
          </div>

          {/* Column headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '180px 160px 1fr',
              padding: '5px 16px',
              borderBottom: '1px solid var(--km-border)',
              flexShrink: 0,
            }}
          >
            {(['TIMESTAMP', 'PROCESS', 'FILE'] as const).map(h => (
              <span key={h} style={{ fontSize: 9, color: 'var(--km-text-faint)', letterSpacing: '0.1em' }}>{h}</span>
            ))}
          </div>

          {/* Scrollable event rows */}
          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            <ScrollArea className="h-full">
              {filteredEvents.map((ev, i) => {
                const alert = isSensitive(ev.filename)
                const isSelected = selectedRow === i
                return (
                  <div
                    key={i}
                    onClick={() => investigateRow(ev, i)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '180px 160px 1fr',
                      padding: '3px 16px',
                      background: isSelected
                        ? 'rgba(245, 158, 11, 0.08)'
                        : alert
                        ? 'var(--km-alert-row)'
                        : 'transparent',
                      borderBottom: '1px solid var(--km-row-sep)',
                      borderLeft: isSelected ? '2px solid #f59e0b' : '2px solid transparent',
                      fontFamily: 'var(--font-mono), "JetBrains Mono", monospace',
                      fontSize: 11,
                      alignItems: 'center',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ color: alert ? '#f87171' : 'var(--km-text-3)' }}>{ev.timestamp}</span>
                    <span style={{ color: alert ? '#fca5a5' : 'var(--km-text)', fontWeight: alert ? 600 : 400 }}>
                      {ev.process}[{ev.pid}]
                    </span>
                    <span style={{ color: alert ? '#f87171' : 'var(--km-text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
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
              flexDirection: 'column',
              padding: '10px 20px',
              borderBottom: '1px solid var(--km-border)',
              flexShrink: 0,
              gap: 5,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Kernel Assistant</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--km-green)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--km-green-dot)', display: 'inline-block', flexShrink: 0 }} />
                  monitoring active
                </div>
              </div>
              <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono), "JetBrains Mono", monospace', lineHeight: 1.5 }}>
                <div style={{ fontSize: 11, color: 'var(--km-text-3)' }}>kernel-sentinel</div>
                {health && (
                  <div style={{ fontSize: 10, color: '#6b7280' }}>{health.model} · local</div>
                )}
              </div>
            </div>

            {health && (
              <div style={{ fontFamily: 'var(--font-mono), "JetBrains Mono", monospace', fontSize: 11, color: 'var(--km-text-3)', lineHeight: 1.4 }}>
                CPU: {health.cpu}% · RAM: {health.ram_used} / {health.ram_total}GB · {health.model} · {health.backend}
              </div>
            )}
          </div>

          {/* Message area */}
          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            <ScrollArea className="h-full">
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.map((msg, i) =>
                  msg.role === 'ai' ? (
                    <div key={i} style={{ alignSelf: 'flex-start', maxWidth: '82%' }}>
                      <div style={{ border: '1px solid #dc2626', background: 'var(--km-ai-bg)', padding: '12px 16px', fontSize: 13, lineHeight: 1.65 }}>
                        <div style={{ fontSize: 9, color: '#dc2626', fontWeight: 700, letterSpacing: '0.14em', marginBottom: 8 }}>
                          KERNEL ASSISTANT
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap', color: 'var(--km-text)' }}>{msg.text}</div>
                      </div>
                    </div>
                  ) : (
                    <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '70%' }}>
                      <div style={{ background: 'var(--km-user-bg)', border: '1px solid var(--km-border)', padding: '8px 14px', fontSize: 13, lineHeight: 1.55, color: 'var(--km-text)' }}>
                        {msg.text}
                      </div>
                    </div>
                  )
                )}

                {loading && (
                  <div style={{ alignSelf: 'flex-start', maxWidth: '82%' }}>
                    <div style={{ border: '1px solid #dc2626', background: 'var(--km-ai-bg)', padding: '12px 16px', fontSize: 13 }}>
                      <div style={{ fontSize: 9, color: '#dc2626', fontWeight: 700, letterSpacing: '0.14em', marginBottom: 8 }}>KERNEL ASSISTANT</div>
                      <div style={{ color: 'var(--km-text-3)' }}>processing…</div>
                    </div>
                  </div>
                )}

                <div ref={chatBottomRef} />
              </div>
            </ScrollArea>
          </div>

          {/* Input bar */}
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--km-border)', flexShrink: 0, background: 'var(--km-bg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ color: '#dc2626', fontFamily: 'var(--font-mono), "JetBrains Mono", monospace', fontSize: 14, flexShrink: 0, userSelect: 'none' }}>
                &gt;
              </span>
              <Input
                value={question}
                onChange={e => { setQuestion(e.target.value); setSelectedRow(null) }}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder="ask your kernel..."
                className="font-mono text-[13px] border-none bg-transparent focus-visible:ring-0 focus-visible:border-0 h-8 px-0"
                style={{ caretColor: '#dc2626' }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => send()}
                className="shrink-0 font-bold tracking-wide text-[10px]"
              >
                SEND ↵
              </Button>
            </div>

            <div style={{ fontSize: 11, color: 'var(--km-text-dim)' }}>
              Try:{' '}
              <button
                onClick={() => send('who touched /etc/passwd?')}
                style={{ background: 'none', border: 'none', color: 'var(--km-text-3)', cursor: 'pointer', fontSize: 11, padding: 0, fontFamily: 'inherit' }}
              >
                &quot;who touched /etc/passwd?&quot;
              </button>
              {' · '}
              <button
                onClick={() => send('what is unknown_4471 doing?')}
                style={{ background: 'none', border: 'none', color: 'var(--km-text-3)', cursor: 'pointer', fontSize: 11, padding: 0, fontFamily: 'inherit' }}
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
