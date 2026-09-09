# AyHungry CRM — Dashboard Visual v1 (diseño)

Fecha: 2026-09-09
Estado: Aprobado por Iván, pendiente de implementación

## Contexto y rol del proyecto

Hoy el flujo comercial de AyHungry vive en tres piezas (ver memoria `reference_arquitectura_sheet_crm_whatsapp`):
- **Sheet `Lead-Ads-MKT`**: bandeja de entrada de leads Meta Ads + registro diario.
- **Control Tower (Notion)**: fuente única de verdad del pipeline (Etapa, Tier, Monto, facturación, seguimiento).
- **WhatsApp**: solo ejecución/aviso, nunca registro.

`AyHungry_CRM.html` (este repo) es hoy un prototipo estático de un solo archivo, sin backend ni persistencia. Este documento define cómo se convierte en un **dashboard visual real, de solo lectura, sobre el Control Tower de Notion** — Notion sigue siendo la única fuente de verdad; este dashboard nunca reinterpreta ni sobreescribe Etapa, Tier ni ningún campo del pipeline.

## Decisión de alcance (v1)

**v1 = solo lectura.** No hay escritura hacia Notion desde el dashboard en esta fase (ni "Registrar Interacción" ni "Nuevo Cliente" activos). Se agrega en v2, coordinado con las reglas de las skills automatizadas existentes (`/control-tower`, `/ayhungry-leads`, `/ayhungry-followup`) para no pisar lo que ya escriben solas — ver `feedback_tier_no_es_etapa_crm`.

## Arquitectura

- **Frontend**: el HTML actual, evolucionado a las 3 vistas descritas abajo. Se sirve desde GitHub Pages o se migra a Vercel (recomendado, ver abajo) junto con el backend.
- **Backend**: funciones serverless en **Vercel** (recomendado sobre Cloudflare Workers o un servidor persistente en Railway/Render) — gratis en el tier básico, mismo repo/deploy que el frontend, sin servidor que mantener. Actúan como proxy autenticado hacia la API de Notion: el token de integración vive como variable de entorno en Vercel, nunca en el HTML público.
- **Datos**: sin base de datos propia. Cada vista consulta la API de Notion en vivo (con caché corto de ~60s en el backend para no golpear rate limits al reordenar/filtrar en el cliente).
- **Acceso**: password simple + cookie de sesión firmada, solo para Iván. Sin multi-usuario en v1.

## Vista 1 — Portafolio (pantalla de entrada)

Tabla de clientes/leads leída del Control Tower, con las columnas:

`Etapa` · `Tier` · `Último contacto` · `Próximo seguimiento` · `Monto mensual` · `Estado facturación` · `En riesgo` · `Nombre` · `Grupo` · `Contacto`

- `Nombre` / `Grupo` / `Contacto` van al final, como punto de acción rápida (llamar/escribir directo).
- Filtro por Etapa y Tier, búsqueda por nombre.
- **Indicador de urgencia visual (color/badge, no solo texto)** en filas con `Próximo seguimiento` vencido o `En riesgo = true` — hallazgo de la auditoría de estándares de industria: sin señal visual fuerte, el seguimiento se atrasa igual aunque el dato esté ahí. Mismo criterio de "vencido" que ya usa la rutina cloud de las 09:00.
- Filtro de conteo sigue la regla ya conocida: excluir `Tipo de ficha = Grupo` usando `IFNULL("Tipo de ficha",'') != 'Grupo'` (ver `reference_control_tower_notion`, trampa de NULL ya documentada).
- Click en una fila → Vista 2 (Ficha Cliente).

## Vista 2 — Ficha Cliente

Jerarquía de la pantalla (hallazgo de la auditoría: no todos los tabs pesan igual):

- **Siempre visible arriba, sin necesidad de hacer click**: Nombre, Contacto principal, Etapa actual, Próximo seguimiento/próxima acción.
- **En tabs de segundo nivel** (como en el mockup original): Info General, Ficha Google, Prueba/Pago, Facturación, Historial.
- Todo poblado con campos reales de Notion. v1 = solo lectura; los botones de "Registrar Interacción" / "Nuevo Cliente" / "Eliminar cliente" quedan ocultos o deshabilitados (se define al construir).

**Gaps de datos conocidos, no se inventan valores:**
- Tab "Ficha Google" no tiene campo equivalente en Notion hoy — se muestra "sin datos" hasta que exista.
- RUT / Razón Social no existen estructurados en Notion (solo como texto libre en el sheet de Facturación) — ver `project_datos_facturacion_gaps`. Se muestra "sin datos" igual.

## Vista 3 — Resumen Ejecutivo (para socios/inversionistas)

Pantalla separada dentro de la misma app, pensada para compartir manualmente (screenshot o link) — sin envío automático en v1.

Métricas, ajustadas según auditoría de estándares (un MRR alto con churn alto se lee peor que un MRR menor con churn casi cero):
- MRR total (suma de `Monto mensual` con `Contrato firmado = true`).
- Pipeline por Etapa (conteo y monto).
- Conversión leads → clientes (usando `Fecha primer contacto` / `Fecha inicio contrato`).
- Distribución por Tier.
- Clientes en riesgo (`En riesgo = true`).
- **Churn**: requiere el campo nuevo `Fecha de baja` (ver siguiente sección) — sin este campo no se puede calcular de forma confiable, y no se va a aproximar con Tier 3 porque ese tier es un balde genérico para todo lo que no es Tier 1/2, no solo churn (ver `reference_control_tower_notion`).
- Trayectoria de crecimiento mensual (MRR actual vs. mes anterior, derivado de `Fecha inicio contrato` acumulado menos bajas por `Fecha de baja`).

## Cambio requerido en Notion (antes de construir la Vista 3 completa)

Agregar campo **`Fecha de baja`** (date) al Control Tower — mismo patrón que se usó para agregar `Numero de locales` en agosto 2026. Se llena manualmente cuando un cliente cancela. Sin este campo, la Vista 3 se construye igual pero sin las secciones de churn/trayectoria (se agregan cuando el campo empiece a tener datos).

## Fuera de alcance de v1 (v2 futuro)

- Escritura hacia Notion desde el dashboard (Registrar Interacción, Nuevo Cliente) — coordinado con las skills automatizadas para no duplicar/pisar registros.
- Automatización de envío del Resumen Ejecutivo (hoy: manual, abierto y compartido por Iván cuando corresponda).
- Multi-usuario / roles de acceso.

## Referencias de la auditoría de estándares de industria (2026-09-09)

- Pipeline views usables a diario necesitan indicador visual de urgencia, no solo columnas de fecha.
- Métricas ejecutivas SaaS estándar: MRR/ARR + churn/NRR + trayectoria de crecimiento, no monto absoluto solo.
- Fichas de cliente: jerarquía visual (lo crítico siempre visible, el resto en segundo nivel) por sobre la discusión tabs-vs-scroll.
