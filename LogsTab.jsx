import { useRef, useEffect, useState } from 'react'

const LEVEL_COLOR = {
  INFO: 'var(--blue)',
  WARN: 'var(--amber)',
  ERR:  'var(--red)',
}

export default function LogsTab({ logs }) {
  const [pinToBottom, setPinToBottom] = useState(true)
  const [filter,      setFilter]      = useState('ALL')
  const bottomRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (pinToBottom && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, pinToBottom])

  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30
    setPinToBottom(atBottom)
  }

  const filtered = filter === 'ALL' ? logs : logs.filter(l => l.level === filter)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div className="section-label" style={{ marginBottom: 0 }}>
          scrape event log — {logs.length} events
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {['ALL', 'INFO', 'WARN', 'ERR'].map(lvl => (
            <button
              key={lvl}
              onClick={() => setFilter(lvl)}
              style={{
                padding: '4px 12px', borderRadius: 4, fontSize: 11,
                fontFamily: 'var(--font-mono)', cursor: 'pointer', fontWeight: 600,
                border: '1px solid var(--border2)',
                background: filter === lvl ? LEVEL_COLOR[lvl] || 'var(--text)' : 'var(--bg3)',
                color: filter === lvl ? '#000' : LEVEL_COLOR[lvl] || 'var(--text2)',
                transition: 'all 0.12s',
              }}
            >
              {lvl}
            </button>
          ))}
          <button
            onClick={() => setPinToBottom(true)}
            style={{
              padding: '4px 12px', borderRadius: 4, fontSize: 11,
              fontFamily: 'var(--font-mono)', cursor: 'pointer',
              border: '1px solid var(--border2)',
              background: pinToBottom ? 'var(--greenDim)' : 'var(--bg3)',
              color: pinToBottom ? 'var(--green)' : 'var(--text2)',
            }}
          >
            ↓ Pin
          </button>
        </div>
      </div>

      {/* Log stream */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="log-stream"
        style={{ height: 420 }}
      >
        {!filtered.length ? (
          <div style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
            {logs.length ? 'No events match filter.' : 'Enable Simulate or Connect to generate log events.'}
          </div>
        ) : (
          [...filtered].reverse().map((l, i) => (
            <div key={l.id || i} style={{ display: 'flex', gap: 12, marginBottom: 4, lineHeight: 1.6 }}>
              <span style={{ color: 'var(--text3)', flexShrink: 0, minWidth: 80 }}>{l.ts}</span>
              <span style={{ color: LEVEL_COLOR[l.level] || 'var(--text2)', fontWeight: 600, flexShrink: 0, minWidth: 36 }}>
                [{l.level}]
              </span>
              <span style={{ color: 'var(--text2)' }}>{l.msg}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 20, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
        <span>total: {logs.length}</span>
        <span style={{ color: 'var(--blue)'  }}>INFO: {logs.filter(l => l.level === 'INFO').length}</span>
        <span style={{ color: 'var(--amber)' }}>WARN: {logs.filter(l => l.level === 'WARN').length}</span>
        <span style={{ color: 'var(--red)'   }}>ERR:  {logs.filter(l => l.level === 'ERR').length}</span>
        <span>showing: {filtered.length}</span>
      </div>
    </div>
  )
}
