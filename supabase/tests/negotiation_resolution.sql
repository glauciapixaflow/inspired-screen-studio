-- Core negotiation rules. Run after migration 202611050002. Everything rolls back.
begin;
select set_config('test.res.client',gen_random_uuid()::text,true);
select set_config('test.res.other',gen_random_uuid()::text,true);
select set_config('test.res.staff',gen_random_uuid()::text,true);
select set_config('test.res.admin',gen_random_uuid()::text,true);
insert into auth.users(id,email) values
  (current_setting('test.res.client')::uuid,current_setting('test.res.client')||'@example.invalid'),
  (current_setting('test.res.other')::uuid,current_setting('test.res.other')||'@example.invalid'),
  (current_setting('test.res.staff')::uuid,current_setting('test.res.staff')||'@example.invalid'),
  (current_setting('test.res.admin')::uuid,current_setting('test.res.admin')||'@example.invalid');
update public.user_profiles set role='collaborator' where user_id=current_setting('test.res.staff')::uuid;
update public.user_profiles set role='admin' where user_id=current_setting('test.res.admin')::uuid;
do $$
declare plot record; r uuid; i integer:=0; label text;
begin
  for plot in select a.id as region,b.id as parcel
    from (values('08'),('12'),('21'),('27'),('32'),('36'),('41'),('45'),('49')) a(id)
    cross join (values('A1'),('A2'),('A3'),('A4'),('B1'),('B2'),('B3'),('B4'),('C1'),('C2'),('C3'),('C4'),('D1'),('D2'),('D3'),('D4')) b(id)
    where not exists(select 1 from public.area_reservations x where x.region_id=a.id and x.parcel_id=b.id) limit 5
  loop
    i:=i+1; label:=case i when 1 then 'confirmed' when 2 then 'lazy' when 3 then 'manual' when 4 then 'cron' else 'atomic' end;
    insert into public.area_reservations(user_id,region_id,parcel_id) values(current_setting('test.res.client')::uuid,plot.region,plot.parcel) returning id into r;
    perform set_config('test.res.'||label,r::text,true);
    perform set_config('test.res.'||label||'_region',plot.region,true);
    perform set_config('test.res.'||label||'_parcel',plot.parcel,true);
  end loop;
  if i<>5 then raise exception 'Five free parcels required'; end if;
end $$;
set local role anon;
do $$ begin
  begin perform public.resolve_reservation(current_setting('test.res.confirmed')::uuid,'confirmed'); raise exception 'Anon resolution allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.res.client'),true);
do $$ begin
  begin perform public.resolve_reservation(current_setting('test.res.confirmed')::uuid,'confirmed'); raise exception 'Client resolution allowed'; exception when insufficient_privilege then null; end;
  begin perform public.expire_negotiation_reservations(); raise exception 'Client maintenance allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.res.staff'),true);
select public.confirm_reservation_contact(current_setting('test.res.confirmed')::uuid);
select public.confirm_reservation_contact(current_setting('test.res.lazy')::uuid);
select public.confirm_reservation_contact(current_setting('test.res.manual')::uuid);
select public.confirm_reservation_contact(current_setting('test.res.cron')::uuid);
select public.confirm_reservation_contact(current_setting('test.res.atomic')::uuid);
reset role;
do $$ begin
  if exists(select 1 from public.area_reservations where user_id=current_setting('test.res.client')::uuid
    and negotiation_expires_at-contacted_at<>interval '360 hours') then raise exception 'Negotiation is not exactly 15 days'; end if;
end $$;
-- Simulate the exact cutoff. The current statement clock is already at/after this timestamp.
update public.area_reservations set created_at=now()-interval '361 hours',expires_at=now()-interval '241 hours',contacted_at=now()-interval '360 hours'
where id in(current_setting('test.res.lazy')::uuid,current_setting('test.res.cron')::uuid);
-- Contact cutoff may have elapsed, but a negotiation with one hour remaining can still conclude.
update public.area_reservations set created_at=now()-interval '360 hours',expires_at=now()-interval '240 hours',contacted_at=now()-interval '359 hours'
where id=current_setting('test.res.confirmed')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.res.staff'),true);
do $$ begin
  begin perform public.resolve_reservation(current_setting('test.res.lazy')::uuid,'confirmed');
    raise exception sqlstate 'ZX002' using message='Late confirmation accepted'; exception when raise_exception then null; end;
  begin perform public.resolve_reservation(current_setting('test.res.atomic')::uuid,'invalid'); raise exception 'Invalid decision accepted'; exception when invalid_parameter_value then null; end;
