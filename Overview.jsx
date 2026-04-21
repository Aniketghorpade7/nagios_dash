import MetricChart from './Chart.jsx'

function statColor(val, warn = 70, crit = 85) {
  if (val >= crit) return 'var(--red)'
  if (val >= warn) return 'var(--amber)'
  return 'var(--green)'
}

function avg(nodes, key) {
  if (!nodes.length) return 0
  return nodes.reduce((a, n) => a + (n[key] || 0), 0) / nodes.length
}

function StatCard({ label, value, unit = '', color, sub }) {
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '14px 18px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: color,
      }} />
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)',
        letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 8,
      }}>{label}</div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700,
        color, lineHeight: 1,
      }}>
        {typeof value === 'number' ? value.toFixed(0) : value}
        <span style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 400 }}>{unit}</span>
      </div>
      {sub && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

export default function Overview({ nodes, cpuHist, memHist, alerts, intervalMs }) {
  const upCount     = nodes.filter(n => n.up).length
  const totalCount  = nodes.length
  const avgCpu      = avg(nodes, 'cpu')
  const avgMem      = avg(nodes, 'mem')
  const critAlerts  = alerts.filter(a => a.sev === 'critical').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Summary cards ───────────────────────────────────── */}
      <div>
        <div className="section-label">cluster summary</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <StatCard
            label="Nodes Up"
            value={`${upCount}/${totalCount}`}
            color={upCount === totalCount ? 'var(--green)' : 'var(--red)'}
            sub="node_exporter targets"
          />
          <StatCard
            label="Avg CPU"
            value={avgCpu}
            unit="%"
            color={statColor(avgCpu)}
            sub="cluster average"
          />
          <StatCard
            label="Avg Memory"
            value={avgMem}
            unit="%"
            color={statColor(avgMem, 70, 90)}
            sub="cluster average"
          />
          <StatCard
            label="Critical Alerts"
            value={critAlerts}
            color={critAlerts > 0 ? 'var(--red)' : 'var(--green)'}
            sub="firing right now"
          />
          <StatCard
            label="Poll Interval"
            value={intervalMs / 1000}
            unit="s"
            color="var(--blue)"
            sub="scrape cadence"
          />
          <StatCard
            label="History Points"
            value={cpuHist.length}
            color="var(--purple)"
            sub="in rolling buffer"
          />
        </div>
      </div>

      {/* ── Line charts ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="panel">
          <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="panel-title">avg CPU % — 30 min</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
              {avgCpu.toFixed(1)}% now
            </span>
          </div>
          <MetricChart data={cpuHist} color="#3b82f6" label="CPU %" />
        </div>
        <div className="panel">
          <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="panel-title">avg memory % — 30 min</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)' }}>
              {avgMem.toFixed(1)}% now
            </span>
          </div>
          <MetricChart data={memHist} color="#a78bfa" label="Mem %" />
        </div>
      </div>

      {/* ── Per-node CPU snapshot bar chart ─────────────────── */}
      {nodes.length > 0 && (
        <div className="panel">
          <div style={{ marginBottom: 14 }}>
            <span className="panel-title">per-node CPU snapshot</span>
          </div>
          <MetricChart
            data={nodes.map(n => ({ ts: n.instance, value: parseFloat(n.cpu.toFixed(1)) }))}
            color="#22d45a"
            label="CPU %"
            type="bar"
            colorFn={v => statColor(v)}
          />
        </div>
      )}

      {/* ── Active alerts summary ────────────────────────────── */}
      {alerts.length > 0 && (
        <div>
          <div className="section-label">active alerts</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {alerts.slice(0, 5).map((a, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 7,
                background: a.sev === 'critical' ? 'var(--redDim)' : a.sev === 'warn' ? 'var(--amberDim)' : 'var(--greenDim)',
                border: `1px solid ${a.sev === 'critical' ? 'var(--red)' : a.sev === 'warn' ? 'var(--amber)' : 'var(--green)'}`,
                color: a.sev === 'critical' ? 'var(--red)' : a.sev === 'warn' ? 'var(--amber)' : 'var(--green)',
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700 }}>
                  {a.sev.toUpperCase()}
                </span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--text)', flex: 1 }}>
                  {a.title}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)' }}>
                  {a.desc}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
