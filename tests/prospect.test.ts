import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prospectSchema, searchPlaces } from '../src/lib/prospect';
import { SqliteStore } from '../src/lib/store';
const query = {
  niches: ['Psicólogos', 'Dentistas'],
  city: 'Bauru',
  state: 'SP',
  limit: 5,
  priority: 'all',
};
test('seletor múltiplo valida nichos, remove duplicados e mantém compatibilidade', () => {
  assert.deepEqual(
    prospectSchema.parse({ ...query, niches: ['Psicólogos', 'psicólogos', 'Dentistas'] }).niches,
    ['psicólogos', 'Dentistas'],
  );
  assert.deepEqual(
    prospectSchema.parse({ ...query, niches: undefined, niche: 'Psicólogos' }).niches,
    ['Psicólogos'],
  );
  assert.throws(() => prospectSchema.parse({ ...query, niches: [] }));
  assert.throws(() => prospectSchema.parse({ ...query, niches: ['A', 'B'] }));
  assert.throws(() =>
    prospectSchema.parse({ ...query, niches: Array.from({ length: 9 }, (_, i) => `Nicho ${i}`) }),
  );
  assert.throws(() => prospectSchema.parse({ ...query, limit: 1 }));
});
test('busca multi nicho distribui limite, deduplica e não persiste conteúdo Places', async () => {
  const db = new SqliteStore(':memory:');
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GOOGLE_PLACES_API_KEY;
  process.env.GOOGLE_PLACES_API_KEY = 'chave-ficticia-para-teste';
  const calls: { textQuery: string; pageSize: number }[] = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    calls.push(body);
    return Response.json({
      places:
        calls.length === 1
          ? [
              { id: 'shared', displayName: { text: 'Dado temporário Google' } },
              { id: 'a' },
              { id: 'b', websiteUri: 'https://example.org' },
            ]
          : [{ id: 'shared' }, { id: 'c' }],
    });
  };
  try {
    const result = await searchPlaces(db, query);
    assert.equal(calls.length, 2);
    assert.deepEqual(
      calls.map((c) => c.pageSize),
      [3, 2],
    );
    assert.match(calls[0].textQuery, /Psicólogos/);
    assert.match(calls[1].textQuery, /Dentistas/);
    assert.equal(result.places.length, 4);
    const state = await db.read();
    assert.equal(state.companies.length, 0);
    assert.equal(state.usage[0].places, 2);
    assert.equal(JSON.stringify(state).includes('Dado temporário Google'), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = originalKey;
    db.close();
  }
});
test('erro de permissão Google é sanitizado e consome cota sem vazar resposta', async () => {
  const db = new SqliteStore(':memory:');
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GOOGLE_PLACES_API_KEY;
  process.env.GOOGLE_PLACES_API_KEY = 'chave-ficticia';
  globalThis.fetch = async () =>
    Response.json(
      { error: { status: 'PERMISSION_DENIED', message: 'secret-upstream-body' } },
      { status: 403 },
    );
  try {
    await assert.rejects(
      searchPlaces(db, query),
      (e) =>
        e instanceof Error &&
        e.message.includes('Places API (New)') &&
        !e.message.includes('secret-upstream'),
    );
    assert.equal((await db.read()).usage[0].places, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = originalKey;
    db.close();
  }
});
