import { spawnSync } from 'node:child_process';
// Build without personal credentials. Runtime secrets are configured in Workers, not bundled.
const env = {
  ...process.env,
  DATABASE_DRIVER: 'd1',
  APP_URL: 'https://cadu-ai.example',
  NEXT_TELEMETRY_DISABLED: '1',
};
for (const key of [
  'GOOGLE_PLACES_API_KEY',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'ADMIN_PASSWORD_HASH',
  'SESSION_SECRET',
  'SUPABASE_SECRET_KEY',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_APP_SECRET',
  'WHATSAPP_VERIFY_TOKEN',
  'GENERATOR_TOKEN',
  'WORKER_TOKEN',
  'BRAVE_SEARCH_API_KEY',
])
  env[key] = '';
const result = spawnSync(
  process.execPath,
  ['node_modules/@opennextjs/cloudflare/dist/cli/index.js', 'build'],
  { stdio: 'inherit', env },
);
process.exit(result.status ?? 1);
