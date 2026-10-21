import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { D1Store, type D1Binding, type D1Statement } from '../src/lib/d1-store';
import { provisionalCompany } from '../src/lib/crm';

test('D1 conserva dados, protege concorrência e não persiste mutação rejeitada', async () => {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync('migrations/d1/0001_state.sql', 'utf8'));
  let session = '';
  const binding: D1Binding = {
    withSession(value) {
      session = value;
      return this;
    },
    prepare(query) {
      let args: unknown[] = [];
      const statement: D1Statement = {
        bind(...values) {
          args = values;
          return this;
        },
        async first<T>() {
          return (sql.prepare(query).get(...(args as (string | number)[])) || null) as T | null;
        },
        async run() {
          const result = sql.prepare(query).run(...(args as (string | number)[]));
          return { success: true, meta: { changes: Number(result.changes) } };
        },
      };
      return statement;
    },
  };
  const db = new D1Store(binding);
  try {
    assert.equal((await db.read()).companies.length, 0);
    assert.equal(session, 'first-primary');
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        db.mutate((s) =>
          provisionalCompany(s, { placeId: `d1-test-${i}`, name: `Empresa fictícia ${i}` }),
        ),
      ),
    );
    assert.equal((await new D1Store(binding).read()).companies.length, 10);
    await assert.rejects(
      () =>
        db.mutate((s) => {
          s.companies = [];
          throw new Error('Rejeitado');
        }),
      /Rejeitado/,
    );
    assert.equal((await db.read()).companies.length, 10);
    await assert.rejects(
      () =>
        db.mutate((s) => {
          s.companies[0].notes = 'x'.repeat(1_900_000);
        }),
      /limite de tamanho/,
    );
    assert.equal((await db.read()).companies[0].notes, '');
  } finally {
    sql.close();
  }
});
