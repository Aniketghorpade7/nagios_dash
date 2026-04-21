import { useState, useEffect, useRef, useCallback } from 'react'
import { Activity, Server, Terminal, Bell, ScrollText, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import {
  setBaseUrl, checkConnection,
  fetchAllNodeMetrics, fetchCpuHistory, fetchMemHistory,
} from './api.js'
import Overview   from './Overview.jsx'
import NodeTable  from './NodeTable.jsx'
import QueryTab   from './QueryTab.jsx'
import AlertsTab  from './AlertsTab.jsx'
import LogsTab    from './LogsTab.jsx'

// ─── Simulation helpers ─────────────────────────────────────────
const SIM_NODES = ['lab-node-01', 'lab-node-02', 'lab-node-03', 'lab-node-04', 'lab-node-05']
const SIM_LOG_MSGS = [
  ['INFO', 'Scrape complete — 5/5 targets'],
  ['INFO', 'TSDB compaction done'],
  ['INFO', 'WAL checkpoint written'],
  ['WARN', 'High CPU detected on lab-node-04'],
  ['ERR',  'lab-node-04: connection refused'],
  ['INFO', 'Metrics collected successfully'],
  ['WARN', 'Disk usage above 80% on lab-node-05'],
]

function simNodes() {
  const t = Date.now() / 1000
  return SIM_NODES.map((name, i) => ({
    instance: `${name}:9100`,
    cpu:  Math.min(99, Math.max(1, 28 + i * 6 + 14 * Math.sin(t / 28 + i) + 6 * (Math.random() - 0.5))),
    mem:  Math.min(99, Math.max(8, 42 + i * 4 + 10 * Math.cos(t / 40 + i) + 4 * (Math.random() - 0.5))),
    disk: Math.min(94, Math.max(5, 18 + i * 9 + 1.5 * Math.sin(t / 100 + i))),
    netRx: Math.random() * 250000 + 40000,
    netTx: Math.random() * 80000  + 10000,
    load:  Math.max(0, 0.5 + i * 0.3 + 0.4 * Math.sin(t / 20 + i) + 0.15 * (Math.random() - 0.5)),
    up:    !(i === 3 && Math.random() < 0.06),
  }))
}

function simHistory(buf, key, newVal) {
  const next = [...buf, { ts: Date.now(), value: Math.round(newVal * 10) / 10 }]
  return next.slice(-120)
}

function evalAlerts(nodes) {
  const list = []
  nodes.forEach(n => {
    if (!n.up)         list.push({ sev: 'critical', title: `${n.instance} is DOWN`, desc: 'Node exporter unreachable — check host or firewall' })
    else if (n.cpu > 85)  list.push({ sev: 'critical', title: `High CPU: ${n.instance}`, desc: `CPU at ${n.cpu.toFixed(1)}%` })
    else if (n.cpu > 70)  list.push({ sev: 'warn',     title: `Elevated CPU: ${n.instance}`, desc: `CPU at ${n.cpu.toFixed(1)}%` })
    if (n.mem > 90)    list.push({ sev: 'critical', title: `High MEM: ${n.instance}`, desc: `Memory at ${n.mem.toFixed(1)}%` })
    if (n.disk > 80)   list.push({ sev: 'warn',     title: `Disk filling: ${n.instance}`, desc: `Disk at ${n.disk.toFixed(1)}%` })
  })
  if (!list.length) list.push({ sev: 'ok', title: 'All systems nominal', desc: `${nodes.length} nodes healthy` })
  return list
}

const TABS = [
  { id: 'overview', label: 'Overview',  Icon: Activity  },
  { id: 'nodes',    label: 'Nodes',     Icon: Server    },
  { id: 'query',    label: 'Query',     Icon: Terminal  },
  { id: 'alerts',   label: 'Alerts',    Icon: Bell      },
  { id: 'logs',     label: 'Live Logs', Icon: ScrollText },
]

const INTERVALS = [
  { label: '5s',  ms: 5000  },
  { label: '10s', ms: 10000 },
  { label: '30s', ms: 30000 },
  { label: '1m',  ms: 60000 },
]

export default function App() {
  const [tab,        setTab]        = useState('overview')
  const [promUrl,    setPromUrl]    = useState('http://localhost:9090')
  const [intervalMs, setIntervalMs] = useState(10000)
  const [simMode,    setSimMode]    = useState(false)
  const [connStatus, setConnStatus] = useState('idle') // idle | connecting | live | error
  const [nodes,      setNodes]      = useState([])
  const [cpuHist,    setCpuHist]    = useState([])
  const [memHist,    setMemHist]    = useState([])
  const [alerts,     setAlerts]     = useState([])
  const [logs,       setLogs]       = useState([])
  const [lastPoll,   setLastPoll]   = useState(null)

  const intervalRef = useRef(null)

  // ─── Push log line ───────────────────────────────────────────
  const pushLog = useCallback((level, msg) => {
    setLogs(prev => [{
      ts: new Date().toLocaleTimeString(),
      level, msg,
      id: `${Date.now()}-${Math.random()}`,
    }, ...prev].slice(0, 300))
  }, [])

  // ─── Simulate tick ───────────────────────────────────────────
  const simTick = useCallback(() => {
    const ns = simNodes()
    setNodes(ns)
    setCpuHist(prev => simHistory(prev, 'cpu', ns.reduce((a, n) => a + n.cpu, 0) / ns.length))
    setMemHist(prev => simHistory(prev, 'mem', ns.reduce((a, n) => a + n.mem, 0) / ns.length))
    setAlerts(evalAlerts(ns))
    const pick = SIM_LOG_MSGS[Math.floor(Math.random() * SIM_LOG_MSGS.length)]
    pushLog(pick[0], pick[1])
    setLastPoll(new Date())
  }, [pushLog])

  // ─── Live poll ───────────────────────────────────────────────
  const liveTick = useCallback(async () => {
    try {
      const [ns, cpu, mem] = await Promise.all([
        fetchAllNodeMetrics(),
        fetchCpuHistory(30, '30s'),
        fetchMemHistory(30, '30s'),
      ])
      setNodes(ns)
      setCpuHist(cpu)
      setMemHist(mem)
      setAlerts(evalAlerts(ns))
      setLastPoll(new Date())
      pushLog('INFO', `Scraped ${ns.length} nodes successfully`)
    } catch (e) {
      setConnStatus('error')
      pushLog('ERR', e.message)
    }
  }, [pushLog])

  // ─── Polling engine ─────────────────────────────────────────
  const stopPolling = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }

  const startPolling = useCallback((mode) => {
    stopPolling()
    const tick = mode === 'sim' ? simTick : liveTick
    tick()
    intervalRef.current = setInterval(tick, intervalMs)
  }, [intervalMs, simTick, liveTick])

  useEffect(() => {
    if (simMode) startPolling('sim')
    else stopPolling()
    return stopPolling
  }, [simMode, intervalMs, startPolling])

  // ─── Connect ─────────────────────────────────────────────────
  async function connect() {
    setConnStatus('connecting')
    setSimMode(false)
    try {
      setBaseUrl(promUrl)
      await checkConnection(promUrl)
      setConnStatus('live')
      startPolling('live')
      pushLog('INFO', `Connected to ${promUrl}`)
    } catch (e) {
      setConnStatus('error')
      pushLog('ERR', `Connection failed: ${e.message}`)
    }
  }

  function toggleSim() {
    if (simMode) { setSimMode(false); stopPolling(); setConnStatus('idle') }
    else { setSimMode(true); setConnStatus('live') }
  }

  // ─── Status pill ─────────────────────────────────────────────
  const statusCfg = {
    idle:       { bg: 'var(--bg3)',      color: 'var(--text3)',  label: 'idle'        },
    connecting: { bg: 'var(--blueDim)',  color: 'var(--blue)',   label: 'connecting…' },
    live:       { bg: 'var(--greenDim)', color: 'var(--green)',  label: simMode ? 'simulated' : 'live' },
    error:      { bg: 'var(--redDim)',   color: 'var(--red)',    label: 'error'       },
  }[connStatus]

  const activeAlerts = alerts.filter(a => a.sev === 'critical').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 100, gap: 12, flexWrap: 'wrap',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 17, letterSpacing: '-0.4px', fontFamily: 'var(--font-display)', flexShrink: 0 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 8px var(--green)', display: 'inline-block' }} />
          LabWatch
          <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 13 }}>/ Prometheus</span>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={promUrl}
            onChange={e => setPromUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && connect()}
            placeholder="http://localhost:9090"
            style={{ width: 260, fontFamily: 'var(--font-mono)', fontSize: 12 }}
          />
          <select
            value={intervalMs}
            onChange={e => setIntervalMs(Number(e.target.value))}
            style={{ width: 72 }}
          >
            {INTERVALS.map(i => <option key={i.ms} value={i.ms}>{i.label}</option>)}
          </select>
          <button onClick={connect} style={{
            padding: '7px 14px', borderRadius: 6, fontFamily: 'var(--font-display)',
            fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none',
            background: 'var(--blue)', color: '#fff',
          }}>
            Connect
          </button>
          <button onClick={toggleSim} style={{
            padding: '7px 14px', borderRadius: 6, fontFamily: 'var(--font-display)',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
            background: simMode ? 'var(--purpleDim)' : 'var(--bg3)',
            color: simMode ? 'var(--purple)' : 'var(--text2)',
            border: `1px solid ${simMode ? 'var(--purple)' : 'var(--border2)'}`,
          }}>
            {simMode ? 'Stop Sim' : 'Simulate'}
          </button>
          {/* Status pill */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 20,
            background: statusCfg.bg, color: statusCfg.color,
            fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 500,
            border: `1px solid ${statusCfg.color}33`,
          }}>
            <span className="pulse-dot" style={{ background: statusCfg.color }} />
            {statusCfg.label}
          </div>
        </div>
      </header>

      {/* ── Tabs ───────────────────────────────────────────── */}
      <nav style={{
        display: 'flex', gap: 2, padding: '10px 24px 0',
        background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
      }}>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 16px', borderRadius: '6px 6px 0 0',
              fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.15s',
              background: tab === id ? 'var(--bg)' : 'transparent',
              color:      tab === id ? 'var(--text)' : 'var(--text2)',
              border:     tab === id ? '1px solid var(--border)' : '1px solid transparent',
              borderBottom: 'none',
              position: 'relative',
            }}
          >
            <Icon size={14} />
            {label}
            {id === 'alerts' && activeAlerts > 0 && (
              <span style={{
                position: 'absolute', top: 6, right: 6,
                width: 14, height: 14, borderRadius: '50%',
                background: 'var(--red)', color: '#fff',
                fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{activeAlerts}</span>
            )}
          </button>
        ))}
      </nav>

      {/* ── Content ────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: '20px 24px', overflow: 'auto' }} className="fade-in" key={tab}>
        {tab === 'overview' && <Overview nodes={nodes} cpuHist={cpuHist} memHist={memHist} alerts={alerts} intervalMs={intervalMs} />}
        {tab === 'nodes'    && <NodeTable nodes={nodes} />}
        {tab === 'query'    && <QueryTab promUrl={promUrl} simMode={simMode} />}
        {tab === 'alerts'   && <AlertsTab alerts={alerts} />}
        {tab === 'logs'     && <LogsTab logs={logs} />}
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer style={{
        padding: '8px 24px', background: 'var(--bg2)', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)',
      }}>
        <span>last poll: {lastPoll ? lastPoll.toLocaleTimeString() : '—'}</span>
        <span>PromQL via /api/v1/query — enable CORS: --web.cors.origin=".*"</span>
        <span>interval: {intervalMs / 1000}s</span>
      </footer>
    </div>
  )
}
