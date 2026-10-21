# FITAI PRO

App nativa de **entrenamiento y nutrición** para iPhone y Android (Expo / React Native + Supabase + RevenueCat).
Crea una rutina y un plan de comidas personalizados con cálculos deterministas (fórmulas publicadas y datos de USDA),
un coach con IA con límites por plan y membresías **Free / Pro / Elite** con compras dentro de la app.

> **No afirmamos que la app está publicada.** Hoy es código fuente. Para llegar a las tiendas faltan cuentas,
> claves, compilaciones y la revisión de Apple y Google. Este documento explica cada paso y qué está probado y qué no.

---

## 1. Estado del proyecto

### ✅ Hecho y probado (en este repositorio)
| Parte | Cómo se probó |
|---|---|
| Motor de cálculo (`src/core`): calorías, macros, rutina, progresión de cargas, menú semanal, lista de compras, sustituciones, revisión semanal, seguridad (edad, TCA, embarazo…), límites de IA, estados de suscripción | 74 pruebas automáticas: `npm test` |
| Textos español/inglés con las mismas claves | `src/core/__tests__/i18n.test.ts` |
| Base de datos: migraciones, catálogo (seed), permisos por usuario (RLS), plan efectivo, eventos de pago duplicados, borrado en cascada, métricas de administrador | `npm run test:db` en PostgreSQL local |
| El motor del servidor es idéntico al de la app | `scripts/sync-functions.ts --check` |
| Script de verificación de alimentos contra USDA | probado con datos simulados; la API real no era accesible desde el entorno de desarrollo |

### 🔑 Hecho, pero necesita cuentas o claves para funcionar
| Parte | Qué falta |
|---|---|
| Backend Supabase (tablas, RLS, fotos privadas, funciones `ai-coach`, `nutrition-plan`, `revenuecat-webhook`, `delete-account`) | Crear el proyecto Supabase y lanzar el workflow **Supabase deploy** |
| Coach con IA | Clave de Anthropic (`ANTHROPIC_API_KEY`) y precios del modelo |
| Compras Pro/Elite | Cuentas de Apple Developer y Google Play, productos creados, RevenueCat configurado |
| Compilaciones para tiendas | Cuenta de expo.dev y secrets en GitHub (workflow **EAS build**) |
| Verificación mensual de alimentos | Clave gratuita de USDA (`FDC_API_KEY`) |

### 🚧 Aún NO construido
- **Elite: análisis de fotos con IA** (se muestra "en desarrollo").
- **Elite: integración con dispositivos** (Apple Health, Health Connect, relojes).
- **Elite: reportes de progreso** descargables.
- **Panel administrativo web (interfaz)**. La base ya tiene la función `admin_metrics` (usuarios, planes, ingresos estimados, costo de IA, errores), pero no hay pantalla web.

### ⚠️ No se pudo ejecutar en el entorno donde se escribió el código
- Instalar dependencias (`npm install`): el registro de npm estaba bloqueado. **Las versiones de `package.json` son aproximadas**; ejecuta `npx expo install --fix` para alinearlas exactamente con Expo SDK 57 (Codespaces lo hace solo).
- Compilar el paquete de Expo, abrir la app en un teléfono o simulador.
- Pagos reales, Supabase en la nube, llamadas a la IA, API de USDA.

El workflow **CI** de GitHub sí ejecuta: tipos, pruebas, base de datos, `deno check` de las funciones y `expo export` para iOS y Android. Revisa la pestaña **Actions** tras cada cambio.

---

## 2. Requisitos (todo desde el iPhone)
- Cuenta de **GitHub** (ya la tienes: repo `wzkn5fbgsb-dotcom/fitai-pro`).
- App **Expo Go** (App Store, versión para SDK 57).
- Safari.
- Más adelante: cuentas de **Supabase**, **expo.dev**, **RevenueCat**, **Apple Developer** (99 USD/año) y **Google Play Console** (25 USD una vez).

---

## A) Probar la app en tu iPhone con Expo Go (vía GitHub Codespaces)

Codespaces es una computadora en la nube que se maneja desde Safari.

