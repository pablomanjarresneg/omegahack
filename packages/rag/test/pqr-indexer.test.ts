import { describe, expect, it, vi } from 'vitest';
import { indexPqrBatch } from '../src/pqr-indexer.js';
import type {
  NellaIndexInput,
  NellaIndexResult,
  NellaTransport,
} from '../src/nella-client.js';
import type { PqrRenderRow } from '../src/pqr-renderer.js';

const sampleRow: PqrRenderRow = {
  id: '11111111-1111-1111-1111-111111111111',
  radicado: 'MED-20260401-AAAA',
  tipo: 'queja',
  status: 'accepted',
  hechos: 'Hay un hueco enorme en la calle 45 con carrera 80.',
  peticion: 'Solicito que lo arreglen antes del 30 de mayo.',
  lead: 'Hueco en calle 45',
  secretaria_id: 'sec-1',
  comuna_id: 'com-12',
  priority_level: 'P2_media',
  priority_score: 60,
  problem_group_id: 'grp-obras-tranvia',
  tag_ids: ['vias', 'infraestructura'],
  issued_at: '2026-04-10T10:00:00Z',
};

function recordingTransport(
  result: NellaIndexResult = { indexed: [sampleRow.id], skipped: [] },
): { transport: NellaTransport; calls: NellaIndexInput[] } {
  const calls: NellaIndexInput[] = [];
  const transport: NellaTransport = {
    search: vi.fn().mockResolvedValue([]),
    index: vi.fn().mockImplementation(async (input: NellaIndexInput) => {
      calls.push(input);
      return result;
    }),
  };
  return { transport, calls };
}

describe('indexPqrBatch', () => {
  it('defaults to the omega-pqr-corpus bucket and forwards one doc per row', async () => {
    const { transport, calls } = recordingTransport();
    const res = await indexPqrBatch([sampleRow], { transport });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.bucket).toBe('omega-pqr-corpus');
    expect(calls[0]!.documents).toHaveLength(1);
    expect(calls[0]!.documents[0]!.id).toBe(sampleRow.id);
    expect(res.bucket).toBe('omega-pqr-corpus');
    expect(res.indexed).toEqual([sampleRow.id]);
    expect(res.skipped).toEqual([]);
  });

  it('passes through the skipped list so callers see idempotent skips', async () => {
    const { transport } = recordingTransport({
      indexed: [],
      skipped: [sampleRow.id],
    });
    const res = await indexPqrBatch([sampleRow], { transport });
    expect(res.indexed).toEqual([]);
    expect(res.skipped).toEqual([sampleRow.id]);
  });

  it('keeps metadata useful for dashboard deep-links (problem_group_id, priority_level)', async () => {
    const { transport, calls } = recordingTransport();
    await indexPqrBatch([sampleRow], { transport });
    const meta = calls[0]!.documents[0]!.metadata!;
    expect(meta.problem_group_id).toBe('grp-obras-tranvia');
    expect(meta.priority_level).toBe('P2_media');
    expect(meta.radicado).toBe('MED-20260401-AAAA');
    expect(meta.tag_ids).toEqual(['vias', 'infraestructura']);
  });

  it('redacts PII before sending — phones are masked in the body text', async () => {
    const { transport, calls } = recordingTransport();
    await indexPqrBatch(
      [
        {
          ...sampleRow,
          hechos: 'Me llamaron al 3001234567 reclamando el predio.',
        },
      ],
      { transport },
    );
    const sent = calls[0]!.documents[0]!.text;
    expect(sent).not.toContain('3001234567');
    expect(sent).toContain('[TEL]');
  });

  it('returns empty result when the batch is empty — transport never called', async () => {
    const { transport, calls } = recordingTransport();
    const res = await indexPqrBatch([], { transport });
    expect(res.indexed).toEqual([]);
    expect(res.skipped).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('respects a custom bucket override', async () => {
    const { transport, calls } = recordingTransport();
    await indexPqrBatch([sampleRow], { transport, bucket: 'custom-bucket' });
    expect(calls[0]!.bucket).toBe('custom-bucket');
  });
});
