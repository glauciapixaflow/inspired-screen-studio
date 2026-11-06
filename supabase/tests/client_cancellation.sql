-- Apply after migration 202611050005. Temporary records are rolled back.
begin;
select set_config('test.cancel.owner',gen_random_uuid()::text,true);
select set_config('test.cancel.other',gen_random_uuid()::text,true);
insert into auth.users(id,email) values
(current_setting('test.cancel.owner')::uuid,current_setting('test.cancel.owner')||'@example.invalid'),
(current_setting('test.cancel.other')::uuid,current_setting('test.cancel.other')||'@example.invalid');
do $$ declare p record; n integer:=0; rid uuid; label text; begin
 for p in select r.id region,c.id parcel from (values('08'),('12'),('21'),('27'),('32'),('36'),('41'),('45'),('49')) r(id)
 cross join (values('A1'),('A2'),('A3'),('A4'),('B1'),('B2'),('B3'),('B4'),('C1'),('C2'),('C3'),('C4'),('D1'),('D2'),('D3'),('D4')) c(id)
 where not exists(select 1 from public.area_reservations a where a.region_id=r.id and a.parcel_id=c.id) limit 6 loop
 n:=n+1; label:=case n when 1 then 'pending' when 2 then 'contacted' when 3 then 'confirmed' when 4 then 'expired' when 5 then 'atomic' else 'overdue' end;
 insert into public.area_reservations(user_id,region_id,parcel_id) values(current_setting('test.cancel.owner')::uuid,p.region,p.parcel) returning id into rid;
 perform set_config('test.cancel.'||label,rid::text,true);perform set_config('test.cancel.'||label||'_region',p.region,true);perform set_config('test.cancel.'||label||'_parcel',p.parcel,true);
 end loop;
 if n<>6 then raise exception 'Six empty parcels required'; end if;
end $$;
update public.area_reservations set status='contacted' where id in(current_setting('test.cancel.contacted')::uuid,current_setting('test.cancel.confirmed')::uuid,current_setting('test.cancel.overdue')::uuid);
update public.area_reservations set status='confirmed' where id=current_setting('test.cancel.confirmed')::uuid;
update public.area_reservations set created_at=now()-interval '121 hours',expires_at=now()-interval '1 hour' where id=current_setting('test.cancel.expired')::uuid;
update public.area_reservations set created_at=now()-interval '362 hours',expires_at=now()-interval '242 hours',contacted_at=now()-interval '361 hours' where id=current_setting('test.cancel.overdue')::uuid;
set local role anon;
do $$ begin
 begin perform public.cancel_my_reservation(current_setting('test.cancel.pending')::uuid); raise exception 'Anonymous cancellation allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.cancel.other'),true);
do $$ begin
 begin perform public.cancel_my_reservation(current_setting('test.cancel.pending')::uuid); raise exception 'Other owner cancellation allowed'; exception when no_data_found then null; end;
 begin update public.area_reservations set status='cancelled' where id=current_setting('test.cancel.pending')::uuid; raise exception 'Direct update allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.cancel.owner'),true);
select public.cancel_my_reservation(current_setting('test.cancel.pending')::uuid);
select public.cancel_my_reservation(current_setting('test.cancel.pending')::uuid);
select public.cancel_my_reservation(current_setting('test.cancel.contacted')::uuid);
do $$ begin
 begin perform public.cancel_my_reservation(current_setting('test.cancel.confirmed')::uuid); raise exception sqlstate 'ZX002' using message='Completed negotiation cancelled'; exception when raise_exception then null; end;
 begin perform public.cancel_my_reservation(current_setting('test.cancel.expired')::uuid); raise exception sqlstate 'ZX002' using message='Expired hold cancelled'; exception when raise_exception then null; end;
 begin perform public.cancel_my_reservation(current_setting('test.cancel.overdue')::uuid); raise exception sqlstate 'ZX002' using message='Overdue negotiation cancelled'; exception when raise_exception then null; end;
 if exists(select 1 from public.reservation_cancellation_events) then raise exception 'Client read internal event table'; end if;
 if not exists(select 1 from public.area_reservation_details where id=current_setting('test.cancel.pending')::uuid and status='cancelled' and resolved_at is not null) then raise exception 'Cancellation missing from history'; end if;
 if exists(select 1 from public.map_area_availability() v where v.region_id=current_setting('test.cancel.pending_region') and v.parcel_id=current_setting('test.cancel.pending_parcel')) then raise exception 'Cancelled parcel still highlighted'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.cancel.other'),true);
insert into public.area_reservations(region_id,parcel_id) values(current_setting('test.cancel.pending_region'),current_setting('test.cancel.pending_parcel'));
insert into public.area_reservations(region_id,parcel_id) values(current_setting('test.cancel.contacted_region'),current_setting('test.cancel.contacted_parcel'));
reset role;
do $$ begin
 if (select count(*) from public.reservation_cancellation_events where reservation_id=current_setting('test.cancel.pending')::uuid)<>1 then raise exception 'Retry duplicated cancellation'; end if;
 if not exists(select 1 from public.reservation_cancellation_events e join public.area_reservations r on r.id=e.reservation_id where r.id=current_setting('test.cancel.contacted')::uuid and e.actor_id=r.user_id and e.cancelled_at=r.resolved_at and r.contacted_at is not null) then raise exception 'Contact history or cancellation actor missing'; end if;
 -- Simulates a team decision winning the lock: completed reservations remain final.
 if not exists(select 1 from public.area_reservations where id=current_setting('test.cancel.confirmed')::uuid and status='confirmed') then raise exception 'Completed status changed'; end if;
end $$;
update public.user_profiles set role='collaborator' where user_id=current_setting('test.cancel.other')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.cancel.other'),true);
do $$ begin
 if not exists(select 1 from public.team_list_reservations('', 'cancelled') where id=current_setting('test.cancel.pending')::uuid and resolution_reason='client_cancelled' and resolved_at is not null) then raise exception 'Team cancellation history missing'; end if;
 begin perform public.confirm_reservation_contact(current_setting('test.cancel.contacted')::uuid); raise exception sqlstate 'ZX002' using message='Cancellation reactivated'; exception when raise_exception then null; end;
 begin perform public.resolve_reservation(current_setting('test.cancel.contacted')::uuid,'confirmed'); raise exception sqlstate 'ZX002' using message='Cancelled reservation concluded'; exception when raise_exception then null; end;
end $$;
reset role;
create function pg_temp.fail_cancellation_event() returns trigger language plpgsql as $$ begin
 if new.reservation_id=current_setting('test.cancel.atomic')::uuid then raise exception 'History failed' using errcode='ZX001'; end if; return new; end $$;
create trigger test_fail_cancellation before insert on public.reservation_cancellation_events for each row execute function pg_temp.fail_cancellation_event();
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.cancel.owner'),true);
do $$ begin
 begin perform public.cancel_my_reservation(current_setting('test.cancel.atomic')::uuid); raise exception 'Ignored history error'; exception when sqlstate 'ZX001' then null; end;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.area_reservations where id=current_setting('test.cancel.atomic')::uuid and status='pending_contact' and resolved_at is null) then raise exception 'Cancellation survived failed audit'; end if;
end $$;
rollback;
