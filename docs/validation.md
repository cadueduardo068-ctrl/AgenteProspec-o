# Validação local — 21/10/2026

- Node 24.22.0; Next.js 16.4.2.
- 19 testes de regras e integrações com mocks passaram: transações, persistência, limite concorrente, idempotência, virada de dia em São Paulo, CSRF, consentimento, exclusão, intenção, assinaturas, múltiplos nichos, deduplicação e não armazenamento de conteúdo Places.
- Fluxo HTTP completo passou em servidor/banco temporários isolados: login, origem, cadastro, autorização, link wa.me, confirmação, aprovação de análise, tarefa e fila de geração, bloqueio de aprovação prematura e exclusão sem zerar o limite.
- TypeScript e build de produção passaram.
- Busca real na API oficial Google Places, pelo navegador integrado: Psicólogos e Clínicas de estética em Bauru/SP, limite total de 5, retornou 5 empresas. Resultados não foram importados para o CRM. Duas requisições registradas no consumo real.
- Prévia de login e dashboard inspecionada no navegador integrado. Em viewport de 390 px, documento sem overflow horizontal e layout adaptado; override restaurado ao final.
- Chave fornecida pelo proprietário configurada somente em `.env.local`; arquivo de ambiente, banco e hash de acesso confirmados como ignorados pelo Git.

Não foram realizados envios de WhatsApp nem geração paga de sites. Supabase, Brave, OpenAI, Meta e infraestrutura de geração/prévia dependem de configuração e de testes de aceitação com o provedor. Os indicadores do banco real começam em zero e nenhuma empresa fictícia foi inserida nele.
