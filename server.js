// ============================================================
//  server.js  —  Dynamic Nagios → REST API Bridge
//  Auto-discovers ALL devices and services from perfdata log
//  Run:  node server.js
//  API:  http://localhost:3000/api/live
// ============================================================

const express = require('express');
const fs      = require('fs');
const path    = require('path');
const app     = express();

app.use(express.static('public'));

// ── Path to your Nagios perfdata file ───────────────────────
//  Change this if your file lives somewhere else
const STATUS_DAT = path.join(__dirname, 'status.dat');

// ── Live data cache ──────────────────────────────────────────
// Structure: { devices: { "hostname": { status, services: { "svcname": { status, metrics, output, timestamp } } } } }
let liveCache = {
  devices:     {},   // auto-populated from log
  lastUpdated: null,
  errors:      []
};

// ── Parse a single perfdata metric string ────────────────────
// e.g. "load1=1.560;5.000;10.000;0;"  →  { name:"load1", value:1.56, unit:"", warn:5, crit:10, min:0, max:null }
function parseMetrics(perfStr) {
  if (!perfStr) return [];
  const metrics = [];
  // Split on space but keep quoted strings intact
  const parts = perfStr.trim().split(/\s+/);
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const label = part.slice(0, eq).replace(/'/g, '');
    const rest  = part.slice(eq + 1);
    // rest format: value[UOM][;warn[;crit[;min[;max]]]]
    const m = rest.match(/^([+-]?[\d.]+(?:e[+-]?\d+)?)([a-zA-Z%]*)(?:;([^;]*);([^;]*);([^;]*);?([^;]*))?/);
    if (!m) continue;
    metrics.push({
      name:  label,
      value: parseFloat(m[1]),
      unit:  m[2] || '',
      warn:  m[3] ? parseFloat(m[3]) : null,
      crit:  m[4] ? parseFloat(m[4]) : null,
      min:   m[5] !== '' && m[5] != null ? parseFloat(m[5]) : null,
      max:   m[6] !== '' && m[6] != null ? parseFloat(m[6]) : null,
    });
  }
  return metrics;
}

// ── Detect status from output string ────────────────────────
function detectStatus(output) {
  const u = (output || '').toUpperCase();
  if (u.includes('CRITICAL') || u.includes('TIMED OUT')) return 'CRITICAL';
  if (u.includes('WARNING'))  return 'WARNING';
  if (u.includes('UNKNOWN'))  return 'UNKNOWN';
  if (u.includes('OK'))       return 'OK';
  return 'UNKNOWN';
}

// ── Main parser ──────────────────────────────────────────────
function scrapeNagios() {
  liveCache.errors = [];

  if (!fs.existsSync(STATUS_DAT)) {
    liveCache.errors.push('status.dat not found at: ' + STATUS_DAT);
    return;
  }

  let data;
  try {
    data = fs.readFileSync(STATUS_DAT, 'utf8');
  } catch (e) {
    liveCache.errors.push('Read error: ' + e.message);
    return;
  }

  const lines = data.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Nagios perfdata format (tab-separated):
    // [SERVICEPERFDATA] \t TIMESTAMP \t HOSTNAME \t SERVICEDESC \t EXECTIME \t LATENCY \t OUTPUT \t PERFDATA
    if (!line.startsWith('[SERVICEPERFDATA]')) continue;

    const cols = line.split('\t');
    // cols[0] = [SERVICEPERFDATA]
    // cols[1] = unix timestamp
    // cols[2] = hostname
    // cols[3] = service description
    // cols[4] = execution time
    // cols[5] = latency
    // cols[6] = output/status message
    // cols[7] = performance data (optional)

    if (cols.length < 7) continue;

    const timestamp = parseInt(cols[1]) || null;
    const hostname  = (cols[2] || '').trim();
    const svcName   = (cols[3] || '').trim();
    const output    = (cols[6] || '').trim();
    const perfRaw   = (cols[7] || '').trim();

    if (!hostname || !svcName) continue;

    const status  = detectStatus(output);
    const metrics = parseMetrics(perfRaw);

    // Auto-create device entry if not seen before
    if (!liveCache.devices[hostname]) {
      liveCache.devices[hostname] = {
        status:   'OK',
        services: {}
      };
    }

    const dev = liveCache.devices[hostname];

    // Upsert service entry
    dev.services[svcName] = {
      status,
      output,
      metrics,
      timestamp,
      perfRaw
    };

    // Roll up device status (worst wins)
    const rank = s => ({ CRITICAL: 3, WARNING: 2, UNKNOWN: 1, OK: 0 }[s] ?? 0);
    const worst = Object.values(dev.services).reduce((acc, s) => {
      return rank(s.status) > rank(acc) ? s.status : acc;
    }, 'OK');
    dev.status = worst;
  }

  liveCache.lastUpdated = new Date().toISOString();
}

// Poll every 2 seconds
scrapeNagios();
setInterval(scrapeNagios, 2000);

// ── API Routes ───────────────────────────────────────────────

// Full live data
app.get('/api/live', (req, res) => res.json(liveCache));

// Single device
app.get('/api/device/:hostname', (req, res) => {
  const dev = liveCache.devices[req.params.hostname];
  if (!dev) return res.status(404).json({ error: 'Device not found' });
  res.json(dev);
});

// Diagnostics
app.get('/api/status', (req, res) => res.json({
  fileExists:   fs.existsSync(STATUS_DAT),
  filePath:     STATUS_DAT,
  deviceCount:  Object.keys(liveCache.devices).length,
  errors:       liveCache.errors,
  lastUpdated:  liveCache.lastUpdated
}));

// ── Start ────────────────────────────────────────────────────
app.listen(3000, () => {
  console.log('');
  console.log('  ✅  Bridge running → http://localhost:3000');
  console.log('  📄  Reading file  → ' + STATUS_DAT);
  console.log('  🔄  Poll interval → 2 seconds');
  console.log('  🌐  Dynamic mode  → auto-discovers all devices & services');
  console.log('');
});