# Deploying to Vercel

This is a Next.js 14 app using Prisma + **Postgres**. Vercel's filesystem is
read-only at runtime, so a hosted Postgres database is required (SQLite won't
work in production).

## One-time setup (≈5 minutes, all in the browser)

1. **Sign in to Vercel** at https://vercel.com with your GitLab account.
2. **Import the repo:** _Add New… → Project → Import_ `socialmediateam`
   (branch `feature/social-publishing-schedule`, or merge to `main` first).
3. **Add a database:** in the project, go to **Storage → Create Database →
   Postgres** (Vercel Postgres / Neon, free tier). Connect it to the project.
   Vercel sets the `DATABASE_URL` environment variable automatically for all
   environments (Production, Preview, Development).
4. **Deploy.** If the very first build ran before the database was connected,
   just hit **Redeploy** once `DATABASE_URL` is present.

That's it. The build command (`prisma db push` → seed → `next build`) creates
the tables and seeds the §8 data on first deploy. The seed is **idempotent** —
later deploys never wipe your data (it only seeds an empty database).

## After it's live

- Open the app, switch to the current month, and click **توليد الجدول**
  (Generate) to build the schedule.
- To use the same database locally, copy its connection string into a local
  `.env` as `DATABASE_URL` (see `.env.example`).

## Build pipeline (configured in package.json)

```
postinstall : prisma generate
build       : prisma db push --accept-data-loss --skip-generate
              && tsx prisma/seed.ts
              && next build
```
