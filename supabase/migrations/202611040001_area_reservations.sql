-- Execute this migration in the Supabase SQL Editor as the project owner.
begin;

create table public.area_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  region_id text not null check (region_id in ('08', '12', '21', '27', '32', '36', '41', '45', '49')),
  parcel_id text not null check (parcel_id ~ '^[A-D][1-4]$'),
  status text not null default 'pending_contact' check (status = 'pending_contact'),
  created_at timestamptz not null default now(),
  constraint area_reservations_region_parcel_key unique (region_id, parcel_id)
);

create index area_reservations_user_created_idx
  on public.area_reservations (user_id, created_at desc);

alter table public.area_reservations enable row level security;

-- Explicit grants are required even with automatic table exposure disabled.
revoke all on public.area_reservations from PUBLIC;
revoke all on public.area_reservations from anon;
revoke all on public.area_reservations from authenticated;
grant usage on schema public to authenticated;
grant select on public.area_reservations to authenticated;
-- Ownership, status, ID and timestamp are supplied by the database.
grant insert (region_id, parcel_id) on public.area_reservations to authenticated;

create policy "Users read their own reservations"
  on public.area_reservations for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users request their own reservations"
  on public.area_reservations for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'pending_contact');


commit;
