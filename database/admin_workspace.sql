create table public.content_versions (
 id bigint generated always as identity primary key,
 resource text not null, record_id text not null, actor_id uuid references public.profiles(id) on delete set null,
 action text not null check(action in ('INSERT','UPDATE','DELETE')), before_data jsonb, after_data jsonb,
 created_at timestamptz not null default now()
);
create index content_versions_record on public.content_versions(resource,record_id,id desc);
alter table public.content_versions enable row level security;
revoke all on public.content_versions from anon,authenticated;
grant select on public.content_versions to authenticated;
create policy versions_read on public.content_versions for select to authenticated using ((select app_private.is_admin()));
create function app_private.record_content_version() returns trigger language plpgsql security definer set search_path='' as $$
declare old_data jsonb; new_data jsonb;
begin
 if TG_OP <> 'INSERT' then old_data=to_jsonb(OLD); end if;
 if TG_OP <> 'DELETE' then new_data=to_jsonb(NEW); end if;
 if old_data is not distinct from new_data then return NEW; end if;
 insert into public.content_versions(resource,record_id,actor_id,action,before_data,after_data)
 values(TG_TABLE_NAME,coalesce(new_data->>'id',old_data->>'id',new_data->>'key',old_data->>'key'),auth.uid(),TG_OP,old_data,new_data);
 if TG_OP='DELETE' then return OLD; end if;
 return NEW;
end $$;
revoke all on function app_private.record_content_version() from public,anon,authenticated;
do $$ declare tab text; begin
 foreach tab in array array['exercises','articles','survey_questions','recommendation_rules','body_zones','system_settings'] loop
 execute format('create trigger content_version after insert or update or delete on public.%I for each row execute function app_private.record_content_version()',tab);
 end loop;
