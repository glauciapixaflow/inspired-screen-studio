begin;

create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'client' check (role in ('client', 'collaborator', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_profiles enable row level security;
revoke all on public.user_profiles from PUBLIC;
revoke all on public.user_profiles from anon;
revoke all on public.user_profiles from authenticated;
grant select on public.user_profiles to authenticated;

-- Read only the caller's role; no browser metadata or caller-supplied user ID.
-- Definer ownership avoids recursive RLS when the policy checks administrator access.
create function public.current_app_role()
returns text language sql stable security definer set search_path = ''
as $$
  select role from public.user_profiles where user_id = (select auth.uid());
$$;
revoke all on function public.current_app_role() from PUBLIC;
revoke all on function public.current_app_role() from anon;
revoke all on function public.current_app_role() from authenticated;
grant execute on function public.current_app_role() to authenticated;

create policy "Read own profile or administer profiles"
on public.user_profiles for select to authenticated
using (user_id = (select auth.uid()) or (select public.current_app_role()) = 'admin');

-- New signups always start as clients, ignoring any role in signup metadata.
create function public.create_client_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.user_profiles(user_id, role) values (new.id, 'client')
    on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.create_client_profile() from PUBLIC;
revoke all on function public.create_client_profile() from anon;
revoke all on function public.create_client_profile() from authenticated;
create trigger create_client_profile after insert on auth.users
for each row execute function public.create_client_profile();

-- Existing users receive the same safe default. No automatic administrators.
insert into public.user_profiles(user_id, role)
select id, 'client' from auth.users on conflict (user_id) do nothing;

create table public.user_role_changes (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  target_id uuid references auth.users(id) on delete set null,
  old_role text not null check (old_role in ('client', 'collaborator', 'admin')),
  new_role text not null check (new_role in ('client', 'collaborator', 'admin')),
  changed_at timestamptz not null default clock_timestamp()
);
alter table public.user_role_changes enable row level security;
revoke all on public.user_role_changes from PUBLIC;
revoke all on public.user_role_changes from anon;
revoke all on public.user_role_changes from authenticated;
grant select on public.user_role_changes to authenticated;
create policy "Administrators read role history" on public.user_role_changes
for select to authenticated using ((select public.current_app_role()) = 'admin');

create function public.audit_user_role_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    insert into public.user_role_changes(actor_id, target_id, old_role, new_role)
    values (auth.uid(), new.user_id, old.role, new.role);
  end if;
  return new;
end;
$$;
revoke all on function public.audit_user_role_change() from PUBLIC;
revoke all on function public.audit_user_role_change() from anon;
revoke all on function public.audit_user_role_change() from authenticated;
create trigger audit_user_role_change after update of role on public.user_profiles
for each row execute function public.audit_user_role_change();

-- The only role-management entrypoint granted to the application.
create function public.set_user_role(p_user_id uuid, p_role text)
returns public.user_profiles language plpgsql security definer set search_path = ''
as $$
declare
  target public.user_profiles;
begin
  -- Serialize administrator changes so concurrent demotions cannot remove all admins.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('user_profiles_role_management', 0));
  if auth.uid() is null or public.current_app_role() is distinct from 'admin' then
    raise exception 'Only administrators can change user roles.' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('client', 'collaborator', 'admin') then
    raise exception 'Invalid application role.' using errcode = '22023';
  end if;
  select * into target from public.user_profiles where user_id = p_user_id for update;
  if not found then
    raise exception 'User profile not found.' using errcode = 'P0002';
  end if;
  if target.role = 'admin' and p_role <> 'admin'
    and (select count(*) from public.user_profiles where role = 'admin') <= 1 then
    raise exception 'Cannot remove the last administrator.' using errcode = '23514';
  end if;
  if target.role = p_role then return target; end if;
  update public.user_profiles set role = p_role, updated_at = clock_timestamp()
    where user_id = p_user_id returning * into target;
  return target;
end;
$$;
revoke all on function public.set_user_role(uuid, text) from PUBLIC;
revoke all on function public.set_user_role(uuid, text) from anon;
revoke all on function public.set_user_role(uuid, text) from authenticated;
grant execute on function public.set_user_role(uuid, text) to authenticated;

commit;
