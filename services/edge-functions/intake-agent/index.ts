import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import {
  IntakeValidationError,
  createIntakeAgent,
  type TenantContext,
} from '../../../packages/intake-agent/src/index.ts';

interface IntakeAgentRequestEnvelope {
  intake?: unknown;
  tenant?: Partial<TenantContext>;
  tenant_id?: unknown;
  tenant_slug?: unknown;
  default_secretaria_codigo?: unknown;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stripEnvelopeKeys(body: Record<string, unknown>): Record<string, unknown> {
  const intake: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (
      key !== 'tenant' &&
      key !== 'tenant_id' &&
      key !== 'tenant_slug' &&
      key !== 'default_secretaria_codigo'
    ) {
      intake[key] = value;
    }
  }
  return intake;
}

function getTenantContext(
  body: IntakeAgentRequestEnvelope,
  req: Request,
): TenantContext {
  const tenant = isRecord(body.tenant) ? body.tenant : {};
  const tenantId =
    typeof tenant.tenantId === 'string'
      ? tenant.tenantId
      : typeof body.tenant_id === 'string'
        ? body.tenant_id
        : req.headers.get('x-tenant-id') ?? Deno.env.get('DEFAULT_TENANT_ID');

  if (!tenantId) {
    throw new Error('tenantId is required');
  }

  return {
    tenantId,
    tenantSlug:
      typeof tenant.tenantSlug === 'string'
        ? tenant.tenantSlug
        : typeof body.tenant_slug === 'string'
          ? body.tenant_slug
          : undefined,
    defaultSecretariaCodigo:
      typeof tenant.defaultSecretariaCodigo === 'string'
        ? tenant.defaultSecretariaCodigo
        : typeof body.default_secretaria_codigo === 'string'
          ? body.default_secretaria_codigo
          : undefined,
  };
}

export async function handleIntakeAgentRequest(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Request body must be valid JSON' }, 400);
  }

  if (!isRecord(body)) {
    return json({ error: 'Request body must be a JSON object' }, 400);
  }

  const envelope = body as IntakeAgentRequestEnvelope;
  let context: TenantContext;
  try {
    context = getTenantContext(envelope, req);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }

  const intake = envelope.intake ?? stripEnvelopeKeys(body);
  const agent = createIntakeAgent();

  try {
    const run = await agent.run(intake, context);
    return json(run);
  } catch (error) {
    if (error instanceof IntakeValidationError) {
      return json({ error: error.message, issues: error.issues }, 400);
    }
    console.error('intake-agent failed:', error);
    return json({ error: 'intake-agent failed' }, 500);
  }
}

serve(handleIntakeAgentRequest);
