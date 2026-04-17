# Nagios Live Dashboard — Setup & Integration Guide

## Project Structure

```
nagios-dashboard/
├── server.js          ← Node.js backend (reads status.dat, exposes API)
├── package.json       ← Dependencies
├── status.dat         ← Your Nagios log file (or symlink to it)
└── public/
    └── index.html     ← Dashboard frontend (auto-polls every 2s)
```

---

## STEP 1 — Install Node.js (if not already installed)

```bash
# Ubuntu / Debian (your Nagios server likely runs this)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version   # should say v20.x.x
npm --version    # should say 10.x.x
```

---

## STEP 2 — Copy the project to your server

Upload the entire `nagios-dashboard/` folder to your server.
Place it anywhere, for example: `/home/youruser/nagios-dashboard/`

```bash
scp -r nagios-dashboard/ youruser@your-server-ip:/home/youruser/
```

---

## STEP 3 — Install dependencies

```bash
cd /home/youruser/nagios-dashboard
npm install
```

This installs Express (the only dependency).

---

## STEP 4 — Connect your real Nagios status.dat

**Find where Nagios writes its perfdata log:**

```bash
# Common locations — check which one exists on your system:
ls /var/log/nagios/service-perfdata.log
ls /usr/local/nagios/var/service-perfdata
ls /var/nagios/service-perfdata.log
ls /var/log/nagios4/service-perfdata.log
```

Once you find it, you have two options:

### Option A — Symlink (recommended)
This makes server.js always read the live file without copying.

```bash
# Remove the sample file first
rm /home/youruser/nagios-dashboard/status.dat

# Create a symlink pointing to the real file
ln -s /var/log/nagios/service-perfdata.log \
      /home/youruser/nagios-dashboard/status.dat
```

### Option B — Change the path in server.js
Open `server.js` and update this line near the top:

```javascript
// Change this:
const STATUS_DAT = path.join(__dirname, 'status.dat');

// To the real path:
const STATUS_DAT = '/var/log/nagios/service-perfdata.log';
```

---

## STEP 5 — Make sure Node.js can read the file

```bash
# Check the file permissions
ls -la /var/log/nagios/service-perfdata.log

# If it's owned by nagios and Node runs as your user, add read permission:
sudo chmod o+r /var/log/nagios/service-perfdata.log

# Or run node as the nagios user (less recommended):
sudo -u nagios node server.js
```

---

## STEP 6 — Configure Nagios to write perfdata (if not already enabled)

In your `nagios.cfg`, make sure these lines are set:

```
process_performance_data=1
service_perfdata_file=/var/log/nagios/service-perfdata.log
service_perfdata_file_template=[SERVICEPERFDATA]\t$TIMET$\t$HOSTNAME$\t$SERVICEDESC$\t$SERVICEEXECUTIONTIME$\t$SERVICELATENCY$\t$SERVICEOUTPUT$\t$SERVICEPERFDATA$
service_perfdata_file_mode=a
service_perfdata_file_processing_interval=0
```

Then restart Nagios:
```bash
sudo systemctl restart nagios
# or
sudo service nagios4 restart
```

---

## STEP 7 — Start the dashboard

```bash
cd /home/youruser/nagios-dashboard
node server.js
```

You should see:
```
  ✅  Bridge running → http://localhost:3000
  📄  Reading file  → /home/youruser/nagios-dashboard/status.dat
  🔄  Poll interval → 2 seconds
```

Open your browser: **http://your-server-ip:3000**

---

## STEP 8 — Verify the API is working

In your browser or with curl:

```bash
# Check what data is being parsed
curl http://localhost:3000/api/live | python3 -m json.tool

# Check if the file is being found
curl http://localhost:3000/api/status
```

If `errors` array is empty and `lastUpdated` is recent — everything is working.

---

## STEP 9 — Keep it running permanently (optional)

```bash
# Install PM2 (process manager)
npm install -g pm2

# Start the dashboard with PM2
pm2 start server.js --name nagios-dashboard

# Auto-restart on server reboot
pm2 startup
pm2 save
```

---

## Adding a new metric

**Example: add Memory Usage**

1. In `server.js`, inside `scrapeNagios()`, add:
```javascript
if (line.includes('localhost') && line.includes('Memory Usage')) {
  const m = line.match(/mem=([\d.]+)/);
  if (m) liveCache.localhost.memUsedMB = parseFloat(m[1]);
}
```

2. In `public/index.html`, add a stat card:
```html
<div class="stat-card">
  <div class="stat-label">Memory Used</div>
  <div class="stat-value" id="v-mem">—</div>
  <div class="stat-sub">MB</div>
</div>
```

3. In the `fetchAndUpdate()` JS function, add:
```javascript
document.getElementById('v-mem').textContent =
  l.memUsedMB !== null ? l.memUsedMB + ' MB' : '—';
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Dashboard shows "Disconnected" | Run `node server.js` first |
| All values show `—` | Check `/api/status` for errors |
| File not found error | Update `STATUS_DAT` path in server.js |
| Permission denied | `sudo chmod o+r <your-perfdata-file>` |
| Port 3000 blocked | Open firewall: `sudo ufw allow 3000` |
| Values never update | Check Nagios has `process_performance_data=1` |
