-- Optional integration test for the SQL Editor, after applying the migration.
-- Creates two temporary auth users and one reservation, then rolls everything back.
-- All changes are inside a transaction. Success ends with ROLLBACK.
begin;
select set_config('test.user_a', gen_random_uuid()::text, true);
select set_config('test.user_b', gen_random_uuid()::text, true);
insert into auth.users(id, email) values
  (current_setting('test.user_a')::uuid, current_setting('test.user_a') || '@example.invalid'),
  (current_setting('test.user_b')::uuid, current_setting('test.user_b') || '@example.invalid');

-- Pick a currently unused parcel without altering existing reservations.
do $$
declare region text; parcel text;
begin
  select r.id, p.id into region, parcel
  from (values ('08'),('12'),('21'),('27'),('32'),('36'),('41'),('45'),('49')) r(id)
  cross join (values ('A1'),('A2'),('A3'),('A4'),('B1'),('B2'),('B3'),('B4'),('C1'),('C2'),('C3'),('C4'),('D1'),('D2'),('D3'),('D4')) p(id)
  where not exists (select 1 from public.area_reservations a where a.region_id = r.id and a.parcel_id = p.id)
  limit 1;
  if region is null then raise exception 'No free parcel available for test'; end if;
  perform set_config('test.region', region, true);
  perform set_config('test.parcel', parcel, true);
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.user_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);
insert into public.area_reservations(region_id, parcel_id)
  values (current_setting('test.region'), current_setting('test.parcel'));
do $$
begin
  if (select count(*) from public.area_reservations) <> 1 then raise exception 'Owner cannot read own reservation'; end if;
  if (select user_id::text from public.area_reservations limit 1) <> current_setting('test.user_a') then raise exception 'Wrong owner'; end if;
  begin
    insert into public.area_reservations(user_id, region_id, parcel_id) values (current_setting('test.user_b')::uuid, current_setting('test.region'), current_setting('test.parcel'));
    raise exception 'Ownership spoof unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.area_reservations set status = 'pending_contact';
    raise exception 'Update unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.area_reservations;
    raise exception 'Delete unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', current_setting('test.user_b'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_b'), 'role', 'authenticated')::text, true);
do $$
begin
  if (select count(*) from public.area_reservations) <> 0 then raise exception 'Other user can read private reservation'; end if;
  begin
    insert into public.area_reservations(region_id, parcel_id) values (current_setting('test.region'), current_setting('test.parcel'));
    raise exception 'Duplicate parcel unexpectedly allowed';
  exception when unique_violation then null;
  end;
end $$;

reset role;
set local role anon;
do $$
begin
  begin
    perform 1 from public.area_reservations;
    raise exception 'Anonymous read unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.area_reservations(region_id, parcel_id) values (current_setting('test.region'), current_setting('test.parcel'));
    raise exception 'Anonymous insert unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
