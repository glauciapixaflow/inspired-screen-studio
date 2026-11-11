-- Apply once after the reservation and specialist migrations.
begin;
-- Only aggregate land availability is returned, never owners, messages or protocols.
create function public.get_ai_lot_availability()
returns table(region_id text, total integer, available integer, reserved integer, confirmed integer, checked_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  with regions(id) as (
    values ('08'), ('12'), ('21'), ('27'), ('32'), ('36'), ('41'), ('45'), ('49')
  ), lots as (
    select r.id as region_id, row_id || column_id::text as parcel_id
    from regions r cross join (values ('A'), ('B'), ('C'), ('D')) rows(row_id)
    cross join generate_series(1, 4) columns(column_id)
  ), occupied as (
    select a.region_id, a.parcel_id, bool_or(a.status = 'confirmed') as confirmed
    from public.area_reservations a
    where a.status = 'confirmed'
      or (a.status = 'pending_contact' and a.expires_at > statement_timestamp())
      or (a.status = 'contacted' and a.negotiation_expires_at > statement_timestamp())
    group by a.region_id, a.parcel_id
  )
  select l.region_id, count(*)::integer,
    count(*) filter (where o.parcel_id is null)::integer,
    count(*) filter (where o.parcel_id is not null and not o.confirmed)::integer,
    count(*) filter (where o.confirmed)::integer,
    statement_timestamp()
  from lots l left join occupied o using (region_id, parcel_id)
  group by l.region_id order by l.region_id;
$$;
revoke all on function public.get_ai_lot_availability() from PUBLIC, anon, authenticated;
grant execute on function public.get_ai_lot_availability() to service_role;
commit;
