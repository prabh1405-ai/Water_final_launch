-- Private, owner-scoped ledger schema for the Vercel deployment.
-- Safe to run on a new Supabase project; it does not alter existing ledger tables.

create table if not exists public.ledger_customers (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  contact text not null default '',
  phone text not null default '',
  "defaultRate" integer not null default 30,
  "openingPending" integer not null default 0,
  "openingCans" integer not null default 0,
  notes text,
  primary key (user_id, id)
);

create table if not exists public.ledger_transactions (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  "customerId" text not null,
  date date not null,
  type text not null check (type in ('delivery', 'payment')),
  "entryId" text,
  cans integer,
  "cansReturned" integer,
  "currentStock" integer,
  rate integer,
  amount integer not null check (amount >= 0),
  "createdAt" bigint not null,
  primary key (user_id, id),
  constraint ledger_transactions_customer_fkey
    foreign key (user_id, "customerId")
    references public.ledger_customers (user_id, id)
    on delete cascade
);

create table if not exists public.ledger_expenses (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  date date not null,
  diesel integer not null default 0,
  "snacksFood" integer not null default 0,
  "serviceRepairs" integer not null default 0,
  "serviceNotes" text,
  "createdAt" bigint not null,
  primary key (user_id, id),
  constraint ledger_expenses_one_per_day unique (user_id, date)
);

create table if not exists public.ledger_water_filling (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  date date not null,
  batches jsonb not null default '[]'::jsonb,
  "createdAt" bigint not null,
  primary key (user_id, id),
  constraint ledger_water_filling_one_per_day unique (user_id, date)
);

create index if not exists ledger_transactions_owner_customer_date_idx
  on public.ledger_transactions (user_id, "customerId", date, "createdAt");
create index if not exists ledger_expenses_owner_date_idx
  on public.ledger_expenses (user_id, date);
create index if not exists ledger_water_filling_owner_date_idx
  on public.ledger_water_filling (user_id, date);

alter table public.ledger_customers enable row level security;
alter table public.ledger_transactions enable row level security;
alter table public.ledger_expenses enable row level security;
alter table public.ledger_water_filling enable row level security;

revoke all on public.ledger_customers, public.ledger_transactions,
  public.ledger_expenses, public.ledger_water_filling from anon;
grant select, insert, update, delete on public.ledger_customers,
  public.ledger_transactions, public.ledger_expenses,
  public.ledger_water_filling to authenticated;

drop policy if exists "private ledger customers" on public.ledger_customers;
create policy "private ledger customers"
  on public.ledger_customers for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "private ledger transactions" on public.ledger_transactions;
create policy "private ledger transactions"
  on public.ledger_transactions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "private ledger expenses" on public.ledger_expenses;
create policy "private ledger expenses"
  on public.ledger_expenses for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "private ledger water filling" on public.ledger_water_filling;
create policy "private ledger water filling"
  on public.ledger_water_filling for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
