begin;

alter table public.area_reservations
  drop constraint area_reservations_status_check,
  drop constraint area_reservations_contact_check;
alter table public.area_reservations
  add column negotiation_expires_at timestamptz,
  add column resolved_at timestamptz;
update public.area_reservations set negotiation_expires_at=contacted_at+interval '360 hours' where contacted_at is not null;
alter table public.area_reservations
  add constraint area_reservations_status_check check (status in ('pending_contact','contacted','confirmed','deactivated','expired')),
  add constraint area_reservations_contact_check check (
    (status in ('contacted','confirmed','deactivated') and contacted_at is not null and contacted_at<expires_at
      and negotiation_expires_at is not null and negotiation_expires_at=contacted_at+interval '360 hours')
    or (status in ('pending_contact','expired') and contacted_at is null and negotiation_expires_at is null)
  ),
  add constraint area_reservations_resolution_check check (
    (status='confirmed' and resolved_at is not null and resolved_at>=contacted_at and resolved_at<negotiation_expires_at)
    or (status='deactivated' and resolved_at is not null and resolved_at>=contacted_at)
    or (status not in ('confirmed','deactivated') and resolved_at is null)
  );
drop index public.area_reservations_active_parcel_key;
create unique index area_reservations_active_parcel_key on public.area_reservations(region_id,parcel_id)
where status in ('pending_contact','contacted','confirmed');
create index area_reservations_negotiation_expiry_idx on public.area_reservations(negotiation_expires_at) where status='contacted';

create table public.reservation_resolution_events (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.area_reservations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('confirmed','deactivated')),
  reason text not null check (reason in ('team_decision','negotiation_timeout')),
  resolved_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp(),
  notes text not null default '' check (length(notes)<=2000)
);
alter table public.reservation_resolution_events enable row level security;
revoke all on public.reservation_resolution_events from PUBLIC;
revoke all on public.reservation_resolution_events from anon;
revoke all on public.reservation_resolution_events from authenticated;
grant select on public.reservation_resolution_events to authenticated;
create policy "Team reads resolution history" on public.reservation_resolution_events for select to authenticated
using ((select public.current_app_role()) in ('admin','collaborator'));

-- Owner-only maintenance. The optional parcel restriction is used by new reservations.
create function public.expire_negotiation_reservations(p_region text default null,p_parcel text default null)
returns integer language plpgsql security definer set search_path=''
as $$
declare candidate record; changed public.area_reservations; processed integer:=0;
begin
  for candidate in select a.id,a.region_id,a.parcel_id from public.area_reservations a
    where a.status='contacted' and a.negotiation_expires_at<=clock_timestamp()
      and (p_region is null or a.region_id=p_region) and (p_parcel is null or a.parcel_id=p_parcel) order by a.id
  loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(candidate.region_id||':'||candidate.parcel_id,0));
    update public.area_reservations set status='deactivated'
      where id=candidate.id and status='contacted' and negotiation_expires_at<=clock_timestamp()
      returning * into changed;
    if found then
      insert into public.reservation_resolution_events(reservation_id,actor_id,decision,reason,resolved_at,notes)
        values(changed.id,null,'deactivated','negotiation_timeout',changed.resolved_at,'Prazo de 15 dias encerrado sem conclusão.');
      processed:=processed+1;
    end if;
  end loop;
  return processed;
end;
$$;
revoke all on function public.expire_negotiation_reservations(text,text) from PUBLIC;
revoke all on function public.expire_negotiation_reservations(text,text) from anon;
revoke all on function public.expire_negotiation_reservations(text,text) from authenticated;

