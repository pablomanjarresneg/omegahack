# Esquema

Vista por dominio del esquema aplicado al proyecto enlazado. Para el estado exacto: `supabase db dump --data-only=false` o consulta `information_schema`.

Toda tabla del `public` que modele negocio tiene columna `tenant_id uuid not null references public.tenants(id)` y RLS activa. Excepciones (catálogos globales): `holidays`.

## 1. Tenants

### `public.tenants`
Raíz del grafo multi-tenant. Un tenant es una alcaldía (hoy: `alcaldia-medellin`).

- `id uuid pk`
- `slug text unique` — ej. `alcaldia-medellin`
- `display_name text`
- `config jsonb` — overrides (plazos, suspensiones, umbrales de prioridad).
- `created_at timestamptz`

## 2. Catálogos

### `public.comunas`
Las 16 comunas + 5 corregimientos de Medellín.

- `id uuid pk`, `tenant_id`
- `numero int` — 1–16 comunas, 50/60/70/80/90 corregimientos.
- `tipo text` — `comuna` o `corregimiento`.
- `nombre text`

### `public.secretarias`
Las 26 dependencias oficiales.

- `id uuid pk`, `tenant_id`
- `codigo text` — `DESP`, `SGOB`, `SHAC`, `SSAL`, `SEDU`, `SMOV`, `SMAM`, `SINF`, `SSEG`, `SDE`, `SCUL`, `SJUV`, `SMUJ`, `SPDH`, `SPAR`, `SGHS`, `SSUM`, `SEVC`, `SINC`, `SCOM`, `SIND`, `DAP`, `DAGRD`, `GCEN`, `GCOR`, `UAEBC`.
- `nombre text`, `responsable text`

### `public.functionaries`
Usuarios internos (jurídica, responsable de secretaría, etc.).

- `id uuid pk`, `tenant_id`, `auth_user_id uuid` (FK a `auth.users`)
- `role text` — `juridica`, `funcionario`, `admin`.
- `secretaria_id uuid nullable`

### `public.citizens`
Ciudadanos peticionarios.

- `id uuid pk`, `tenant_id`
- `document_id text`, `email text`, `phone text`, `full_name text`
- `consent_data boolean` — Ley 1581/2012.
- `comuna_id uuid nullable`

### `public.holidays`
Festivos colombianos. **Global** (sin `tenant_id`).

- `date date pk`
- `nombre text`, `kind text` — `fijo`, `emiliani`, `pascua_derivado`.

## 3. Núcleo PQR

### `public.pqr`
Un caso.

- `id uuid pk`, `tenant_id`
- `radicado text unique` — `MED-YYYYMMDD-XXXXXX`.
- `source_hash text unique` — idempotencia.
- `tipo text` — `peticion`, `queja`, `reclamo`, `oposicion`, `sugerencia`, `denuncia`.
- `channel text` — `web`, `email`, `mercurio_csv`, `verbal`, `social_manual`.
- `status text` — `received`, `classified`, `assigned`, `in_progress`, `responded`, `closed`, `bounced_incomplete`.
- `classification_status text` — `pending`, `classified`, `failed`.
- `hechos text`, `peticion text`, `lead text` — descomposición estructurada.
- `raw_text text`, `display_text text`, `llm_text text` — tres vistas del texto (ver arquitectura).
- `discriminacion_tematica text[]` — tags.
- `secretaria_id uuid`, `comuna_id uuid`, `citizen_id uuid`
- `estructura_minima jsonb` — `{hechos_ok, peticion_ok, lugar_ok, fecha_ok}`.
- `respeto_ok boolean`, `anonimato boolean`, `tutela_risk_score numeric`
- `issued_at timestamptz`, `legal_deadline timestamptz`
- `priority_level text` — `P0_critica`, `P1_alta`, `P2_media`, `P3_baja`.
- `priority_score int`, `priority_reason jsonb`
- `created_at timestamptz`, `updated_at timestamptz`

### `public.pqr_events`
Historial append-only.

- `id uuid pk`, `tenant_id`, `pqr_id uuid`
- `kind text` — `intake_agent_run`, `intake_agent_bounce`, `deadline_extended`, `status_changed`, `response_drafted`, `response_sent`, etc.
- `payload jsonb`
- `actor_id uuid nullable` — funcionario o null si fue automático.
- `created_at timestamptz`

### `public.responses`
Borradores y envíos de respuesta.

