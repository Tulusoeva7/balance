begin;
alter table public.exercise_logs add column if not exists feedback text check (feedback in ('better','same','worse'));
commit;
