# Estado del proyecto FITAI PRO (punto de guardado)

Fecha de guardado: 2026-10-21

## Qué existe
- App React Native + Expo (SDK 57) + TypeScript en `app/`, `src/`.
- Motor puro en `src/core` (nutrición, rutinas, progresión, revisión semanal, coach, planes, seguridad). Sincronizado a `supabase/functions/_shared/core` con `scripts/sync-functions.ts`.
- Backend Supabase: migraciones de esquema y RLS en `supabase/migrations/`, pruebas de RLS en `supabase/tests/`, funciones Edge en `supabase/functions/` (ai-coach, nutrition-plan, revenuecat-webhook, delete-account).
- Documentos legales en `docs/legal/` (BORRADOR: requieren revisión de un abogado).
- CI/CD en `.github/workflows/` (ci, eas-build, eas-update, supabase-deploy, verify-food-data).

## Verificado
- Type-check estricto contra stubs: exit 0.
- Pruebas unitarias: 74 pasan, 0 fallan (`npm test`).
- Pruebas de base de datos (RLS) pasan en Postgres local (`scripts/test-db.sh`, ejecutar como usuario no root).
- `sync-functions --check`: core sincronizado.
- i18n es/en: claves consistentes.

## No verificado / pendiente
- El bundle de Expo nunca se compiló (el registro npm estaba bloqueado en este entorno).
- No se ejecutó en dispositivo ni con Supabase, RevenueCat o Anthropic reales.
- Revisión de pantallas (bugs de runtime) incompleta.
- Contratos por corregir: endpoint de invalidación de plan nutricional; primera sesión en nube sobrescribe historial local; fotos offline no se suben; 409 no_profile se muestra como error genérico; cambios de compra no persisten en servidor.
- No implementado: análisis de fotos con IA, integraciones de dispositivos, reportes de progreso, panel admin web (solo métricas en BD).
- Videos de demostración: no creados.

## Siguientes pasos
1. Conectar GitHub en claude.ai → Ajustes → Conectores, y hacer push a `wzkn5fbgsb-dotcom/fitai-pro` (rama main).
2. Ejecutar `npx expo install --fix` y `expo export` en una máquina con acceso al registro npm (Codespace con `.devcontainer`).
3. Construir con EAS para iOS (TestFlight) y Android.
4. Resolver contratos pendientes y completar revisión de pantallas.
5. Revisión legal antes de publicar.

## Cómo verla desde el iPhone (cuando esté lista para correr)
1. En github.com/wzkn5fbgsb-dotcom/fitai-pro → Code → Codespaces → Create codespace (usa `.devcontainer`).
2. En la terminal del Codespace: `npm install` y luego `npx expo start --tunnel`.
3. Abre la app **Expo Go** (App Store) en el iPhone y escanea el QR que aparece.
Nota: Expo Go no procesa compras reales de RevenueCat; eso requiere una build de desarrollo con EAS.
Estado actual: el registro npm estaba bloqueado en el entorno de Claude, así que este paso aún no se ha probado.
