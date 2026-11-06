-- Run after migration 004. Temporary fixtures are removed by ROLLBACK.
begin;
select set_config('test.panel_tag', gen_random_uuid()::text, true);
select set_config('test.panel_client', gen_random_uuid()::text, true);
select set_config('test.panel_staff', gen_random_uuid()::text, true);
select set_config('test.panel_admin', gen_random_uuid()::text, true);
select set_config('test.panel_other', gen_random_uuid()::text, true);
insert into auth.users(id,email) values
  (current_setting('test.panel_client')::uuid, 'client-' || current_setting('test.panel_tag') || '@example.invalid'),
  (current_setting('test.panel_staff')::uuid, 'staff-' || current_setting('test.panel_tag') || '@example.invalid'),
  (current_setting('test.panel_admin')::uuid, 'admin-' || current_setting('test.panel_tag') || '@example.invalid'),
  (current_setting('test.panel_other')::uuid, 'other-' || current_setting('test.panel_tag') || '@example.invalid');
update public.user_profiles set role = 'admin' where user_id = current_setting('test.panel_admin')::uuid;
update public.user_profiles set role = 'collaborator' where user_id = current_setting('test.panel_staff')::uuid;
update auth.users set created_at = now() - interval '168 hours' where id = current_setting('test.panel_client')::uuid;
set local role anon;
do $$
begin
  begin
    perform public.admin_list_users();
    raise exception 'Anonymous administrator listing allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.panel_client'), true);
do $$
begin
  begin
    perform public.admin_list_users();
    raise exception 'Client accessed user emails';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.panel_staff'), true);
do $$
begin
  begin
    perform public.admin_list_users();
    raise exception 'Collaborator accessed user emails';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.panel_admin'), true);
do $$
begin
  if (select count(*) from public.admin_list_users(current_setting('test.panel_tag'))) <> 4 then
    raise exception 'Administrator list missing users'; end if;
  if (select count(*) from public.admin_list_users(current_setting('test.panel_tag'), 'client')) <> 2 then
    raise exception 'Role filter failed'; end if;
  if (select count(*) from public.admin_list_users(upper('client-' || current_setting('test.panel_tag')))) <> 1 then
    raise exception 'Email search is not case insensitive'; end if;
  if (select created_at from public.admin_list_users(current_setting('test.panel_client'))) <> now() - interval '168 hours' then
    raise exception 'Original account creation date not returned'; end if;
  if (select count(*) from public.admin_list_users(current_setting('test.panel_staff'))) <> 1 then
    raise exception 'ID search failed'; end if;
  if exists (select 1 from public.admin_list_users('%' || current_setting('test.panel_tag'))) then
    raise exception 'Search wildcard interpreted rather than treated literally'; end if;
  if (select count(*) from public.admin_list_users(current_setting('test.panel_tag'), null, 2, 0)) <> 2 then
    raise exception 'Page size failed'; end if;
  if (select min(total_count) from public.admin_list_users(current_setting('test.panel_tag'), null, 2, 0)) <> 4 then
    raise exception 'Total count failed'; end if;
  if exists (select 1 from public.admin_list_users(current_setting('test.panel_tag'), null, 2, 0) a
    join public.admin_list_users(current_setting('test.panel_tag'), null, 2, 2) b using(user_id)) then
    raise exception 'Pagination repeated rows'; end if;
  begin
    perform public.admin_list_users('', 'owner');
    raise exception 'Invalid role filter accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.admin_list_users('', null, 101, 0);
    raise exception 'Unbounded page size accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.admin_list_users('', null, 20, -1);
    raise exception 'Negative offset accepted';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
rollback;
