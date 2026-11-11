-- Apply after 202611050005_client_cancellation.sql. No reservation status is changed by chat.
begin;
create table public.reservation_conversations (
 id uuid primary key default gen_random_uuid(),
 reservation_id uuid not null unique references public.area_reservations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'ai' check(status in ('ai','waiting_team','human')),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp()
);
create table public.reservation_chat_messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.reservation_conversations(id) on delete cascade,
 sender_id uuid references auth.users(id) on delete set null,
 sender_kind text not null check(sender_kind in ('client','team','assistant','system')),
 content text not null check(length(btrim(content)) between 1 and 4000),
 request_id uuid not null default gen_random_uuid(),
 created_at timestamptz not null default clock_timestamp(),
 unique(conversation_id,request_id)
);
create table public.reservation_ai_turns (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.reservation_conversations(id) on delete cascade,
 message_id uuid not null unique references public.reservation_chat_messages(id) on delete cascade,
 status text not null default 'processing' check(status in ('processing','finished','failed')),
 created_at timestamptz not null default clock_timestamp()
);
create index reservation_chat_history_idx on public.reservation_chat_messages(conversation_id,created_at,id);
create index reservation_chat_rate_idx on public.reservation_chat_messages(sender_id,created_at);
create index reservation_conversations_updated_idx on public.reservation_conversations(updated_at desc);
alter table public.reservation_conversations enable row level security;
alter table public.reservation_chat_messages enable row level security;
alter table public.reservation_ai_turns enable row level security;
-- All access goes through authorization-checking functions, including team reads.
revoke all on public.reservation_conversations, public.reservation_chat_messages, public.reservation_ai_turns from PUBLIC;
revoke all on public.reservation_conversations, public.reservation_chat_messages, public.reservation_ai_turns from anon;
revoke all on public.reservation_conversations, public.reservation_chat_messages, public.reservation_ai_turns from authenticated;

create function public.ensure_reservation_conversation(p_reservation_id uuid)
returns public.reservation_conversations language plpgsql security definer set search_path=''
as $$ declare r public.area_reservations; c public.reservation_conversations; begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select * into r from public.area_reservations where id=p_reservation_id;
 if not found or (r.user_id<>auth.uid() and coalesce(public.current_app_role(),'') not in('admin','collaborator')) then
   raise exception 'Reservation not found' using errcode='P0002'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chat:'||p_reservation_id::text,0));
 if r.user_id<>auth.uid() and coalesce(public.current_app_role(),'') not in('admin','collaborator') then raise exception 'Team permission removed' using errcode='42501'; end if;
 insert into public.reservation_conversations(reservation_id,user_id) values(r.id,r.user_id) on conflict(reservation_id) do nothing;
 select * into c from public.reservation_conversations where reservation_id=r.id;
 return c;
end $$;
revoke all on function public.ensure_reservation_conversation(uuid) from PUBLIC;
revoke all on function public.ensure_reservation_conversation(uuid) from anon;
revoke all on function public.ensure_reservation_conversation(uuid) from authenticated;

create function public.get_reservation_chat(p_reservation_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare r public.area_reservations; c public.reservation_conversations; history jsonb; begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select * into r from public.area_reservations where id=p_reservation_id;
 if not found or (r.user_id<>auth.uid() and coalesce(public.current_app_role(),'') not in('admin','collaborator')) then
   raise exception 'Reservation not found' using errcode='P0002'; end if;
 select * into c from public.reservation_conversations where reservation_id=r.id;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'sender_kind',m.sender_kind,'content',m.content,'created_at',m.created_at) order by m.created_at,m.id),'[]'::jsonb)
 into history from (select * from public.reservation_chat_messages where conversation_id=c.id order by created_at desc,id desc limit 100) m;
 return jsonb_build_object('reservation',(select to_jsonb(d) from public.area_reservation_details d where d.id=r.id),
 'is_owner',r.user_id=auth.uid(),'conversation',case when c.id is null then null else jsonb_build_object('id',c.id,'status',c.status,'updated_at',c.updated_at) end,'messages',history);
end $$;
revoke all on function public.get_reservation_chat(uuid) from PUBLIC;
revoke all on function public.get_reservation_chat(uuid) from anon;
grant execute on function public.get_reservation_chat(uuid) to authenticated;

