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
  if not exists (select 1 from public.area_reservations where expires_at - created_at = interval '120 hours') then
    raise exception 'Deadline is not exactly 120 hours';
  end if;
  begin
    update public.area_reservations set status = 'contacted';
    raise exception 'User unexpectedly confirmed own contact';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
-- Only administrator fixtures can move dates to simulate passage of time.
update public.area_reservations set
  created_at = now() - interval '144 hours',
  expires_at = now() - interval '24 hours'
where user_id = current_setting('test.user_a')::uuid;

set local role authenticated;
do $$
begin
  if not exists (select 1 from public.area_reservation_details where status = 'expired') then
    raise exception 'Deadline view did not expire the old reservation';
  end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.user_b'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_b'), 'role', 'authenticated')::text, true);
-- The expired hold must not block a new user's request.
insert into public.area_reservations(region_id, parcel_id)
  values (current_setting('test.region'), current_setting('test.parcel'));
reset role;
do $$
begin
  if not exists (select 1 from public.area_reservations where user_id = current_setting('test.user_a')::uuid and status = 'expired') then
    raise exception 'Expired history was not retained';
  end if;
  begin
    update public.area_reservations set status = 'contacted'
      where user_id = current_setting('test.user_a')::uuid;
    raise exception sqlstate 'ZX001' using message = 'Expired reservation was unexpectedly reactivated';
  exception when raise_exception then null;
  end;
end $$;
-- Simulate a timely confirmation by the administrator.
update public.area_reservations set status = 'contacted'
  where user_id = current_setting('test.user_b')::uuid;
do $$
begin
  if not exists (select 1 from public.area_reservations where user_id = current_setting('test.user_b')::uuid and contacted_at is not null) then
    raise exception 'Confirmation timestamp missing';
  end if;
end $$;
-- Move the confirmed fixture into the past, preserving timely contact.
update public.area_reservations set
  created_at = now() - interval '144 hours',
  expires_at = now() - interval '24 hours',
  contacted_at = now() - interval '143 hours'
where user_id = current_setting('test.user_b')::uuid;
set local role authenticated;
do $$
begin
  if not exists (select 1 from public.area_reservation_details where status = 'contacted') then
    raise exception 'Confirmed contact was incorrectly expired';
  end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.user_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);
do $$
begin
  begin
    insert into public.area_reservations(region_id, parcel_id)
      values (current_setting('test.region'), current_setting('test.parcel'));
    raise exception 'Confirmed reservation no longer blocks duplicates';
  exception when unique_violation then null;
  end;
end $$;
reset role;
rollback;
