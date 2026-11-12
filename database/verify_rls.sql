-- Runs entirely inside a rollback transaction; never modifies real answers.
begin;
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where role::text='user' limit 1),true);
set local role authenticated;
select jsonb_build_object(
 'foreign_diary',(select count(*) from public.diary_entries where user_id<>auth.uid()),
 'foreign_surveys',(select count(*) from public.surveys where user_id<>auth.uid()),
 'admin_access',app_private.is_admin(),
 'body_zones',(select count(*) from public.body_zones),
 'questions',(select count(*) from public.survey_questions where is_active),
 'exercises',(select count(*) from public.exercises where is_active)) as verification;
do $$ begin
 begin
  update public.profiles set role='admin' where id=auth.uid();
  raise exception 'SECURITY TEST FAILED';
 exception when raise_exception then
  if sqlerrm='SECURITY TEST FAILED' then raise; end if;
 end;
end $$;
rollback;
