const ICON = { critical: '▲', warn: '●', ok: '✓', info: 'ℹ' }

const SEV_STYLE = {
  critical: { bg: 'var(--redDim)',   border: 'var(--red)',   text: 'var(--red)'   },
  warn:     { bg: 'var(--amberDim)', border: 'var(--amber)', text: 'var(--amber)' },
  ok:       { bg: 'var(--greenDim)', border: 'var(--green)', text: 'var(--green)' },
  info:     { bg: 'var(--blueDim)',  border: 'var(--blue)',  text: 'var(--blue)'  },
}

export default function AlertsTab({ alerts }) {
  const critical = alerts.filter(a => a.sev === 'critical')
  const warn     = alerts.filter(a => a.sev === 'warn')
  const ok       = alerts.filter(a => a.sev === 'ok')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Critical', count: critical.length, sev: 'critical' },
          { label: 'Warning',  count: warn.length,     sev: 'warn'     },
          { label: 'OK',       count: ok.length,       sev: 'ok'       },
        ].map(s => {
          const st = SEV_STYLE[s.sev]
          return (
            <div key={s.label} style={{
              background: st.bg, border: `1px solid ${st.border}`,
              borderRadius: 10, padding: '14px 18px', textAlign: 'center',
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: st.text, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>
                {s.label}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 700, color: st.text, lineHeight: 1 }}>
                {s.count}
              </div>
            </div>
          )
        })}
      </div>

      {/* Alert list */}
      <div>
        <div className="section-label">alert conditions</div>
        {!alerts.length ? (
          <div className="panel" style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
            start polling to evaluate alerts
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alerts.map((a, i) => {
              const st = SEV_STYLE[a.sev] || SEV_STYLE.info
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                  padding: '12px 16px', borderRadius: 8,
                  background: st.bg, border: `1px solid ${st.border}`,
                }}>
                  <span style={{ fontSize: 14, color: st.text, flexShrink: 0, marginTop: 1, fontFamily: 'var(--font-mono)' }}>
                    {ICON[a.sev] || 'ℹ'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 3 }}>
                      {a.title}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)' }}>
                      {a.desc}
                    </div>
                  </div>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 10,
                    fontFamily: 'var(--font-mono)', fontWeight: 700,
                    background: st.border + '22', color: st.text,
                    border: `1px solid ${st.border}`, flexShrink: 0,
                  }}>
                    {a.sev.toUpperCase()}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Threshold reference */}
      <div className="panel">
        <div style={{ marginBottom: 12 }} className="panel-title">alert thresholds (configurable in App.jsx)</div>
        <table style={{ width: '100%', fontSize: 12, fontFamily: 'var(--font-mono)', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text3)', fontWeight: 600 }}>Metric</th>
              <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--amber)', fontWeight: 600 }}>Warning</th>
              <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--red)', fontWeight: 600 }}>Critical</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['CPU %',     '> 70%', '> 85%'],
              ['Memory %',  '—',     '> 90%'],
              ['Disk %',    '> 80%', '—'],
              ['Node up',   '—',     'down'],
            ].map(([m, w, c]) => (
              <tr key={m} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 10px', color: 'var(--text2)' }}>{m}</td>
                <td style={{ padding: '8px 10px', color: 'var(--amber)' }}>{w}</td>
                <td style={{ padding: '8px 10px', color: 'var(--red)' }}>{c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
