-- Commercial approval access, versioning and publication. All changes roll back.
begin;
select set_config('test.terms.admin',gen_random_uuid()::text,true);
select set_config('test.terms.client',gen_random_uuid()::text,true);
select set_config('test.terms.staff',gen_random_uuid()::text,true);
insert into auth.users(id,email) select current_setting(v)::uuid,current_setting(v)||'@example.invalid' from (values('test.terms.admin'),('test.terms.client'),('test.terms.staff')) x(v);
update public.user_profiles set role='admin' where user_id=current_setting('test.terms.admin')::uuid;
update public.user_profiles set role='collaborator' where user_id=current_setting('test.terms.staff')::uuid;
set local role anon;
do $$ begin
 begin perform public.admin_list_commercial_terms();raise exception 'Anonymous list allowed';exception when insufficient_privilege then null;end;
 begin perform public.get_ai_commercial_terms('08');raise exception 'Anonymous AI context allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role authenticated;
do $$ declare uid text; begin
 foreach uid in array array[current_setting('test.terms.client'),current_setting('test.terms.staff')] loop
 perform set_config('request.jwt.claim.sub',uid,true);
 begin perform public.admin_list_commercial_terms();raise exception 'Nonadmin list allowed';exception when insufficient_privilege then null;end;
 begin perform public.admin_save_commercial_terms('08','fixed',10000,null,null,null,array['pix'],'',true,0);raise exception 'Nonadmin approval allowed';exception when insufficient_privilege then null;end;
 begin perform public.get_ai_commercial_terms('08');raise exception 'Client context access allowed';exception when insufficient_privilege then null;end;
 begin perform * from public.reservation_commercial_terms;raise exception 'Direct catalog read allowed';exception when insufficient_privilege then null;end;
 end loop;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.terms.admin'),true);
select public.admin_save_commercial_terms('08','fixed',1234567,0,12,null,array['pix','pix'],'Conditions',false,0);
reset role;
set local role service_role;
do $$ begin
 if public.get_ai_commercial_terms('08') is not null then raise exception 'Draft exposed';end if;
 if public.get_ai_commercial_terms('49') is not null then raise exception 'Unconfigured region invented';end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.terms.admin'),true);
do $$ begin
 begin perform public.admin_save_commercial_terms('08','fixed',1234567,0,12,0,array['pix'],'',true,0);raise exception 'Stale write allowed';exception when serialization_failure then null;end;
 begin perform public.admin_save_commercial_terms('08','fixed',null,0,12,0,array['pix'],'',true,1);raise exception 'Missing approved price allowed';exception when invalid_parameter_value then null;end;
 begin perform public.admin_save_commercial_terms('08','fixed',1,2,12,0,array['pix'],'',true,1);raise exception 'Entry exceeds price';exception when invalid_parameter_value then null;end;
 begin perform public.admin_save_commercial_terms('08','fixed',10000,0,12,0,array['unknown'],'',true,1);raise exception 'Unknown method accepted';exception when invalid_parameter_value then null;end;
 begin perform public.admin_save_commercial_terms('08','fixed',10000,0,12,0,array[null]::text[],'',true,1);raise exception 'Null method accepted';exception when invalid_parameter_value then null;end;
end $$;
select public.admin_save_commercial_terms('08','starting_at',1234567,0,12,0,array['pix','boleto','pix'],'Approved conditions',true,1);
reset role;
do $$ begin
 if (select count(*) from public.commercial_terms_changes where region_id='08')<>2 then raise exception 'Missing audit events';end if;
 if (select new_terms->>'version' from public.commercial_terms_changes where region_id='08' order by changed_at desc limit 1)<>'2' then raise exception 'Wrong audit version';end if;
end $$;
set local role service_role;
do $$ declare facts jsonb; begin
 facts:=public.get_ai_commercial_terms('08');
 if facts->>'version'<>'2' or facts->>'price_cents'<>'1234567' or facts->>'down_payment_cents'<>'0' or facts->>'monthly_interest_bps'<>'0' then raise exception 'Approved facts mismatch';end if;
 if jsonb_array_length(facts->'payment_methods')<>2 then raise exception 'Duplicate payment method';end if;
 if facts ? 'approved_by' or facts ? 'updated_by' then raise exception 'Actor exposed to AI';end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.terms.admin'),true);
select public.admin_save_commercial_terms('08','on_request',null,null,null,null,'{}','',false,2);
reset role;
set local role service_role;
do $$ begin
 if public.get_ai_commercial_terms('08') is not null then raise exception 'Withdrawn approval exposed';end if;
end $$;
reset role;
update public.user_profiles set role='client' where user_id=current_setting('test.terms.admin')::uuid;
set local role authenticated;
do $$ begin
 begin perform public.admin_save_commercial_terms('08','on_request',null,null,null,null,'{}','',true,3);raise exception 'Demoted admin approval allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;