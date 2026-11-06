-- Requires migration 202611050004; temporary data is rolled back.
begin;
select set_config('test.map.owner',gen_random_uuid()::text,true);
select set_config('test.map.viewer',gen_random_uuid()::text,true);
insert into auth.users(id,email) values
(current_setting('test.map.owner')::uuid,current_setting('test.map.owner')||'@example.invalid'),
(current_setting('test.map.viewer')::uuid,current_setting('test.map.viewer')||'@example.invalid');
do $$ declare p record; n integer:=0; rid uuid; begin
 for p in select r.id region,c.id parcel from (values('08'),('12'),('21'),('27'),('32'),('36'),('41'),('45'),('49')) r(id)
 cross join (values('A1'),('A2'),('A3'),('A4'),('B1'),('B2'),('B3'),('B4'),('C1'),('C2'),('C3'),('C4'),('D1'),('D2'),('D3'),('D4')) c(id)
 where not exists(select 1 from public.area_reservations a where a.region_id=r.id and a.parcel_id=c.id) limit 4 loop
 n:=n+1;
 insert into public.area_reservations(user_id,region_id,parcel_id) values(current_setting('test.map.owner')::uuid,p.region,p.parcel) returning id into rid;
 perform set_config('test.map.id'||n,rid::text,true);
 perform set_config('test.map.region'||n,p.region,true); perform set_config('test.map.parcel'||n,p.parcel,true);
 end loop;
 if n<>4 then raise exception 'Four empty parcels required'; end if;
end $$;
-- One confirmed, one overdue pending, one overdue negotiation; first stays pending and active.
update public.area_reservations set status='contacted' where id in(current_setting('test.map.id2')::uuid,current_setting('test.map.id4')::uuid);
update public.area_reservations set status='confirmed' where id=current_setting('test.map.id2')::uuid;
update public.area_reservations set created_at=now()-interval '121 hours',expires_at=now()-interval '1 hour' where id=current_setting('test.map.id3')::uuid;
update public.area_reservations set created_at=now()-interval '362 hours',expires_at=now()-interval '242 hours',contacted_at=now()-interval '361 hours' where id=current_setting('test.map.id4')::uuid;
set local role anon;
do $$ begin
 begin perform public.map_area_availability(); raise exception 'Anonymous access allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.map.viewer'),true);
do $$ declare rows jsonb; begin
 select jsonb_agg(to_jsonb(v)) into rows from public.map_area_availability() v;
 if not exists(select 1 from public.map_area_availability() v where v.region_id=current_setting('test.map.region1') and v.parcel_id=current_setting('test.map.parcel1') and v.status='reserved' and v.available_until>now()) then raise exception 'Other account cannot see reserved parcel'; end if;
 if not exists(select 1 from public.map_area_availability() v where v.region_id=current_setting('test.map.region2') and v.parcel_id=current_setting('test.map.parcel2') and v.status='confirmed' and v.available_until is null) then raise exception 'Confirmed parcel missing'; end if;
 if exists(select 1 from public.map_area_availability() v where (v.region_id=current_setting('test.map.region3') and v.parcel_id=current_setting('test.map.parcel3')) or (v.region_id=current_setting('test.map.region4') and v.parcel_id=current_setting('test.map.parcel4'))) then raise exception 'Expired parcel still highlighted'; end if;
 if exists(select 1 from jsonb_array_elements(rows) v cross join lateral jsonb_object_keys(v) k where k not in('region_id','parcel_id','status','available_until')) then raise exception 'Unexpected private data'; end if;
 if exists(select 1 from public.area_reservations where user_id=current_setting('test.map.owner')::uuid) then raise exception 'Map RPC weakened own-only RLS'; end if;
end $$;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 begin perform public.map_area_availability(); raise exception sqlstate 'ZX002' using message='Missing user allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