1. En Safari abre `github.com/wzkn5fbgsb-dotcom/fitai-pro`.
2. Toca el botón verde **Code** → pestaña **Codespaces** → **Create codespace on main**.
   - Si no ves el botón, pide "Versión de escritorio" en el menú `aA` de Safari.
3. Espera 3–5 minutos: se instalan las dependencias solas (`npm install` y `npx expo install --fix`).
4. Abajo verás una **Terminal**. Escribe:
   ```
   npm run phone
   ```
   La primera vez puede preguntar si instalar `@expo/ngrok`: responde `y`.
5. Aparece un **código QR** y una dirección `exp://…`.
   - Abre la app **Cámara** del iPhone y apunta al QR (puedes enfocar la pantalla de otro dispositivo), **o**
   - copia la dirección `exp://…` y ábrela en Safari: te ofrecerá abrir Expo Go.
6. La app se abre en **Expo Go**.

Qué esperar en Expo Go:
- Sin Supabase configurado la app funciona en **modo local** (datos sólo en el teléfono).
- Las **compras no funcionan en Expo Go** (RevenueCat sólo da datos simulados ahí). Para pagos reales hace falta una compilación (paso D).
- Para usar tu backend, crea un archivo `.env` en el Codespace copiando `.env.example` y rellenando las claves; luego reinicia `npm run phone`.

Al terminar, en github.com → **Codespaces** puedes detenerlo (las horas gratis son limitadas).

---

## B) Backend en la nube: Supabase

1. Entra en **supabase.com** → **New project**. Región: Estados Unidos. Guarda la **contraseña de la base de datos**.
2. Copia estos datos:
   - **Project ref**: la parte de la URL `supabase.com/dashboard/project/<ref>`.
   - **Project Settings → API**: `Project URL` y `anon public key` (son para la app).
   - **Connect → Session pooler**: la cadena de conexión `postgresql://…` (cambia `[YOUR-PASSWORD]` por tu contraseña).
3. **Account → Access Tokens** → crea un token.
4. En GitHub: repo → **Settings → Secrets and variables → Actions → New repository secret**. Crea:

   | Secret | Valor |
   |---|---|
   | `SUPABASE_ACCESS_TOKEN` | el token del paso 3 |
   | `SUPABASE_PROJECT_REF` | el ref |
   | `SUPABASE_DB_PASSWORD` | la contraseña |
   | `SUPABASE_DB_URL` | la cadena de conexión |
   | `ANTHROPIC_API_KEY` | de console.anthropic.com |
   | `AI_MODEL` | `claude-haiku-5-5` (o el que elijas) |
   | `AI_PRICE_IN_PER_MTOK` / `AI_PRICE_OUT_PER_MTOK` | precio por millón de tokens, **copiado de la página de precios actual de Anthropic** |
   | `REVENUECAT_WEBHOOK_AUTH` | una frase larga y aleatoria que inventes (la usarás en el paso C) |

5. GitHub → **Actions → Supabase deploy → Run workflow**. Esto:
   aplica las migraciones (tablas + permisos), carga el catálogo de alimentos/recetas/ejercicios, guarda los secretos y despliega las 4 funciones.
6. En Supabase → **Authentication → URL Configuration** añade `fitaipro://` como Redirect URL (para enlaces de correo que abran la app).
7. Pon `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` en tu `.env` (Codespaces) y en **expo.dev → proyecto → Environment variables** (para las compilaciones).

**Administrador:** para ver métricas, añade tu id de usuario a la tabla `admin_users` (Supabase → Table Editor). Todavía no hay pantalla web; se consulta con `select public.admin_metrics('2026-10-01','2026-10-31');` en el SQL Editor.

---

## C) Suscripciones: App Store Connect, Google Play Console y RevenueCat

### Productos (mismos ids en ambas tiendas)
| Id de producto | Plan | Periodo |
|---|---|---|
| `pro_monthly` | Pro | mensual |
| `pro_annual` | Pro | anual |
| `elite_monthly` | Elite | mensual |
| `elite_annual` | Elite | anual |

