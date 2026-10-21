import { randomBytes, scryptSync } from 'node:crypto';
// Read password through stdin; never put it in command arguments or logs.
let input = '';
for await (const chunk of process.stdin) input += chunk;
const password = input.trimEnd();
if (password.length < 12)
  throw new Error('Senha deve ter ao menos 12 caracteres. Envie pela entrada padrão.');
const salt = randomBytes(16).toString('hex');
process.stdout.write(`${salt}:${scryptSync(password, salt, 64).toString('hex')}\n`);
