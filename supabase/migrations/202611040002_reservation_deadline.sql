begin;

alter table public.area_reservations
  drop constraint area_reservations_status_check;
alter table public.area_reservations
  add constraint area_reservations_status_check
  check (status in ('pending_contact', 'contacted', 'expired'));

alter table public.area_reservations
  add column expires_at timestamptz,
  add column contacted_at timestamptz;
update public.area_reservations set expires_at = created_at + interval '120 hours';
alter table public.area_reservations alter column expires_at set not null;
alter table public.area_reservations
  add constraint area_reservations_expiry_check check (expires_at = created_at + interval '120 hours'),
  add constraint area_reservations_contact_check check (
    (status = 'contacted' and contacted_at is not null and contacted_at < expires_at)
    or (status <> 'contacted' and contacted_at is null)
  );

update public.area_reservations set status = 'expired'
  where status = 'pending_contact' and expires_at <= clock_timestamp();
alter table public.area_reservations
  drop constraint area_reservations_region_parcel_key;
create unique index area_reservations_active_parcel_key
  on public.area_reservations(region_id, parcel_id)
  where status in ('pending_contact', 'contacted');

-- Serializes requests for each parcel. Expiry and timestamps use the database
-- clock, including after waiting for another reservation transaction.
create function public.enforce_area_reservation_deadline()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.region_id || ':' || new.parcel_id, 0));
  if tg_op = 'INSERT' then
    new.created_at := clock_timestamp();
    new.expires_at := new.created_at + interval '120 hours';
    new.contacted_at := null;
    new.status := 'pending_contact';
    update public.area_reservations
      set status = 'expired'
      where region_id = new.region_id and parcel_id = new.parcel_id
        and status = 'pending_contact' and expires_at <= new.created_at;
  elsif new.status = 'contacted' and old.status <> 'contacted' then
    if old.status <> 'pending_contact' or old.expires_at <= clock_timestamp() then
      raise exception 'The contact deadline has passed; create a new reservation if the parcel is available.';
    end if;
    new.contacted_at := clock_timestamp();
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_area_reservation_deadline() from PUBLIC;
revoke all on function public.enforce_area_reservation_deadline() from anon;
revoke all on function public.enforce_area_reservation_deadline() from authenticated;
create trigger enforce_area_reservation_deadline
  before insert or update of status on public.area_reservations
  for each row execute function public.enforce_area_reservation_deadline();

-- Computes expired status immediately, even if nobody is using the website.
-- The insert trigger frees expired holds before checking the unique index.
create view public.area_reservation_details with (security_invoker = true) as
select id, user_id, region_id, parcel_id,
  case when status = 'pending_contact' and expires_at <= statement_timestamp()
    then 'expired' else status end as status,
  created_at, expires_at, contacted_at
from public.area_reservations;
revoke all on public.area_reservation_details from PUBLIC;
revoke all on public.area_reservation_details from anon;
revoke all on public.area_reservation_details from authenticated;
grant select on public.area_reservation_details to authenticated;

commit;
