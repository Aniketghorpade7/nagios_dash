import { useState } from 'react'
import { rawQuery } from './api.js'
import { setBaseUrl } from './api.js'

const PRESETS = [
  { label: 'Node CPU (idle)',        q: 'rate(node_cpu_seconds_total{mode="idle"}[5m])' },
  { label: 'Avg CPU %',             q: '100 - (avg by(instance)(rate(node_cpu_seconds_total{mode="idle"}[5m]))*100)' },
  { label: 'Memory used %',         q: '(1 - node_memory_MemAvailable_bytes/node_memory_MemTotal_bytes)*100' },
  { label: 'Disk used %',           q: '(1 - node_filesystem_avail_bytes{mountpoint="/"}/node_filesystem_size_bytes{mountpoint="/"})*100' },
  { label: 'Net RX bytes/s',        q: 'rate(node_network_receive_bytes_total{device!="lo"}[5m])' },
  { label: 'Net TX bytes/s',        q: 'rate(node_network_transmit_bytes_total{device!="lo"}[5m])' },
  { label: 'Load average 1m',       q: 'node_load1' },
  { label: 'Open file descriptors', q: 'node_filefd_allocated' },
  { label: 'Up status',             q: 'up{job="node_exporter"}' },
  { label: 'Prometheus itself',     q: 'up{job="prometheus"}' },
]

// Fake sim response
function fakeResult(q) {
  return {
    status: 'success',
    data: {
      resultType: 'vector',
      result: [
        { metric: { instance: 'lab-node-01:9100', job: 'node_exporter' }, value: [Date.now() / 1000, String((Math.random() * 100).toFixed(4))] },
        { metric: { instance: 'lab-node-02:9100', job: 'node_exporter' }, value: [Date.now() / 1000, String((Math.random() * 100).toFixed(4))] },
      ],
    },
  }
}

export default function QueryTab({ promUrl, simMode }) {
  const [query,   setQuery]   = useState('node_load1')
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  async function run() {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      if (simMode) {
        await new Promise(r => setTimeout(r, 180))
        setResult(fakeResult(query))
      } else {
        setBaseUrl(promUrl)
        const data = await rawQuery(query)
        setResult({ status: 'success', data })
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div className="section-label">PromQL query console</div>

      <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Query input */}
        <textarea
          className="query-textarea"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Enter PromQL expression… (Ctrl+Enter to run)"
          rows={3}
        />

        {/* Presets */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => setQuery(p.q)}
              style={{
                padding: '4px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                fontFamily: 'var(--font-mono)', border: '1px solid var(--border2)',
                background: query === p.q ? 'var(--blueDim)' : 'var(--bg3)',
                color: query === p.q ? 'var(--blue)' : 'var(--text2)',
                transition: 'all 0.12s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Run button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={run}
            disabled={loading}
            style={{
              padding: '8px 20px', borderRadius: 6, fontFamily: 'var(--font-display)',
              fontSize: 13, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
              border: 'none', background: loading ? 'var(--bg4)' : 'var(--blue)',
              color: loading ? 'var(--text3)' : '#fff',
            }}
          >
            {loading ? 'Running…' : 'Run Query'}
          </button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
            Ctrl+Enter to run
          </span>
          {simMode && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--purple)', background: 'var(--purpleDim)', padding: '3px 8px', borderRadius: 4 }}>
              simulated response
            </span>
          )}
        </div>
      </div>

      {/* Result */}
      {error && (
        <div style={{
          background: 'var(--redDim)', border: '1px solid var(--red)', borderRadius: 8,
          padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--red)',
        }}>
          Error: {error}
        </div>
      )}
      {result && (
        <div className="panel" style={{ padding: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="panel-title">result</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
              {result.data?.result?.length ?? 0} series — type: {result.data?.resultType}
            </span>
          </div>
          <pre className="query-result" style={{ margin: 0, borderRadius: '0 0 10px 10px' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
