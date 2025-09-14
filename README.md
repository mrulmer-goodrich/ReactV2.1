# Serverless API for Academic Monitoring App

This adds **shared persistence** so anyone opening your website sees the same data (no more local-only).

## What this gives you
- `GET /api/load` → returns `{ data: <state or null> }`
- `POST /api/save` + JSON `{ data: <state> }` → stores the whole state
- Uses **Vercel KV** (a managed Redis) via `@vercel/kv`

Your `App.jsx` is already coded to **use these endpoints if present**, and otherwise fall back to localStorage.

---

## Monkey-proof steps 🐒 (just press the buttons)

### 1) Add these two files to your repo
Place them exactly like this:
```
/api/load.js
/api/save.js
```

### 2) Install the dependency
In your project folder (the one with `package.json`):
```
npm i @vercel/kv
```

### 3) Create a KV store in Vercel
- Go to **Vercel Dashboard → Storage → KV → Create**.
- Select your project (the site where this app is deployed).
- Vercel will inject these env vars into your project automatically:
  - `KV_REST_API_URL`
  - `KV_REST_API_TOKEN`
  - `KV_URL` (for non-Edge usage)

No manual `.env` editing required if you do it via the Vercel UI and link it to the project. If you prefer local dev with envs, add these to `.env.local`:

```
KV_URL=redis://... (optional for serverless; @vercel/kv uses REST vars)
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...
```

### 4) Redeploy
- Push the `/api` folder + your `package.json` change to the repo (or click **Deploy**).
- Vercel will build, install `@vercel/kv`, and the endpoints will be live at:
  - `https://<your-domain>/api/load`
  - `https://<your-domain>/api/save`

### 5) Smoke test (no code editing)
- Open your site → open **DevTools → Network**.
- You should see `/api/load` return `200` with `{ data: null }` on first run.
- Interact with the app (add a class/student/skill) → it will call `/api/save`.
- Refresh the site → `/api/load` should return your saved state.

That’s it. Your app is now **multi-user** and **persists for everyone**.

---

## Notes
- The storage key is `seating-monitor-v7-1`. If you ever want multiple datasets, change keys or add endpoints like `/api/save/<classId>`.\
- This is **global**: all visitors share the same state. If you want per-class or per-teacher isolation later, we can add auth + namespacing.
- Rate limits: KV is generous for small apps; we can add minimal debouncing if needed.
- Backups: use the app’s **Export** button regularly; that dumps the entire JSON.
