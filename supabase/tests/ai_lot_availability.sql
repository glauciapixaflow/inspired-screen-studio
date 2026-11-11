-- Run only against an isolated test database. All fixture data is rolled back.
begin;
select set_config('test.lots.owner', gen_random_uuid()::text, true);
insert into auth.users(id,email) values(current_setting('test.lots.owner')::uuid, 'lots-test@example.invalid');
insert into public.area_reservations(user_id,region_id,parcel_id)
select current_setting('test.lots.owner')::uuid,'08',p
from unnest(array['A1','A2','A3','A4','B1','B2','B3']) p;
update public.area_reservations set status='contacted'
where user_id=current_setting('test.lots.owner')::uuid and parcel_id in ('A2','A3','B1');
update public.area_reservations set status='confirmed'
where user_id=current_setting('test.lots.owner')::uuid and parcel_id='A3';
update public.area_reservations set created_at=now()-interval '121 hours',expires_at=now()-interval '1 hour'
where user_id=current_setting('test.lots.owner')::uuid and parcel_id='A4';
update public.area_reservations set created_at=now()-interval '362 hours',expires_at=now()-interval '242 hours',contacted_at=now()-interval '361 hours',negotiation_expires_at=now()-interval '1 hour'
where user_id=current_setting('test.lots.owner')::uuid and parcel_id='B1';
update public.area_reservations set status='cancelled'
where user_id=current_setting('test.lots.owner')::uuid and parcel_id='B2';
update public.area_reservations set created_at=now()-interval '121 hours',expires_at=now()-interval '1 hour'
where user_id=current_setting('test.lots.owner')::uuid and parcel_id='B3';
update public.area_reservations set status='expired'
where user_id=current_setting('test.lots.owner')::uuid and parcel_id='B3';
set local role anon;
do $$ begin
 begin perform public.get_ai_lot_availability(); raise exception 'Anonymous aggregate access allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ begin
 begin perform public.get_ai_lot_availability(); raise exception 'Browser service RPC access allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
do $$ declare r record; begin
 if (select count(*) from public.get_ai_lot_availability()) <> 9 then raise exception 'Missing regions'; end if;
 select * into r from public.get_ai_lot_availability() where region_id='08';
 if r.total<>16 or r.available<>13 or r.reserved<>2 or r.confirmed<>1 or r.checked_at is null then
   raise exception 'Incorrect active land counts: %',row_to_json(r);
 end if;
 if exists(select 1 from public.get_ai_lot_availability() where region_id<>'08' and available<>16) then raise exception 'Region counts leaked'; end if;
 if exists(select 1 from public.get_ai_lot_availability() v cross join lateral jsonb_object_keys(to_jsonb(v)) k
   where k not in ('region_id','total','available','reserved','confirmed','checked_at')) then raise exception 'Private data exposed'; end if;
end $$;
reset role;
rollback;
