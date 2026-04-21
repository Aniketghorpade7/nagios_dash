# LabWatch — Prometheus Dashboard

A production-grade React dashboard for your Prometheus + node_exporter lab.

## Project structure

```
prometheus-dashboard/
├── prometheus/
│   └── prometheus.yml          # Prometheus config — edit targets here
└── frontend/
    ├── package.json
    ├── vite.config.js           # Dev proxy: /api → localhost:9090
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── main.jsx             # React entry point
        ├── App.jsx              # Root: header, tabs, polling engine, state
        ├── api.js               # All Prometheus API calls (Axios)
        ├── styles.css           # Global dark theme, CSS variables
        └── components/
            ├── Overview.jsx     # Stat cards + Recharts line/bar charts
            ├── Chart.jsx        # Recharts wrapper (line + bar)
            ├── NodeTable.jsx    # Sortable/filterable node inventory
            ├── QueryTab.jsx     # PromQL console with presets
            ├── AlertsTab.jsx    # Alert conditions + threshold reference
            └── LogsTab.jsx      # Live scrape event log
```

---

## Step 1 — Prometheus setup

### Install Prometheus
```bash
# Download latest from https://prometheus.io/download/
wget https://github.com/prometheus/prometheus/releases/download/v2.52.0/prometheus-2.52.0.linux-amd64.tar.gz
tar xvf prometheus-*.tar.gz
cd prometheus-*/
```

### Install node_exporter on every lab machine
```bash
wget https://github.com/prometheus/node_exporter/releases/download/v1.8.0/node_exporter-1.8.0.linux-amd64.tar.gz
tar xvf node_exporter-*.tar.gz
cd node_exporter-*/
./node_exporter &
```
node_exporter runs on **port 9100** by default.

### Edit prometheus.yml
Open `prometheus/prometheus.yml` and replace the targets with your actual lab machine IPs:
```yaml
- targets:
    - '192.168.1.10:9100'
    - '192.168.1.11:9100'
    - '192.168.1.12:9100'
```

### Run Prometheus with CORS enabled (required for browser fetch)
```bash
./prometheus \
  --config.file=../prometheus-dashboard/prometheus/prometheus.yml \
  --web.cors.origin=".*" \
  --web.enable-admin-api
```

Verify at: **http://localhost:9090** → Status → Targets

---

## Step 2 — Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**

In development, Vite proxies `/api` to `http://localhost:9090` so you avoid CORS issues.

---

## Step 3 — Connect

1. Enter your Prometheus URL in the header input (e.g. `http://192.168.1.5:9090`)
2. Click **Connect**
3. The dashboard polls every 10s (configurable) and updates all tabs live

Or click **Simulate** to see the full UI with fake data — no Prometheus needed.

---

## Production build

```bash
npm run build
# Serve the dist/ folder with any static server or nginx
npx serve dist
```

Point the `VITE_PROM_URL` env var at your Prometheus instance or update the default in `api.js`.

---

## Customising alert thresholds

Edit `evalAlerts()` in `src/App.jsx`:
```js
if (n.cpu > 85)  // critical CPU threshold
if (n.cpu > 70)  // warning CPU threshold
if (n.mem > 90)  // critical memory threshold
if (n.disk > 80) // warning disk threshold
```

## Adding new metrics

1. Add a fetch function in `src/api.js` (follow the existing pattern)
2. Call it inside `fetchAllNodeMetrics()` and add the result to the node map
3. Display it in `NodeTable.jsx` or add a new chart in `Overview.jsx`

---

## Tech stack

| Layer       | Library                          |
|-------------|----------------------------------|
| Framework   | React 18 + Vite                  |
| Charts      | Recharts                         |
| HTTP        | Axios                            |
| Icons       | Lucide React                     |
| Styling     | Tailwind CSS + CSS variables     |
| Data source | Prometheus HTTP API /api/v1      |
| Agents      | node_exporter on each lab host   |
