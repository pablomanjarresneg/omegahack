// Embedding logic for reembed-pqr.
//
// Delegates to Azure nella-embeddings when creds are present, otherwise
// returns a deterministic SHA-256-seeded stub so the pipeline can be
// exercised end-to-end in dev / CI without external credentials.
//
// This file has NO top-level side effects so it can be imported cleanly
// from Deno tests (no --allow-net required).

export const EMBEDDING_DIM = 1024;

const AZURE_ENDPOINT = Deno.env.get('AZURE_EMBEDDINGS_ENDPOINT');
const AZURE_KEY = Deno.env.get('AZURE_EMBEDDINGS_KEY');

export async function embed(text: string): Promise<number[]> {
  if (AZURE_ENDPOINT && AZURE_KEY) {
    return await embedViaAzure(text);
  }
  return deterministicEmbed(text);
}

async function embedViaAzure(text: string): Promise<number[]> {
  const resp = await fetch(AZURE_ENDPOINT!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': AZURE_KEY!,
    },
    body: JSON.stringify({ input: text }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Azure embeddings ${resp.status}: ${body}`);
  }
  const json = await resp.json();
  // Azure OpenAI-compatible shape: { data: [{ embedding: number[] }] }
  const vec: number[] | undefined = json?.data?.[0]?.embedding ?? json?.embedding;
  if (!Array.isArray(vec) || vec.length !== EMBEDDING_DIM) {
    throw new Error(
      `Azure returned unexpected embedding shape (len=${Array.isArray(vec) ? vec.length : 'n/a'}, expected ${EMBEDDING_DIM})`,
    );
  }
  return vec;
}

/**
 * Deterministic stub embedding.
 *
 * Seeds a mulberry32 PRNG with eight 32-bit words pulled from the SHA-256 of
 * `text`, draws `EMBEDDING_DIM` values from N(0, 1) via Box–Muller, then
 * normalizes to unit length. Same input → same 1024-dim unit vector; different
 * inputs → uncorrelated vectors. Empty input is allowed — the hash handles it.
 */
export function deterministicEmbed(text: string): number[] {
  const seedBytes = sha256(new TextEncoder().encode(text));
  // Build 8 × uint32 from the 32-byte digest.
  const seeds = new Uint32Array(8);
  for (let i = 0; i < 8; i++) {
    seeds[i] =
      (seedBytes[i * 4] << 24) |
      (seedBytes[i * 4 + 1] << 16) |
      (seedBytes[i * 4 + 2] << 8) |
      seedBytes[i * 4 + 3];
  }
  // Fold the 8 seeds together so every byte of the digest influences state.
  let state = 0 >>> 0;
  for (const s of seeds) {
    state = (state ^ s) >>> 0;
    state = (Math.imul(state, 1597334677) + 1) >>> 0;
  }
  const rng = mulberry32(state || 0x9e3779b9);

  const out = new Array<number>(EMBEDDING_DIM);
  // Box–Muller: each pair of uniforms → pair of N(0,1) samples.
  for (let i = 0; i < EMBEDDING_DIM; i += 2) {
    const u1 = Math.max(rng(), 1e-12); // avoid log(0)
    const u2 = rng();
    const mag = Math.sqrt(-2.0 * Math.log(u1));
    const theta = 2.0 * Math.PI * u2;
    out[i] = mag * Math.cos(theta);
    if (i + 1 < EMBEDDING_DIM) out[i + 1] = mag * Math.sin(theta);
  }
  // L2 normalize to unit length.
  let sumSq = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) sumSq += out[i] * out[i];
  const norm = Math.sqrt(sumSq) || 1;
  for (let i = 0; i < EMBEDDING_DIM; i++) out[i] = out[i] / norm;
  return out;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Pure SHA-256 (FIPS 180-4) --------------------------------------------
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256(bytes: Uint8Array): Uint8Array {
  const bitLen = bytes.length * 8;
  // Padding: append 0x80, then zeros, then 64-bit big-endian length.
  const withPad = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  withPad.set(bytes);
  withPad[bytes.length] = 0x80;
  const view = new DataView(withPad.buffer);
  view.setUint32(withPad.length - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(withPad.length - 4, bitLen >>> 0, false);

  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const W = new Uint32Array(64);

  for (let chunk = 0; chunk < withPad.length; chunk += 64) {
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(chunk + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }
  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, H[i], false);
  return out;
}

function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}