end $$;
select public.resolve_reservation(current_setting('test.res.confirmed')::uuid,'confirmed','Acordo concluído.');
select public.resolve_reservation(current_setting('test.res.confirmed')::uuid,'confirmed','Must not replace original.');
reset role;
do $$ begin
  if (select count(*) from public.reservation_resolution_events where reservation_id=current_setting('test.res.confirmed')::uuid)<>1 then raise exception 'Duplicate resolution'; end if;
  if not exists(select 1 from public.reservation_resolution_events where reservation_id=current_setting('test.res.confirmed')::uuid
    and actor_id=current_setting('test.res.staff')::uuid and notes='Acordo concluído.') then raise exception 'Missing or changed audit'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.res.client'),true);
do $$ begin
  if not exists(select 1 from public.area_reservation_details where id=current_setting('test.res.lazy')::uuid and status='deactivated') then raise exception 'View did not deactivate at cutoff'; end if;
  if exists(select 1 from public.reservation_resolution_events) then raise exception 'Internal history leaked'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.res.other'),true);
do $$ begin
  begin insert into public.area_reservations(region_id,parcel_id) values(current_setting('test.res.confirmed_region'),current_setting('test.res.confirmed_parcel'));
    raise exception 'Confirmed parcel was released'; exception when unique_violation then null; end;
end $$;
-- Availability must work even before the scheduled job executes.
insert into public.area_reservations(region_id,parcel_id) values(current_setting('test.res.lazy_region'),current_setting('test.res.lazy_parcel'));
reset role;
do $$ begin
  if not exists(select 1 from public.reservation_resolution_events where reservation_id=current_setting('test.res.lazy')::uuid
    and actor_id is null and reason='negotiation_timeout') then raise exception 'Lazy automatic audit missing'; end if;
end $$;
-- Move the confirmed fixture into the past: it must remain unavailable forever.
update public.area_reservations set created_at=now()-interval '601 hours',expires_at=now()-interval '481 hours',contacted_at=now()-interval '600 hours',resolved_at=now()-interval '599 hours'
where id=current_setting('test.res.confirmed')::uuid;
do $$ begin
  if public.expire_negotiation_reservations()<>1 then raise exception 'Maintenance did not process the overdue negotiation'; end if;
  if public.expire_negotiation_reservations()<>0 then raise exception 'Maintenance is not idempotent'; end if;
  if not exists(select 1 from public.area_reservations where id=current_setting('test.res.confirmed')::uuid and status='confirmed') then raise exception 'Confirmed reservation expired'; end if;
  if not exists(select 1 from public.reservation_resolution_events e join public.area_reservations r on r.id=e.reservation_id
    where r.id=current_setting('test.res.cron')::uuid and e.resolved_at=r.negotiation_expires_at and e.reason='negotiation_timeout' and e.actor_id is null) then raise exception 'Scheduled audit is invalid'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.res.admin'),true);
select public.resolve_reservation(current_setting('test.res.manual')::uuid,'deactivated','Cliente desistiu.');
do $$ begin
  begin perform public.resolve_reservation(current_setting('test.res.confirmed')::uuid,'deactivated'); raise exception 'Closed result was reversed'; exception when serialization_failure then null; end;
  if not exists(select 1 from public.reservation_resolution_events where reservation_id=current_setting('test.res.manual')::uuid and actor_id=auth.uid()) then raise exception 'Manual actor not recorded'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.res.other'),true);
insert into public.area_reservations(region_id,parcel_id) values(current_setting('test.res.manual_region'),current_setting('test.res.manual_parcel'));
reset role;
-- A failed history write must roll back definitive confirmation as well.
create function pg_temp.fail_resolution_event() returns trigger language plpgsql as $$ begin
  if new.reservation_id=current_setting('test.res.atomic')::uuid then raise exception 'Audit failure' using errcode='ZX001'; end if; return new; end $$;
create trigger test_fail_resolution before insert on public.reservation_resolution_events for each row execute function pg_temp.fail_resolution_event();
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.res.staff'),true);
do $$ begin
  begin perform public.resolve_reservation(current_setting('test.res.atomic')::uuid,'confirmed'); raise exception 'Failed audit ignored'; exception when sqlstate 'ZX001' then null; end;
end $$;
reset role;
do $$ begin
  if not exists(select 1 from public.area_reservations where id=current_setting('test.res.atomic')::uuid and status='contacted' and resolved_at is null) then raise exception 'Resolution persisted without audit'; end if;
end $$;
rollback;
