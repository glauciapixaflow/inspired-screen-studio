-- Run after the contact migration. All fixtures and test triggers are rolled back.
begin;
select set_config('test.contact.tag', gen_random_uuid()::text, true);
select set_config('test.contact.client', gen_random_uuid()::text, true);
select set_config('test.contact.other', gen_random_uuid()::text, true);
select set_config('test.contact.staff', gen_random_uuid()::text, true);
select set_config('test.contact.admin', gen_random_uuid()::text, true);
insert into auth.users(id,email) values
  (current_setting('test.contact.client')::uuid, 'client-' || current_setting('test.contact.tag') || '@example.invalid'),
  (current_setting('test.contact.other')::uuid, 'other-' || current_setting('test.contact.tag') || '@example.invalid'),
  (current_setting('test.contact.staff')::uuid, 'staff-' || current_setting('test.contact.tag') || '@example.invalid'),
  (current_setting('test.contact.admin')::uuid, 'admin-' || current_setting('test.contact.tag') || '@example.invalid');
update public.user_profiles set role = 'collaborator' where user_id = current_setting('test.contact.staff')::uuid;
update public.user_profiles set role = 'admin' where user_id = current_setting('test.contact.admin')::uuid;
do $$
declare plot record; new_id uuid; i integer := 0;
begin
  for plot in
    select r.id as region, p.id as parcel
    from (values ('08'),('12'),('21'),('27'),('32'),('36'),('41'),('45'),('49')) r(id)
    cross join (values ('A1'),('A2'),('A3'),('A4'),('B1'),('B2'),('B3'),('B4'),('C1'),('C2'),('C3'),('C4'),('D1'),('D2'),('D3'),('D4')) p(id)
    where not exists (select 1 from public.area_reservations a where a.region_id = r.id and a.parcel_id = p.id)
    limit 3
  loop
    i := i + 1;
    insert into public.area_reservations(user_id, region_id, parcel_id)
      values (current_setting('test.contact.client')::uuid, plot.region, plot.parcel) returning id into new_id;
    perform set_config(case i when 1 then 'test.contact.active' when 2 then 'test.contact.expired' else 'test.contact.rollback' end, new_id::text, true);
  end loop;
  if i <> 3 then raise exception 'Three unused parcels are required for this test'; end if;
end $$;
update public.area_reservations set created_at = now() - interval '144 hours', expires_at = now() - interval '24 hours'
  where id = current_setting('test.contact.expired')::uuid;
set local role anon;
do $$
begin
  begin perform public.team_list_reservations(); raise exception 'Anonymous list allowed';
  exception when insufficient_privilege then null; end;
  begin perform public.confirm_reservation_contact(current_setting('test.contact.active')::uuid); raise exception 'Anonymous confirmation allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.contact.client'), true);
do $$
begin
  if (select count(*) from public.area_reservations) <> 3 then raise exception 'Client cannot see own reservations'; end if;
  begin perform public.team_list_reservations(); raise exception 'Client list allowed';
  exception when insufficient_privilege then null; end;
  begin perform public.confirm_reservation_contact(current_setting('test.contact.active')::uuid); raise exception 'Client confirmation allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.contact.other'), true);
do $$
begin
  if exists (select 1 from public.area_reservations) then raise exception 'Client sees someone else''s reservations'; end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.contact.staff'), true);
do $$
begin
  if (select count(*) from public.team_list_reservations(current_setting('test.contact.tag'))) <> 3 then raise exception 'Staff cannot list reservations'; end if;
  if (select count(*) from public.team_list_reservations(current_setting('test.contact.tag'), 'expired')) <> 1 then raise exception 'Expired status filter failed'; end if;
  if (select count(*) from public.team_list_reservations(current_setting('test.contact.active'))) <> 1 then raise exception 'Protocol search failed'; end if;
  if (select min(total_count) from public.team_list_reservations(current_setting('test.contact.tag'), null, 2)) <> 3 then raise exception 'Pagination count failed'; end if;
  begin perform public.team_list_reservations('', 'invalid'); raise exception 'Invalid status accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.confirm_reservation_contact(current_setting('test.contact.expired')::uuid);
    raise exception sqlstate 'ZX002' using message = 'Expired reservation was reactivated';
  exception when raise_exception then null; end;
  begin perform public.confirm_reservation_contact(gen_random_uuid()); raise exception 'Missing reservation confirmed';
  exception when no_data_found then null; end;
  begin perform public.confirm_reservation_contact(current_setting('test.contact.active')::uuid, repeat('x', 2001)); raise exception 'Oversized notes accepted';
  exception when invalid_parameter_value then null; end;
  begin insert into public.reservation_contact_events(reservation_id, actor_id) values(current_setting('test.contact.active')::uuid, current_setting('test.contact.admin')::uuid);
    raise exception 'Staff forged a contact event';
  exception when insufficient_privilege then null; end;
  perform public.confirm_reservation_contact(current_setting('test.contact.active')::uuid, '  Contato recebido pelo chat.  ');
  if not exists (select 1 from public.reservation_contact_events e join public.team_list_reservations(current_setting('test.contact.active')) r on r.id=e.reservation_id
    where e.reservation_id=current_setting('test.contact.active')::uuid and e.actor_id=auth.uid()
    and e.notes='Contato recebido pelo chat.' and e.recorded_at=r.contacted_at and r.status='contacted') then
    raise exception 'Actor, notes, timestamp or status missing'; end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.contact.admin'), true);
select public.confirm_reservation_contact(current_setting('test.contact.active')::uuid, 'This retry must not replace the first note.');
do $$
begin
  if (select count(*) from public.reservation_contact_events where reservation_id=current_setting('test.contact.active')::uuid) <> 1 then raise exception 'Duplicate confirmation event'; end if;
  if not exists (select 1 from public.reservation_contact_events where reservation_id=current_setting('test.contact.active')::uuid
    and actor_id=current_setting('test.contact.staff')::uuid and notes='Contato recebido pelo chat.') then raise exception 'Retry replaced the original audit'; end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.contact.client'), true);
do $$
begin
  if exists (select 1 from public.reservation_contact_events) then raise exception 'Internal notes leaked to client'; end if;
end $$;
reset role;
-- Force an audit-write failure to verify the status transition is atomic.
create function pg_temp.fail_contact_event() returns trigger language plpgsql as $$
begin
  if new.reservation_id=current_setting('test.contact.rollback')::uuid then
    raise exception 'Simulated audit failure' using errcode='ZX001'; end if;
  return new;
end $$;
create trigger test_fail_contact_event before insert on public.reservation_contact_events
for each row execute function pg_temp.fail_contact_event();
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.contact.staff'), true);
do $$
begin
  begin
    perform public.confirm_reservation_contact(current_setting('test.contact.rollback')::uuid, 'Atomic test');
    raise exception 'Audit failure unexpectedly ignored';
  exception when sqlstate 'ZX001' then null; end;
end $$;
reset role;
do $$
begin
  if not exists (select 1 from public.area_reservations where id=current_setting('test.contact.rollback')::uuid and status='pending_contact' and contacted_at is null) then
    raise exception 'Status changed despite failed audit'; end if;
end $$;
-- Revoked team members lose permission without refreshing a JWT.
update public.user_profiles set role='client' where user_id=current_setting('test.contact.staff')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.contact.staff'), true);
do $$
begin
  begin perform public.team_list_reservations(); raise exception 'Revoked staff kept list access';
  exception when insufficient_privilege then null; end;
  begin perform public.confirm_reservation_contact(current_setting('test.contact.rollback')::uuid); raise exception 'Revoked staff kept confirmation access';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
