-- Requires 202611090001. All data and role changes roll back.
begin;
select set_config('test.chat.owner',gen_random_uuid()::text,true);
select set_config('test.chat.other',gen_random_uuid()::text,true);
select set_config('test.chat.staff',gen_random_uuid()::text,true);
insert into auth.users(id,email) select current_setting(v)::uuid,current_setting(v)||'@example.invalid' from (values('test.chat.owner'),('test.chat.other'),('test.chat.staff')) x(v);
update public.user_profiles set role='collaborator' where user_id=current_setting('test.chat.staff')::uuid;
do $$ declare p record;n integer:=0;rid uuid;begin
 for p in select r.id region,c.id parcel from (values('08'),('12'),('21'),('27'),('32'),('36'),('41'),('45'),('49')) r(id)
 cross join(values('A1'),('A2'),('A3'),('A4'),('B1'),('B2'),('B3'),('B4'),('C1'),('C2'),('C3'),('C4'),('D1'),('D2'),('D3'),('D4')) c(id)
 where not exists(select 1 from public.area_reservations a where a.region_id=r.id and a.parcel_id=c.id) limit 3 loop
 n:=n+1;insert into public.area_reservations(user_id,region_id,parcel_id) values(current_setting(case when n=2 then 'test.chat.other' else 'test.chat.owner' end)::uuid,p.region,p.parcel) returning id into rid;
 perform set_config('test.chat.res'||n,rid::text,true);
 end loop;
 if n<>3 then raise exception 'Three free parcels required';end if;
end $$;
set local role anon;
do $$ begin
 begin perform public.get_reservation_chat(current_setting('test.chat.res1')::uuid);raise exception 'Anonymous chat allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.chat.owner'),true);
do $$ begin
 if public.get_reservation_chat(current_setting('test.chat.res1')::uuid)->'conversation'<>'null'::jsonb then raise exception 'Read created conversation';end if;
 begin perform public.get_reservation_chat(current_setting('test.chat.res2')::uuid);raise exception 'Other chat leaked';exception when no_data_found then null;end;
 begin perform public.claim_reservation_ai(current_setting('test.chat.res1')::uuid,auth.uid(),gen_random_uuid());raise exception 'Client AI claim allowed';exception when insufficient_privilege then null;end;
 begin insert into public.reservation_chat_messages(conversation_id,sender_kind,content) values(gen_random_uuid(),'assistant','Forged AI');raise exception 'Direct AI write allowed';exception when insufficient_privilege then null;end;
end $$;
select set_config('test.chat.request',gen_random_uuid()::text,true);
select set_config('test.chat.msg',(public.send_reservation_chat(current_setting('test.chat.res1')::uuid,'Como funciona o prazo?',current_setting('test.chat.request')::uuid)).id::text,true);
select public.send_reservation_chat(current_setting('test.chat.res1')::uuid,'Como funciona o prazo?',current_setting('test.chat.request')::uuid);
do $$ begin
 if jsonb_array_length(public.get_reservation_chat(current_setting('test.chat.res1')::uuid)->'messages')<>1 then raise exception 'Retry duplicated message';end if;
 begin perform public.set_reservation_chat_mode(current_setting('test.chat.res1')::uuid,'human');raise exception 'Client took team role';exception when insufficient_privilege then null;end;
 begin perform public.send_reservation_chat(current_setting('test.chat.res1')::uuid,' ',gen_random_uuid());raise exception 'Empty message accepted';exception when invalid_parameter_value then null;end;
end $$;
reset role;
set local role service_role;
select set_config('test.chat.turn',(public.claim_reservation_ai(current_setting('test.chat.res1')::uuid,current_setting('test.chat.owner')::uuid,current_setting('test.chat.msg')::uuid)->>'turn_id'),true);
do $$ begin
 if public.claim_reservation_ai(current_setting('test.chat.res1')::uuid,current_setting('test.chat.owner')::uuid,current_setting('test.chat.msg')::uuid)->>'state'<>'duplicate' then raise exception 'Duplicate paid attempt';end if;
 begin perform public.claim_reservation_ai(current_setting('test.chat.res1')::uuid,current_setting('test.chat.other')::uuid,current_setting('test.chat.msg')::uuid);raise exception 'Claim for wrong owner allowed';exception when no_data_found then null;end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.chat.owner'),true);
do $$ begin
 begin perform public.send_reservation_chat(current_setting('test.chat.res1')::uuid,'Outra dúvida',gen_random_uuid());raise exception 'Message sent during AI processing';exception when object_not_in_prerequisite_state then null;end;
end $$;
reset role;
set local role service_role;
select public.finish_reservation_ai(current_setting('test.chat.turn')::uuid,'Você tem cinco dias para o contato confirmado pela equipe.',false);
do $$ begin
 if public.finish_reservation_ai(current_setting('test.chat.turn')::uuid,'Duplicada',false) then raise exception 'Duplicate AI reply';end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.chat.owner'),true);
