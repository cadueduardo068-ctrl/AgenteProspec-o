import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
const keys = [
  'GOOGLE_PLACES_API_KEY',
  'OPENAI_API_KEY',
  'SUPABASE_SECRET_KEY',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_APP_SECRET',
  'GENERATOR_TOKEN',
  'WORKER_TOKEN',
  'SESSION_SECRET',
];
const secrets = keys.map((key) => process.env[key]).filter((value) => value && value.length >= 12);
const root = path.join(process.env.NEXT_DIST_DIR || '.next', 'static');
if (!existsSync(root)) throw new Error('Execute o build antes da inspeção do bundle cliente.');
let files = 0;
function visit(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) visit(file);
    else {
      files++;
      const text = readFileSync(file, 'utf8');
      if (secrets.some((secret) => text.includes(secret)))
        throw new Error('Um segredo do servidor foi detectado no bundle público. Push bloqueado.');
    }
  }
}
visit(root);
console.log(
  `Bundle público inspecionado: ${files} arquivos; nenhum segredo configurado encontrado.`,
);
