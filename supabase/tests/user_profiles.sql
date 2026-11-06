-- Run after migration 003 in SQL Editor. Test fixtures are rolled back.
begin;
select set_config('test.client', gen_random_uuid()::text, true);
select set_config('test.staff', gen_random_uuid()::text, true);
select set_config('test.admin', gen_random_uuid()::text, true);
select set_config('test.other_admin', gen_random_uuid()::text, true);
insert into auth.users(id, email, raw_user_meta_data) values
  (current_setting('test.client')::uuid, current_setting('test.client') || '@example.invalid', '{"role":"admin"}'),
  (current_setting('test.staff')::uuid, current_setting('test.staff') || '@example.invalid', '{}'),
  (current_setting('test.admin')::uuid, current_setting('test.admin') || '@example.invalid', '{}'),
  (current_setting('test.other_admin')::uuid, current_setting('test.other_admin') || '@example.invalid', '{}');
do $$
begin
  if exists (select 1 from public.user_profiles where user_id in (
    current_setting('test.client')::uuid, current_setting('test.staff')::uuid,
    current_setting('test.admin')::uuid, current_setting('test.other_admin')::uuid
  ) and role <> 'client') then raise exception 'Signup metadata elevated a user'; end if;
  if (select count(*) from public.user_profiles where user_id in (
    current_setting('test.client')::uuid, current_setting('test.staff')::uuid,
    current_setting('test.admin')::uuid, current_setting('test.other_admin')::uuid
  )) <> 4 then raise exception 'Missing signup profiles'; end if;
end $$;
-- Explicit owner-only fixture bootstrap, never reachable through the app.
update public.user_profiles set role = 'admin' where user_id = current_setting('test.admin')::uuid;

set local role anon;
do $$
begin
  begin
    perform 1 from public.user_profiles;
    raise exception 'Anonymous profile read allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.current_app_role();
    raise exception 'Anonymous role RPC allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.set_user_role(current_setting('test.client')::uuid, 'admin');
    raise exception 'Anonymous role change allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.client'), true);
do $$
begin
  if public.current_app_role() <> 'client' then raise exception 'Wrong client role'; end if;
  if (select count(*) from public.user_profiles) <> 1 then raise exception 'Client sees another profile'; end if;
  if exists (select 1 from public.user_role_changes) then raise exception 'Client sees role audit'; end if;
  begin
    perform public.set_user_role(current_setting('test.client')::uuid, 'admin');
    raise exception 'Client self-promotion allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.user_profiles set role = 'admin' where user_id = auth.uid();
    raise exception 'Direct client promotion allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.user_profiles(user_id, role) values (auth.uid(), 'admin');
    raise exception 'Direct profile insertion allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.user_profiles where user_id = auth.uid();
    raise exception 'Client deleted a role';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.user_role_changes;
    raise exception 'Client deleted audit';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub', current_setting('test.admin'), true);
do $$
begin
  if public.current_app_role() <> 'admin' then raise exception 'Wrong admin role'; end if;
  if (select count(*) from public.user_profiles where user_id in (
    current_setting('test.client')::uuid, current_setting('test.staff')::uuid,
    current_setting('test.admin')::uuid, current_setting('test.other_admin')::uuid
  )) <> 4 then raise exception 'Admin cannot list profiles'; end if;
  begin
    perform public.set_user_role(current_setting('test.client')::uuid, 'invalid');
    raise exception 'Invalid role allowed';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.set_user_role(gen_random_uuid(), 'collaborator');
    raise exception 'Missing profile unexpectedly updated';
  exception when no_data_found then null; end;
  if (select count(*) from public.user_profiles where role = 'admin') = 1 then
    begin
      perform public.set_user_role(auth.uid(), 'client');
      raise exception 'Last administrator removed';
    exception when check_violation then null; end;
  else
    raise notice 'Existing project administrators: last-admin case is tested in the isolated database only.';
  end if;
  perform public.set_user_role(current_setting('test.staff')::uuid, 'collaborator');
  -- Idempotent changes must not create duplicate audit events.
  perform public.set_user_role(current_setting('test.staff')::uuid, 'collaborator');
  if (select count(*) from public.user_role_changes where target_id = current_setting('test.staff')::uuid) <> 1 then
    raise exception 'Role audit missing or duplicated';
  end if;
  if not exists (select 1 from public.user_role_changes where
    target_id = current_setting('test.staff')::uuid and actor_id = auth.uid()
    and old_role = 'client' and new_role = 'collaborator') then
    raise exception 'Audit does not identify the responsible administrator';
  end if;
end $$;

select set_config('request.jwt.claim.sub', current_setting('test.staff'), true);
do $$
begin
  if public.current_app_role() <> 'collaborator' then raise exception 'Wrong collaborator role'; end if;
  if (select count(*) from public.user_profiles) <> 1 then raise exception 'Staff sees other profiles'; end if;
  begin
    perform public.set_user_role(auth.uid(), 'admin');
    raise exception 'Staff self-promotion allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.admin'), true);
select public.set_user_role(current_setting('test.staff')::uuid, 'client');
select public.set_user_role(current_setting('test.other_admin')::uuid, 'admin');
select public.set_user_role(current_setting('test.admin')::uuid, 'client');
do $$
begin
  if public.current_app_role() <> 'client' then raise exception 'Demotion requires a token refresh'; end if;
  begin
    perform public.set_user_role(current_setting('test.staff')::uuid, 'admin');
    raise exception 'Demoted admin retains management rights';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
