-- Repair legacy accounts: an initial survey means onboarding was completed.
update public.profiles p
set onboarding_completed = true
where onboarding_completed = false
  and exists (
    select 1 from public.surveys s
    where s.user_id = p.id and s.survey_type = 'initial'
  );
