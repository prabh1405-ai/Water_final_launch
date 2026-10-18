-- Signed-in users share one ledger. Anonymous users have no table access.
do $$
declare
  relation record;
  policy record;
begin
  for policy in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('customers', 'transactions', 'expenses')
  loop
    execute format('drop policy %I on public.%I', policy.policyname, policy.tablename);
  end loop;

  for relation in
    select conname
    from pg_constraint
    where conrelid = 'public.transactions'::regclass
      and confrelid = 'public.customers'::regclass
      and contype = 'f'
  loop
    execute format('alter table public.transactions drop constraint %I', relation.conname);
  end loop;
end $$;

alter table public.customers drop column if exists owner_id cascade;
alter table public.transactions drop column if exists owner_id cascade;
alter table public.expenses drop column if exists owner_id cascade;

alter table public.transactions
  add constraint transactions_customer_fkey
  foreign key ("customerId")
  references public.customers (id)
  on delete cascade;

alter table public.customers enable row level security;
alter table public.transactions enable row level security;
alter table public.expenses enable row level security;

revoke all on table public.customers, public.transactions, public.expenses from anon;
grant select, insert, update, delete on table public.customers, public.transactions, public.expenses to authenticated;

create policy "signed-in users share customers"
  on public.customers for all to authenticated
  using (true)
  with check (true);

create policy "signed-in users share transactions"
  on public.transactions for all to authenticated
  using (true)
  with check (true);

create policy "signed-in users share expenses"
  on public.expenses for all to authenticated
  using (true)
  with check (true);