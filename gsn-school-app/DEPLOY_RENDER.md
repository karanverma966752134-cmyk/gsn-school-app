Render deployment - quick steps

1) Prepare local commit

```powershell
cd "c:\Users\DELL\OneDrive\Desktop\my app\gsn-school-app"
git add .
git commit -m "Prepare app for Render deployment: add render.yaml, .gitignore"
# If you don't have a remote, add one: git remote add origin <your-repo-url>
# Push to the branch defined in render.yaml (default: main)
git push origin main
```

2) Create the Render Web Service (two options)

Option A — via Render Dashboard (recommended):
- Sign in to https://dashboard.render.com
- New -> Web Service
- Connect your Git repo and select the `main` branch
- Build Command: `npm install`
- Start Command: `npm start`
- Environment: `Node`
- Set Environment Variables (Security):
  - `JWT_SECRET` = <your-secure-random-string>
  - (optional) `NODE_ENV=production`
  - (optional) `HOST=0.0.0.0`
- Create service and wait for build + deploy

Option B — via `render.yaml` (Infrastructure as Code):
- Ensure `render.yaml` is committed to the repo (already present)
- When creating the service in the Dashboard, choose the option to use the `render.yaml` file

3) Post-deploy checks

- Visit the service URL Render provides and verify `/api/dashboard` returns JSON.
- Login using seeded admin credentials if needed:
  - `staffId=GSN-A-001`, `password=password123`
- IMPORTANT: SQLite is ephemeral on Render. For production persistence, migrate to Postgres.

4) Optional: Add a managed Postgres service on Render and update the app
- I can help add a Postgres adapter and migration script if you want persistent storage.

If you want, I can:
- Push these changes to a remote (if you give me the remote URL and confirm),
- Or, walk you through the Render dashboard steps interactively.
