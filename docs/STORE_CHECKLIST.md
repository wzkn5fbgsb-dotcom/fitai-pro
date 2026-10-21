# Checklist para publicar en App Store y Google Play

Marca cada punto sólo cuando lo hayas comprobado tú. Nada de esto está hecho todavía salvo donde se indica "(código listo)".

## 1. Cuentas y acuerdos
- [ ] Apple Developer Program (99 USD/año) activo.
- [ ] App Store Connect: acuerdo **Paid Apps** firmado, datos bancarios y fiscales completos.
- [ ] Google Play Console (25 USD) con identidad verificada; perfil de pagos (Merchant) creado.
- [ ] Cuentas de expo.dev, Supabase y RevenueCat.
- [ ] Si publicas como persona física, tu nombre aparecerá como vendedor. Considera una empresa (LLC) — consúltalo con un asesor.

## 2. Backend en producción
- [ ] Workflow **Supabase deploy** ejecutado sin errores.
- [ ] Secrets de funciones configurados (IA, precios, webhook).
- [ ] Prueba: crear cuenta, iniciar sesión, generar plan, subir y borrar una foto, **eliminar cuenta** y comprobar en Supabase que no quedan filas ni fotos.
- [ ] Presupuesto mensual de IA revisado en `plan_config`.

## 3. Compras
- [ ] 4 productos creados en ambas tiendas: `pro_monthly`, `pro_annual`, `elite_monthly`, `elite_annual`.
- [ ] RevenueCat: entitlements `pro` y `elite`, offering `default`, webhook con cabecera `Authorization` → evento de prueba respondió 200.
- [ ] Compra de prueba en **sandbox de Apple** (TestFlight) y con **probador de licencias** en Google: el plan cambia en la app tras unos segundos.
- [ ] Cancelación: conserva acceso hasta la expiración; después vuelve a Free.
- [ ] Botón **Restaurar compras** funciona.
- [ ] La pantalla de compra muestra: precio, periodo, renovación automática, cómo cancelar, enlaces a Términos y Privacidad (exigido por Apple 3.1.2).

## 4. Textos legales
- [ ] `docs/legal/*` revisados por un abogado (y el aviso de salud por un profesional sanitario).
- [ ] Publicados en una **URL pública** (por ejemplo GitHub Pages o tu web).
- [ ] [EMAIL DE CONTACTO] y datos del responsable sustituidos.
- [ ] URL de privacidad en App Store Connect y Google Play.
- [ ] URL de soporte (Apple la exige).

## 5. Requisitos de la app
- [ ] **Eliminación de cuenta dentro de la app** (Apple 5.1.1(v)) — (código listo: función `delete-account`). Comprobado en dispositivo.
- [ ] Google: además, **enlace web** para solicitar el borrado de cuenta (formulario "Data deletion" de Play Console). Puede ser una página con instrucciones y el email de contacto.
- [ ] Aviso de salud visible en el onboarding — (código listo en textos i18n). Comprobado.
- [ ] La app no genera planes a menores de 18 — (código listo y probado en `nutrition.test.ts`).
- [ ] Recursos de ayuda (988, 1-866-662-1235, 911) visibles donde corresponde.
- [ ] Funciones "en desarrollo" claramente marcadas (Apple rechaza funciones que no funcionan).
- [ ] Sin modo de prueba de planes en producción (sólo `__DEV__`).
- [ ] Permisos de cámara/fotos con explicación clara — (código listo en `app.config.ts`).

## 6. Apple — App Privacy ("etiquetas nutricionales")
Declarar como **vinculados al usuario**, **no usados para rastreo**:
- [ ] **Salud y fitness** (Health, Fitness) — funcionalidad de la app.
- [ ] **Fotos** — funcionalidad.
- [ ] **Información de contacto: correo** — funcionalidad / cuenta.
- [ ] **Compras** — funcionalidad.
- [ ] **Contenido del usuario: otros** (mensajes al coach) — funcionalidad.
- [ ] **Identificadores: ID de usuario** — funcionalidad.
- [ ] **Diagnóstico** (errores sin datos personales) — si aplica.
- [ ] Sin App Tracking Transparency (no hay rastreo).
- [ ] Revisa los "privacy manifests" de los SDK (Expo y RevenueCat los incluyen; compruébalo en la compilación).

## 7. Google Play — Data safety
- [ ] Mismos tipos de datos: Health and fitness, Photos, Email, Purchase history, User IDs, App interactions/Messages.
- [ ] Datos **cifrados en tránsito**: sí.
- [ ] El usuario **puede solicitar la eliminación**: sí (en app + enlace web).
- [ ] No se comparten con terceros para fines propios (los proveedores son "service providers").
- [ ] Declaración de **apps de salud** (Health apps declaration) en Play Console.
- [ ] Público objetivo: 18+. Cuestionario de contenido (IARC).

## 8. Clasificación de edad
- [ ] Apple: cuestionario de edad; marcar "Medical/Treatment Information" de forma ocasional/leve si aplica. Restringir a **18+** en la descripción y en la app.
- [ ] Google: público objetivo 18+, no dirigido a niños.

## 9. Ficha de la tienda
- [ ] Nombre, subtítulo, descripción (es/en) sin promesas de resultados ni lenguaje médico ("cura", "trata").
- [ ] Capturas de pantalla reales de la app (iPhone 6.9", iPad si `supportsTablet`; teléfono Android).
- [ ] Icono 1024×1024 sin transparencia — (listo: `assets/icon.png`).
- [ ] Palabras clave, categoría **Salud y forma física**.
- [ ] Notas para el revisor de Apple: cuenta de prueba (correo + contraseña) y explicación de las suscripciones.

## 10. Compilación y envío
- [ ] Workflow **EAS build** con perfil `production` para iOS y Android.
- [ ] iOS: subir con `eas submit` → TestFlight → probar → enviar a revisión.
- [ ] Android: subir el AAB a **prueba interna** → **prueba cerrada** (las cuentas personales nuevas de Google deben hacer una prueba cerrada con al menos 12 probadores durante 14 días antes de producción [VERIFICAR REQUISITO VIGENTE]) → producción.
- [ ] Versión y número de compilación correctos (EAS los incrementa con `autoIncrement`).
