-- Bootstrap: extensions, schemas, roles, storage buckets.
-- Runs as postgres superuser via `supabase db push`.
-- Idempotent — safe to re-run.

-- =============================================================================
-- 1. Extensions
-- =============================================================================

create extension if not exists vector;
create extension if not exists pgcrypto;

-- =============================================================================
-- 2. Schemas
-- =============================================================================

create schema if not exists qa_bank;

comment on schema qa_bank is
  'Isolated Q&A corpus for the RAG retrieval layer. Read-only from app_qa_reader; no access from app_operational.';

-- =============================================================================
-- 3. Application roles
-- =============================================================================
-- Both roles are NOLOGIN; server-side code connects as `postgres` and issues
-- `SET ROLE` (or uses `?options=-c role=<role>` in the connection string) to
-- scope privileges.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_operational') then
    create role app_operational nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'app_qa_reader') then
    create role app_qa_reader nologin;
  end if;
end$$;

-- --- app_operational: full CRUD on public.*, zero access to qa_bank.* ---

grant usage on schema public to app_operational;
grant all on all tables    in schema public to app_operational;
grant all on all sequences in schema public to app_operational;
grant all on all functions in schema public to app_operational;

alter default privileges in schema public
  grant all on tables    to app_operational;
alter default privileges in schema public
  grant all on sequences to app_operational;
alter default privileges in schema public
  grant all on functions to app_operational;

revoke all on schema qa_bank from app_operational;
revoke all on all tables    in schema qa_bank from app_operational;
revoke all on all sequences in schema qa_bank from app_operational;
revoke all on all functions in schema qa_bank from app_operational;

-- --- app_qa_reader: SELECT-only on qa_bank.*, zero access to public.* ---

grant usage on schema qa_bank to app_qa_reader;
grant select on all tables in schema qa_bank to app_qa_reader;

alter default privileges in schema qa_bank
  grant select on tables to app_qa_reader;

revoke all on schema public from app_qa_reader;
revoke all on all tables    in schema public from app_qa_reader;
revoke all on all sequences in schema public from app_qa_reader;
revoke all on all functions in schema public from app_qa_reader;

-- Grant postgres (the pooler login user) membership so it can SET ROLE.
grant app_operational to postgres;
grant app_qa_reader   to postgres;

-- =============================================================================
-- 4. Storage buckets
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
  values ('attachments', 'attachments', false, 52428800)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
  values ('qa-corpus', 'qa-corpus', false, 52428800)
  on conflict (id) do nothing;

-- --- Baseline policies on storage.objects ---
-- Default: deny-by-default. Service role bypasses RLS (Supabase default) and is
-- used by seed/ingest scripts. Tenant-scoped policies for attachments arrive
-- with the core schema migration; qa-corpus stays service-role-only.

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname = 'attachments_authenticated_read'
  ) then
    create policy attachments_authenticated_read
      on storage.objects for select to authenticated
      using (bucket_id = 'attachments');
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname = 'attachments_authenticated_write'
  ) then
    create policy attachments_authenticated_write
      on storage.objects for insert to authenticated
      with check (bucket_id = 'attachments');
  end if;
end$$;

-- qa-corpus: no policies for anon/authenticated. Only service_role can
-- read/write via the Supabase JS client, and app_qa_reader can SELECT from
-- qa_bank.* tables directly via Postgres connection.
