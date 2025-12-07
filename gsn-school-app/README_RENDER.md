Render Deployment Notes

1) Service settings
- Environment: "Web Service"
- Build Command: `npm install`
- Start Command: `npm start`
- Branch: choose your repo branch

2) Environment variables (set in Render dashboard -> Environment)
- `NODE_ENV=production` (optional)
- `JWT_SECRET` = a secure random string (required for production tokens)
- `HOST` = `0.0.0.0` (optional; code defaults to 0.0.0.0)
- Do NOT hardcode `PORT`; Render provides `PORT` automatically

3) SQLite considerations
- Render containers have ephemeral filesystems. Using SQLite (`db.sqlite`) means data will not persist across deploys or instance restarts.
- For production, migrate to a managed DB (Postgres, MySQL). If you need help migrating, I can add a minimal Postgres adapter and migration steps.

4) Verify after deploy
- Open the service URL and check `/api/dashboard` and `/api/students` endpoints.
- Use seeded admin credentials for initial login: `staffId=GSN-A-001`, `password=password123` (change `JWT_SECRET` first).

5) Logs & troubleshooting
- If the service fails to start, check Render Logs (Dashboard -> Service -> Logs). Look for the startup log line:
  "GSN Staff app running at http://<HOST>:<PORT>"

6) Quick tips
- To keep data between deploys, use an external DB.
- Set `JWT_SECRET` to a secure value before exposing the service publicly.

If you want, I can:
- Add a Postgres version of the DB helpers and schema migration script.
- Prepare a `render.yaml` for Render's Infrastructure as Code (optional).

Tell me which of those you'd like next.