end $$;
create table public.support_tickets(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 subject text not null check(length(subject) between 1 and 150), message text not null check(length(message) between 1 and 3000),
 status text not null default 'open' check(status in ('open','in_progress','closed')),
 reply text not null default '' check(length(reply)<=3000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index support_tickets_user on public.support_tickets(user_id,created_at desc);
alter table public.support_tickets enable row level security;
revoke all on public.support_tickets from anon,authenticated;
grant select on public.support_tickets to authenticated;
grant insert(user_id,subject,message) on public.support_tickets to authenticated;
grant update(status,reply,updated_at) on public.support_tickets to authenticated;
create policy tickets_read on public.support_tickets for select to authenticated using(user_id=(select auth.uid()) or (select app_private.is_admin()));
create policy tickets_insert on public.support_tickets for insert to authenticated with check(user_id=(select auth.uid()));
create policy tickets_update on public.support_tickets for update to authenticated using((select app_private.is_admin())) with check((select app_private.is_admin()));
create function public.restore_content_version(version_id bigint, expected_revision bigint) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v public.content_versions; snapshot jsonb; pk text; current_row jsonb; assignments text; restored jsonb; last_revision bigint;
begin
 if not app_private.has_admin_scope('content') then raise exception 'Admin access required' using errcode='42501'; end if;
 select * into v from public.content_versions where id=version_id;
 if not found or v.resource not in ('exercises','articles','survey_questions','recommendation_rules','body_zones','system_settings') then raise exception 'Version unavailable'; end if;
 snapshot=v.after_data;
 if snapshot is null then raise exception 'Deleted version cannot be restored'; end if;
 pk=case when v.resource='system_settings' then 'key' else 'id' end;
 execute format('select to_jsonb(t) from public.%I t where %I::text=$1 for update',v.resource,pk) into current_row using v.record_id;
 if current_row is null then raise exception 'Record no longer exists'; end if;
 select max(id) into last_revision from public.content_versions where resource=v.resource and record_id=v.record_id;
 if last_revision is distinct from expected_revision then raise exception 'Record changed; reload versions' using errcode='40001'; end if;
 if v.resource in ('exercises','articles') and (snapshot->>'is_active')::boolean then
  if coalesce(snapshot->>'title','')='' or coalesce(snapshot->>'source_url','') not like 'https://%' or
   coalesce(snapshot->>case when v.resource='exercises' then 'instructions' else 'content' end,'')='' then raise exception 'Incomplete published content'; end if;
  if v.resource='exercises' and (coalesce(jsonb_array_length(snapshot->'target_zones'),0)=0 or coalesce(jsonb_array_length(snapshot->'applicability'->'space'),0)=0) then raise exception 'Missing exercise targets or space'; end if;
 end if;
 if v.resource='survey_questions' and (snapshot->'definition'->>'key' is distinct from current_row->'definition'->>'key' or snapshot->'definition'->>'type' is distinct from current_row->'definition'->>'type') then raise exception 'Incompatible question definition'; end if;
 if v.resource='survey_questions' and exists(select 1 from jsonb_array_elements(coalesce(current_row->'definition'->'options','[]'::jsonb)) old_option where not exists(select 1 from jsonb_array_elements(coalesce(snapshot->'definition'->'options','[]'::jsonb)) new_option where new_option->'value'=old_option->'value')) then raise exception 'Incompatible answer options'; end if;
 if v.resource='system_settings' and v.record_id='max_exercises' and not (snapshot->>'value')::integer between 1 and 10 then raise exception 'Invalid exercise limit'; end if;
 select string_agg(format('%I=s.%I',a.attname,a.attname),',') into assignments
 from pg_catalog.pg_attribute a where a.attrelid=to_regclass('public.'||v.resource) and a.attnum>0 and not a.attisdropped and a.attname not in(pk,'created_at','updated_at');
 execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$1) s where t.%I::text=$2 returning to_jsonb(t)',v.resource,assignments,v.resource,pk) into restored using snapshot,v.record_id;
 return restored;
end $$;
revoke all on function public.restore_content_version(bigint,bigint) from public,anon;
grant execute on function public.restore_content_version(bigint,bigint) to authenticated;
create table public.admin_access(
 user_id uuid primary key references public.profiles(id) on delete cascade,
 access_level text not null check(access_level in ('owner','editor','support'))
);
alter table public.admin_access enable row level security;
revoke all on public.admin_access from anon,authenticated;
grant select,insert,update on public.admin_access to authenticated;
create function app_private.has_admin_scope(required_scope text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p left join public.admin_access a on a.user_id=p.id
 where p.id=auth.uid() and p.role::text='admin' and not p.is_blocked
 and (coalesce(a.access_level,'owner')='owner'
 or (a.access_level='editor' and required_scope='content')
 or (a.access_level='support' and required_scope in ('support','diagnostics'))))
$$;
revoke all on function app_private.has_admin_scope(text) from public,anon;
grant execute on function app_private.has_admin_scope(text) to authenticated;
create or replace function app_private.is_admin() returns boolean
language sql stable security definer set search_path='' as $$ select app_private.has_admin_scope('owner') $$;
create policy access_read on public.admin_access for select to authenticated using(user_id=(select auth.uid()) or (select app_private.is_admin()));
create policy access_insert on public.admin_access for insert to authenticated with check((select app_private.is_admin()) and user_id<>(select auth.uid()) and exists(select 1 from public.profiles p where p.id=user_id and p.role::text='admin'));
create policy access_update on public.admin_access for update to authenticated using((select app_private.is_admin()) and user_id<>(select auth.uid())) with check((select app_private.is_admin()) and user_id<>(select auth.uid()) and exists(select 1 from public.profiles p where p.id=user_id and p.role::text='admin'));
do $$ declare tab text; begin
 foreach tab in array array['exercises','articles','survey_questions','recommendation_rules','body_zones','system_settings'] loop
 execute format('create policy content_editor on public.%I for all to authenticated using ((select app_private.has_admin_scope(''content''))) with check ((select app_private.has_admin_scope(''content'')))',tab);
 end loop;
end $$;
drop policy versions_read on public.content_versions;
create policy versions_read on public.content_versions for select to authenticated using((select app_private.has_admin_scope('content')));
drop policy tickets_read on public.support_tickets;
create policy tickets_read on public.support_tickets for select to authenticated using(user_id=(select auth.uid()) or (select app_private.has_admin_scope('support')));
drop policy tickets_update on public.support_tickets;
create policy tickets_update on public.support_tickets for update to authenticated using((select app_private.has_admin_scope('support'))) with check((select app_private.has_admin_scope('support')));
create policy editor_event_insert on public.admin_events for insert to authenticated with check(actor_id=(select auth.uid()) and (select app_private.has_admin_scope('content')));
create or replace function app_private.record_content_version() returns trigger language plpgsql security definer set search_path='' as $$
declare old_data jsonb; new_data jsonb;
begin
 if TG_OP <> 'INSERT' then old_data=to_jsonb(OLD); end if;
 if TG_OP <> 'DELETE' then new_data=to_jsonb(NEW); end if;
 if old_data is not distinct from new_data then return NEW; end if;
 insert into public.content_versions(resource,record_id,actor_id,action,before_data,after_data)
 values(TG_TABLE_NAME,coalesce(new_data->>'id',old_data->>'id',new_data->>'key',old_data->>'key'),auth.uid(),TG_OP,old_data,new_data);
 if auth.uid() is not null then
 insert into public.admin_events(actor_id,action,resource) values(auth.uid(),TG_OP,TG_TABLE_NAME);
 end if;
 if TG_OP='DELETE' then return OLD; end if;
 return NEW;
end $$;

create function app_private.record_admin_action() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null then insert into public.admin_events(actor_id,action,resource) values(auth.uid(),TG_OP,TG_TABLE_NAME); end if;
 return NEW;
end $$;
revoke all on function app_private.record_admin_action() from public,anon,authenticated;
create trigger access_audit after insert or update on public.admin_access for each row execute function app_private.record_admin_action();
create trigger ticket_audit after update on public.support_tickets for each row execute function app_private.record_admin_action();
create index content_versions_actor on public.content_versions(actor_id);
create table public.ai_request_events(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 status text not null check(status in ('success','provider_error','invalid_response')),
 model text not null check(length(model) between 1 and 100),
 input_tokens integer check(input_tokens between 0 and 1000000),output_tokens integer check(output_tokens between 0 and 1000000),
 latency_ms integer not null check(latency_ms between 0 and 120000),
 created_at timestamptz not null default now()
);
create index ai_events_user on public.ai_request_events(user_id);
create index ai_events_created on public.ai_request_events(created_at desc);
alter table public.ai_request_events enable row level security;
revoke all on public.ai_request_events from anon,authenticated;
grant select on public.ai_request_events to authenticated;
grant insert(user_id,status,model,input_tokens,output_tokens,latency_ms) on public.ai_request_events to authenticated;
create policy ai_events_read on public.ai_request_events for select to authenticated using(user_id=(select auth.uid()) or (select app_private.has_admin_scope('diagnostics')));
create policy ai_events_insert on public.ai_request_events for insert to authenticated with check(user_id=(select auth.uid()));