- `id uuid pk`, `tenant_id`, `pqr_id uuid`
- `content text`, `sent_at timestamptz nullable`
- `drafted_by uuid`, `approved_by uuid nullable`

### `public.attachments`
Adjuntos (ligados a Storage `pqr-attachments`).

- `id uuid pk`, `tenant_id`, `pqr_id uuid`
- `storage_path text`, `mime_type text`, `size_bytes bigint`

### `public.pqr_clusters`
Agrupación preliminar (legada; el clustering principal vive en `problem_groups`).

## 4. Auditoría

### `public.pqr_audit`
Log append-only de cada mutación en tablas protegidas. Alimentado por el trigger genérico `audit_row()`.

- `id bigint pk`, `tenant_id`, `table_name text`, `row_pk jsonb`
- `operation text` — `INSERT`, `UPDATE`, `DELETE`.
- `before jsonb`, `after jsonb`
- `actor_id uuid nullable`, `at timestamptz`

## 5. Indexación

### `public.pqr_embeddings`
Embeddings 1024-dim por PQR.

- `id uuid pk`, `tenant_id`, `pqr_id uuid`
- `kind text` — `full`, `lead`, `peticion`.
- `model_version text`
- `embedding vector(1024)` (pgvector).
- Único por `(pqr_id, kind, model_version)`.

### `public.pqr_embedding_jobs`
Cola drainada por `reembed-pqr`.

- `id uuid pk`, `pqr_id uuid`
- `status text` — `queued`, `running`, `done`, `failed`.
- `attempt_count int`, `last_error text`
- `created_at`, `updated_at`

## 6. Tags

### `public.tags`
Taxonomía namespaced.

- `id text pk` — ej. `tema:movilidad`, `subtema:movilidad:huecos`, `ubicacion:comuna:11`.
- `namespace text`, `label text`, `metadata jsonb`

### `public.pqr_tags`
Muchos-a-muchos.

- `pqr_id uuid`, `tag_id text`, `tenant_id uuid`, `score numeric`
- PK compuesta.

## 7. Problem Groups

### `public.problem_groups`
Clusters de PQRs parecidos dentro de un tenant.

- `id uuid pk`, `tenant_id`
- `canonical_title text`, `resumen text`, `location text`
- `tag_ids text[]`
- `centroid_embedding vector(1024)` — media corriente de los miembros.
- `member_count int`, `created_at timestamptz`
- `hot boolean` — excede umbrales de cantidad + velocidad.

### `public.pqr_problem_group_members`
Pertenencia + similitud en el momento del attach.

- `pqr_id uuid`, `group_id uuid`, `similarity_score numeric`
- Único por `pqr_id`.

## 8. Memoria

### `public.simple_memory`
Contexto rolling por ciudadano. El intake lo lee para enriquecer el prompt.

- `citizen_id uuid pk`, `tenant_id`
- `open_pqr_count int`, `unresolved_tutela_count int`, `vulnerability_flags text[]`
- `last_updated_at timestamptz`

## 9. Transparencia (vistas)

Todas agregan con k-anonymity — filas con `cohort < 5` se suprimen.

- `public.transparency_comuna_density` — conteo de PQRs por comuna/mes/secretaría.
- `public.transparency_secretaria_ranking` — cumplimiento de plazos por secretaría.
- `public.transparency_monthly_trend` — serie temporal global.

## 10. Q&A (`qa_bank.*`)

Aislado a nivel de `GRANT`. El rol `app_operational` no tiene `USAGE` sobre `qa_bank`.

### `qa_bank.qa_sources`
Ley, decreto, jurisprudencia, protocolo interno.

- `id uuid pk`, `title text`, `jurisdiction text`, `kind text`, `url text`

### `qa_bank.qa_documents`
Documento ingestado desde Storage.

- `id uuid pk`, `source_id uuid`, `storage_path text`
- `ingested_at`, `model_version`

### `qa_bank.qa_chunks`
Chunks consciente-de-encabezados.

- `id uuid pk`, `document_id uuid`, `chunk_index int`
- `heading_path text[]`, `content text`

### `qa_bank.qa_embeddings`
1024-dim por chunk.

- `chunk_id uuid pk`, `embedding vector(1024)`, `model_version text`

### `qa_bank.qa_feedback`
Señal de calidad sobre recuperaciones.

- `id uuid pk`, `chunk_id uuid`, `rating smallint`, `actor_id uuid`, `at timestamptz`
