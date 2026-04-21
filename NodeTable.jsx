import { useState } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

function fmtBytes(b) {
  if (!b) return '—'
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB/s`
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB/s`
  return `${b.toFixed(0)} B/s`
}

function MiniBar({ value = 0, warn = 70, crit = 85 }) {
  const color = value >= crit ? 'var(--red)' : value >= warn ? 'var(--amber)' : 'var(--green)'
  return (
    <div className="mini-bar-wrap">
      <div className="mini-bar">
        <div className="mini-bar-fill" style={{ width: `${Math.min(100, value)}%`, background: color }} />
      </div>
      <span style={{ color, minWidth: 38 }}>{value.toFixed(1)}%</span>
    </div>
  )
}

const COLS = [
  { key: 'instance', label: 'Node' },
  { key: 'up',       label: 'Status' },
  { key: 'cpu',      label: 'CPU' },
  { key: 'mem',      label: 'Memory' },
  { key: 'disk',     label: 'Disk' },
  { key: 'load',     label: 'Load 1m' },
  { key: 'netRx',    label: 'Net RX' },
  { key: 'netTx',    label: 'Net TX' },
]

export default function NodeTable({ nodes }) {
  const [sortKey, setSortKey]   = useState('instance')
  const [sortDir, setSortDir]   = useState('asc')
  const [filter,  setFilter]    = useState('')

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = nodes.filter(n =>
    n.instance?.toLowerCase().includes(filter.toLowerCase())
  )

  const sorted = [...filtered].sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey]
    if (sortKey === 'up') { av = av ? 1 : 0; bv = bv ? 1 : 0 }
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    return sortDir === 'asc' ? av - bv : bv - av
  })

  if (!nodes.length) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
        Connect to Prometheus or enable Simulate to see nodes.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div className="section-label" style={{ marginBottom: 0 }}>node inventory — {sorted.length} nodes</div>
        <input
          placeholder="Filter by hostname…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ width: 220, fontSize: 12 }}
        />
      </div>

      {/* Table */}
      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {COLS.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={{
                    padding: '11px 14px', textAlign: 'left', cursor: 'pointer',
                    fontSize: 10, color: sortKey === col.key ? 'var(--text)' : 'var(--text3)',
                    fontWeight: 600, letterSpacing: '0.9px', textTransform: 'uppercase',
                    userSelect: 'none', whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {col.label}
                    {sortKey === col.key
                      ? sortDir === 'asc'
                        ? <ArrowUp size={10} />
                        : <ArrowDown size={10} />
                      : <ArrowUpDown size={10} style={{ opacity: 0.3 }} />
                    }
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((n, i) => (
              <tr
                key={n.instance}
                style={{
                  borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none',
                  background: 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '11px 14px', color: 'var(--text)', fontWeight: 500 }}>{n.instance}</td>
                <td style={{ padding: '11px 14px' }}>
                  <span className={`badge badge-${n.up ? 'up' : 'down'}`}>
                    {n.up ? '▲ UP' : '▼ DOWN'}
                  </span>
                </td>
                <td style={{ padding: '11px 14px' }}><MiniBar value={n.cpu || 0} /></td>
                <td style={{ padding: '11px 14px' }}><MiniBar value={n.mem || 0} warn={70} crit={90} /></td>
                <td style={{ padding: '11px 14px' }}><MiniBar value={n.disk || 0} warn={70} crit={85} /></td>
                <td style={{ padding: '11px 14px', color: 'var(--text2)' }}>
                  {n.load !== undefined ? n.load.toFixed(2) : '—'}
                </td>
                <td style={{ padding: '11px 14px', color: 'var(--blue)' }}>{fmtBytes(n.netRx)}</td>
                <td style={{ padding: '11px 14px', color: 'var(--teal)' }}>{fmtBytes(n.netTx)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
