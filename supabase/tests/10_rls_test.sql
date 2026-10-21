-- Pruebas de permisos entre usuarios. Ejecutadas con scripts/test-db.sh.
-- Cualquier fallo lanza una excepción y detiene la ejecución (ON_ERROR_STOP).
grant all on all tables in schema public to authenticated, service_role;
grant all on storage.objects, storage.buckets to authenticated, service_role;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.dev'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.dev');

-- Trigger: cada usuario nuevo tiene suscripción gratuita.
do $$ begin
  if (select count(*) from public.subscriptions) <> 2 then raise exception 'FALLO: trigger de suscripción'; end if;
end $$;

-- ---------- Usuario A crea sus datos
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.user_profiles (user_id, age, sex, height_cm, weight_kg, units, level, data)
  values (auth.uid(), 30, 'male', 178, 85, 'metric', 'beginner', '{"goal":"fat_loss"}');
insert into public.body_measurements (user_id, measured_on, weight_kg) values (auth.uid(), '2026-10-01', 85);
insert into public.workout_sessions (id, user_id, day_index, completed_pct) values ('10000000-0000-0000-0000-000000000001', auth.uid(), 0, 1);
insert into public.exercise_logs (session_id, user_id, exercise_id, set_number, weight_kg, reps)
  values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'back_squat', 1, 100, 8);
insert into storage.objects (bucket_id, name) values ('progress-photos', '00000000-0000-0000-0000-00000000000a/front.jpg');

-- A no puede escribir datos a nombre de B
do $$ begin
  begin
    insert into public.body_measurements (user_id, measured_on, weight_kg) values ('00000000-0000-0000-0000-00000000000b', '2026-10-01', 70);
    raise exception 'FALLO: A escribió datos de B';
  exception when insufficient_privilege then null; -- esperado (RLS)
  end;
end $$;

-- A no puede subirse a premium ni crear eventos de pago o uso de IA
do $$ begin
  begin
    update public.subscriptions set plan = 'elite', status = 'active' where user_id = auth.uid();
    if (select plan from public.subscriptions where user_id = auth.uid()) = 'elite' then raise exception 'FALLO: el cliente cambió su plan'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.payment_events (event_id, event_type, payload) values ('x', 'INITIAL_PURCHASE', '{}');
    raise exception 'FALLO: el cliente insertó un evento de pago';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.nutrition_plans (user_id, kind, targets, week) values (auth.uid(), 'week', '{}', '{}');
    raise exception 'FALLO: el cliente insertó un plan de comidas premium';
  exception when insufficient_privilege then null;
  end;
end $$;

-- A no puede usar el panel administrativo
do $$ begin
  begin
    perform public.admin_metrics('2026-01-01', '2026-12-31');
    raise exception 'FALLO: usuario normal accedió a métricas';
  exception when insufficient_privilege then null;
  end;
end $$;

-- A no puede subir fotos en la carpeta de B
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('progress-photos', '00000000-0000-0000-0000-00000000000b/x.jpg');
    raise exception 'FALLO: A subió una foto a la carpeta de B';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------- Usuario B no ve nada de A
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  if exists (select 1 from public.user_profiles) then raise exception 'FALLO: B ve perfiles ajenos'; end if;
  if exists (select 1 from public.body_measurements) then raise exception 'FALLO: B ve medidas ajenas'; end if;
  if exists (select 1 from public.exercise_logs) then raise exception 'FALLO: B ve registros ajenos'; end if;
  if exists (select 1 from storage.objects) then raise exception 'FALLO: B ve fotos ajenas'; end if;
  if (select count(*) from public.subscriptions) <> 1 then raise exception 'FALLO: B ve suscripciones ajenas'; end if;
  if (select count(*) from public.foods) = 0 then raise exception 'FALLO: catálogo no legible'; end if;
end $$;
-- B no puede colgar registros de la sesión de A
do $$ begin
  begin
    insert into public.exercise_logs (session_id, user_id, exercise_id, set_number, reps)
      values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'back_squat', 2, 5);
    raise exception 'FALLO: B escribió en la sesión de A';
  exception when insufficient_privilege then null;
  end;
end $$;
-- B no puede borrar datos de A (el borrado no afecta filas)
delete from public.body_measurements;
reset role;
do $$ begin
  if (select count(*) from public.body_measurements) <> 1 then raise exception 'FALLO: B borró datos de A'; end if;
end $$;

-- ---------- Servidor: el plan efectivo depende de la suscripción
update public.subscriptions set plan = 'pro', status = 'active', expires_at = now() + interval '30 days' where user_id = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  if public.current_plan('00000000-0000-0000-0000-00000000000a') <> 'pro' then raise exception 'FALLO: plan pro'; end if;
end $$;
update public.subscriptions set status = 'cancelled_active' where user_id = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  if public.current_plan('00000000-0000-0000-0000-00000000000a') <> 'pro' then raise exception 'FALLO: cancelada conserva acceso hasta expirar'; end if;
end $$;
update public.subscriptions set expires_at = now() - interval '1 day' where user_id = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  if public.current_plan('00000000-0000-0000-0000-00000000000a') <> 'free' then raise exception 'FALLO: expirada debe ser free'; end if;
end $$;

-- Eventos de pago duplicados se rechazan
insert into public.payment_events (event_id, event_type, payload) values ('evt_1', 'RENEWAL', '{}');
do $$ begin
  begin
    insert into public.payment_events (event_id, event_type, payload) values ('evt_1', 'RENEWAL', '{}');
    raise exception 'FALLO: evento duplicado aceptado';
  exception when unique_violation then null;
  end;
end $$;

-- Panel administrativo para administradores
insert into public.admin_users (user_id) values ('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ declare m jsonb; begin
  m := public.admin_metrics('2026-01-01', '2026-12-31');
  if (m->>'registered_users')::int <> 2 then raise exception 'FALLO: métricas %', m; end if;
  if m->>'revenue_net_est_usd' is null then raise exception 'FALLO: ingresos netos'; end if;
end $$;
reset role;

-- Borrar la cuenta elimina todos sus datos (cascada)
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  if exists (select 1 from public.user_profiles where user_id = '00000000-0000-0000-0000-00000000000a') then raise exception 'FALLO: cascada perfil'; end if;
  if exists (select 1 from public.exercise_logs) then raise exception 'FALLO: cascada registros'; end if;
  if exists (select 1 from public.subscriptions where user_id = '00000000-0000-0000-0000-00000000000a') then raise exception 'FALLO: cascada suscripción'; end if;
end $$;

select 'TODAS LAS PRUEBAS DE BASE DE DATOS PASARON' as resultado;
