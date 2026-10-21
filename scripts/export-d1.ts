import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { normalizeState } from '../src/lib/domain';
const filename = path.resolve(process.env.LOCAL_DATA_DIR || '.local', 'cadu.sqlite');
const db = new DatabaseSync(filename, { readOnly: true });
try {
  const row = db.prepare('SELECT data FROM app_state WHERE id=1').get() as
    { data: string } | undefined;
  if (!row) throw new Error('Banco local vazio ou inválido. Nenhum arquivo de dados foi alterado.');
  const serialized = JSON.stringify(normalizeState(JSON.parse(row.data)));
  if (Buffer.byteLength(serialized) > 1_800_000)
    throw new Error('Snapshot maior que o limite atual do adaptador D1.');
  const directory = path.resolve('.local/exports');
  mkdirSync(directory, { recursive: true });
  const target = path.join(directory, 'cadu-d1-import.sql');
  writeFileSync(
    target,
    `-- Dados privados. Não enviar ao Git. Importação não sobrescreve registros remotos existentes.\nINSERT OR IGNORE INTO app_state(id,version,data) VALUES (1,0,'${serialized.replace(/'/g, "''")}');\n`,
    { mode: 0o600 },
  );
  console.log(
    'Exportação privada preparada em .local/exports/cadu-d1-import.sql. Banco local preservado; nenhum dado foi enviado.',
  );
} finally {
  db.close();
}
