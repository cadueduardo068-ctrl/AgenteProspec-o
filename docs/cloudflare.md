# Cloudflare Workers + D1

O projeto mantém Next.js 16 e APIs de servidor. A implantação usa o adaptador OpenNext para Workers, com banco Cloudflare D1. O ambiente local habitual continua em SQLite; nenhum comando de build apaga `.local/cadu.sqlite`.

## Executar e conferir localmente

```powershell
npm ci
npm run dev
```

Abra `http://127.0.0.1:3000`. A biblioteca fica em `/library`; as empresas têm endereço `/companies/<id>`.

Para o artefato Cloudflare:

```powershell
npm run build:cloudflare
npm run check:cloudflare:secrets
npm run test:cloudflare
```

O teste inicia o runtime real `workerd` com D1 local em uma pasta isolada, usa credenciais efêmeras, verifica login, CRM, biblioteca, geradores e persistência após reiniciar. Não chama WhatsApp, OpenAI ou Google nem publica recursos.

Para usar a prévia do Worker manualmente, copie `.dev.vars.example` para `.dev.vars` e configure o hash administrativo e um segredo de sessão aleatório de pelo menos 32 caracteres. Essa configuração é privada e ignorada pelo Git. Execute:

```powershell
npm run db:cloudflare:local
npm run preview:cloudflare
```

Abra `http://127.0.0.1:8787`. O D1 local dessa prévia fica em `.local/cloudflare`, separado do SQLite do desenvolvimento.

## Configurar a conta e publicar

1. No terminal privado, faça `npx wrangler login` e autorize a conta Cloudflare.
2. Crie o banco com `npx wrangler d1 create cadu-ai`.
3. Substitua somente `database_id` em `wrangler.jsonc` pelo ID retornado. Configure `vars.APP_URL` com a URL HTTPS real do Worker ou domínio próprio. IDs e URL são configuração pública; credenciais não devem ficar nesse arquivo.
4. Configure os segredos pelo comando interativo, sem valores na linha de comando:

```powershell
npx wrangler secret put ADMIN_PASSWORD_HASH
npx wrangler secret put SESSION_SECRET
```

`npm run password` gera o hash scrypt em um terminal privado. Use um segredo de sessão aleatório e persistente. A aplicação não oferece cadastro inicial em produção. Integrações opcionais também devem usar `wrangler secret put`: `GOOGLE_PLACES_API_KEY`, `BRAVE_SEARCH_API_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL` e os segredos do worker de geração, quando necessários. Não copie `.env.local` para o Git ou para assets.

5. Aplique o esquema remoto:

```powershell
npm run db:cloudflare:remote
```

6. Se for migrar o banco local existente, faça a importação abaixo **antes da primeira execução do aplicativo remoto**.
7. Execute `npm run build:cloudflare`, `npm run check:cloudflare:secrets` e `npm run deploy:cloudflare`.

O comando de deploy recusa o ID D1 de exemplo e URLs de exemplo. A autenticação Cloudflare e a configuração dos segredos dependem da conta do administrador. Nenhuma publicação remota é feita durante os testes.

## Preservar e migrar os dados existentes

```powershell
npm run db:cloudflare:export
npx wrangler d1 execute DB --remote --file .local/exports/cadu-d1-import.sql
```

O primeiro comando lê o SQLite em modo somente leitura e prepara uma exportação privada, ignorada pelo Git. Não envia informações. O segundo envia os dados para o D1 vinculado na sua conta e deve ser executado somente no banco de destino correto.

A importação usa `INSERT OR IGNORE`: não sobrescreve um estado remoto já existente. Um banco já inicializado requer uma migração revisada; não apague dados para forçar a importação. O SQLite local permanece preservado. Confira empresas, históricos e autorizações após importar e mantenha backups conforme sua necessidade.

## Arquitetura e limites

- D1 usa sessões `first-primary` e atualização condicionada à versão, com repetição em conflitos. Uma gravação rejeitada não altera os dados.
- Clientes D1 são criados no contexto de cada solicitação; não são reutilizados globalmente entre requisições do Worker.
- O estado atual ocupa um snapshot JSON. A aplicação rejeita gravações acima de 1,8 MB sem remover o estado anterior; volumes maiores exigem normalização das tabelas ou o adaptador Supabase já existente.
- Rotas privadas são dinâmicas e não são colocadas no cache público. Somente assets estáticos têm cache longo.
- A criação de sites continua sendo executada pelo worker isolado configurado, fora do runtime Web. O Cloudflare não executa o CLI do Codex nem comandos de instalação de projetos dentro da requisição.
- O build OpenNext recomenda Linux/WSL no Windows. O artefato foi também validado pelo runtime local e por `wrangler deploy --dry-run`; o build de produção pode ser executado no ambiente Linux do Cloudflare.

Referências oficiais: [OpenNext — configuração e publicação](https://opennext.js.org/cloudflare/get-started), [bindings](https://opennext.js.org/cloudflare/bindings), [Cloudflare D1](https://developers.cloudflare.com/d1/get-started/) e [compatibilidade Node.js](https://developers.cloudflare.com/workers/runtime-apis/nodejs/).
