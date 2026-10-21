import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
const keys = [
  'GOOGLE_PLACES_API_KEY',
  'OPENAI_API_KEY',
  'ADMIN_PASSWORD_HASH',
  'SESSION_SECRET',
  'SUPABASE_SECRET_KEY',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_APP_SECRET',
  'GENERATOR_TOKEN',
  'WORKER_TOKEN',
  'BRAVE_SEARCH_API_KEY',
];
const values = keys.map((k) => process.env[k]).filter((v) => v && v.length >= 16);
let count = 0;
function inspect(directory) {
  for (const name of readdirSync(directory)) {
    const file = path.join(directory, name);
    if (statSync(file).isDirectory()) {
      inspect(file);
      continue;
    }
    if (/\.env(?:\.|$)|\.dev\.vars/.test(name))
      throw new Error(`Arquivo de ambiente encontrado no artefato: ${file}`);
    const bytes = readFileSync(file);
    count++;
    if (values.some((v) => bytes.includes(Buffer.from(v))))
      throw new Error(`Segredo configurado encontrado no artefato: ${file}`);
  }
}
inspect('.open-next');
console.log(
  `Artefato Cloudflare inspecionado: ${count} arquivos; nenhum segredo configurado encontrado.`,
);
