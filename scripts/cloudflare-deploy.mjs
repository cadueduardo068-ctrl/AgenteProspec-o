import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
if (
  !config.d1_databases?.[0]?.database_id ||
  /^0+-0+-0+-0+-0+$/.test(config.d1_databases[0].database_id) ||
  !/^https:\/\//.test(config.vars?.APP_URL || '') ||
  /\.example\b/.test(config.vars.APP_URL)
) {
  console.error(
    'Configure o database_id D1 e a APP_URL HTTPS em wrangler.jsonc antes de publicar. Consulte docs/cloudflare.md.',
  );
  process.exit(1);
}
const result = spawnSync(
  process.execPath,
  ['node_modules/@opennextjs/cloudflare/dist/cli/index.js', 'deploy'],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
