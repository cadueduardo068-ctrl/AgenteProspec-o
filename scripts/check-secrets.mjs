import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const files = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  { encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);
const badNames =
  /(^|\/)(\.env(?:\..*)?|\.npmrc|credentials[^/]*|service-account[^/]*|[^/]+\.(pem|key|p12|pfx)|\.local\/.*)$/i;
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:sk-proj-|sk_live_|ghp_|github_pat_|sb_secret_)[A-Za-z0-9_-]{16,}/,
  /\bAIza[A-Za-z0-9_-]{30,}/,
  /\bEAA[A-Za-z0-9]{60,}/,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
];
let failed = false;
for (const file of files) {
  if (file !== '.env.example' && badNames.test(file)) {
    console.error(`Nome de arquivo sensível: ${file}`);
    failed = true;
    continue;
  }
  if (/package-lock\.json$/.test(file)) continue;
  const data = readFileSync(file, 'utf8');
  if (patterns.some((p) => p.test(data))) {
    console.error(`Possível segredo em: ${file}`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log(
  `Revisão automática concluída: ${files.length} arquivos; nenhum padrão de segredo encontrado. Revise também o diff.`,
);
