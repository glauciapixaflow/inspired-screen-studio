-- Apply after 202611050002_negotiation_resolution.sql.
begin;
-- Only parcel availability is shared between accounts. Never return owner or protocol.
create function public.map_area_availability()
returns table(region_id text, parcel_id text, status text, available_until timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to view parcel availability.' using errcode = '42501';
  end if;
  return query
  select a.region_id, a.parcel_id,
    case when a.status = 'confirmed' then 'confirmed' else 'reserved' end,
    case when a.status = 'pending_contact' then a.expires_at
      when a.status = 'contacted' then a.negotiation_expires_at else null end
  from public.area_reservations a
  where a.status = 'confirmed'
    or (a.status = 'pending_contact' and a.expires_at > statement_timestamp())
    or (a.status = 'contacted' and a.negotiation_expires_at > statement_timestamp());
end;
$$;
revoke all on function public.map_area_availability() from PUBLIC;
revoke all on function public.map_area_availability() from anon;
revoke all on function public.map_area_availability() from authenticated;
grant execute on function public.map_area_availability() to authenticated;
commit;
