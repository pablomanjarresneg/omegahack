# Arquitectura

OmegaHack es un monorepo Turborepo que combina tres apps Next.js, once paquetes TypeScript compartidos, tres edge functions en Supabase y un workflow de n8n. Todo converge sobre un único Postgres con pgvector, RLS y particionamiento lógico por tenant.

## Flujo de datos end-to-end

```
                        ciudadano
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
      apps/web         n8n webhook       canal externo
    (formulario)     (POST /pqrs/intake)   (Mercurio CSV,
                                           correo, etc.)
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │
                            ▼
              ┌──────────────────────────────┐
              │        Intake Agent          │
              │                              │
              │  1. Validar esquema          │
              │  2. Calcular radicado +      │
              │     source_hash (idempot.)   │
              │  3. Format-preserve          │
              │     (raw / display / llm)    │
              │  4. Redacción PII            │
              │     (@omega/habeas-data)     │
              │  5. Agente de validez        │
              │     (Claude o Gemini)        │
              │  6. Compuertas Art. 16       │
              │     Ley 1755/2015            │
              │  7. Agente clasificador      │
              │     → tipo, secretaría,      │
              │       comuna, tags           │
              │  8. Motor de prioridad       │
              │     + plazo legal            │
              └───────────────┬──────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │   Postgres / RLS    │
                    │                     │
                    │  pqr, pqr_events,   │
                    │  secretarias,       │
                    │  comunas, tags,     │
                    │  problem_groups,    │
                    │  qa_bank            │
                    └─────────┬───────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       apps/workbench   apps/secretaria   apps/web
      (cola jurídica)  (vista sectorial) (/transparencia)
```

## Componentes

### Ingesta

Dos implementaciones conviven porque cubren distintos modos de uso:

- **`packages/intake-agent` + `services/edge-functions/intake-agent`** — pipeline en TypeScript/Deno. Lo usan las apps Next.js cuando necesitan procesar un intake desde el propio backend de Supabase.
- **`retos/mini_reto-valor/workflow.json`** — el mismo pipeline expresado como workflow de n8n con agentes Gemini, pensado para el entregable del reto y para integraciones externas. Ver [`docs/n8n.md`](n8n.md).

Ambas rutas producen exactamente el mismo estado en la BD: una fila en `pqr` + un evento en `pqr_events` (`intake_agent_run` o `intake_agent_bounce`).

### Clasificación

`packages/classifier` llama a Claude con el texto ya sin PII y devuelve:

- `tipo`: peticion · queja · reclamo · oposicion · sugerencia · denuncia.
- `secretaria_codigo`: uno de los 26 códigos oficiales (DESP, SGOB, SHAC, SSAL, SEDU, SMOV, SINF, SMAM, SSEG, etc.).
- `comuna_numero` + `comuna_tipo` (comuna 1–16 o corregimiento 50/60/70/80/90).
- `discriminacion_tematica`: tags en namespaces (`tema:*`, `subtema:*`, `ubicacion:*`, `actor:*`, `vulnerabilidad:*`, `sentimiento:*`).
- Señales auxiliares: `respeto_ok`, `anonimato`, `tutela_risk_score`, `estructura_minima`.

### Plazos

`packages/deadline-engine` calcula fechas límite en días hábiles colombianos sobre `America/Bogota`. Cubre Ley Emiliani (festivos movibles), días derivados de Pascua, suspensiones por tenant y la regla de prórroga ≤ 2× del plazo original (Ley 1755/2015). 100% offline; 393 tests, 100% líneas cubiertas.

### Agrupación

`packages/problem-groups` agrupa PQRs del mismo tenant por similitud coseno sobre el embedding + intersección de tags + coincidencia de comuna. Marca grupos como `hot` cuando superan umbrales de cantidad y velocidad. Política configurable por tenant.

### Búsqueda y RAG

- `packages/rag` — chunking consciente de encabezados, embeddings Azure `nella-embeddings` (1024-dim), retriever híbrido (vector + FTS), cliente para la API interna Nella.
- `packages/search` — búsqueda de PQRs con filtros (comuna, secretaría, estado, tipo, tags).

### Persistencia

`packages/db` expone tres fábricas de cliente:

- `createOperationalClient()` — hace `SET ROLE app_operational` al abrir la conexión. Uso por defecto desde las apps.
- `createQaReaderClient()` — `SET ROLE app_qa_reader`. Solo puede leer `qa_bank.*`.
- `createServiceRoleClient()` — bypass de RLS; solo para edge functions y jobs.

## Límites de confianza

```
                           │ navegador │ Vercel (apps) │ Supabase (edge + db) │
────────────────────────────┼───────────┼───────────────┼──────────────────────┤
SUPABASE_ANON_KEY           │     ✓     │       ✓       │          —           │
SUPABASE_SERVICE_ROLE_KEY   │     ✗     │       ✓ (*)   │          ✓           │
ANTHROPIC_API_KEY           │     ✗     │       ✓       │          ✓           │
AZURE_EMBEDDINGS_KEY        │     ✗     │       ✗       │          ✓           │
DATABASE_URL_OPERATIONAL    │     ✗     │       ✓       │        (no aplica)   │
```

(*) El service-role solo se usa en route handlers server-side; nunca cruza al bundle del cliente.

La BD aplica RLS para todas las tablas con `tenant_id`. El rol `app_operational` solo ve filas cuyo `tenant_id` coincida con el claim `jwt.claims.tenant_id`. El rol `app_qa_reader` no ve `public.*` en absoluto.

## Convenciones transversales

- **Multi-tenant**: toda tabla de negocio lleva `tenant_id` con FK a `tenants`. Nunca consultas sin filtrar por tenant.
- **Texto de PQRs**: siempre se guarda en tres formas — `raw_text` (original, protegido), `display_text` (limpio, se muestra al funcionario), `llm_text` (sin PII, se manda a modelos).
- **Zona horaria**: toda lógica de plazos se normaliza a `America/Bogota`. Almacenamiento en UTC.
- **Radicado**: formato `MED-YYYYMMDD-XXXXXX` (6 hex aleatorios). `source_hash` SHA-256 sobre `raw_text + issued_at + contacto` da idempotencia.
- **Eventos**: cada cambio relevante emite un `pqr_events.kind` (`intake_agent_run`, `intake_agent_bounce`, `deadline_extended`, etc.). La auditoría reconstruye la historia desde ahí.
