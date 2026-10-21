import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createClient } from '@supabase/supabase-js';
import { initialState, normalizeState, type State } from './domain';

export interface Store {
  read(): Promise<State>;
  mutate<T>(fn: (state: State) => T): Promise<T>;
}
export class SqliteStore implements Store {
  private db: DatabaseSync;
  constructor(filename: string) {
    if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec(
      'PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL, data TEXT NOT NULL)',
    );
    this.db
      .prepare('INSERT OR IGNORE INTO app_state VALUES (1,0,?)')
      .run(JSON.stringify(initialState()));
  }
  async read(): Promise<State> {
    const row = this.db.prepare('SELECT data FROM app_state WHERE id=1').get() as { data: string };
    return normalizeState(JSON.parse(row.data));
  }
  async mutate<T>(fn: (state: State) => T): Promise<T> {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.db.prepare('SELECT data FROM app_state WHERE id=1').get() as {
        data: string;
      };
      const state: State = normalizeState(JSON.parse(row.data));
      const result = fn(state);
      this.db
        .prepare('UPDATE app_state SET data=?,version=version+1 WHERE id=1')
        .run(JSON.stringify(state));
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  close() {
    this.db.close();
  }
}
export class SupabaseStore implements Store {
  private client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  private async snapshot() {
    const { data, error } = await this.client
      .from('cadu_state')
      .select('version,data')
      .eq('id', 1)
      .single();
    if (error) throw new Error('Banco indisponível. Confira a migração e as credenciais Supabase.');
    const snapshot = data as { version: number; data: State };
    snapshot.data = normalizeState(snapshot.data);
    return snapshot;
  }
  async read() {
    return (await this.snapshot()).data;
  }
  async mutate<T>(fn: (state: State) => T): Promise<T> {
    for (let attempt = 0; attempt < 12; attempt++) {
      const snap = await this.snapshot();
      const result = fn(snap.data);
      const { data, error } = await this.client.rpc('cadu_compare_and_swap', {
        expected_version: snap.version,
        next_data: snap.data,
      });
      if (error) throw new Error('Falha na transação do banco.');
      if (data === true) return result;
    }
    throw new Error('Conflito de concorrência. Tente novamente.');
  }
}
const globalStore = globalThis as unknown as { caduStore?: Store; caduSchema?: number };
export function store(): Store {
  if (!globalStore.caduStore || globalStore.caduSchema !== 3) {
    const old = globalStore.caduStore as (Store & { close?: () => void }) | undefined;
    old?.close?.();
    if (process.env.DATABASE_DRIVER === 'supabase') {
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY)
        throw new Error('Configure o Supabase antes de iniciar.');
      globalStore.caduStore = new SupabaseStore();
    } else {
      if (process.env.NODE_ENV === 'production' && !process.env.LOCAL_DATA_DIR)
        throw new Error('Configure um banco e armazenamento persistente.');
      globalStore.caduStore = new SqliteStore(
        path.resolve(process.env.LOCAL_DATA_DIR || '.local', 'cadu.sqlite'),
      );
    }
    globalStore.caduSchema = 3;
  }
  return globalStore.caduStore;
}
