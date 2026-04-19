#!/usr/bin/env node
// Generates supabase/migrations/20260418170500_reference_data.sql from the
// fixtures under /fixtures/. Seeds comunas, corregimientos, secretarias, and
// Colombian holidays for the canonical tenant.
// Re-run whenever fixtures change; commit the regenerated .sql alongside.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const TENANT = "'00000000-0000-0000-0000-000000000001'";

const comunasRaw = JSON.parse(
  readFileSync(resolve(root, 'fixtures/comunas-corregimientos.json'), 'utf-8'),
);
const secretariasRaw = JSON.parse(
  readFileSync(resolve(root, 'fixtures/secretarias-medellin.json'), 'utf-8'),
);
const holidaysRaw = JSON.parse(
  readFileSync(resolve(root, 'fixtures/colombian-holidays/holidays.json'), 'utf-8'),
);

function sqlString(s) {
  return "'" + String(s).replace(/'/g, "''") + "'";
}
function sqlJsonb(obj) {
  return sqlString(JSON.stringify(obj)) + '::jsonb';
}
function sqlTextArray(items) {
  const inner = items.map((x) => sqlString(x)).join(', ');
  return 'array[' + inner + ']::text[]';
}

const lines = [];
lines.push('-- Reference data seed: comunas, corregimientos, secretarias, holidays.');
lines.push('-- Generated from /fixtures/*.json by scripts/gen-reference-data-migration.mjs.');
lines.push('-- DO NOT EDIT BY HAND — regenerate and commit.');
lines.push('');
lines.push('-- =============================================================================');
lines.push('-- Comunas + corregimientos');
lines.push('-- =============================================================================');
lines.push('');

for (const row of comunasRaw) {
  lines.push(
    `insert into public.comunas (tenant_id, tipo, numero, nombre, barrios) values (`,
    `  ${TENANT},`,
    `  ${sqlString(row.tipo)},`,
    `  ${row.numero},`,
    `  ${sqlString(row.nombre)},`,
    `  ${sqlTextArray(row.barrios_principales)}`,
    `) on conflict (tenant_id, tipo, numero) do update set`,
    `  nombre  = excluded.nombre,`,
    `  barrios = excluded.barrios;`,
    '',
  );
}

lines.push('-- =============================================================================');
lines.push('-- Secretarías / dependencias');
lines.push('-- =============================================================================');
lines.push('');

for (const row of secretariasRaw) {
  lines.push(
    `insert into public.secretarias (tenant_id, codigo, nombre, tipo, funciones, competencias_legales, temas_clave, interfaz_mercurio) values (`,
    `  ${TENANT},`,
    `  ${sqlString(row.codigo)},`,
    `  ${sqlString(row.nombre)},`,
    `  ${sqlString(row.tipo)},`,
    `  ${sqlJsonb(row.funciones ?? [])},`,
    `  ${sqlJsonb(row.competencias_legales ?? [])},`,
    `  ${sqlTextArray(row.temas_clave ?? [])},`,
    `  ${row.interfaz_mercurio ? 'true' : 'false'}`,
    `) on conflict (tenant_id, codigo) do update set`,
    `  nombre               = excluded.nombre,`,
    `  tipo                 = excluded.tipo,`,
    `  funciones            = excluded.funciones,`,
    `  competencias_legales = excluded.competencias_legales,`,
    `  temas_clave          = excluded.temas_clave,`,
    `  interfaz_mercurio    = excluded.interfaz_mercurio;`,
    '',
  );
}

lines.push('-- =============================================================================');
lines.push('-- Colombian holidays 2024–2030 (Ley Emiliani + fijos + Semana Santa + Easter-derived)');
lines.push('-- =============================================================================');
lines.push('');

for (const [year, dates] of Object.entries(holidaysRaw)) {
  for (const d of dates) {
    lines.push(
      `insert into public.holidays (pais, fecha) values ('CO', ${sqlString(d)}) on conflict (pais, fecha) do nothing;`,
    );
  }
}

const out = lines.join('\n') + '\n';
const dest = resolve(root, 'supabase/migrations/20260418170500_reference_data.sql');
writeFileSync(dest, out);
console.log(`Wrote ${dest} (${out.length} bytes, ${lines.length} lines)`);