Precios iniciales sugeridos (hipótesis a validar): Pro 9.99 USD/mes, Elite 19.99 USD/mes, anual con 30 % de descuento.

1. **App Store Connect** (appstoreconnect.apple.com): crea la app con el Bundle ID `com.fitaipro.app` (o el tuyo) → **Subscriptions** → un grupo "FITAI PRO" con los 4 productos (Elite con nivel superior a Pro).
   Firma el acuerdo **Paid Apps** y rellena datos bancarios y fiscales.
2. **Google Play Console**: crea la app con el paquete `com.fitaipro.app` → **Monetize → Subscriptions** → los 4 productos (cada uno con su "base plan").
   Google exige subir al menos una compilación (APK/AAB) antes de crear suscripciones: usa el paso D.
3. **RevenueCat** (app.revenuecat.com):
   - Crea el proyecto y añade las apps iOS y Android (conecta las claves de App Store Connect y la cuenta de servicio de Google según su guía).
   - **Entitlements**: `pro` (con `pro_monthly`, `pro_annual`) y `elite` (con `elite_monthly`, `elite_annual`).
   - **Offerings** → `default` con paquetes Monthly/Annual de cada plan (el identificador del paquete o producto debe contener `elite` para los de Elite).
   - **API keys** públicas → `EXPO_PUBLIC_REVENUECAT_IOS_KEY` y `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.
   - **Integrations → Webhooks**:
     - URL: `https://<ref>.supabase.co/functions/v1/revenuecat-webhook`
     - Authorization header: `Bearer <tu REVENUECAT_WEBHOOK_AUTH>`
     - Envía un evento de prueba: debe responder 200.
4. El acceso Pro/Elite **siempre** lo decide el servidor (tabla `subscriptions`, actualizada por el webhook). La app nunca desbloquea funciones por su cuenta.

Nota de tiendas: Apple exige In-App Purchase para suscripciones digitales (guía 3.1.1). En EE. UU. se permiten enlaces de pago externos en ambas tiendas, pero las reglas y comisiones cambian a menudo: esta app usa sólo las compras de cada tienda.

---

## D) Compilar la app desde GitHub (EAS Build, sin computadora)

1. Crea una cuenta en **expo.dev** → **Create project** con el nombre `fitai-pro`. Copia el **Project ID**.
2. expo.dev → **Account settings → Access tokens** → crea un token.
3. Secrets de GitHub: `EXPO_TOKEN` y `EAS_PROJECT_ID`.
4. En expo.dev → proyecto → **Environment variables**: crea las `EXPO_PUBLIC_*` (ver `.env.example`) en los entornos `preview` y `production`.
5. **Android (APK de prueba):** GitHub → **Actions → EAS build → Run workflow** → plataforma `android`, perfil `preview`.
   En ~20 min aparece en expo.dev → **Builds**; descarga el APK en un Android para probar.
6. **iOS (TestFlight):** necesitas Apple Developer. Crea una **clave de API** en App Store Connect → Users and Access → Integrations → App Store Connect API (rol App Manager). Descarga el `.p8` (sólo se puede una vez).
   - Convierte el `.p8` a base64 (en un Codespace: `base64 -w0 AuthKey_XXXX.p8`) y guárdalo como secret `EXPO_ASC_API_KEY_P8`.
   - Secrets `EXPO_ASC_KEY_ID`, `EXPO_ASC_ISSUER_ID`, `EXPO_APPLE_TEAM_ID`.
   - Ejecuta **EAS build** con `ios` y perfil `production`. EAS crea los certificados solo.
   - Para enviar a TestFlight: en un Codespace, `npx eas-cli submit -p ios --latest` (o configura `submit.production.ios.ascAppId` en `eas.json` con el "Apple ID" numérico de la app que aparece en App Store Connect → App Information).
7. **Actualizaciones rápidas** (sólo código JS, sin pasar por compilación): **Actions → EAS update (preview)**.

> La primera compilación de cada plataforma debe salir bien antes de poder usar "Build from GitHub" en expo.dev; el workflow de GitHub Actions resuelve esto sin computadora.

---

