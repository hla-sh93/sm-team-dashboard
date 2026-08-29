# Deploying to Vercel

This is a Next.js 15 app using Prisma + **Postgres**. Vercel's filesystem is
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
4. **Initialize or update the schema explicitly** from a trusted operator shell
   with the production `DATABASE_URL`: `npm run db:deploy:schema`. This command
   does not opt into data loss; Prisma refuses destructive changes.
5. **Configure security secrets before exposing the deployment:**
   `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and a long random `AUTH_SECRET` for admin;
   `CRON_SECRET` for scheduled endpoints; and the Telegram token/webhook secret
   only when Telegram is enabled. A public deployment without admin credentials
   exposes the intentional first-run owner-creation screen.
6. **Deploy.** Builds compile the application and never mutate application data.

Seeding/importing is a separate, explicit operator decision. Never attach seed,
snapshot import, repair, or reconciliation scripts to the Vercel build command.

## After it's live

- Open the app, switch to the current month, and click **توليد الجدول**
  (Generate) to build the schedule.
- To use the same database locally, copy its connection string into a local
  `.env` as `DATABASE_URL` (see `.env.example`).

## Copy the current local database to Vercel

When local and Vercel differ, export the local SQLite database and import that
snapshot into the Vercel Postgres database. This replaces the production app
tables, including completed and incomplete task states plus finance fields.

```
npm run db:export-local
vercel env pull .env.production.local --environment=production
npm run db:import-prod
```

`db:import-prod` refuses to run unless `DATABASE_URL` points at Postgres. After
the import, redeploy or refresh the app; Vercel will read the copied data.
If Vercel keeps Postgres secrets hidden from `env pull`, perform the import from
a trusted operator shell that has a short-lived production `DATABASE_URL`.
The build no longer imports snapshots, even when `IMPORT_LOCAL_SNAPSHOT` is set.

## Two schemas (local SQLite vs production Postgres)

- `prisma/schema.prisma` — **SQLite**, used for local development/preview.
- `prisma/schema.postgres.prisma` — **Postgres**, used by Vercel (selected with
  `--schema` in the build command). Keep the two models in sync.

## Safe build and schema commands

```
postinstall      : prisma generate                  (local SQLite client)
db:deploy:schema : prisma db push --schema=prisma/schema.postgres.prisma
                   --skip-generate                  (explicit operator action)
build            : prisma generate --schema=prisma/schema.postgres.prisma
                   && next build                    (no database writes)
```

The repository has no Prisma migration history; schema rollout currently uses
explicit, non-destructive `db push`. Review the generated diff and back up the
database before every production schema change.
