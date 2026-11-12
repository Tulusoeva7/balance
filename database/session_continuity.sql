alter table public.working_sessions add column next_break_work_seconds integer not null default 2700 check(next_break_work_seconds>=0);
alter table public.working_sessions add column break_started_seconds integer not null default 0 check(break_started_seconds>=0);
create unique index exercise_completion_per_day on public.exercise_logs(user_id,exercise_id,date) where date is not null;
