begin;
alter table public.exercise_logs add column if not exists feedback text check (feedback in ('better','same','worse'));
alter table public.exercises add column if not exists target_zones text[] not null default '{}';
alter table public.exercises add column if not exists repetitions text;
alter table public.exercises add column if not exists limitations text[] not null default '{}';
alter table public.exercises add column if not exists applicability jsonb not null default '{}';
alter table public.exercises add column if not exists source_url text;
alter table public.exercises add column if not exists media_url text;
alter table public.survey_questions add column if not exists question_key text;
alter table public.survey_questions add column if not exists definition jsonb not null default '{}';
alter table public.recommendation_rules add column if not exists condition jsonb not null default '{}';
alter table public.recommendation_rules add column if not exists recommendation text;
alter table public.recommendation_rules add column if not exists reason text;
alter table public.recommendation_rules add column if not exists source_url text;
create table if not exists public.onboarding_drafts (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 step integer not null default 0 check (step between 0 and 10), answers jsonb not null default '{}', updated_at timestamptz not null default now()
);
create table if not exists public.diary_entries (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 date date not null, overall_change text not null check(overall_change in ('better','same','worse','first')),
 zones jsonb not null default '{}', note text not null default '' check(length(note)<=2000), created_at timestamptz not null default now(),
 unique(user_id,date)
);
create table if not exists public.working_sessions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 started_at timestamptz not null default now(), ended_at timestamptz,
 state text not null default 'working' check(state in ('working','paused','break','finished')),
 work_seconds integer not null default 0 check(work_seconds>=0), break_seconds integer not null default 0 check(break_seconds>=0),
 breaks_completed integer not null default 0 check(breaks_completed>=0), interval_minutes integer not null default 45 check(interval_minutes between 10 and 120),
 posture jsonb not null default '{}', updated_at timestamptz not null default now()
);
create unique index if not exists one_active_work_session on public.working_sessions(user_id) where state <> 'finished';
create table if not exists public.articles (
 id uuid primary key default gen_random_uuid(), title text not null, category text not null default 'workplace',
 content text not null, target_zones text[] not null default '{}', source_url text, is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.admin_events (
 id uuid primary key default gen_random_uuid(), actor_id uuid not null references public.profiles(id),
 action text not null, resource text not null, created_at timestamptz not null default now()
);
create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;
create or replace function app_private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and role::text='admin' and not is_blocked);
$$;
revoke all on function app_private.is_admin() from public;
grant execute on function app_private.is_admin() to authenticated;
create or replace function public.protect_profile_fields() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is not null then
  if new.role is distinct from old.role then raise exception 'Roles are assigned by a trusted database operator'; end if;
  if new.is_blocked is distinct from old.is_blocked and not app_private.is_admin() then raise exception 'Administrator required'; end if;
  if new.email is distinct from old.email then raise exception 'Use Auth to change email'; end if;
 end if;
 return new;
end; $$;
-- Preserve the existing database enum for compatibility; new application uses user/admin only.
update public.profiles set role='admin' where role::text='super_admin';
create or replace function public.is_admin() returns boolean language sql stable security invoker set search_path='' as $$ select app_private.is_admin(); $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
do $$ declare t text; begin
 foreach t in array array['onboarding_drafts','diary_entries','working_sessions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy owner_access on public.%I for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()))',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 end loop;
end $$;
alter table public.articles enable row level security;
create policy articles_read on public.articles for select to authenticated using (is_active or (select app_private.is_admin()));
create policy articles_manage on public.articles for all to authenticated using ((select app_private.is_admin())) with check ((select app_private.is_admin()));
grant select,insert,update,delete on public.articles to authenticated;
alter table public.admin_events enable row level security;
create policy events_read on public.admin_events for select to authenticated using ((select app_private.is_admin()));
create policy events_insert on public.admin_events for insert to authenticated with check(actor_id=(select auth.uid()) and (select app_private.is_admin()));
grant select,insert on public.admin_events to authenticated;
create or replace function public.complete_onboarding(p_answers jsonb,p_date date) returns uuid language plpgsql security invoker set search_path='' as $$
declare survey_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 insert into public.surveys(user_id,survey_type,date,answers) values(auth.uid(),'initial',p_date,p_answers) returning id into survey_id;
 update public.profiles set onboarding_completed=true, goals=array(select jsonb_array_elements_text(coalesce(p_answers->'goals','[]'::jsonb))), consent_given_at=coalesce(consent_given_at,now()) where id=auth.uid();
 delete from public.onboarding_drafts where user_id=auth.uid();
 return survey_id;
end; $$;
revoke all on function public.complete_onboarding(jsonb,date) from public;
grant execute on function public.complete_onboarding(jsonb,date) to authenticated;
create index if not exists diary_owner_date on public.diary_entries(user_id,date desc);
create index if not exists sessions_owner_start on public.working_sessions(user_id,started_at desc);
commit;
