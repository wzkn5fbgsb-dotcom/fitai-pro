-- FITAI PRO — seguridad a nivel de fila (RLS) y almacenamiento privado de fotos.

-- Catálogo: lectura para usuarios autenticados; escritura sólo administradores.
do $$
declare t text;
begin
  foreach t in array array['foods','recipes','recipe_ingredients','exercises'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_read', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin', t);
  end loop;
end $$;

-- Datos propios del usuario: lectura y escritura sólo sobre sus filas.
do $$
declare t text;
begin
  foreach t in array array[
    'user_profiles','fitness_goals','health_safety_flags','user_preferences',
    'workout_plans','workout_sessions','exercise_logs','daily_nutrition_logs',
    'body_measurements','progress_photos','weekly_checkins'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = auth.uid())', t || '_own_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = auth.uid())', t || '_own_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_own_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = auth.uid())', t || '_own_delete', t);
  end loop;
end $$;

-- Un registro de ejercicio sólo puede colgar de una sesión del mismo usuario.
create policy exercise_logs_session_owner on public.exercise_logs as restrictive for insert to authenticated
  with check (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid()));

-- Datos que SÓLO escribe el servidor (funciones con service_role):
-- membresías, eventos de pago, uso de IA y planes de comidas generados.
do $$
declare t text;
begin
  foreach t in array array['subscriptions','payment_events','ai_usage','nutrition_plans'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
create policy subscriptions_own_select on public.subscriptions for select to authenticated using (user_id = auth.uid());
create policy ai_usage_own_select on public.ai_usage for select to authenticated using (user_id = auth.uid());
create policy nutrition_plans_own_select on public.nutrition_plans for select to authenticated using (user_id = auth.uid());
create policy payment_events_admin_select on public.payment_events for select to authenticated using (public.is_admin());
-- (payment_events: los usuarios ven su estado en subscriptions; los eventos crudos sólo los administradores)

-- Administración
alter table public.admin_users enable row level security;
create policy admin_users_admin on public.admin_users for select to authenticated using (public.is_admin());
alter table public.plan_config enable row level security;
create policy plan_config_read on public.plan_config for select to authenticated using (true);
create policy plan_config_admin on public.plan_config for update to authenticated using (public.is_admin()) with check (public.is_admin());
alter table public.app_errors enable row level security;
create policy app_errors_insert on public.app_errors for insert to authenticated with check (user_id = auth.uid());
create policy app_errors_admin on public.app_errors for select to authenticated using (public.is_admin());

-- Nadie anónimo accede a nada.
revoke all on all tables in schema public from anon;

-- ------------------------------------------------- almacenamiento de fotos
-- Bucket privado. Ruta obligatoria: <user_id>/<archivo>. Sólo el dueño lee,
-- sube o borra. La app muestra las fotos con URLs firmadas temporales.
insert into storage.buckets (id, name, public) values ('progress-photos', 'progress-photos', false)
on conflict (id) do update set public = false;

create policy photos_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
