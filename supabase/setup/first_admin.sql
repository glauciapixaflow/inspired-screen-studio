-- Run ONLY as the project owner in Supabase SQL Editor, after migration 003.
-- Replace the placeholder with the exact email of your existing Auth user.
-- This does not grant permission to signups or expose a bootstrap RPC.
begin;
do $$
declare
  first_admin_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('user_profiles_role_management', 0));
  if exists (select 1 from public.user_profiles where role = 'admin') then
    raise exception 'An administrator already exists. Use the role-management function instead.';
  end if;
  select id into strict first_admin_id from auth.users
    where lower(email) = lower('SUBSTITUA-PELO-SEU-EMAIL-CADASTRADO');
  update public.user_profiles set role = 'admin', updated_at = clock_timestamp()
    where user_id = first_admin_id;
  if not found then raise exception 'Apply migration 003 before creating the first administrator.'; end if;
exception when no_data_found then
  raise exception 'Email not found in Authentication > Users. Check the placeholder and try again.';
end;
$$;
commit;
