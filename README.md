# CADU AI

CRM e prospecção assistida para um administrador. Next.js, TypeScript, Node 24, SQLite local e adaptador Supabase PostgreSQL. O fluxo principal usa WhatsApp pessoal por links oficiais `wa.me`; não exige outro número ou API Business e não acessa conversas privadas.

## Executar localmente

```powershell
npm ci
npm run dev
```

Abra [CADU AI local](http://127.0.0.1:3000). No primeiro acesso em desenvolvimento, crie uma senha de pelo menos 12 caracteres. O hash e o segredo da sessão ficam em `.local/auth.json`, ignorado pelo Git. Dados ficam em `.local/cadu.sqlite`. Não apague essa pasta para atualizar a aplicação.

Copie `.env.example` para `.env.local`, preencha somente as integrações necessárias e reinicie o servidor. Não envie valores reais pelo chat ou pelo Git. O CRM e o fluxo manual funcionam sem essas chaves.

## Funcionalidades

- Login protegido, validação, CSRF e rate limiting persistente.
- Cadastro verificado, filtros, cards, tabela, Kanban, notas, tarefas, arquivamento e linha do tempo com origem e data.
- Fila priorizada por pontuação estimada, rascunhos editáveis, cópia e abertura do WhatsApp pessoal.
- Consentimento e exclusão permanente. Abrir não conta como envio. Confirmação manual idempotente, cancelamento e limite inicial de 10 contatos/dia em São Paulo, com controle de concorrência.
- Importação voluntária de `.txt` ou texto, análise por regras locais identificada ou OpenAI configurada e aprovação das mudanças no CRM. Texto original não é retido por padrão.
- Dashboard e relatórios calculados do banco. Taxas somente com denominador conhecido; nenhum dado fictício inserido no banco real.
- Prospecção com até 8 nichos simultâneos, seletor por categorias, busca e nichos personalizados. O limite total é distribuído entre os nichos, com deduplicação por Place ID.
- APIs reais Google Places, Brave Search e OpenAI. Meta opcional com webhook assinado, independente do modo pessoal.
- Fila persistente de geração, briefing verificado, worker e revisão/aprovação. Sem provedor, a tarefa aguarda; não há conclusão fictícia.

## Integrações

| Integração | Configuração | Situação |
|---|---|---|
| CRM local e WhatsApp pessoal | Criar acesso, cadastrar empresa e autorização | Regras e fluxo HTTP testados |
| Google Places | `GOOGLE_PLACES_API_KEY`, API New e faturamento | Consulta real validada com a chave local; 5 empresas em Bauru, 2 nichos |
| Fontes complementares | `BRAVE_SEARCH_API_KEY` | Adaptador real; precisa da chave |
| OpenAI | `OPENAI_API_KEY`, `OPENAI_MODEL` | Sem chave usa regras locais, explicitamente sem IA |
| Supabase | Migração, driver, URL e secret key | Preparado; precisa do banco para teste real |
| Meta opcional | `WHATSAPP_*`, webhook e template aprovado | Assinatura e regras testadas; nenhum envio real realizado |
| Codex e prévias | Worker/provedor isolado e origem privada | Fila real; depende de infraestrutura e credenciais |
| GitHub de clientes | Publicação manual após revisão | Sem publicação automática |

“Configurada” indica presença das variáveis, não validação de acesso. Resultados Google são temporários, com atribuição. O CRM guarda Place ID e dados verificados independentemente; não copie conteúdo do Places para armazenamento permanente. A idade de sites exige revisão manual.

## Verificação

```powershell
npm test
npm run test:e2e
npm run typecheck
npm run build
npm run check:secrets
```

O teste HTTP usa a porta 3101, banco temporário e credenciais em memória, separados dos dados reais. Não envia mensagens ou consome APIs pagas. As integrações devem ser testadas também na conta do proprietário após configurar as chaves.

## Produção

Use Node 24, HTTPS e armazenamento persistente ou Supabase. Defina `APP_URL` canônica, `ADMIN_PASSWORD_HASH` e `SESSION_SECRET` aleatório com ao menos 32 caracteres. `npm run password` recebe a senha pela entrada padrão e retorna um hash scrypt; execute somente em terminal privado. Hash e segredo ficam fora do Git.

```powershell
npm ci
npm run build
npm start
```

O servidor escuta loopback; use reverse proxy HTTPS. Configure backups criptografados e teste restauração. Personalize termos, privacidade e `PRIVACY_CONTACT` antes de uso público. Este backend Node/SQLite não roda diretamente em Cloudflare Workers. Consulte [arquitetura](docs/architecture.md) e [geração isolada](docs/generation.md).

## Git e segredos

Antes de cada push: testes, `npm run check:secrets`, `git diff --check` e revisão do diff. Somente `.env.example` com placeholders pode ser versionado; outros `.env`, dados locais, tokens, dependências e builds são ignorados. A varredura automática é complementar à revisão.

Repositório: [AgenteProspec-o](https://github.com/cadueduardo068-ctrl/AgenteProspec-o). Etapas funcionais são enviadas à `main`, conforme autorização do proprietário.
