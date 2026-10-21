# Arquitetura e limites da primeira versão

## Aplicação

Next.js App Router e TypeScript. A interface usa Lucide, Framer Motion e Recharts. O CSS é próprio para preservar a identidade visual. Não há serviços de envio ou credenciais no frontend. As APIs ficam em `src/app/api/[...path]/route.ts`; regras de domínio, CRM, contatos manuais, métricas e integrações ficam em módulos separados em `src/lib/`.

O armazenamento padrão é SQLite, usando `node:sqlite` do Node 24, em `.local/cadu.sqlite`. Transações `BEGIN IMMEDIATE` serializam mutações entre processos. O driver Supabase usa PostgreSQL com comparação atômica de versão e repetição limitada de conflitos. As funções de mutação são síncronas, sem efeitos externos, para poderem ser repetidas com segurança. Chamadas externas acontecem fora das transações.

Para este MVP de um administrador, o banco armazena um documento JSON com revisão transacional. Não é um desenho para grande volume ou múltiplos tenants. Antes de escalar, normalize empresas, eventos, contatos e tarefas em tabelas com índices e políticas por tenant, retenção e paginação. Não acrescente vários usuários mantendo este modelo de autorização.

## Contatos pessoais

WhatsApp pessoal funciona por `https://wa.me/<numero>?text=<mensagem>`. Não há automação de navegador nem acesso às conversas. Preparar não envia; abrir não confirma; confirmar altera o registro com origem manual. Autorização específica é exigida para iniciar contato comercial. Respostas externas são informadas pelo administrador, nunca presumidas.

Aberturas pendentes reservam vagas sem aumentar o contador. Confirmações são transacionais e idempotentes. O dia segue `America/Sao_Paulo`. A reserva antiga deve ser cancelada e reaberta depois da virada. O ledger mínimo conserva hash do telefone, data e estado, para que excluir e recriar um cadastro não burle limite ou deduplicação. Hash de telefone é dado pseudonimizado, não anonimização absoluta. Recusas mantêm uma lista de exclusão permanente; não há reativação automática.

O contador manual não verifica o WhatsApp e depende da confirmação verdadeira do administrador. Uma pessoa pode enviar fora da plataforma; nenhum software consegue impedir isso sem integração com o provedor. API oficial Meta é opcional e separada; primeiro envio usa template aprovado sem parâmetros. Falhas ambíguas consomem a reserva e suspendem novos disparos, sem repetição automática.

## Análises de respostas

O administrador seleciona a empresa e o trecho do cliente. Arquivos `.txt` são lidos no navegador; somente o trecho selecionado é enviado ao backend ao clicar em analisar. O texto bruto não é guardado por padrão. A análise guarda resumo, origem, intenção estimada, sugestão e data. A aplicação ao CRM exige aprovação. Exclusão de análise remove também o texto bruto, se houver.

Sem OpenAI configurada, há classificação por regras locais identificada na interface. Confiança é heurística, não calibrada. Com OpenAI, usa-se Responses API com `store:false`; isso não substitui a revisão dos termos de retenção do provedor. Recusa clara detectada localmente prevalece. Não existe envio automático de respostas nesta versão.

## Segurança

Senha em scrypt com sal aleatório; sessão assinada HMAC, HttpOnly, SameSite Strict e expiração de 8 horas. Produção exige HTTPS, hash e segredo com ao menos 32 caracteres. Cadastro inicial existe somente em desenvolvimento e host de loopback. Rate limiting é persistido e transacional. Mutações do administrador exigem Origin igual a APP_URL. Webhooks Meta usam HMAC SHA-256 e conferem a conta e o número. Workers usam token separado.

Os arquivos locais não são criptografados pela aplicação; use disco criptografado, permissões do sistema e backups protegidos. Em produção, use gerenciador de segredos, banco com criptografia em repouso e TLS. Nunca exponha `.local`, `.env.local` ou chaves de serviço em hospedagem estática. Logs de aplicação registram tipo e request ID, sem conteúdo de conversas, credenciais ou respostas brutas dos provedores. Logs HTTP da infraestrutura também devem ser revisados para não armazenar query strings de verificação do webhook.

SQLite precisa de disco persistente e um host Node. Next.js com `node:sqlite` não roda diretamente em Cloudflare Workers. Para Cloudflare, hospede estáticos/prévias compatíveis e mantenha este backend em Node, ou faça uma adaptação explícita a runtime e banco HTTP. Não há deploy automático incluído.

## Dados Google

Resultados são temporários, mantidos na memória da página, sem salvar conteúdo do Places no banco. Apenas Place ID pode ser associado ao CRM; demais informações devem ser verificadas em fonte independente ou fornecidas pela empresa. A interface exibe atribuição Google Maps e fornecedores retornados pela API. Não são solicitadas fotos ou avaliações. O filtro de sites antigos não inventa idade: exige revisão manual. Pesquisa complementar usa Brave Search quando configurado.

O orçamento interno limita quantidade de requisições por dia, incluindo tentativas com erro. Não é cotação de faturamento. Configure restrições de chave e cotas também no Google Cloud. Antes de uso público, personalize os termos, a política e PRIVACY_CONTACT e revise as condições dos provedores.

## Operação e pendências

### Evolução de municípios e acompanhamento

Localidades vêm da API oficial do [IBGE](https://servicodados.ibge.gov.br/api/docs/localidades), com cache de 24 horas e uso da última lista oficial disponível se a API ficar indisponível. Nenhum nome é criado pelo sistema. Recentes são persistidos no banco. O backend valida correspondência entre ID, nome e UF antes de uma busca real.

Resultados temporários agora têm ações diretas para o fluxo comercial, mas dados permanentes ainda exigem verificação independente. Campos sugeridos precisam ser revisados e confirmados pelo administrador. O sistema não deduz WhatsApp ativo apenas por haver telefone.

O perfil tem URL protegida própria. Notas são salvas com debounce de 700ms e no blur, com flush ao voltar pelo perfil e indicação de erro; o navegador avisa se houver notas pendentes antes de sair. Tarefas guardam instante UTC e são exibidas no fuso local. Não há lembrete automático. Recusas continuam prevalecendo sobre alterações de etapa.

Mensagens e prompts podem ser preparados por modelos locais identificados ou pela OpenAI configurada. Prompts gerados ainda são rascunhos: só entram no histórico após salvar. Revisões preservam versões anteriores; marcar início gera uma tarefa de execução manual, sem criar um site fictício. O histórico de prompts é removido com o cadastro e incluído na exportação privada.

Sem chaves, CRM, fila, contadores, análises locais, importação, tarefas, relatórios e fila de geração funcionam. Google/Brave/Meta/OpenAI/Supabase e execução de geração precisam de configuração e testes na conta real. Não existe verificação automática de qualidade de sites, leitura de faturas, envio sem revisão ou publicação de clientes. O status de integração configurada indica presença de variáveis; não representa teste bem-sucedido.

Backups: configure snapshots criptografados do volume SQLite (use a API de backup ou pare o serviço antes da cópia; WAL deve ser considerado). No Supabase, habilite backups e PITR conforme seu plano, teste restauração em ambiente separado. Exporte dados do CRM pelo painel quando necessário. A exportação não substitui um backup de recuperação. Defina política de retenção e faça revisão periódica de análises e eventos.
