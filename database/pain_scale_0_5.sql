-- Balance uses one pain intensity scale everywhere: 0..5.
-- Apply only after checking that existing values are <= 5.
update public.recommendation_rules set max_pain = 5 where max_pain > 5;

alter table public.recommendation_rules drop constraint if exists recommendation_rules_min_pain_check;
alter table public.recommendation_rules drop constraint if exists recommendation_rules_max_pain_check;
alter table public.recommendation_rules add constraint recommendation_rules_min_pain_check check (min_pain between 0 and 5);
alter table public.recommendation_rules add constraint recommendation_rules_max_pain_check check (max_pain between 0 and 5);

alter table public.exercise_logs drop constraint if exists exercise_logs_pain_before_check;
alter table public.exercise_logs drop constraint if exists exercise_logs_pain_after_check;
alter table public.exercise_logs add constraint exercise_logs_pain_before_check check (pain_before is null or pain_before between 0 and 5);
alter table public.exercise_logs add constraint exercise_logs_pain_after_check check (pain_after is null or pain_after between 0 and 5);
