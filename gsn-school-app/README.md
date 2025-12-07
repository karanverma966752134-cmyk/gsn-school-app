GSN School App (local development)
=================================

Quick start
-----------

Prerequisites: Node.js (v16+ recommended) installed.

From the project root (`gsn-school-app`) you can start the server:

PowerShell (current session only):

```
$env:HOST='0.0.0.0'
$env:PORT='3001'
node server.js
```

Command Prompt (cmd.exe):

```
set HOST=0.0.0.0
set PORT=3001
node server.js
```

Use the helper scripts:

- `run-server.bat` — starts the watcher which restarts the server and writes logs to `logs/server.log`.
- `start-server.bat` — starts `server.js` directly.

Open the app in a browser on the server machine:

```
http://127.0.0.1:3001/
```

Allow LAN access (Windows firewall)
---------------------------------

If you want other devices on the same LAN to reach the site, add a firewall rule (requires Administrator):

PowerShell (Run as Administrator):

```
New-NetFirewallRule -DisplayName "GSN School App (3001)" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow -Profile Any
```

Alternatively allow the Node executable:

```
New-NetFirewallRule -DisplayName "GSN School App Node" -Direction Inbound -Program "C:\Program Files\nodejs\node.exe" -Action Allow -Profile Any
```

Testing from another LAN device
-------------------------------

From a Windows client:

```
Test-NetConnection -ComputerName <server-ip> -Port 3001 -InformationLevel Detailed
curl http://<server-ip>:3001/api/dashboard -v
```

From macOS/Linux:

```
nc -vz <server-ip> 3001
curl -v http://<server-ip>:3001/api/dashboard
```

Expose temporarily via localtunnel (no admin) — if outbound connections are allowed
---------------------------------------------------------------------------------

If you cannot change firewall or router settings you can expose the local server with `localtunnel` for a short test. This depends on outbound connectivity (some networks block it).

From Command Prompt (recommended to avoid PowerShell execution policy issues):

```
cd "C:\Users\<you>\OneDrive\Desktop\my app\gsn-school-app"
npx localtunnel --port 3001 --print-requests
```

The tool will print a public URL (`https://xxxx.loca.lt`). For API calls the tunnel may show an interstitial page; to bypass it for programmatic calls add the header `bypass-tunnel-reminder`:

```
curl -H "bypass-tunnel-reminder: 1" https://xxxx.loca.lt/api/dashboard
```

Notes
-----
- If the app reports `EADDRINUSE` when starting, another process is listening on the port — stop it or choose a different `PORT`.
- If client devices still cannot reach the server after opening the firewall, check router/AP settings for "Client Isolation" or "Guest Network" which prevent device-to-device traffic.
- For automated smoke tests the repo includes a Playwright test in `tests/smoke.test.js`; install browsers with `npm run test:smoke:install` and run `npm run test:smoke`.

If you'd like, I can add a short troubleshooting section for common Windows networking issues or create a one-click `.bat` that sets HOST/PORT and opens the firewall (requires Admin). Reply with "add bat" and I'll add it.

