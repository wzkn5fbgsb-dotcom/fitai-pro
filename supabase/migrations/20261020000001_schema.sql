-- FITAI PRO — esquema principal (PostgreSQL / Supabase)
-- Cada usuario sólo accede a sus propios datos (RLS en 20261020000002_rls.sql).
-- Las tablas de catálogo (alimentos, recetas, ejercicios) son de sólo lectura para la app.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ catálogo
create table public.foods (
  id text primary key,
  name_es text not null,
  name_en text not null,
  usda_ndb text not null,
  usda_description text not null,
  kcal_100g numeric(7,2) not null check (kcal_100g >= 0),
  protein_100g numeric(6,2) not null check (protein_100g >= 0),
  carbs_100g numeric(6,2) not null check (carbs_100g >= 0),
  fat_100g numeric(6,2) not null check (fat_100g >= 0),
  fiber_100g numeric(6,2) check (fiber_100g >= 0),
  state text not null check (state in ('raw','dry','cooked','drained','ready')),
  category text not null,
  origin text not null,
  allergens text[] not null default '{}',
  cost_tier smallint not null check (cost_tier between 1 and 3),
  unit_grams numeric(6,1),
  verified_on date,
  updated_at timestamptz not null default now()
);
comment on table public.foods is 'FoodDatabase. Valores por 100 g de USDA FoodData Central (SR Legacy).';

create table public.recipes (
  id text primary key,
  name_es text not null,
  name_en text not null,
  meal_types text[] not null,
  prep_minutes int not null check (prep_minutes > 0),
  steps_es text[] not null,
  steps_en text[] not null,
  seasonings_es text not null,
  seasonings_en text not null,
  batch_friendly boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.recipe_ingredients (
  recipe_id text not null references public.recipes(id) on delete cascade,
  position smallint not null,
  food_id text not null references public.foods(id),
  role text not null check (role in ('P','C','F','V')),
  base_g numeric(6,1) not null,
  min_g numeric(6,1) not null,
  max_g numeric(6,1) not null,
  step_g numeric(6,1) not null,
  alternatives text[] not null default '{}',
  primary key (recipe_id, position),
  check (min_g <= base_g and base_g <= max_g)
);

create table public.exercises (
  id text primary key,
  name_es text not null,
  name_en text not null,
  pattern text not null,
  primary_muscle text not null,
  secondary_muscles text[] not null default '{}',
  equipment text[] not null,
  load_type text not null,
  difficulty smallint not null check (difficulty between 1 and 3),
  compound boolean not null,
  stress_areas text[] not null default '{}',
  cues_es text[] not null,
  cues_en text[] not null,
  mistakes_es text[] not null,
  mistakes_en text[] not null,
  video_url text, -- sólo fuentes verificadas
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------- usuarios
-- "Users" es auth.users (Supabase Auth). Todo cuelga de ahí con borrado en cascada.

create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  age smallint not null check (age between 13 and 100),
  sex text not null check (sex in ('male','female','unspecified')),
  height_cm numeric(5,1) not null check (height_cm between 120 and 230),
  weight_kg numeric(5,1) not null check (weight_kg between 30 and 300),
  units text not null check (units in ('metric','imperial')),
  lang text not null default 'es' check (lang in ('es','en')),
  country text not null default 'US',
  level text not null check (level in ('beginner','intermediate','advanced')),
  -- Instantánea completa del perfil que usa el motor de cálculo (src/core/types.ts).
  -- Incluye respuestas de salud: dato sensible, nunca se registra en logs.
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fitness_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal text not null check (goal in ('fat_loss','muscle_gain','recomposition','toning','strength','endurance','maintenance')),
  target_weight_kg numeric(5,1),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index fitness_goals_one_active on public.fitness_goals(user_id) where ended_at is null;

create table public.health_safety_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  severity text not null check (severity in ('info','caution','block')),
  created_at timestamptz not null default now(),
  unique (user_id, code)
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  diet text not null default 'omnivore' check (diet in ('omnivore','vegetarian','vegan','pescatarian')),
  allergens text[] not null default '{}',
  excluded_foods text[] not null default '{}',
  favorite_foods text[] not null default '{}',
  budget text not null default 'medium' check (budget in ('low','medium','high')),
  cooking_time text not null default 'some' check (cooking_time in ('minimal','some','plenty')),
  meals_per_day smallint not null default 3 check (meals_per_day between 3 and 5),
  prep_style text not null default 'daily' check (prep_style in ('daily','batch')),
  theme text not null default 'system' check (theme in ('system','light','dark')),
  notifications jsonb not null default '{}'::jsonb,
  calorie_offset_kcal int not null default 0 check (calorie_offset_kcal between -500 and 500),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------- entrenamiento
create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  split text not null,
  plan jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index workout_plans_one_active on public.workout_plans(user_id) where active;

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.workout_plans(id) on delete set null,
  day_index smallint not null check (day_index between 0 and 6),
  performed_at timestamptz not null default now(),
  perceived_effort smallint check (perceived_effort between 1 and 10),
  recovery_ok boolean not null default true,
  completed_pct numeric(4,3) not null check (completed_pct between 0 and 1),
  notes text check (char_length(notes) <= 1000)
);
create index workout_sessions_user_date on public.workout_sessions(user_id, performed_at desc);

create table public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null references public.exercises(id),
  set_number smallint not null check (set_number between 1 and 20),
  weight_kg numeric(6,2) check (weight_kg >= 0),
  reps smallint not null check (reps between 0 and 100),
  rir smallint check (rir between 0 and 10),
  completed boolean not null default true,
  pain boolean not null default false,
  technique_ok boolean not null default true,
  unique (session_id, exercise_id, set_number)
);
create index exercise_logs_user_ex on public.exercise_logs(user_id, exercise_id);