create or replace function public.enforce_area_reservation_deadline()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.region_id||':'||new.parcel_id,0));
  if tg_op='INSERT' then
    new.created_at:=clock_timestamp(); new.expires_at:=new.created_at+interval '120 hours';
    new.contacted_at:=null; new.negotiation_expires_at:=null; new.resolved_at:=null; new.status:='pending_contact';
    update public.area_reservations set status='expired' where region_id=new.region_id and parcel_id=new.parcel_id
      and status='pending_contact' and expires_at<=new.created_at;
    perform public.expire_negotiation_reservations(new.region_id,new.parcel_id);
  elsif new.status is distinct from old.status then
    if old.status in ('confirmed','deactivated','expired') then
      raise exception 'Closed reservations cannot be reactivated.' using errcode='P0001';
    elsif new.status='contacted' then
      if old.status<>'pending_contact' or old.expires_at<=clock_timestamp() then
        raise exception 'Contact deadline passed.' using errcode='P0001'; end if;
      new.contacted_at:=clock_timestamp(); new.negotiation_expires_at:=new.contacted_at+interval '360 hours';
    elsif new.status in ('confirmed','deactivated') then
      if old.status<>'contacted' then raise exception 'Contact must be confirmed first.' using errcode='P0001'; end if;
      if new.status='confirmed' and old.negotiation_expires_at<=clock_timestamp() then
        raise exception 'Negotiation deadline passed.' using errcode='P0001'; end if;
      new.resolved_at:=case when new.status='deactivated' and old.negotiation_expires_at<=clock_timestamp()
        then old.negotiation_expires_at else clock_timestamp() end;
    elsif new.status='expired' then
      if old.status<>'pending_contact' or old.expires_at>clock_timestamp() then raise exception 'Invalid expiry.' using errcode='P0001'; end if;
    else raise exception 'Invalid reservation transition.' using errcode='P0001';
    end if;
  elsif new.contacted_at is distinct from old.contacted_at then
    -- Preserve the server-derived deadline when an owner adjusts a test/import timestamp.
    new.negotiation_expires_at:=case when new.contacted_at is null then null else new.contacted_at+interval '360 hours' end;
  end if;
  return new;
end;
$$;
drop trigger enforce_area_reservation_deadline on public.area_reservations;
create trigger enforce_area_reservation_deadline before insert or update of status,contacted_at on public.area_reservations
for each row execute function public.enforce_area_reservation_deadline();

create or replace view public.area_reservation_details with (security_invoker=true) as
select id,user_id,region_id,parcel_id,
  case when status='pending_contact' and expires_at<=statement_timestamp() then 'expired'
    when status='contacted' and negotiation_expires_at<=statement_timestamp() then 'deactivated' else status end as status,
  created_at,expires_at,contacted_at,negotiation_expires_at,
  case when status='contacted' and negotiation_expires_at<=statement_timestamp() then negotiation_expires_at else resolved_at end as resolved_at
from public.area_reservations;

create function public.resolve_reservation(p_reservation_id uuid,p_decision text,p_notes text default '')
returns public.area_reservations language plpgsql security definer set search_path=''
as $$
declare target public.area_reservations;
begin
  if auth.uid() is null or public.current_app_role() is null or public.current_app_role() not in ('admin','collaborator') then
    raise exception 'Team access required.' using errcode='42501'; end if;
  if p_decision is null or p_decision not in ('confirmed','deactivated') or length(coalesce(p_notes,''))>2000 then
    raise exception 'Invalid resolution.' using errcode='22023'; end if;
  select * into target from public.area_reservations where id=p_reservation_id;
  if not found then raise exception 'Reservation not found.' using errcode='P0002'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target.region_id||':'||target.parcel_id,0));
  if public.current_app_role() is null or public.current_app_role() not in ('admin','collaborator') then
    raise exception 'Team permission removed.' using errcode='42501'; end if;
  select * into target from public.area_reservations where id=p_reservation_id for update;
  if not found then raise exception 'Reservation not found.' using errcode='P0002'; end if;
  if target.status=p_decision then return target; end if;
  if target.status in ('confirmed','deactivated') then raise exception 'Reservation already resolved. Reload.' using errcode='40001'; end if;
  if target.status<>'contacted' or target.negotiation_expires_at<=clock_timestamp() then
    raise exception 'No active negotiation within deadline.' using errcode='P0001'; end if;
  update public.area_reservations set status=p_decision where id=p_reservation_id returning * into target;
  insert into public.reservation_resolution_events(reservation_id,actor_id,decision,reason,resolved_at,notes)
    values(target.id,auth.uid(),p_decision,'team_decision',target.resolved_at,btrim(coalesce(p_notes,'')));
  return target;
