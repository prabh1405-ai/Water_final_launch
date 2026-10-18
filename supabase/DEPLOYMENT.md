# Deploy with Supabase and Vercel

The app uses local storage when the Supabase variables are absent. With both
variables configured, it requires sign-in and reads/writes a private,
user-owned Supabase ledger. It does not copy browser data into Supabase or erase
the existing browser storage.

## Supabase

1. Create a new Supabase project.
2. In **SQL Editor**, review and run [`private-ledger.sql`](./private-ledger.sql).
   This creates new owner-scoped tables and does not touch the existing
   `customers`, `transactions`, or `expenses` tables.
3. In **Authentication → Users**, create the single user who should sign in.
   Disable public signups in the project's Auth settings; signup is not
   provided in the app.
4. Copy the project URL and its publishable/anon key from **Project Settings →
   API**. Never use a service-role key in the browser or Vercel's `VITE_*`
   variables.

## Vercel

1. Import `prabh1405-ai/Water_final_launch` from GitHub.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project
   environment variables for the environments you will deploy.
3. Deploy. Vercel builds the TanStack Start app with Nitro's Vercel preset.
4. Open the deployment URL and sign in with the user created in Supabase.

## Data loading

The app fetches all rows from each ledger table in ordered batches of 1,000 and
continues until the final short page. Supabase still applies per-request row
limits; the client pagination retrieves all rows visible to the signed-in user
without exposing other users' records.

Local browser data remains on its original browser origin and is not imported
automatically. Back it up separately before changing data sources.

Do not run `secure-shared-ledger.sql`; it is for a shared-user model, not this
private single-account deployment.