select set_config('test.chat.msg2',(public.send_reservation_chat(current_setting('test.chat.res1')::uuid,'Quero conversar com uma pessoa.',gen_random_uuid())).id::text,true);
reset role;
set local role service_role;
select set_config('test.chat.turn2',(public.claim_reservation_ai(current_setting('test.chat.res1')::uuid,current_setting('test.chat.owner')::uuid,current_setting('test.chat.msg2')::uuid)->>'turn_id'),true);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.chat.owner'),true);
select public.set_reservation_chat_mode(current_setting('test.chat.res1')::uuid,'waiting_team');
select set_config('request.jwt.claim.sub',current_setting('test.chat.other'),true);
do $$ begin
 if exists(select 1 from public.list_reservation_chats() where reservation_id=current_setting('test.chat.res1')::uuid) then raise exception 'Chat listed for another client';end if;
 begin perform public.send_reservation_chat(current_setting('test.chat.res1')::uuid,'Intruso',gen_random_uuid());raise exception 'Cross account message';exception when no_data_found then null;end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.chat.staff'),true);
do $$ begin
 if not exists(select 1 from public.list_reservation_chats() where reservation_id=current_setting('test.chat.res1')::uuid and status='waiting_team') then raise exception 'Team queue missing';end if;
end $$;
select public.set_reservation_chat_mode(current_setting('test.chat.res1')::uuid,'human');
select public.send_reservation_chat(current_setting('test.chat.res1')::uuid,'Olá, sou da equipe.',gen_random_uuid());
reset role;
set local role service_role;
do $$ begin
 if public.finish_reservation_ai(current_setting('test.chat.turn2')::uuid,'Resposta tardia da IA',false) then raise exception 'AI overrode takeover';end if;
end $$;
reset role;
update public.user_profiles set role='client' where user_id=current_setting('test.chat.staff')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.chat.staff'),true);
do $$ begin
 begin perform public.get_reservation_chat(current_setting('test.chat.res1')::uuid);raise exception 'Removed team role retained access';exception when no_data_found then null;end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.chat.owner'),true);
select set_config('test.chat.msg3',(public.send_reservation_chat(current_setting('test.chat.res3')::uuid,'Tenho uma dúvida.',gen_random_uuid())).id::text,true);
reset role;
set local role service_role;
select set_config('test.chat.turn3',(public.claim_reservation_ai(current_setting('test.chat.res3')::uuid,current_setting('test.chat.owner')::uuid,current_setting('test.chat.msg3')::uuid)->>'turn_id'),true);
select public.finish_reservation_ai(current_setting('test.chat.turn3')::uuid,'IA indisponível; equipe continuará.',true,true);
reset role;
do $$ begin
 if not exists(select 1 from public.reservation_conversations where reservation_id=current_setting('test.chat.res3')::uuid and status='waiting_team') then raise exception 'Failure did not hand over';end if;
 if not exists(select 1 from public.area_reservations where id=current_setting('test.chat.res1')::uuid and status='pending_contact' and contacted_at is null) then raise exception 'Chat modified reservation';end if;
 if exists(select 1 from public.reservation_chat_messages where content='Resposta tardia da IA') then raise exception 'Late AI saved';end if;
end $$;
-- Quota is shared by the owner's conversations; no paid request is made on overflow.
update public.reservation_conversations set status='ai' where reservation_id=current_setting('test.chat.res3')::uuid;
do $$ declare c uuid;mid uuid;n integer;begin
 select id into c from public.reservation_conversations where reservation_id=current_setting('test.chat.res3')::uuid;
 select 20-count(*) into n from public.reservation_ai_turns t join public.reservation_conversations x on x.id=t.conversation_id where x.user_id=current_setting('test.chat.owner')::uuid;
 for i in 1..n loop
 insert into public.reservation_chat_messages(conversation_id,sender_id,sender_kind,content,created_at) values(c,current_setting('test.chat.owner')::uuid,'client','Fixture',clock_timestamp()-interval '2 minutes') returning id into mid;
 insert into public.reservation_ai_turns(conversation_id,message_id,status) values(c,mid,'finished');
 end loop;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.chat.owner'),true);
select set_config('test.chat.quota_msg',(public.send_reservation_chat(current_setting('test.chat.res3')::uuid,'Mais uma dúvida.',gen_random_uuid())).id::text,true);
reset role;
set local role service_role;
do $$ begin
 if public.claim_reservation_ai(current_setting('test.chat.res3')::uuid,current_setting('test.chat.owner')::uuid,current_setting('test.chat.quota_msg')::uuid)->>'state'<>'limit' then raise exception 'Quota not enforced';end if;
end $$;
reset role;
rollback;