end;
$$;
revoke all on function public.resolve_reservation(uuid,text,text) from PUBLIC;
revoke all on function public.resolve_reservation(uuid,text,text) from anon;
revoke all on function public.resolve_reservation(uuid,text,text) from authenticated;
grant execute on function public.resolve_reservation(uuid,text,text) to authenticated;

drop function public.team_list_reservations(text,text,integer,integer);
create function public.team_list_reservations(p_search text default '',p_status text default null,p_limit integer default 20,p_offset integer default 0)
returns table(id uuid,user_id uuid,client_email text,region_id text,parcel_id text,status text,created_at timestamptz,expires_at timestamptz,contacted_at timestamptz,
  confirmed_by uuid,confirmed_by_email text,contact_note text,total_count bigint,negotiation_expires_at timestamptz,resolved_at timestamptz,
  resolved_by_email text,resolution_reason text,resolution_note text)
language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null or public.current_app_role() is null or public.current_app_role() not in ('admin','collaborator') then
    raise exception 'Team access required.' using errcode='42501'; end if;
  if p_status is not null and p_status not in ('pending_contact','contacted','confirmed','deactivated','expired') then
    raise exception 'Invalid status filter.' using errcode='22023'; end if;
  if p_limit is null or p_limit<1 or p_limit>100 or p_offset is null or p_offset<0 or length(coalesce(p_search,''))>200 then
    raise exception 'Invalid pagination.' using errcode='22023'; end if;
  return query
  with effective as (select a.*,case when a.status='pending_contact' and a.expires_at<=statement_timestamp() then 'expired'
    when a.status='contacted' and a.negotiation_expires_at<=statement_timestamp() then 'deactivated' else a.status end as effective_status
    from public.area_reservations a)
  select r.id,r.user_id,u.email::text,r.region_id,r.parcel_id,r.effective_status,r.created_at,r.expires_at,r.contacted_at,
    e.actor_id,actor.email::text,e.notes,count(*) over (),r.negotiation_expires_at,
    case when r.status='contacted' and r.effective_status='deactivated' then r.negotiation_expires_at else r.resolved_at end,
    resolver.email::text,case when r.status='contacted' and r.effective_status='deactivated' then 'negotiation_timeout' else decision.reason end,decision.notes
  from effective r join auth.users u on u.id=r.user_id
  left join public.reservation_contact_events e on e.reservation_id=r.id left join auth.users actor on actor.id=e.actor_id
  left join public.reservation_resolution_events decision on decision.reservation_id=r.id left join auth.users resolver on resolver.id=decision.actor_id
  where (p_status is null or r.effective_status=p_status) and (coalesce(btrim(p_search),'')=''
    or position(lower(btrim(p_search)) in lower(coalesce(u.email,'')))>0 or position(lower(btrim(p_search)) in r.id::text)>0)
  order by r.created_at desc,r.id limit p_limit offset p_offset;
end;
$$;
revoke all on function public.team_list_reservations(text,text,integer,integer) from PUBLIC;
revoke all on function public.team_list_reservations(text,text,integer,integer) from anon;
revoke all on function public.team_list_reservations(text,text,integer,integer) from authenticated;
grant execute on function public.team_list_reservations(text,text,integer,integer) to authenticated;

-- Apply the rule to previously confirmed contacts using their original timestamp.
select public.expire_negotiation_reservations();
commit;
