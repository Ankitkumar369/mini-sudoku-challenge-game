# Mini Sudoko challenge game

End-to-end capstone implementation with authentication, playable daily puzzle, local persistence, and backend progress sync.

## Implemented features

- React + Tailwind puzzle UI
- Daily 4x4 logic puzzle generation (deterministic by date)
- Hint, reset, submit, score, and timer flow
- Local IndexedDB resume support for in-progress puzzle state
- Compact grid encoding in IndexedDB to reduce storage footprint
- Guest sign-in mode for local play without Firebase credentials
- Automated tests for puzzle generation and validation rules
- API handler tests for puzzle/progress/auth endpoints
- Google login via Firebase Auth
- Truecaller OAuth scaffold via backend endpoints
- Neon PostgreSQL progress sync endpoints
- Batched sync policy (every 5 solved entries or on logout)
- Vercel serverless + SPA rewrites

## Project structure

- `src/App.jsx`: app shell, auth panel, puzzle UI, progress history UI
- `src/game/useDailyPuzzle.js`: gameplay state, timer, submit/sync flow
- `src/game/puzzleHelpers.js`: score/timer/grid helper functions
- `src/game/puzzleApi.js`: API request wrappers used by gameplay hook
- `shared/dailyPuzzle.js`: shared puzzle generation and validation logic
- `src/auth/*`: auth state and provider actions
- `src/lib/*`: env, firebase, IndexedDB, local progress helpers
- `api/puzzle/today.js`: fetch current daily puzzle
- `api/puzzle/submit.js`: validate submission, score, optional DB save
- `api/progress/index.js`: read recent user progress
- `api/progress/save.js`: save in-progress snapshot metadata
- `api/users/upsert.js`: user bootstrap/upsert in DB
- `api/auth/truecaller/*`: truecaller auth start/callback
- `db/schema.sql`: database schema

Beginner walkthrough:
- `docs/BEGINNER_CODE_MAP.md`

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create env file:
```powershell
Copy-Item .env.example .env
```

3. Fill required values in `.env`:
- `VITE_FIREBASE_*` for Google auth
- `DATABASE_URL` for Neon
- `TRUECALLER_*` for Truecaller OAuth
- `VITE_API_BASE_URL` optional (leave empty for same-origin)

4. Run app (frontend mode):
```bash
npm run dev
```
Note: this mode supports full local gameplay and local resume, even if backend APIs are unavailable. You can continue with Guest mode when OAuth providers are not configured.

## Full API local run

For local serverless API execution, run with Vercel CLI:

```bash
vercel dev
```

This enables `/api/*` locally for health checks, submit validation, and Neon sync.

## API overview

- `GET /api/health`
- `POST /api/users/upsert`
- `GET /api/puzzle/today`
- `POST /api/puzzle/submit`
- `GET /api/progress?userId=...`
- `POST /api/progress/save`

Health behavior:
- `/api/health` returns `200` when API is reachable, even if `DATABASE_URL` is missing.
- Response includes `databaseConfigured` and `databaseConnected` flags for UI status.

## Quality checks

- Lint:
```bash
npm run lint
```

- Tests:
```bash
npm run test
```

- Full quality gate:
```bash
npm run check
```

- Environment readiness check:
```bash
npm run doctor
```

- Production environment preflight:
```bash
npm run doctor:prod
```

- Production build:
```bash
npm run build
```

## Deploy

1. Import repo in Vercel.
2. Add env vars from `.env.example`.
3. Deploy; Vercel serves both SPA and API routes.

## Production-ready setup (Step-by-step)

### 1) External services required

You need these external services for full production mode:

- Firebase project (Google auth)
- Neon PostgreSQL database (progress sync + history + leaderboard data)
- Truecaller developer app (optional if you want Truecaller login enabled)
- Vercel project (frontend + serverless API deployment)

### 2) How to get each required value

1. Firebase (Google Sign-in):
   - Open Firebase Console -> create/select project.
   - Enable Authentication -> Google provider.
   - Project settings -> Web app config -> copy:
     - `VITE_FIREBASE_API_KEY`
     - `VITE_FIREBASE_AUTH_DOMAIN`
     - `VITE_FIREBASE_PROJECT_ID`
     - `VITE_FIREBASE_APP_ID`
     - optional: storage/sender/measurement values
   - Add your production domain in Firebase Authorized Domains.

2. Neon database:
   - Create Neon project and database.
   - Copy connection string -> `DATABASE_URL`.
   - Keep SSL mode enabled.

3. Truecaller:
   - Truecaller is optional for production launch.
   - If you skip Truecaller, keep the UI button disabled and use Guest + Google auth.
   - Create app in Truecaller Developer dashboard.
   - Set callback URL:
     - `https://<your-domain>/api/auth/truecaller/callback`
   - Copy:
     - `TRUECALLER_CLIENT_ID`
     - `TRUECALLER_CLIENT_SECRET`
     - `TRUECALLER_REDIRECT_URI` (same callback URL)
   - Keep default auth/token/userinfo URLs unless dashboard says otherwise.

### 3) Required Vercel environment variables

Set these in Vercel Project -> Settings -> Environment Variables:

- `PUBLIC_APP_URL=https://<your-production-domain>`
- `ALLOWED_ORIGINS=https://<your-production-domain>,https://<preview-domain-if-needed>`
- `DATABASE_URL=...`
- `VITE_FIREBASE_API_KEY=...`
- `VITE_FIREBASE_AUTH_DOMAIN=...`
- `VITE_FIREBASE_PROJECT_ID=...`
- `VITE_FIREBASE_APP_ID=...`
- `TRUECALLER_CLIENT_ID=...`
- `TRUECALLER_CLIENT_SECRET=...` (optional unless full Truecaller OAuth secret access is available)
- `TRUECALLER_REDIRECT_URI=https://<your-production-domain>/api/auth/truecaller/callback`
- `TRUECALLER_AUTH_BASE_URL=https://oauth.truecaller.com/v1/authorize`
- `TRUECALLER_TOKEN_URL=https://oauth.truecaller.com/v1/token`
- `TRUECALLER_USERINFO_URL=https://oauth.truecaller.com/v1/userinfo`
- `TRUECALLER_SCOPE=openid profile phone`

Optional:
- `VITE_API_BASE_URL` (leave empty when frontend+API are same domain)
- `VITE_ENABLE_SW=true` only after final caching validation

### 4) Pre-deploy validation

Run locally:

```bash
npm run check
npm run doctor:prod
```

Both should pass for complete production readiness.

### 5) Post-deploy smoke test

After deployment, verify:

1. `/api/health` returns API reachable + DB connected true.
2. Guest login works.
3. Google login works.
4. Puzzle submit works and stage unlock works.
5. Offline mode works and re-open keeps progress.
6. Reconnect internet and sync succeeds.
7. No console errors in browser.

### Vercel Troubleshooting

- If build fails with `vite: command not found`, redeploy after latest commit.
  Root `postinstall` now installs `puzzle-game` dependencies automatically.
- Set project **Root Directory** to `puzzle-game` (recommended).
- If Vercel shows `Function Runtimes must have a valid version`, open:
  Project Settings -> Functions -> Runtime and remove any invalid custom runtime entry.
