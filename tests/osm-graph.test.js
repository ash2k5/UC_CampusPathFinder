import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function okJson(payload) {
  return { ok: true, status: 200, json: async () => payload, text: async () => '' };
}

function notOk(status = 504) {
  return { ok: false, status, json: async () => ({}), text: async () => 'overpass error' };
}

const sample = {
  elements: [
    { type: 'node', id: 1, lat: 39.13, lon: -84.51 },
    { type: 'way', id: 10, nodes: [1], tags: { highway: 'footway' } },
    { type: 'way', id: 11, nodes: [1], tags: { highway: 'motorway' } },
  ],
};

// The route module keeps an in-memory cache, so reload it per test for isolation.
async function loadGet() {
  return (await import('../app/api/osm-graph/route.js')).GET;
}

describe('GET /api/osm-graph', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it('keeps walkable ways and all nodes, drops the rest', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson(structuredClone(sample))));
    const res = await (await loadGet())();
    const body = await res.json();
    expect(body.elements.filter(e => e.type === 'way').map(e => e.id)).toEqual([10]);
    expect(body.elements.some(e => e.type === 'node' && e.id === 1)).toBe(true);
  });

  it('falls through to the next endpoint when one responds with an error', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(notOk(504))
      .mockResolvedValueOnce(okJson(structuredClone(sample)));
    vi.stubGlobal('fetch', fetchMock);
    const res = await (await loadGet())();
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns 503 when every endpoint fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const res = await (await loadGet())();
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/failed/i);
  });

  it('rejects a payload whose elements is not an array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ elements: null })));
    const res = await (await loadGet())();
    expect(res.status).toBe(503);
  });

  it('serves the cached response without refetching', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson(structuredClone(sample)));
    vi.stubGlobal('fetch', fetchMock);
    const GET = await loadGet();
    await GET();
    await GET();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