create function public.list_reservation_chats()
returns table(reservation_id uuid,region_id text,parcel_id text,conversation_id uuid,status text,updated_at timestamptz)
language plpgsql security definer set search_path=''
as $$ begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 return query select c.reservation_id,r.region_id,r.parcel_id,c.id,c.status,c.updated_at
 from public.reservation_conversations c join public.area_reservations r on r.id=c.reservation_id
 where c.user_id=auth.uid() or coalesce(public.current_app_role(),'') in('admin','collaborator')
 order by c.updated_at desc,c.id limit 100;
end $$;
revoke all on function public.list_reservation_chats() from PUBLIC;
revoke all on function public.list_reservation_chats() from anon;
grant execute on function public.list_reservation_chats() to authenticated;

create function public.send_reservation_chat(p_reservation_id uuid,p_content text,p_request_id uuid)
returns public.reservation_chat_messages language plpgsql security definer set search_path=''
as $$ declare c public.reservation_conversations; m public.reservation_chat_messages; kind text; begin
 if p_request_id is null or p_content is null or length(btrim(p_content)) not between 1 and 2000 then raise exception 'Invalid message' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chat-sender:'||auth.uid()::text,0));
 c:=public.ensure_reservation_conversation(p_reservation_id);
 select * into m from public.reservation_chat_messages where conversation_id=c.id and request_id=p_request_id;
 if found then
  if m.sender_id is distinct from auth.uid() or m.content<>btrim(p_content) then raise exception 'Request conflict' using errcode='22023'; end if;
  return m;
 end if;
 if (select count(*) from public.reservation_chat_messages where sender_id=auth.uid() and created_at>clock_timestamp()-interval '1 minute')>=10 then raise exception 'Message rate exceeded' using errcode='54000'; end if;
 kind:=case when c.user_id=auth.uid() then 'client' else 'team' end;
 if kind='client' and c.status='ai' and exists(select 1 from public.reservation_ai_turns where conversation_id=c.id and status='processing' and created_at>clock_timestamp()-interval '75 seconds') then raise exception 'Wait for assistant' using errcode='55000'; end if;
 if kind='team' then update public.reservation_conversations set status='human' where id=c.id; end if;
 insert into public.reservation_chat_messages(conversation_id,sender_id,sender_kind,content,request_id) values(c.id,auth.uid(),kind,btrim(p_content),p_request_id) returning * into m;
 update public.reservation_conversations set updated_at=m.created_at where id=c.id;
 return m;
end $$;
revoke all on function public.send_reservation_chat(uuid,text,uuid) from PUBLIC;
revoke all on function public.send_reservation_chat(uuid,text,uuid) from anon;
grant execute on function public.send_reservation_chat(uuid,text,uuid) to authenticated;

create function public.set_reservation_chat_mode(p_reservation_id uuid,p_mode text)
returns void language plpgsql security definer set search_path=''
as $$ declare c public.reservation_conversations; note text; begin
 if p_mode is null or p_mode not in('waiting_team','human') then raise exception 'Invalid mode' using errcode='22023'; end if;
 c:=public.ensure_reservation_conversation(p_reservation_id);
 if p_mode='human' and coalesce(public.current_app_role(),'') not in('admin','collaborator') then raise exception 'Team access required' using errcode='42501'; end if;
 if c.status='human' or c.status=p_mode then return; end if;
 note:=case when p_mode='human' then 'A equipe humana assumiu o atendimento.' else 'Atendimento solicitado à equipe humana. O prazo da reserva continua valendo.' end;
 update public.reservation_conversations set status=p_mode,updated_at=clock_timestamp() where id=c.id;
 insert into public.reservation_chat_messages(conversation_id,sender_id,sender_kind,content) values(c.id,auth.uid(),'system',note);
end $$;
revoke all on function public.set_reservation_chat_mode(uuid,text) from PUBLIC;
revoke all on function public.set_reservation_chat_mode(uuid,text) from anon;
grant execute on function public.set_reservation_chat_mode(uuid,text) to authenticated;

