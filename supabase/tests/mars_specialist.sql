-- Isolated quota metadata, permissions and duplicate suppression. No real messages saved.
begin;
select set_config('test.mars.owner',gen_random_uuid()::text,true);
select set_config('test.mars.other',gen_random_uuid()::text,true);
insert into auth.users(id,email) select current_setting(v)::uuid,current_setting(v)||'@example.invalid' from (values('test.mars.owner'),('test.mars.other')) x(v);
set local role anon;
do $$ begin
 begin perform public.claim_mars_specialist(current_setting('test.mars.owner')::uuid,gen_random_uuid());raise exception 'Anonymous paid claim allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.mars.owner'),true);
do $$ begin
 begin perform public.claim_mars_specialist(auth.uid(),gen_random_uuid());raise exception 'Client paid claim allowed';exception when insufficient_privilege then null;end;
 begin perform * from public.mars_specialist_requests;raise exception 'Quota metadata exposed';exception when insufficient_privilege then null;end;
 begin insert into public.mars_specialist_requests(user_id,request_id) values(auth.uid(),gen_random_uuid());raise exception 'Forged quota allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('test.mars.request',gen_random_uuid()::text,true);
set local role service_role;
do $$ declare uid uuid:=current_setting('test.mars.owner')::uuid;req uuid:=current_setting('test.mars.request')::uuid;i integer;begin
 if public.claim_mars_specialist(uid,req)->>'state'<>'claimed' then raise exception 'First claim failed';end if;
 if public.claim_mars_specialist(uid,req)->>'state'<>'duplicate' then raise exception 'Duplicate claim allowed';end if;
 for i in 1..4 loop
  if public.claim_mars_specialist(uid,gen_random_uuid())->>'state'<>'claimed' then raise exception 'Early rate limit';end if;
 end loop;
 if public.claim_mars_specialist(uid,gen_random_uuid())->>'state'<>'limit' then raise exception 'Minute rate exceeded';end if;
 if public.claim_mars_specialist(current_setting('test.mars.other')::uuid,req)->>'state'<>'claimed' then raise exception 'Users share quota';end if;
 begin perform public.claim_mars_specialist(gen_random_uuid(),gen_random_uuid());raise exception 'Unknown user accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
update public.mars_specialist_requests set created_at=clock_timestamp()-interval '2 hours' where user_id=current_setting('test.mars.owner')::uuid;
insert into public.mars_specialist_requests(user_id,request_id,created_at) select current_setting('test.mars.owner')::uuid,gen_random_uuid(),clock_timestamp()-interval '1 hour' from generate_series(1,15);
set local role service_role;
do $$ begin
 if public.claim_mars_specialist(current_setting('test.mars.owner')::uuid,gen_random_uuid())->>'state'<>'limit' then raise exception 'Daily quota exceeded';end if;
end $$;
reset role;
update public.mars_specialist_requests set created_at=clock_timestamp()-interval '25 hours' where user_id=current_setting('test.mars.owner')::uuid;
set local role service_role;
do $$ begin
 if public.claim_mars_specialist(current_setting('test.mars.owner')::uuid,gen_random_uuid())->>'state'<>'claimed' then raise exception 'Rolling quota failed';end if;
end $$;
reset role;
rollback;