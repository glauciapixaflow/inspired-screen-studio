-- Apply once after the chat migrations. This stores quota metadata only, not scientific chat messages.
begin;
create table public.mars_specialist_requests (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(user_id,request_id)
);
create index mars_specialist_quota_idx on public.mars_specialist_requests(user_id,created_at);
alter table public.mars_specialist_requests enable row level security;
revoke all on public.mars_specialist_requests from PUBLIC,anon,authenticated;

create function public.claim_mars_specialist(p_user_id uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$ begin
 if p_user_id is null or p_request_id is null or not exists(select 1 from auth.users where id=p_user_id) then
  raise exception 'Verified user required' using errcode='42501';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('mars-specialist:'||p_user_id::text,0));
 if exists(select 1 from public.mars_specialist_requests where user_id=p_user_id and request_id=p_request_id) then
  return jsonb_build_object('state','duplicate');
 end if;
 if (select count(*) from public.mars_specialist_requests where user_id=p_user_id and created_at>clock_timestamp()-interval '1 minute')>=5
 or (select count(*) from public.mars_specialist_requests where user_id=p_user_id and created_at>clock_timestamp()-interval '24 hours')>=20 then
  return jsonb_build_object('state','limit');
 end if;
 insert into public.mars_specialist_requests(user_id,request_id) values(p_user_id,p_request_id);
 return jsonb_build_object('state','claimed');
end $$;
revoke all on function public.claim_mars_specialist(uuid,uuid) from PUBLIC,anon,authenticated;
grant execute on function public.claim_mars_specialist(uuid,uuid) to service_role;
commit;