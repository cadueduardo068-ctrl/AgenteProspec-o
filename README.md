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
- Seletor de municípios oficiais do IBGE por estado, busca por nome, navegação por teclado, cidades recentes persistidas e validação no backend. Funciona sem chave Google; padrão São Paulo/Bauru.
- Cards reais de prospecção com nicho, localização, telefone, presença digital, pontuação explicada e ações de WhatsApp, prompt e detalhes. Redes sociais são diferenciadas de site próprio.
- Empresas contatadas entram automaticamente na tabela ao abrir uma conversa, sem contar abertura como envio. Há busca, filtros, ordenação, datas e próxima ação.
- Perfil com endereço próprio (`/companies/<id>`), notas com debounce, indicador de salvamento, tarefas com data/descrição/status, respostas e histórico cronológico.
- Dois geradores diretos nos resultados e no perfil: verde “Gerar mensagem para WhatsApp” e azul “Gerar prompt do site”. Ambos usam a mesma empresa provisória sem exigir formulário de verificação ou telefone.
- Mensagens comerciais: Primeiro contato, Apresentar proposta, Cliente interessado, Oferecer demonstração e Enviar demonstração. Versões geradas e edições salvas ficam em histórico próprio, separado dos prompts técnicos. Rascunhos anteriores são preservados na migração. Sem OpenAI, modelos locais identificados; com credenciais, geração real via Responses API.
- Enviar demonstração requer link de prévia/PDF aprovado pelo administrador ou job aprovado. Sem link aprovado, retorna pendência e bloqueia a abertura com esse texto. Nenhuma geração marca contato ou site criado. A abertura e a confirmação manual continuam independentes.
- Prompts de sites personalizados por segmento com landing page ou institucional recomendado, pendências explícitas, editor, cópia e histórico de versões. Marcar uma demonstração como iniciada cria tarefa manual; não simula execução do Codex.
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

“Configurada” indica presença das variáveis, não validação de acesso. Consultas têm atribuição; o botão de prompt seleciona dados para um registro provisório, sempre `verified:false`. Antes de salvar ou publicar conteúdo, observe as permissões de uso e retenção do provedor. A idade de sites exige revisão manual.

O gerador abre diretamente e prepara o rascunho sem exigir cadastro verificado, telefone, endereço, site ou fonte. O resumo distingue dados pendentes e confirmados. Sem configuração OpenAI, utiliza briefing local personalizado e informa “sem IA”. Copiar, editar, regenerar e salvar no CRM são ações independentes. Cada edição salva cria uma versão com data e vínculo à mesma empresa; Place ID impede duplicação. “Verificar informações” no perfil mantém o ID e todo o histórico. Telefones observados não habilitam WhatsApp no briefing nem autorização de contato.

No fluxo dos cards, uma empresa ainda não cadastrada passa por revisão e confirmação de fonte independente antes de ser salva. O telefone é normalizado para Brasil sem inventar DDD ou nono dígito; número ausente ou ambíguo desabilita o WhatsApp. Acompanhamentos de contatos já confirmados não consomem uma nova vaga de primeiro contato.

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

## Fluxo diário e biblioteca

A navegação principal reúne Visão geral, Encontrar empresas, Biblioteca, Conversas e Prévias de sites. As ferramentas avançadas permanecem em “Mais ferramentas”. Cada seção tem rota própria, incluindo `/library`, e pode ser atualizada sem perder os registros do servidor.

No gerador comercial, “Conferir contato” permite confirmar o número e registrar a evidência de autorização sem exigir a verificação de todos os dados da empresa. A caixa de revisão do texto sozinha não substitui a autorização. O botão informa exatamente o que falta. A empresa continua provisória para os outros campos; abrir WhatsApp não confirma envio.

A biblioteca permite pesquisar e abrir empresas, editar os dados sem duplicação, acompanhar a etapa e excluir pelo fluxo de confirmação. Alterar o número invalida a autorização anterior. A persistência local permanece em `.local/cadu.sqlite`; atualizar a interface não apaga o banco.
