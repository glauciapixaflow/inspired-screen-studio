begin;

-- Only administrators may read the minimum identity data needed by the panel.
create function public.admin_list_users(
  p_search text default '',
  p_role text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  user_id uuid, email text, role text,
  created_at timestamptz, updated_at timestamptz, total_count bigint
)
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or public.current_app_role() is distinct from 'admin' then
    raise exception 'Only administrators can list users.' using errcode = '42501';
  end if;
  if p_role is not null and p_role not in ('client', 'collaborator', 'admin') then
    raise exception 'Invalid role filter.' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100
    or p_offset is null or p_offset < 0
    or length(coalesce(p_search, '')) > 200 then
    raise exception 'Invalid pagination or search parameters.' using errcode = '22023';
  end if;
  return query
  select p.user_id, u.email::text, p.role, coalesce(u.created_at, p.created_at), p.updated_at, count(*) over ()
  from public.user_profiles p join auth.users u on u.id = p.user_id
  where (p_role is null or p.role = p_role)
    and (coalesce(btrim(p_search), '') = ''
      or position(lower(btrim(p_search)) in lower(coalesce(u.email, ''))) > 0
      or position(lower(btrim(p_search)) in p.user_id::text) > 0)
  order by coalesce(u.created_at, p.created_at) desc, p.user_id
  limit p_limit offset p_offset;
end;
$$;
revoke all on function public.admin_list_users(text, text, integer, integer) from PUBLIC;
revoke all on function public.admin_list_users(text, text, integer, integer) from anon;
revoke all on function public.admin_list_users(text, text, integer, integer) from authenticated;
grant execute on function public.admin_list_users(text, text, integer, integer) to authenticated;

commit;
