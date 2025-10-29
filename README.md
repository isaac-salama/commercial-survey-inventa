# Commercial Survey (Inventa)

This repo contains a Next.js app in `commercial-survey-main/`.

- App directory: `commercial-survey-main/`
- App README: `commercial-survey-main/README.md`

## Quickstart (local)

1. `cd commercial-survey-main`
2. Create `.env.local` and set at least:
   - `DATABASE_URL=postgres://...` (Neon/Postgres; include `?sslmode=require`)
   - `NEXTAUTH_SECRET=your-long-random-string`
   - Optional: `LOCK_RESULTS_NAV=true`
3. Install deps: `npm install`
4. Apply DB schema: `npm run drizzle:push`
5. (Optional) Seed questions/options: `npm run seed:csv`
6. Run dev server: `npm run dev` and open http://localhost:3000

To generate a password hash for manual user insertion:

```
node -e "console.log(require('bcryptjs').hashSync('YourPasswordHere', 10))"
```

## Deploy (Vercel)

- Root Directory: `commercial-survey-main`
- Framework Preset: Next.js
- Build Command: (auto) `npm run build`
- Install Command: (auto) `npm ci`
- Output Directory: (auto) `.next`
- Environment Variables (Production and Preview):
  - `DATABASE_URL` (Neon connection string)
  - `NEXTAUTH_SECRET` (same value across all environments)
  - `NEXTAUTH_URL` (e.g. your production URL) – recommended
  - `LOCK_RESULTS_NAV` (optional)

Ensure the target Neon database has the schema by running `npm run drizzle:push` locally against that DB before first deploy.

