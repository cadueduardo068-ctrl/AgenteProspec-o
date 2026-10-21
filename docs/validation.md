# Validação local — 21/10/2026

- Node 24.22.0; Next.js 16.4.2.
- 32 testes de regras e integrações com mocks passaram: transações, persistência, limite concorrente, idempotência, virada de dia em São Paulo, CSRF, consentimento, exclusão, intenção, assinaturas, múltiplos nichos, IBGE, telefones brasileiros, links e texto wa.me, acompanhamento, templates, prompts e versões, entrypoint do worker e adaptador OpenAI com minimização de dados. O conteúdo Places não é persistido automaticamente.
- Fluxo HTTP completo passou em servidor/banco temporários isolados: login, origem, cadastro, autorização, link wa.me, confirmação, acompanhamento sem duplicar limite, notas, tarefas com data, geração e histórico de prompts, aprovação de análise, fila de geração, bloqueio de aprovação prematura e exclusão sem zerar o limite.
- TypeScript e build de produção passaram.
- Busca real na API oficial Google Places, pelo navegador integrado: Psicólogos e Clínicas de estética em Bauru/SP, limite total de 5, retornou 5 empresas. Resultados não foram importados para o CRM. Duas requisições registradas no consumo real.
- Prévia de login e dashboard inspecionada no navegador integrado. Em viewport de 390 px, documento sem overflow horizontal e layout adaptado; override restaurado ao final.
- Chave fornecida pelo proprietário configurada somente em `.env.local`; arquivo de ambiente, banco e hash de acesso confirmados como ignorados pelo Git.

## Melhorias de acompanhamento

- Consulta real IBGE: 27 estados e 645 municípios em SP, com Bauru identificado pelo código 3506003. O seletor também carregou Minas Gerais e permitiu selecionar Belo Horizonte por busca e Enter, com a chave Google desativada no ambiente de QA. Busca por cidade inexistente não ofereceu seleção.
- Busca real Google no sistema principal: 5 psicólogos em Bauru, exibidos nos novos cards com ações de WhatsApp, prompt e detalhes. Nenhum cadastro real foi salvo automaticamente.
- QA de navegador em banco separado `.local/qa`, com nome explicitamente marcado `[TESTE FICTÍCIO]`: notas salvas após blur e preservadas após recarregar; editor de prompt com uma única instância; prompt salvo, carregado novamente e marcado como iniciado sem gerar site fictício; empresa contatada exibida na tabela; etapa comercial editada; destinatário e texto revisável do WhatsApp conferidos sem abrir conversa externa; tarefa gravada e exibida em 22/10/2026 às 10h.
- Perfil em viewport de 390 px: página e perfil medidos em 390 px, sem overflow horizontal. Override restaurado. A aba e o servidor temporários de QA foram encerrados; a prévia principal foi preservada.
- Build, TypeScript e varredura do bundle público passaram. Nenhum segredo configurado foi encontrado nos arquivos públicos.

Não foram realizados envios de WhatsApp nem geração paga de sites. Supabase, Brave, OpenAI, Meta e infraestrutura de geração/prévia dependem de configuração e de testes de aceitação com o provedor. Os indicadores do banco real começam em zero e nenhuma empresa fictícia foi inserida nele.