-- Service-only AI claim: one paid attempt per message, with daily quota and serialized work.
create function public.claim_reservation_ai(p_reservation_id uuid,p_user_id uuid,p_message_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare c public.reservation_conversations; m public.reservation_chat_messages; turn_id uuid; history jsonb; begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ai-user:'||p_user_id::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chat:'||p_reservation_id::text,0));
 select * into c from public.reservation_conversations where reservation_id=p_reservation_id and user_id=p_user_id;
 if not found then raise exception 'Reservation not found' using errcode='P0002'; end if;
 if c.status<>'ai' then return jsonb_build_object('state','human'); end if;
 select * into m from public.reservation_chat_messages where conversation_id=c.id order by created_at desc,id desc limit 1;
 if m.id is distinct from p_message_id or m.sender_kind<>'client' or m.sender_id is distinct from p_user_id then return jsonb_build_object('state','obsolete'); end if;
 if exists(select 1 from public.reservation_ai_turns where message_id=p_message_id) then return jsonb_build_object('state','duplicate'); end if;
 if exists(select 1 from public.reservation_ai_turns where conversation_id=c.id and status='processing' and created_at>clock_timestamp()-interval '75 seconds') then return jsonb_build_object('state','busy'); end if;
 if (select count(*) from public.reservation_ai_turns t join public.reservation_conversations owner on owner.id=t.conversation_id where owner.user_id=p_user_id and t.created_at>clock_timestamp()-interval '24 hours')>=20 then
   update public.reservation_conversations set status='waiting_team',updated_at=clock_timestamp() where id=c.id;
   insert into public.reservation_chat_messages(conversation_id,sender_kind,content) values(c.id,'system','O limite de respostas automáticas foi atingido. A equipe humana continuará o atendimento.');
   return jsonb_build_object('state','limit');
 end if;
 insert into public.reservation_ai_turns(conversation_id,message_id) values(c.id,m.id) returning id into turn_id;
 select jsonb_agg(jsonb_build_object('role',case when h.sender_kind='assistant' then 'assistant' else 'user' end,'content',h.content) order by h.created_at,h.id) into history
 from (select * from public.reservation_chat_messages where conversation_id=c.id and sender_kind in('client','assistant') order by created_at desc,id desc limit 12) h;
 return jsonb_build_object('state','claimed','turn_id',turn_id,'reservation',(select jsonb_build_object('region_id',d.region_id,'parcel_id',d.parcel_id,'status',d.status,'expires_at',d.expires_at,'negotiation_expires_at',d.negotiation_expires_at) from public.area_reservation_details d where d.id=p_reservation_id),'history',history);
end $$;
revoke all on function public.claim_reservation_ai(uuid,uuid,uuid) from PUBLIC;
revoke all on function public.claim_reservation_ai(uuid,uuid,uuid) from anon;
revoke all on function public.claim_reservation_ai(uuid,uuid,uuid) from authenticated;
grant execute on function public.claim_reservation_ai(uuid,uuid,uuid) to service_role;

create function public.finish_reservation_ai(p_turn_id uuid,p_reply text,p_handoff boolean,p_failed boolean default false)
returns boolean language plpgsql security definer set search_path=''
as $$ declare t public.reservation_ai_turns; c public.reservation_conversations; begin
 if p_reply is null or length(btrim(p_reply)) not between 1 and 4000 or p_handoff is null or p_failed is null then raise exception 'Invalid assistant reply' using errcode='22023'; end if;
 select * into t from public.reservation_ai_turns where id=p_turn_id;
 if not found then raise exception 'Turn not found' using errcode='P0002'; end if;
 select * into c from public.reservation_conversations where id=t.conversation_id;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chat:'||c.reservation_id::text,0));
 select * into t from public.reservation_ai_turns where id=p_turn_id for update;
 if t.status<>'processing' then return false; end if;
 update public.reservation_ai_turns set status=case when p_failed then 'failed' else 'finished' end where id=t.id;
 select * into c from public.reservation_conversations where id=t.conversation_id;
 -- A human takeover always wins over a late AI response.
 if c.status<>'ai' or t.message_id is distinct from (select id from public.reservation_chat_messages where conversation_id=c.id and sender_kind='client' order by created_at desc,id desc limit 1) then return false; end if;
 insert into public.reservation_chat_messages(conversation_id,sender_kind,content,request_id) values(c.id,case when p_failed then 'system' else 'assistant' end,btrim(p_reply),t.id);
 update public.reservation_conversations set status=case when p_handoff or p_failed then 'waiting_team' else 'ai' end,updated_at=clock_timestamp() where id=c.id;
 return true;
end $$;
revoke all on function public.finish_reservation_ai(uuid,text,boolean,boolean) from PUBLIC;
revoke all on function public.finish_reservation_ai(uuid,text,boolean,boolean) from anon;
revoke all on function public.finish_reservation_ai(uuid,text,boolean,boolean) from authenticated;
grant execute on function public.finish_reservation_ai(uuid,text,boolean,boolean) to service_role;
commit;
