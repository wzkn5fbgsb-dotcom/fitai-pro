# Arquitectura de FITAI PRO

## 1. Decisiones y motivos

| Decisión | Motivo | Alternativas descartadas |
|---|---|---|
| **Expo SDK 57 + React Native 0.86 + expo-router**, un solo código para iOS y Android | Una persona puede mantenerlo; se prueba en Expo Go sin compilar; EAS compila en la nube (el dueño no tiene computadora). Se apunta a SDK 57 porque Expo Go para SDK 58 aún no está en la App Store. | Swift + Kotlin (dos apps), Flutter (otro lenguaje sin Expo Go/EAS equivalente) |
| **Supabase**: Postgres + Auth + Storage + Edge Functions | SQL real con **Row Level Security** (cada usuario sólo ve sus filas), borrado en cascada, almacenamiento privado de fotos y funciones en el servidor con secretos. Plan gratuito para empezar. | Firebase (reglas menos expresivas para datos relacionales), servidor propio (más mantenimiento) |
| **RevenueCat** para compras en Apple y Google | Una API para ambas tiendas, validación de recibos en su servidor y **webhook** hacia nuestro backend. La tabla `subscriptions` es la única fuente de verdad del plan. | StoreKit/Play Billing directo (doble trabajo y validación propia) |
| **Motor determinista compartido** (`src/core`) | Las cifras (calorías, macros, series, menús) salen de fórmulas publicadas y datos USDA, no de la IA. El mismo código corre en la app y en el servidor (copiado a `supabase/functions/_shared/core` y comprobado en CI). Es puro y se prueba con Node sin dependencias. | Generar planes con IA (inconsistente, caro, difícil de verificar) |
| **IA sólo para preguntas abiertas** | El coach responde primero con reglas usando datos reales del usuario; sólo si no sabe, llama al modelo con un resumen (nunca fotos). Límites por plan y presupuesto mensual en el servidor. | IA para todo (costo sin control, riesgo de cifras inventadas) |
| **Modo local** sin backend | La app se puede probar en Expo Go sin cuentas; los datos quedan en el teléfono (expo-sqlite kv-store). | — |

## 2. Componentes
```
iPhone / Android (Expo)
 ├─ app/ (pantallas)  ─ src/data (estado) ─ src/core (motor)
 ├─ src/lib/supabase.ts ──────► Supabase Auth / Postgres (RLS) / Storage (progress-photos, privado)
 ├─ src/lib/purchases.ts ─────► RevenueCat SDK ──► App Store / Google Play
 └─ functions.invoke ─────────► Edge Functions (Deno)
                                  ├─ nutrition-plan   (menú según plan, en servidor)
                                  ├─ ai-coach         (reglas → Anthropic, límites y presupuesto)
                                  ├─ delete-account   (fotos + usuario, cascada)
                                  └─ revenuecat-webhook ◄── RevenueCat (cabecera secreta)
```

## 3. Modelo de datos (`supabase/migrations`)
| Tabla | Contenido | Acceso de la app |
|---|---|---|
| `foods` | alimentos USDA SR Legacy por 100 g, número NDB | lectura |
| `recipes`, `recipe_ingredients` | recetas, ingredientes con rangos de gramos y alternativas | lectura |
| `exercises` | biblioteca bilingüe, patrón, músculos, equipo, zonas de estrés | lectura |
| `user_profiles` | edad, sexo, altura, peso, unidades, idioma, nivel + instantánea `data` (incluye respuestas de salud) | propio |
| `fitness_goals` | objetivo activo (uno) e historial | propio |
| `health_safety_flags` | señales de seguridad (TCA, embarazo, etc.) con severidad | propio |
| `user_preferences` | dieta, alergias, exclusiones, presupuesto, tiempo, comidas/día, tema, notificaciones, ajuste de kcal ±500 | propio |
| `workout_plans` | rutina activa (una) | propio |
| `workout_sessions`, `exercise_logs` | sesiones y series (peso, reps, RIR, dolor, técnica) | propio |
| `nutrition_plans` | objetivos y menú (preview/semana). **Sólo lo escribe el servidor** | lectura propia |
| `daily_nutrition_logs` | comidas marcadas | propio |
| `body_measurements` | peso y medidas | propio |
| `progress_photos` | ruta en Storage, pose, consentimiento IA | propio |
| `weekly_checkins` | respuestas, propuesta y decisión | propio |
| `subscriptions` | plan, estado, expiración. **Sólo servidor** | lectura propia |
| `payment_events` | eventos de la tienda (id único = idempotencia). Sólo servidor | ninguno |
| `ai_usage` | tokens, costo estimado, éxito. Sólo servidor | ninguno |
| `admin_users`, `plan_config`, `app_errors` | administración, precios, presupuesto IA, comisión estimada, errores sin datos personales | ninguno (admin vía `admin_metrics`) |

