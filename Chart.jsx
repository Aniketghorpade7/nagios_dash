import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine,
} from 'recharts'

// Format bytes to human-readable
function fmtBytes(bytes) {
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB/s`
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB/s`
  return `${bytes.toFixed(0)} B/s`
}

// Custom tooltip
function CustomTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value
  return (
    <div style={{
      background: '#1a1e28', border: '1px solid #2a2f42',
      borderRadius: 6, padding: '8px 12px',
      fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#e2e6f0',
    }}>
      <div style={{ color: '#8891aa', marginBottom: 4 }}>{label}</div>
      <div style={{ color: payload[0]?.color || '#22d45a', fontWeight: 600 }}>
        {typeof val === 'number' ? `${val.toFixed(1)}${unit}` : val}
      </div>
    </div>
  )
}

// Format timestamp for X axis
function fmtTs(ts) {
  if (typeof ts === 'string') return ts.length > 14 ? ts.slice(-8) : ts
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// Tick color constants
const TICK_STYLE = { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: '#4a5268' }
const GRID_COLOR = '#2a2f42'

export default function MetricChart({
  data = [],
  color = '#3b82f6',
  label = 'value',
  unit = '%',
  type = 'line',    // 'line' | 'bar'
  colorFn = null,   // optional fn(value) => color string for bars
  height = 180,
  warn = 70,
  crit = 85,
  showRefLines = false,
}) {
  if (!data.length) {
    return (
      <div style={{
        height, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#4a5268',
      }}>
        no data — connect or enable simulate
      </div>
    )
  }

  // Normalise data: each point is { ts, value }
  const pts = data.map(d => ({ ts: d.ts, value: d.value }))

  if (type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={pts} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
          <XAxis dataKey="ts" tick={TICK_STYLE} tickFormatter={fmtTs} interval="preserveStartEnd" />
          <YAxis tick={TICK_STYLE} domain={[0, 100]} tickFormatter={v => `${v}%`} />
          <Tooltip content={<CustomTooltip unit={unit} />} />
          {showRefLines && <>
            <ReferenceLine y={warn} stroke="#f59e0b" strokeDasharray="4 3" label={{ value: 'warn', fill: '#f59e0b', fontSize: 10 }} />
            <ReferenceLine y={crit} stroke="#ef4444" strokeDasharray="4 3" label={{ value: 'crit', fill: '#ef4444', fontSize: 10 }} />
          </>}
          <Bar dataKey="value" radius={[3, 3, 0, 0]}>
            {pts.map((entry, i) => (
              <Cell
                key={i}
                fill={colorFn ? colorFn(entry.value) : color}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={pts} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey="ts"
          tick={TICK_STYLE}
          tickFormatter={fmtTs}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={TICK_STYLE}
          domain={[0, 105]}
          tickFormatter={v => unit === '%' ? `${v}%` : v}
        />
        <Tooltip content={<CustomTooltip unit={unit} />} />
        {showRefLines && <>
          <ReferenceLine y={warn} stroke="#f59e0b66" strokeDasharray="4 3" />
          <ReferenceLine y={crit} stroke="#ef444466" strokeDasharray="4 3" />
        </>}
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: color }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
