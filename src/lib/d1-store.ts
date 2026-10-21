import { initialState, normalizeState, type State } from './domain';
import type { Store } from './store';
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<{ success: boolean; meta: { changes?: number } }>;
}
export interface D1Binding {
  prepare(sql: string): D1Statement;
  withSession?(constraint: string): D1Binding;
}
/** Request-scoped, strongly consistent D1 snapshot with optimistic atomic writes. */
export class D1Store implements Store {
  private db: D1Binding;
  constructor(binding: D1Binding) {
    this.db = binding.withSession?.('first-primary') || binding;
  }
  private async snapshot() {
    await this.db
      .prepare('INSERT OR IGNORE INTO app_state(id,version,data) VALUES (1,0,?)')
      .bind(JSON.stringify(initialState()))
      .run();
    const row = await this.db
      .prepare('SELECT version,data FROM app_state WHERE id=1')
      .first<{ version: number; data: string }>();
    if (!row)
      throw new Error('Banco D1 indisponível. Confira o binding DB e aplique as migrações.');
    return { version: row.version, data: normalizeState(JSON.parse(row.data)) };
  }
  async read() {
    return (await this.snapshot()).data;
  }
  async mutate<T>(fn: (state: State) => T): Promise<T> {
    for (let attempt = 0; attempt < 12; attempt++) {
      const snap = await this.snapshot();
      const result = fn(snap.data);
      const serialized = JSON.stringify(snap.data);
      if (Buffer.byteLength(serialized) > 1_800_000)
        throw new Error(
          'O banco atingiu o limite de tamanho desta versão. Exporte e arquive históricos antes de continuar.',
        );
      const saved = await this.db
        .prepare('UPDATE app_state SET data=?,version=version+1 WHERE id=1 AND version=?')
        .bind(serialized, snap.version)
        .run();
      if (!saved.success) throw new Error('Não foi possível salvar no D1. Tente novamente.');
      if (saved.meta.changes === 1) return result;
    }
    throw new Error('Outro salvamento ocorreu ao mesmo tempo. Tente novamente.');
  }
}
