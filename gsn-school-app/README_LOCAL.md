# GSN School App — Quick Local Run & Tests

This short README explains how to run the app locally on Windows, run the smoke tests, and common troubleshooting steps.

## Prerequisites

- Node.js (v16+ recommended)
- Git (optional)

## Quick start (local)

1. Open PowerShell in the project root (`gsn-school-app`).
2. Start the server (defaults: `HOST=127.0.0.1`, `PORT=3001`):

```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force
$env:HOST = '127.0.0.1'
$env:PORT = '3001'
npm start
```

## Helper scripts

- `run-server.bat` — runs the watcher script which restarts the server on exit.
- `start-server.bat` — starts `server.js` directly (sets `HOST=127.0.0.1` by default).
- `tools/start-server-admin.ps1` — elevated helper that can add a Windows firewall rule and start the server (requires Administrator).

Open the app in a browser on the server machine:

```
http://127.0.0.1:3001/
```

## Running tests (Playwright smoke)

The repo includes a Playwright smoke test at `tests/smoke.test.js`.

1. Install Playwright test runner (if not already done):

```powershell
npm install
npm install -D @playwright/test
npx playwright install
```

2. Run the smoke test:

```powershell
npm run test:smoke
```

> Note: Playwright downloads browser binaries (100s of MB); make sure outbound downloads are allowed.

## Seeded credentials

The server seeds example accounts on first run. Use the following to test login:

- staffId: `GSN-T-001`
- password: `password123`

## Troubleshooting

- `EADDRINUSE`: port already in use — stop the conflicting process or change `PORT`.
- Windows Firewall: to allow LAN access add an inbound rule (Admin PowerShell):

```powershell
New-NetFirewallRule -DisplayName "GSN School App (3001)" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow -Profile Any
```

- If other LAN devices still can't reach the server, check router/AP settings for "Client Isolation" or "Guest Network".

If you want a concise, one-click `.bat` to set HOST/PORT and add the firewall rule (Admin), tell me and I'll add it.

---

Last verified: server started and API endpoints (`/api/dashboard`, `/api/login`) responded correctly.