-- -------------------------------------------------------------- nutrición
-- Los planes de comidas los genera el SERVIDOR (función nutrition-plan) según el
-- plan de membresía: la app no puede insertarlos directamente.
create table public.nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('preview','week')),
  targets jsonb not null,
  week jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index nutrition_plans_one_active on public.nutrition_plans(user_id) where active;

create table public.daily_nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  slot_id text not null,
  recipe_id text references public.recipes(id),
  eaten boolean not null default true,
  kcal numeric(7,1) not null default 0,
  protein_g numeric(6,1) not null default 0,
  carbs_g numeric(6,1) not null default 0,
  fat_g numeric(6,1) not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, log_date, slot_id)
);

-- --------------------------------------------------------------- progreso
create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(5,2) check (weight_kg between 30 and 300),
  waist_cm numeric(5,1) check (waist_cm between 30 and 250),
  chest_cm numeric(5,1) check (chest_cm between 30 and 250),
  arm_cm numeric(5,1) check (arm_cm between 10 and 100),
  hip_cm numeric(5,1) check (hip_cm between 30 and 250),
  thigh_cm numeric(5,1) check (thigh_cm between 20 and 150),
  created_at timestamptz not null default now(),
  unique (user_id, measured_on)
);

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  pose text not null check (pose in ('front','side','back')),
  taken_on date not null,
  -- Consentimiento explícito para análisis por IA. Nunca se usan para entrenar modelos.
  consent_ai_analysis boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  answers jsonb not null,
  proposal jsonb not null,
  decision text not null default 'pending' check (decision in ('pending','accepted','rejected','modified')),
  applied_delta_kcal int not null default 0 check (applied_delta_kcal between -500 and 500),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

-- ----------------------------------------------------------- membresías
create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','pro','elite')),
  status text not null default 'expired' check (status in ('active','in_grace','billing_issue','cancelled_active','expired','paused')),
  expires_at timestamptz,
  will_renew boolean not null default false,
  store text,
  product_id text,
  updated_at timestamptz not null default now()
);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique, -- id del evento de la tienda: protege contra duplicados
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  product_id text,
  price_usd numeric(10,2),
  store text,
  environment text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  model text not null,
  intent text,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  est_cost_usd numeric(10,6) not null default 0,
  success boolean not null default true
);
create index ai_usage_user_time on public.ai_usage(user_id, created_at desc);

-- ---------------------------------------------------------- administración
create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.plan_config (
  id smallint primary key default 1 check (id = 1),
  pro_monthly_usd numeric(6,2) not null default 9.99,
  elite_monthly_usd numeric(6,2) not null default 19.99,
  annual_discount_pct numeric(5,2) not null default 30 check (annual_discount_pct between 0 and 80),
  ai_monthly_budget_usd numeric(10,2) not null default 100,
  store_fee_pct numeric(5,2) not null default 15, -- comisión estimada de la tienda
  updated_at timestamptz not null default now()
);
insert into public.plan_config (id) values (1);