## E) Antes de enviar a las tiendas
Lista completa en [`docs/STORE_CHECKLIST.md`](docs/STORE_CHECKLIST.md). Lo esencial:
- **Política de privacidad** publicada en una URL (borradores en `docs/legal/`, **deben revisarse por un abogado**).
- **Eliminación de cuenta** dentro de la app (servidor hecho: función `delete-account` y acción `deleteAllData`; comprueba en la app instalada que el botón de Perfil funciona).
- **Aviso de salud** visible (no es consejo médico).
- **Clasificación de edad**: app sólo para mayores de 18 años.
- **App Privacy (Apple)**: Salud y fitness, Fotos, Correo electrónico, Compras; vinculados al usuario; sin rastreo.
- **Data safety (Google Play)**: los mismos datos, cifrados en tránsito, con opción de borrado.

---

## Para quien tenga computadora
```bash
npm install
npx expo install --fix   # alinea versiones con SDK 57
npm start                # Expo Go
npm run ios              # simulador iOS: necesita macOS + Xcode
npm run android          # emulador: necesita Android Studio
npm run typecheck
npm test
npm run test:db          # necesita PostgreSQL instalado; no se puede ejecutar como root
npm run seed             # regenera supabase/seed.sql desde src/core/data
npm run sync:functions   # copia src/core a las funciones del servidor
npm run verify:usda      # necesita FDC_API_KEY
npm run export:check     # compila el paquete JS para iOS y Android
npm run doctor           # diagnóstico de Expo
node scripts/gen-assets.mjs  # regenera iconos y splash (necesita sharp)
```

## Pruebas
| Prueba | Archivo | Cómo |
|---|---|---|
| Nutrición (Mifflin-St Jeor, macros, seguridad) | `src/core/__tests__/nutrition.test.ts` | `npm test` |
| Entrenamiento y progresión | `src/core/__tests__/training.test.ts` | `npm test` |
| Menú, recetas, lista de compras, sustituciones | `src/core/__tests__/mealplan.test.ts` | `npm test` |
| Revisión semanal, planes, suscripciones, coach | `src/core/__tests__/review-plans-coach.test.ts` | `npm test` |
| Respuestas de la IA, costos | `src/core/__tests__/ai.test.ts` | `npm test` |
| Traducciones | `src/core/__tests__/i18n.test.ts` | `npm test` |
| Base de datos y permisos | `supabase/tests/10_rls_test.sql` | `npm run test:db` |
| Datos de alimentos vs. USDA | `scripts/verify-usda.ts` | `npm run verify:usda` |

Pendiente / manual: pruebas en dispositivos reales, compras en sandbox de Apple y Google, llamadas reales a la IA, pruebas de interfaz.

## Costos
- El coach responde primero con reglas (sin costo). Sólo las preguntas abiertas usan IA.
- Límites por plan (en `src/core/plans.ts`): Free 3/día y 30/mes, Pro 30/día y 400/mes, Elite 80/día y 1500/mes.
- **Presupuesto mensual** de IA en la tabla `plan_config` (`ai_monthly_budget_usd`, 100 USD por defecto): al alcanzarlo, el coach deja de llamar a la IA.
- El costo se estima con los precios que pongas en `AI_PRICE_IN_PER_MTOK` / `AI_PRICE_OUT_PER_MTOK`; revísalos cuando cambien.
- Otros costos: Supabase (plan gratuito para empezar), EAS (plan gratuito con compilaciones limitadas), Apple 99 USD/año, Google 25 USD, comisiones de tienda y RevenueCat (gratis hasta cierto volumen de ingresos; consulta su web).

## Estructura
```
app/                     pantallas (expo-router)
src/core/                motor de cálculo puro + pruebas (compartido con el servidor)
src/lib, src/data        configuración, Supabase, compras, almacenamiento, estado
src/i18n                 textos es/en
supabase/migrations      esquema y permisos
supabase/functions       funciones del servidor (Deno)
scripts/                 seed, sincronización, verificación USDA, iconos, pruebas de BD
docs/                    arquitectura, contratos, textos legales, checklist de tiendas
```
Más detalles técnicos: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).
