// Fire-and-forget helper for callers that just persisted a PQR row and want
// to kick off nella indexing without blocking the response.
//
// Currently only the n8n workflow inserts into `public.pqr`. If a Node
// route ever grows an insert site (e.g. a Next.js server action), it should
// call `fireNellaIndexRequest(id, …)` right after the insert and let errors
// flow to the logger.

const DEFAULT_TIMEOUT_MS = 1500;

export interface FireNellaIndexArgs {
  supabaseUrl: string;
  serviceRoleKey: string;
  ids: readonly string[];
  timeoutMs?: number;
  /** Optional logger — default is `console.warn`. */
  warn?: (message: string) => void;
}

/**
 * Triggers `POST /functions/v1/pqr-nella-indexer` with the given ids.
 * Returns a promise that resolves regardless of success — never throws,
 * never blocks the caller's critical path. Meant to be called as
 * `void fireNellaIndexRequest(...)`.
 */
export async function fireNellaIndexRequest(
  args: FireNellaIndexArgs,
): Promise<void> {
  if (args.ids.length === 0) return;
  const warn = args.warn ?? ((m: string) => console.warn(m));
  const ctrl = new AbortController();
  const timer = setTimeout(
    () => ctrl.abort(),
    args.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  try {
    const resp = await fetch(
      `${args.supabaseUrl.replace(/\/$/, '')}/functions/v1/pqr-nella-indexer`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${args.serviceRoleKey}`,
        },
        body: JSON.stringify({ ids: [...args.ids] }),
        signal: ctrl.signal,
      },
    );
    if (!resp.ok) {
      warn(
        `fireNellaIndexRequest: edge function replied ${resp.status} (${resp.statusText}) for ids=${args.ids.length}`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warn(`fireNellaIndexRequest: ${msg}`);
  } finally {
    clearTimeout(timer);
  }
}
