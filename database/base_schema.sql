-- Initial schema for a NEW Supabase project. Do not apply to the existing configured project.
begin;
create type public.user_role as enum ('user','admin');
create type public.body_zone as enum ('neck','shoulders','back','lower_back','chest','arms','hips','knees','feet','posture','head','eyes','wrists','elbows');
create type public.difficulty as enum ('easy','medium','hard');
create type public.question_type as enum ('scale','single_choice','multi_choice','text','boolean');
create table public.profiles (
 id uuid not null,
 email text not null,
 full_name text,
 age integer check(age >= 5 AND age <= 120),
 occupation text,
 role public.user_role not null default 'user'::user_role,
 is_blocked boolean not null default false,
 created_at timestamp with time zone not null default now(),
 updated_at timestamp with time zone not null default now(),
 height integer check(height IS NULL OR height >= 100 AND height <= 230),
 weight integer check(weight IS NULL OR weight >= 30 AND weight <= 250),
 gender text check(gender IS NULL OR (gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text]))),
 goals text[] not null default '{}'::text[],
 onboarding_completed boolean not null default false,
 consent_given_at timestamp with time zone,
 primary key (id)
);
create table public.exercises (
 id uuid not null default gen_random_uuid(),
 title text not null,
 body_zone public.body_zone not null,
 difficulty public.difficulty not null default 'easy'::difficulty,
 duration_seconds integer not null check(duration_seconds > 0),
 description text,
 instructions text,
 is_active boolean not null default true,
 created_by uuid,
 created_at timestamp with time zone not null default now(),
 updated_at timestamp with time zone not null default now(),
 primary key (id)
);
create table public.exercise_complexes (
 id uuid not null default gen_random_uuid(),
 title text not null,
 description text,
 is_active boolean not null default true,
 created_at timestamp with time zone not null default now(),
 primary key (id)
);
create table public.exercise_complex_items (
 complex_id uuid not null,
 exercise_id uuid not null,
 position integer not null default 0,
 primary key (complex_id,exercise_id)
);
create table public.survey_questions (
 id uuid not null default gen_random_uuid(),
 question_text text not null,
 question_type public.question_type not null,
 options jsonb,
 body_zone public.body_zone,
 order_index integer not null default 0,
 is_active boolean not null default true,
 created_at timestamp with time zone not null default now(),
 updated_at timestamp with time zone not null default now(),
 primary key (id)
);
create table public.recommendation_rules (
 id uuid not null default gen_random_uuid(),
 body_zone public.body_zone not null,
 target_zone public.body_zone,
 min_pain integer not null default 0 check(min_pain >= 0 AND min_pain <= 5),
 max_pain integer not null default 5 check(max_pain >= 0 AND max_pain <= 5),
 max_difficulty public.difficulty not null default 'easy'::difficulty,
 max_items integer not null default 5 check(max_items > 0),
 priority integer not null default 0,
 is_active boolean not null default true,
 created_at timestamp with time zone not null default now(),
 primary key (id)
);
create table public.achievements (
 id uuid not null default gen_random_uuid(),
 code text not null,
 title text not null,
 description text,
 points_bonus integer not null default 0,
 condition jsonb,
 is_active boolean not null default true,
 primary key (id)
);
create table public.system_settings (
 key text not null,
 value jsonb not null,
 updated_at timestamp with time zone not null default now(),
 primary key (key)
);
create table public.surveys (
 id uuid not null default gen_random_uuid(),
 user_id uuid not null,
 body_zone public.body_zone,
 pain_level integer check(pain_level >= 0 AND pain_level <= 5),
 answers jsonb not null default '{}'::jsonb,
 comment text,
 created_at timestamp with time zone not null default now(),
 survey_type text,
 date date,
 pain_neck integer,
 pain_back integer,
 pain_lower_back integer,
 pain_head integer,
 pain_shoulders integer,
 pain_arms integer,
 feet_position text,
 hours_computer integer check(hours_computer IS NULL OR hours_computer >= 0 AND hours_computer <= 16),
 has_breaks boolean,
 water_glasses integer check(water_glasses IS NULL OR water_glasses >= 0 AND water_glasses <= 20),
 chair_type text,
 monitor_height text,
 has_armrests boolean,
 has_laptop_stand boolean,
 primary key (id)
);
create table public.exercise_logs (
 id uuid not null default gen_random_uuid(),
 user_id uuid not null,
 exercise_id uuid not null,
 duration_seconds integer check(duration_seconds >= 0),
 pain_before integer check(pain_before >= 0 AND pain_before <= 5),
 pain_after integer check(pain_after >= 0 AND pain_after <= 5),
 completed_at timestamp with time zone not null default now(),
 date date,
 created_at timestamp with time zone not null default now(),
 primary key (id)
);
create table public.workout_plans (
 id uuid not null default gen_random_uuid(),
 user_id uuid not null,
 day_of_week integer not null check(day_of_week >= 1 AND day_of_week <= 7),
 exercise_id uuid not null,
 planned_time time without time zone,
 primary key (id)
);
create table public.user_achievements (
 user_id uuid not null,
 achievement_id uuid not null,
 earned_at timestamp with time zone not null default now(),
 primary key (user_id,achievement_id)
);
create table public.user_scores (
 user_id uuid not null,
 points integer not null default 0,
 streak_days integer not null default 0,
 last_activity_date date,
 updated_at timestamp with time zone not null default now(),
 primary key (user_id)
);
create table public.posture_sessions (
 id uuid not null default gen_random_uuid(),
 user_id uuid not null,
 started_at timestamp with time zone not null default now(),
 duration_seconds integer check(duration_seconds >= 0),
 good_posture_percent numeric check(good_posture_percent >= 0::numeric AND good_posture_percent <= 100::numeric),
 alerts_count integer not null default 0,
 primary key (id)
);
alter table public.workout_plans add constraint workout_plans_user_id_fkey foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.surveys add constraint surveys_user_id_fkey foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade;
alter table public.exercises add constraint exercises_created_by_fkey foreign key (created_by) references public.profiles (id);
alter table public.posture_sessions add constraint posture_sessions_user_id_fkey foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.user_scores add constraint user_scores_user_id_fkey foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.user_achievements add constraint user_achievements_user_id_fkey foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.exercise_logs add constraint exercise_logs_user_id_fkey foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.exercise_logs add constraint exercise_logs_exercise_id_fkey foreign key (exercise_id) references public.exercises (id);
alter table public.exercise_complex_items add constraint exercise_complex_items_exercise_id_fkey foreign key (exercise_id) references public.exercises (id);
alter table public.workout_plans add constraint workout_plans_exercise_id_fkey foreign key (exercise_id) references public.exercises (id);
alter table public.exercise_complex_items add constraint exercise_complex_items_complex_id_fkey foreign key (complex_id) references public.exercise_complexes (id);
alter table public.user_achievements add constraint user_achievements_achievement_id_fkey foreign key (achievement_id) references public.achievements (id);

