import axios from 'axios'

let BASE_URL = '/api' 

export function setBaseUrl(url) {
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

export async function instantQuery(expr) {
  return promFetch('/api/v1/query', { query: expr })
}

export async function rangeQuery(expr, start, end, step = '15s') {
  return promFetch('/api/v1/query_range', { query: expr, start, end, step })
}

// ─── Connectivity check ────────────────────────────────────────
export async function checkConnection(url) {
  const testUrl = `${url.replace(/\/$/, '')}/api/v1/query?query=up`
  const resp = await axios.get(testUrl, { timeout: 5000 })
  return resp.data.status === 'success'
}

// ─── Safe Nagios Metric Fetcher ────────────────────────────────
export async function fetchAllNodeMetrics() {
  // Querying specifically for the Nagios job
  const data = await instantQuery('up{job="nagios"}')

  return data.result.map(m => {
    // Safely extract the target's name no matter what label the exporter uses
    // This prevents the undefined crash in NodeTable.jsx!
    const nodeName = m.metric.instance || m.metric.host || m.metric.name || 'Unknown Target'

    return {
      instance: nodeName,
      up: m.value[1] === '1',
      // Zero out the hardware stats since Nagios doesn't provide them
      cpu: 0,
      mem: 0,
      disk: 0,
      netRx: 0,
      netTx: 0,
      load: 0
    }
  })
}

// ─── Empty History Helpers to Prevent Chart Crashes ────────────
export async function fetchCpuHistory(minutes = 30, step = '30s') {
  return [] 
}

export async function fetchMemHistory(minutes = 30, step = '30s') {
  return [] 
}

// ─── Raw PromQL ────────────────────────────────────────────────
export async function rawQuery(expr) {
  return promFetch('/api/v1/query', { query: expr })
}