Funciones SQL: `current_plan(uid)` (plan efectivo según estado y expiración), `is_admin()`, `handle_new_user()` (crea suscripción free), `admin_metrics(desde, hasta)`.
Storage: bucket privado `progress-photos`, ruta `<user_id>/<id>.jpg`, políticas por carpeta.

## 4. Flujos

**Onboarding**: datos básicos → objetivo → actividad → equipo/días → salud (preguntas de seguridad) → preferencias de comida. `safety.ts` valida (menores de 18 bloqueados; TCA, embarazo, enfermedad renal → sin cifras de nutrición; restricción médica → sin rutina). Se crean perfil, rutina y objetivos.

**Generación de planes**: rutina con `routine.ts` (días disponibles, equipo, lesiones, tiempo); objetivos con `energy.ts`/`targets.ts` (Mifflin-St Jeor, actividad, déficit/superávit acotados); menú con `mealplan.ts` en el servidor (`nutrition-plan`): free = una comida de ejemplo, pro/elite = semana completa, sustituciones y lista de compras.

**Validación de membresía**: compra en la app (RevenueCat, `app_user_id` = id de Supabase) → RevenueCat llama a `revenuecat-webhook` con `Authorization: Bearer <secreto>` → se guarda el evento (duplicados rechazados) → `applyStoreEvent` actualiza `subscriptions` → la app relee su plan. Las funciones del servidor consultan `current_plan` antes de dar acceso. Cancelada = acceso hasta la expiración.

**Revisión semanal**: el usuario responde (hambre, energía, adherencia, molestias) → `review.ts` calcula la tendencia de peso por regresión lineal y propone cambios (máx. ±150 kcal, nunca bajar con hambre extrema, mínimo 14 días entre ajustes, sin cambios con baja adherencia) → el usuario acepta, rechaza o modifica.

## 5. Plan de pruebas
| Requisito | Prueba |
|---|---|
| Fórmula de gasto basal correcta | `nutrition.test.ts` › Mifflin-St Jeor |
| Macros coherentes con calorías | `nutrition.test.ts` › macros coherentes |
| Déficit/superávit seguros, mínimos de kcal | `nutrition.test.ts` (pérdida de grasa, ganancia, IMC) |
| Menores de 18 sin plan; TCA/embarazo sin cifras | `nutrition.test.ts` |
| Conversión de unidades | `nutrition.test.ts` |
| Rutina respeta días, equipo, lesiones, tiempo | `training.test.ts` |
| Progresión: no subir carga con dolor | `training.test.ts` |
| Menú dentro de ±7–10 % de kcal y proteína | `mealplan.test.ts` |
| Alergias, dieta vegana, exclusiones | `mealplan.test.ts` |
| Lista de compras y sustituciones | `mealplan.test.ts` |
| Datos de alimentos coherentes (Atwater) | `mealplan.test.ts` |
| Datos de alimentos = USDA | `scripts/verify-usda.ts` (necesita clave; workflow mensual) |
| Revisión semanal | `review-plans-coach.test.ts` |
| Acceso por plan y límites de IA | `review-plans-coach.test.ts` |
| Eventos de tienda → suscripción | `review-plans-coach.test.ts` |
| Coach no inventa datos; respuestas de IA validadas | `review-plans-coach.test.ts`, `ai.test.ts` |
| Traducciones completas | `i18n.test.ts` |
| Un usuario no ve ni modifica datos ajenos (RLS) | `supabase/tests/10_rls_test.sql` |
| El cliente no puede darse premium | `10_rls_test.sql` |
| Eventos de pago duplicados | `10_rls_test.sql` |
| Borrado de cuenta elimina todo | `10_rls_test.sql` (cascada) · borrado de fotos: **manual** |
| Funciones del servidor compilan | CI › `deno check` |
| Paquete JS compila para iOS y Android | CI › `expo export` |
| Compras reales (sandbox Apple / prueba Google) | **pendiente / manual** |
| Webhook real de RevenueCat | **manual** (evento de prueba desde RevenueCat) |
| Llamadas reales a la IA | **manual** |
| Interfaz en dispositivos (pantallas, accesibilidad, modo oscuro) | **pendiente / manual** |
| Notificaciones | **manual** en dispositivo |
