// Deno-side port of packages/rag/src/embedding.ts.
// Shares env var names with reembed-pqr so the same Azure deployment is
// reused for PQR and Q&A corpus embeddings.

export const EMBEDDING_DIM = 1024;
export const EMBEDDING_MODEL = 'azure-nella-embeddings-1024';

const AZURE_ENDPOINT = Deno.env.get('AZURE_EMBEDDINGS_ENDPOINT');
const AZURE_KEY = Deno.env.get('AZURE_EMBEDDINGS_KEY');

export async function embed(text: string): Promise<number[]> {
  if (!AZURE_ENDPOINT || !AZURE_KEY) {
    throw new Error('AZURE_EMBEDDINGS_ENDPOINT / AZURE_EMBEDDINGS_KEY not configured');
  }
  const resp = await fetch(AZURE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': AZURE_KEY,
    },
    body: JSON.stringify({ input: text }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Azure embeddings ${resp.status}: ${body}`);
  }
  const json = await resp.json();
  const vec: number[] | undefined = json?.data?.[0]?.embedding ?? json?.embedding;
  if (!Array.isArray(vec) || vec.length !== EMBEDDING_DIM) {
    throw new Error(
      `Azure returned unexpected embedding shape (len=${Array.isArray(vec) ? vec.length : 'n/a'}, expected ${EMBEDDING_DIM})`,
    );
  }
  return vec;
}
