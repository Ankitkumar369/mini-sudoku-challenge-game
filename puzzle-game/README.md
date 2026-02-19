# Mini Sudoko Challenge Game

Frontend + API puzzle project ready for GitHub and Vercel deployment.

## Run locally

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run check
npm run doctor
```

## Deploy on Vercel

1. Push repo to GitHub.
2. Import project in Vercel.
3. Set **Root Directory** to `puzzle-game`.
4. Add environment variables from `.env.example`.
5. Deploy.

## Environment notes

- `VITE_FIREBASE_*` keys are required for Google login.
- `DATABASE_URL` enables backend persistence.
- Truecaller can use either:
  - `TRUECALLER_*` (recommended)
  - `TRUECALLLER_*` (legacy typo-compatible fallback)
