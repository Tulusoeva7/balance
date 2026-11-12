create or replace function public.complete_onboarding(p_answers jsonb,p_date date) returns uuid language plpgsql security invoker set search_path='' as $$
declare survey_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select id into survey_id from public.surveys where user_id=auth.uid() and survey_type='initial' and date=p_date and answers=p_answers order by created_at desc limit 1;
 if survey_id is null then
  insert into public.surveys(user_id,survey_type,date,answers) values(auth.uid(),'initial',p_date,p_answers) returning id into survey_id;
 end if;
 update public.profiles set onboarding_completed=true, goals=array(select jsonb_array_elements_text(coalesce(p_answers->'goals','[]'::jsonb))), consent_given_at=coalesce(consent_given_at,now()) where id=auth.uid();
 delete from public.onboarding_drafts where user_id=auth.uid();
 return survey_id;
end; $$;
