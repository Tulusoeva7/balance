alter function public.set_updated_at() set search_path='';
alter function public.update_updated_at_column() set search_path='';
revoke execute on function public.handle_new_user() from public,anon,authenticated;
revoke execute on function public.award_points_on_log() from public,anon,authenticated;
revoke execute on function public.is_super_admin() from public,anon,authenticated;
