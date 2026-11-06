begin;

create table public.reservation_contact_events (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.area_reservations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default clock_timestamp(),
  notes text not null default '' check (length(notes) <= 2000)
);
alter table public.reservation_contact_events enable row level security;
revoke all on public.reservation_contact_events from PUBLIC;
revoke all on public.reservation_contact_events from anon;
revoke all on public.reservation_contact_events from authenticated;
grant select on public.reservation_contact_events to authenticated;
create policy "Team reads contact history" on public.reservation_contact_events
for select to authenticated
using ((select public.current_app_role()) in ('admin', 'collaborator'));

create function public.team_list_reservations(
  p_search text default '', p_status text default null,
  p_limit integer default 20, p_offset integer default 0
)
returns table (
  id uuid, user_id uuid, client_email text, region_id text, parcel_id text,
  status text, created_at timestamptz, expires_at timestamptz, contacted_at timestamptz,
  confirmed_by uuid, confirmed_by_email text, contact_note text, total_count bigint
)
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or public.current_app_role() not in ('admin', 'collaborator')
    or public.current_app_role() is null then
    raise exception 'Only team members can list reservations.' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('pending_contact', 'contacted', 'expired') then
    raise exception 'Invalid status filter.' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 or p_offset is null or p_offset < 0
    or length(coalesce(p_search, '')) > 200 then
    raise exception 'Invalid search or pagination.' using errcode = '22023';
  end if;
  return query
  with effective as (
    select a.*, case when a.status = 'pending_contact' and a.expires_at <= statement_timestamp()
      then 'expired' else a.status end as effective_status
    from public.area_reservations a
  )
  select r.id, r.user_id, u.email::text, r.region_id, r.parcel_id,
    r.effective_status, r.created_at, r.expires_at, r.contacted_at,
    e.actor_id, actor.email::text, e.notes, count(*) over ()
  from effective r
  join auth.users u on u.id = r.user_id
  left join public.reservation_contact_events e on e.reservation_id = r.id
  left join auth.users actor on actor.id = e.actor_id
  where (p_status is null or r.effective_status = p_status)
    and (coalesce(btrim(p_search), '') = ''
      or position(lower(btrim(p_search)) in lower(coalesce(u.email, ''))) > 0
      or position(lower(btrim(p_search)) in r.id::text) > 0)
  order by r.created_at desc, r.id
  limit p_limit offset p_offset;
end;
$$;
revoke all on function public.team_list_reservations(text, text, integer, integer) from PUBLIC;
revoke all on function public.team_list_reservations(text, text, integer, integer) from anon;
revoke all on function public.team_list_reservations(text, text, integer, integer) from authenticated;
grant execute on function public.team_list_reservations(text, text, integer, integer) to authenticated;

create function public.confirm_reservation_contact(p_reservation_id uuid, p_notes text default '')
returns public.area_reservations
language plpgsql security definer set search_path = ''
as $$
declare
  target public.area_reservations;
begin
  if auth.uid() is null or public.current_app_role() not in ('admin', 'collaborator')
    or public.current_app_role() is null then
    raise exception 'Only team members can confirm contact.' using errcode = '42501';
  end if;
  if length(coalesce(p_notes, '')) > 2000 then
    raise exception 'Contact notes must have at most 2000 characters.' using errcode = '22023';
  end if;
  select * into target from public.area_reservations where id = p_reservation_id;
  if not found then raise exception 'Reservation not found.' using errcode = 'P0002'; end if;
  -- Match the lock order used by reservation creation before locking the row.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target.region_id || ':' || target.parcel_id, 0));
  if public.current_app_role() not in ('admin', 'collaborator') or public.current_app_role() is null then
    raise exception 'Team permission was removed.' using errcode = '42501';
  end if;
  select * into target from public.area_reservations where id = p_reservation_id for update;
  if not found then raise exception 'Reservation not found.' using errcode = 'P0002'; end if;
  -- A retry preserves the first actor, note and timestamp without duplicate events.
  if target.status = 'contacted' then return target; end if;
  if target.status <> 'pending_contact' or target.expires_at <= clock_timestamp() then
    raise exception 'The contact deadline has passed.' using errcode = 'P0001';
  end if;
  update public.area_reservations set status = 'contacted'
    where id = p_reservation_id returning * into target;
  insert into public.reservation_contact_events(reservation_id, actor_id, recorded_at, notes)
    values(target.id, auth.uid(), target.contacted_at, btrim(coalesce(p_notes, '')));
  return target;
end;
$$;
revoke all on function public.confirm_reservation_contact(uuid, text) from PUBLIC;
revoke all on function public.confirm_reservation_contact(uuid, text) from anon;
revoke all on function public.confirm_reservation_contact(uuid, text) from authenticated;
grant execute on function public.confirm_reservation_contact(uuid, text) to authenticated;

commit;