create function public.set_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now();return new;end; $$;
create function public.update_updated_at_column() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now();return new;end; $$;
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.profiles where id=auth.uid() and role::text='admin' and not is_blocked); $$;
create function public.is_super_admin() returns boolean language sql stable set search_path='' as $$ select false; $$;
create function public.protect_profile_fields() returns trigger language plpgsql security invoker set search_path='' as $$ begin if auth.uid() is not null and (new.role is distinct from old.role or new.email is distinct from old.email or (new.is_blocked is distinct from old.is_blocked and not public.is_admin())) then raise exception 'Protected profile fields'; end if;return new;end; $$;
create trigger trg_protect_profile before update on public.profiles for each row execute function public.protect_profile_fields();
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.profiles(id,email,full_name) values(new.id,new.email,new.raw_user_meta_data->>'full_name');insert into public.user_scores(user_id) values(new.id);return new;end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create function public.award_points_on_log() returns trigger language plpgsql security definer set search_path='' as $$ begin update public.user_scores set points=points+10,updated_at=now() where user_id=new.user_id;return new;end; $$;
create trigger on_exercise_complete after insert on public.exercise_logs for each row execute function public.award_points_on_log();
alter table public.profiles enable row level security;
create trigger update_timestamp before update on public.profiles for each row execute function public.set_updated_at();
create policy profiles_select on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated using(id=auth.uid() or public.is_admin()) with check(id=auth.uid() or public.is_admin());
grant select,update on public.profiles to authenticated;
alter table public.exercises enable row level security;
create trigger update_timestamp before update on public.exercises for each row execute function public.set_updated_at();
create policy content_read on public.exercises for select to authenticated using(true);
create policy content_manage on public.exercises for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update,delete on public.exercises to authenticated;
alter table public.exercise_complexes enable row level security;
create policy content_read on public.exercise_complexes for select to authenticated using(true);
create policy content_manage on public.exercise_complexes for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update,delete on public.exercise_complexes to authenticated;
alter table public.exercise_complex_items enable row level security;
create policy content_read on public.exercise_complex_items for select to authenticated using(true);
create policy content_manage on public.exercise_complex_items for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update,delete on public.exercise_complex_items to authenticated;
alter table public.survey_questions enable row level security;
create trigger update_timestamp before update on public.survey_questions for each row execute function public.set_updated_at();
create policy content_read on public.survey_questions for select to authenticated using(true);
create policy content_manage on public.survey_questions for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update,delete on public.survey_questions to authenticated;
alter table public.recommendation_rules enable row level security;
create policy content_read on public.recommendation_rules for select to authenticated using(true);
create policy content_manage on public.recommendation_rules for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update,delete on public.recommendation_rules to authenticated;
alter table public.achievements enable row level security;
create policy content_read on public.achievements for select to authenticated using(true);
create policy content_manage on public.achievements for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update,delete on public.achievements to authenticated;
alter table public.system_settings enable row level security;
create trigger update_timestamp before update on public.system_settings for each row execute function public.set_updated_at();
create policy content_read on public.system_settings for select to authenticated using(public.is_admin());
create policy content_manage on public.system_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update,delete on public.system_settings to authenticated;
alter table public.surveys enable row level security;
create policy owner_access on public.surveys for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,update,delete on public.surveys to authenticated;
alter table public.exercise_logs enable row level security;
create policy owner_access on public.exercise_logs for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,update,delete on public.exercise_logs to authenticated;
alter table public.workout_plans enable row level security;
create policy owner_access on public.workout_plans for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,update,delete on public.workout_plans to authenticated;
alter table public.user_achievements enable row level security;
create policy owner_access on public.user_achievements for select to authenticated using(user_id=auth.uid());
grant select on public.user_achievements to authenticated;
alter table public.user_scores enable row level security;
create trigger update_timestamp before update on public.user_scores for each row execute function public.set_updated_at();
create policy owner_access on public.user_scores for select to authenticated using(user_id=auth.uid());
grant select on public.user_scores to authenticated;
alter table public.posture_sessions enable row level security;
create policy owner_access on public.posture_sessions for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,update,delete on public.posture_sessions to authenticated;
commit;