create table public.app_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  source text not null,
  code text not null,
  created_at timestamptz not null default now()
  -- deliberadamente sin mensaje libre: no se registran datos sensibles
);

-- -------------------------------------------------------------- funciones
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger t_user_profiles_updated before update on public.user_profiles for each row execute function public.touch_updated_at();
create trigger t_user_preferences_updated before update on public.user_preferences for each row execute function public.touch_updated_at();
create trigger t_subscriptions_updated before update on public.subscriptions for each row execute function public.touch_updated_at();

-- Plan efectivo según el SERVIDOR (fuente de verdad para el acceso premium).
create or replace function public.current_plan(uid uuid default auth.uid()) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when s.status in ('expired','paused') then 'free'
      when s.expires_at is not null and s.expires_at < now() then 'free'
      else s.plan end
    from public.subscriptions s where s.user_id = uid
  ), 'free')
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid())
$$;

-- Cada usuario nuevo recibe una fila de suscripción gratuita.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.subscriptions (user_id, plan, status) values (new.id, 'free', 'expired')
  on conflict (user_id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Métricas del panel administrativo (sólo administradores).
create or replace function public.admin_metrics(from_date date, to_date date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb;
  cfg public.plan_config;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into cfg from public.plan_config where id = 1;
  select jsonb_build_object(
    'registered_users', (select count(*) from auth.users),
    'new_users', (select count(*) from auth.users where created_at::date between from_date and to_date),
    'active_users', (select count(distinct user_id) from (
        select user_id from public.workout_sessions where performed_at::date between from_date and to_date
        union select user_id from public.daily_nutrition_logs where log_date between from_date and to_date
        union select user_id from public.ai_usage where created_at::date between from_date and to_date) a),
    'plan_distribution', (select coalesce(jsonb_object_agg(p, n), '{}'::jsonb) from (
        select public.current_plan(user_id) p, count(*) n from public.subscriptions group by 1) d),
    'new_subscriptions', (select count(*) from public.payment_events where event_type = 'INITIAL_PURCHASE' and received_at::date between from_date and to_date),
    'cancellations', (select count(*) from public.payment_events where event_type = 'CANCELLATION' and received_at::date between from_date and to_date),
    'failed_payments', (select count(*) from public.payment_events where event_type = 'BILLING_ISSUE' and received_at::date between from_date and to_date),
    -- MRR = ingresos recurrentes mensuales; NO es beneficio.
    'mrr_gross_usd', (select coalesce(sum(case public.current_plan(user_id) when 'pro' then cfg.pro_monthly_usd when 'elite' then cfg.elite_monthly_usd else 0 end), 0) from public.subscriptions),
    'revenue_gross_usd', (select coalesce(sum(price_usd), 0) from public.payment_events where event_type in ('INITIAL_PURCHASE','RENEWAL','PRODUCT_CHANGE') and received_at::date between from_date and to_date),
    'store_fees_est_usd', (select coalesce(sum(price_usd), 0) * cfg.store_fee_pct / 100 from public.payment_events where event_type in ('INITIAL_PURCHASE','RENEWAL','PRODUCT_CHANGE') and received_at::date between from_date and to_date),
    'ai_messages', (select count(*) from public.ai_usage where created_at::date between from_date and to_date),
    'ai_cost_usd', (select coalesce(sum(est_cost_usd), 0) from public.ai_usage where created_at::date between from_date and to_date),
    'errors', (select count(*) from public.app_errors where created_at::date between from_date and to_date),
    'paying_users', (select count(*) from public.subscriptions where public.current_plan(user_id) <> 'free')
  ) into result;
  result := result || jsonb_build_object(
    'revenue_net_est_usd', (result->>'revenue_gross_usd')::numeric - (result->>'store_fees_est_usd')::numeric,
    'margin_after_variable_costs_est_usd', (result->>'revenue_gross_usd')::numeric - (result->>'store_fees_est_usd')::numeric - (result->>'ai_cost_usd')::numeric,
    'free_to_paid_conversion', case when (result->>'registered_users')::numeric > 0 then round((result->>'paying_users')::numeric / (result->>'registered_users')::numeric, 4) else 0 end
  );
  return result;
end $$;
