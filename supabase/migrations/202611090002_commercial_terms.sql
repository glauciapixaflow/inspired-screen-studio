-- Apply after 202611090001_reservation_chat.sql. No illustrative site prices are imported.
begin;
create table public.reservation_commercial_terms (
 region_id text primary key check(region_id in('08','12','21','27','32','36','41','45','49')),
 price_kind text not null default 'on_request' check(price_kind in('fixed','starting_at','on_request')),
 price_cents bigint check(price_cents between 1 and 1000000000000),
 down_payment_cents bigint check(down_payment_cents between 0 and 1000000000000),
 max_installments integer check(max_installments between 1 and 360),
 monthly_interest_bps integer check(monthly_interest_bps between 0 and 10000),
 payment_methods text[] not null default '{}' check(payment_methods <@ array['pix','bank_transfer','boleto','credit_card','debit_card']::text[]),
 payment_notes text not null default '' check(length(payment_notes)<=2000),
 published boolean not null default false,
 version integer not null default 1,
 approved_at timestamptz,
 approved_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default clock_timestamp(),
 updated_by uuid references auth.users(id) on delete set null,
 check(price_kind<>'on_request' or price_cents is null),
 check(not published or price_kind='on_request' or price_cents is not null),
 check(price_cents is null or down_payment_cents is null or down_payment_cents<=price_cents),
 check((published and approved_at is not null) or (not published and approved_at is null))
);
create table public.commercial_terms_changes (
 id uuid primary key default gen_random_uuid(),
 region_id text not null references public.reservation_commercial_terms(region_id),
 actor_id uuid references auth.users(id) on delete set null,
 previous_terms jsonb,
 new_terms jsonb not null,
 changed_at timestamptz not null default clock_timestamp()
);
alter table public.reservation_commercial_terms enable row level security;
alter table public.commercial_terms_changes enable row level security;
revoke all on public.reservation_commercial_terms,public.commercial_terms_changes from PUBLIC;
revoke all on public.reservation_commercial_terms,public.commercial_terms_changes from anon;
revoke all on public.reservation_commercial_terms,public.commercial_terms_changes from authenticated;

create function public.admin_list_commercial_terms()
returns setof public.reservation_commercial_terms language plpgsql security definer set search_path=''
as $$ begin
 if auth.uid() is null or public.current_app_role() is distinct from 'admin' then raise exception 'Admin access required' using errcode='42501';end if;
 return query select * from public.reservation_commercial_terms order by region_id;
end $$;
revoke all on function public.admin_list_commercial_terms() from PUBLIC;
revoke all on function public.admin_list_commercial_terms() from anon;
grant execute on function public.admin_list_commercial_terms() to authenticated;

create function public.admin_save_commercial_terms(
 p_region_id text,p_price_kind text,p_price_cents bigint,p_down_payment_cents bigint,
 p_max_installments integer,p_monthly_interest_bps integer,p_payment_methods text[],
 p_payment_notes text,p_published boolean,p_expected_version integer
)
returns public.reservation_commercial_terms language plpgsql security definer set search_path=''
as $$ declare previous public.reservation_commercial_terms; saved public.reservation_commercial_terms; before_json jsonb; methods text[]; begin
 if auth.uid() is null or public.current_app_role() is distinct from 'admin' then raise exception 'Admin access required' using errcode='42501';end if;
 if p_region_id is null or p_region_id not in('08','12','21','27','32','36','41','45','49')
 or p_price_kind is null or p_price_kind not in('fixed','starting_at','on_request')
 or p_published is null or p_expected_version is null or p_expected_version<0
 or p_payment_methods is null or not(p_payment_methods<@array['pix','bank_transfer','boleto','credit_card','debit_card']::text[])
 or array_position(p_payment_methods,null) is not null
 or p_payment_notes is null or length(p_payment_notes)>2000
 or (p_price_cents is not null and (p_price_cents<1 or p_price_cents>1000000000000))
 or (p_down_payment_cents is not null and (p_down_payment_cents<0 or p_down_payment_cents>1000000000000))
 or (p_max_installments is not null and (p_max_installments<1 or p_max_installments>360))
 or (p_monthly_interest_bps is not null and (p_monthly_interest_bps<0 or p_monthly_interest_bps>10000))
 or (p_price_kind='on_request' and p_price_cents is not null)
 or (p_published and p_price_kind<>'on_request' and p_price_cents is null)
 or (p_price_cents is not null and p_down_payment_cents>p_price_cents) then raise exception 'Invalid commercial terms' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('commercial:'||p_region_id,0));
 if public.current_app_role() is distinct from 'admin' then raise exception 'Admin permission removed' using errcode='42501';end if;
 select * into previous from public.reservation_commercial_terms where region_id=p_region_id for update;
 if p_expected_version<>coalesce(previous.version,0) then raise exception 'Commercial terms changed; reload before saving' using errcode='40001';end if;
 before_json:=case when previous.region_id is null then null else to_jsonb(previous) end;
 select coalesce(array_agg(distinct item order by item),'{}'::text[]) into methods from unnest(p_payment_methods) item;
 insert into public.reservation_commercial_terms(region_id,price_kind,price_cents,down_payment_cents,max_installments,monthly_interest_bps,payment_methods,payment_notes,published,version,approved_at,approved_by,updated_by)
 values(p_region_id,p_price_kind,p_price_cents,p_down_payment_cents,p_max_installments,p_monthly_interest_bps,methods,btrim(p_payment_notes),p_published,coalesce(previous.version,0)+1,case when p_published then clock_timestamp() else null end,case when p_published then auth.uid() else null end,auth.uid())
 on conflict(region_id) do update set price_kind=excluded.price_kind,price_cents=excluded.price_cents,down_payment_cents=excluded.down_payment_cents,max_installments=excluded.max_installments,monthly_interest_bps=excluded.monthly_interest_bps,payment_methods=excluded.payment_methods,payment_notes=excluded.payment_notes,published=excluded.published,version=excluded.version,approved_at=excluded.approved_at,approved_by=excluded.approved_by,updated_at=clock_timestamp(),updated_by=auth.uid()
 returning * into saved;
 insert into public.commercial_terms_changes(region_id,actor_id,previous_terms,new_terms) values(saved.region_id,auth.uid(),before_json,to_jsonb(saved));
 return saved;
end $$;
revoke all on function public.admin_save_commercial_terms(text,text,bigint,bigint,integer,integer,text[],text,boolean,integer) from PUBLIC;
revoke all on function public.admin_save_commercial_terms(text,text,bigint,bigint,integer,integer,text[],text,boolean,integer) from anon;
grant execute on function public.admin_save_commercial_terms(text,text,bigint,bigint,integer,integer,text[],text,boolean,integer) to authenticated;

-- Only the server receives approved commercial facts. No draft, actor or audit data is exposed.
create function public.get_ai_commercial_terms(p_region_id text)
returns jsonb language sql stable security definer set search_path=''
as $$
 select jsonb_build_object('region_id',region_id,'currency','BRL','price_kind',price_kind,'price_cents',price_cents,'down_payment_cents',down_payment_cents,'max_installments',max_installments,'monthly_interest_bps',monthly_interest_bps,'payment_methods',payment_methods,'payment_notes',payment_notes,'version',version,'approved_at',approved_at)
 from public.reservation_commercial_terms where region_id=p_region_id and published;
$$;
revoke all on function public.get_ai_commercial_terms(text) from PUBLIC;
revoke all on function public.get_ai_commercial_terms(text) from anon;
revoke all on function public.get_ai_commercial_terms(text) from authenticated;
grant execute on function public.get_ai_commercial_terms(text) to service_role;
commit;
