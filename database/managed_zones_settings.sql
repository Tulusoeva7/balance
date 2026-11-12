create table public.body_zones(id text primary key,label text not null,description text not null default '',order_index integer not null default 0);
alter table public.body_zones enable row level security;
create policy zones_read on public.body_zones for select to authenticated using(true);
create policy zones_write on public.body_zones for update to authenticated using((select app_private.is_admin())) with check((select app_private.is_admin()));
grant select,update on public.body_zones to authenticated;
insert into public.body_zones(id,label,order_index) values ('head','Голова',1),('neck','Шея',2),('shoulders','Плечи',3),('upper_back','Верх спины',4),('lower_back','Поясница',5),('elbows','Локти / предплечья',6),('wrists','Кисти / запястья',7),('hips','Таз / бёдра',8),('knees','Колени',9),('feet','Стопы',10);
create policy settings_read_safe on public.system_settings for select to authenticated using(key in ('max_exercises'));
insert into public.system_settings(key,value) values ('max_exercises','5'::jsonb) on conflict(key) do nothing;
