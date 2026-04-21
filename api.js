import axios from 'axios'

// ──────────────────────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────────────────────
// In dev with vite proxy (vite.config.js), use '/api'.
// In production point directly at your Prometheus server.
// Overridden at runtime via the URL input in the header.
// ──────────────────────────────────────────────────────────────

let BASE_URL = '/api'   // default — Vite proxies this to http://localhost:9090

export function setBaseUrl(url) {
  // Strip trailing slash and inject /api/v1 prefix
  BASE_URL = url.replace(/\/$/, '')
}

export function getBaseUrl() { return BASE_URL }

// ─── Core fetch helper ─────────────────────────────────────────
async function promFetch(path, params = {}) {
  const url = `${BASE_URL}${path}`
  const resp = await axios.get(url, { params, timeout: 8000 })
  if (resp.data.status !== 'success') throw new Error(resp.data.error || 'Prometheus error')
  return resp.data.data
}

// ─── Instant query ─────────────────────────────────────────────
// Returns: [{ metric: {}, value: [ts, "val"] }, ...]
export async function instantQuery(expr) {
  return promFetch('/api/v1/query', { query: expr })
}

// ─── Range query ───────────────────────────────────────────────
// Returns: [{ metric: {}, values: [[ts, "val"], ...] }, ...]
export async function rangeQuery(expr, start, end, step = '15s') {
  return promFetch('/api/v1/query_range', { query: expr, start, end, step })
}

// ─── Named metric helpers ──────────────────────────────────────

// Average CPU usage % per instance
export async function fetchCpuUsage() {
  const data = await instantQuery(
    '100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'
  )
  return data.result.map(m => ({
    instance: m.metric.instance,
    value: parseFloat(m.value[1]),
  }))
}

// Memory used % per instance
export async function fetchMemUsage() {
  const data = await instantQuery(
    '(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100'
  )
  return data.result.map(m => ({
    instance: m.metric.instance,
    value: parseFloat(m.value[1]),
  }))
}

// Root disk used % per instance
export async function fetchDiskUsage() {
  const data = await instantQuery(
    '(1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100'
  )
  return data.result.map(m => ({
    instance: m.metric.instance,
    value: parseFloat(m.value[1]),
  }))
}

// Network receive bytes/s per instance (non-loopback)
export async function fetchNetRx() {
  const data = await instantQuery(
    'sum by (instance) (rate(node_network_receive_bytes_total{device!="lo"}[5m]))'
  )
  return data.result.map(m => ({
    instance: m.metric.instance,
    value: parseFloat(m.value[1]),
  }))
}

// Network transmit bytes/s per instance
export async function fetchNetTx() {
  const data = await instantQuery(
    'sum by (instance) (rate(node_network_transmit_bytes_total{device!="lo"}[5m]))'
  )
  return data.result.map(m => ({
    instance: m.metric.instance,
    value: parseFloat(m.value[1]),
  }))
}

// 1-minute load average per instance
export async function fetchLoad() {
  const data = await instantQuery('node_load1')
  return data.result.map(m => ({
    instance: m.metric.instance,
    value: parseFloat(m.value[1]),
  }))
}

// Up/down status (1 = up, 0 = down)
export async function fetchUpStatus() {
  const data = await instantQuery('up{job="nagios"}')
  return data.result.map(m => ({
    instance: m.metric.instance,
    up: m.value[1] === '1',
  }))
}

// ─── Composite: all node metrics in one round-trip ─────────────
export async function fetchAllNodeMetrics() {
  const [cpu, mem, disk, netRx, netTx, load, upStatus] = await Promise.allSettled([
    fetchCpuUsage(),
    fetchMemUsage(),
    fetchDiskUsage(),
    fetchNetRx(),
    fetchNetTx(),
    fetchLoad(),
    fetchUpStatus(),
  ])

  // Build instance → metrics map
  const map = {}

  const safe = (r) => (r.status === 'fulfilled' ? r.value : [])

  safe(cpu).forEach(({ instance, value }) => {
    if (!map[instance]) map[instance] = { instance }
    map[instance].cpu = value
  })
  safe(mem).forEach(({ instance, value }) => {
    if (!map[instance]) map[instance] = { instance }
    map[instance].mem = value
  })
  safe(disk).forEach(({ instance, value }) => {
    if (!map[instance]) map[instance] = { instance }
    map[instance].disk = value
  })
  safe(netRx).forEach(({ instance, value }) => {
    if (!map[instance]) map[instance] = { instance }
    map[instance].netRx = value
  })
  safe(netTx).forEach(({ instance, value }) => {
    if (!map[instance]) map[instance] = { instance }
    map[instance].netTx = value
  })
  safe(load).forEach(({ instance, value }) => {
    if (!map[instance]) map[instance] = { instance }
    map[instance].load = value
  })
  safe(upStatus).forEach(({ instance, up }) => {
    if (!map[instance]) map[instance] = { instance }
    map[instance].up = up
  })

  // Default up=true for nodes seen in metrics but not in up{}
  Object.values(map).forEach(n => {
    if (n.up === undefined) n.up = true
  })

  return Object.values(map)
}

// ─── Range query helpers for charts ───────────────────────────
// Returns last `minutes` minutes of avg cluster CPU
export async function fetchCpuHistory(minutes = 30, step = '30s') {
  const end = Math.floor(Date.now() / 1000)
  const start = end - minutes * 60
  const data = await rangeQuery(
    '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
    start, end, step
  )
  return (data.result[0]?.values || []).map(([ts, val]) => ({
    ts: ts * 1000,
    value: parseFloat(parseFloat(val).toFixed(1)),
  }))
}

export async function fetchMemHistory(minutes = 30, step = '30s') {
  const end = Math.floor(Date.now() / 1000)
  const start = end - minutes * 60
  const data = await rangeQuery(
    'avg((1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100)',
    start, end, step
  )
  return (data.result[0]?.values || []).map(([ts, val]) => ({
    ts: ts * 1000,
    value: parseFloat(parseFloat(val).toFixed(1)),
  }))
}

// ─── Connectivity check ────────────────────────────────────────
export async function checkConnection(url) {
  const testUrl = `${url.replace(/\/$/, '')}/api/v1/query?query=up`
  const resp = await axios.get(testUrl, { timeout: 5000 })
  return resp.data.status === 'success'
}

// ─── Raw PromQL (used by Query tab) ───────────────────────────
export async function rawQuery(expr) {
  return promFetch('/api/v1/query', { query: expr })
}
