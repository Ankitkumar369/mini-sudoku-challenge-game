# Mini Sudoko challenge game

End-to-end capstone implementation with authentication, playable daily puzzle, local persistence, and backend progress sync.

## Implemented features

- React + Tailwind puzzle UI
- Daily 4x4 logic puzzle generation (deterministic by date)
- Hint, reset, submit, score, and timer flow
- Local IndexedDB resume support for in-progress puzzle state
- Guest sign-in mode for local play without Firebase credentials
- Automated tests for puzzle generation and validation rules
- API handler tests for puzzle/progress/auth endpoints
- Google login via Firebase Auth
- Truecaller OAuth scaffold via backend endpoints
- Neon PostgreSQL progress sync endpoints
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

- Production build:
```bash
npm run build
```

## Deploy

1. Import repo in Vercel.
2. Add env vars from `.env.example`.
3. Deploy; Vercel serves both SPA and API routes.

### Vercel Troubleshooting

- If build fails with `vite: command not found`, redeploy after latest commit.
  Root `postinstall` now installs `puzzle-game` dependencies automatically.
- Set project **Root Directory** to `puzzle-game` (recommended).
- If Vercel shows `Function Runtimes must have a valid version`, open:
  Project Settings -> Functions -> Runtime and remove any invalid custom runtime entry.
