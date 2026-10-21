# Geração de sites: contrato e operação

## Disponível nesta versão

O dashboard cria tarefas persistentes e registra briefing, revisões, estados, verificações, prévia, capturas e aprovação. Não há infraestrutura Docker ou credenciais Codex provisionadas neste computador. Sem worker, as tarefas permanecem aguardando geração. Isso não afeta o CRM ou WhatsApp pessoal.

`workers/provider.ts` define a interface `CodeGenerationProvider` e um adaptador HTTPS real. `workers/runner.ts` reivindica uma tarefa por vez e acompanha o provedor. `workers/codex-adapter.ts` fornece uma implementação real com o SDK oficial Codex para uso pelo provedor em container separado. Não se presume acesso programático ao aplicativo Codex do administrador.

## Configuração

No backend, configure `APP_URL`, `WORKER_TOKEN` (token aleatório longo), `GENERATOR_URL`, `GENERATOR_TOKEN` e `PREVIEW_ORIGIN` (HTTPS). Execute `npm run worker` em processo supervisor com essas variáveis. Credenciais de provedores devem vir do gerenciador de segredos, nunca de URLs ou argumentos de comando.

O worker chama:

- `POST /api/worker/claim`: recebe uma tarefa e sua concessão de 20 minutos.
- `POST /api/worker/callback`: registra fases reais, autenticado por `Authorization: Bearer <WORKER_TOKEN>`.

O adaptador remoto chama `POST <GENERATOR_URL>/jobs` com `{id,idempotencyKey,brief,revision?}` e recebe `{jobId}`. O provedor deve deduplicar pela chave de idempotência e, em revisões, criar uma nova tentativa vinculada ao mesmo projeto. Em seguida, `GET /jobs/<jobId>` retorna:

```json
{
  "status": "ready",
  "previewUrl": "https://sua-origem-privada.example/projetos/id",
  "desktopScreenshot": "https://sua-origem-privada.example/projetos/id/desktop.png",
  "mobileScreenshot": "https://sua-origem-privada.example/projetos/id/mobile.png",
  "checks": ["HTML validado", "Fluxo de contato verificado", "Desktop e mobile revisados"]
}
```

Estados: `generating`, `installing`, `testing`, `preview`, `ready`, `failed`. O provedor precisa manter cada fase visível até ser observada; não pule fases. Para sites estáticos sem dependências, a fase de instalação deve validar explicitamente que não há dependências a instalar, sem inventar execução de instalação. Erros não devem conter segredos ou conteúdo de conversas. O runner limita cada tentativa a 18 minutos. Concessões expiradas falham sem repetição automática de trabalho faturável. Cada revisão deve usar um `idempotencyKey` novo por tentativa.

## Isolamento obrigatório do provedor

Implemente o serviço remoto em uma máquina/conta separada, com uma sandbox descartável por tarefa. Nunca monte o diretório da aplicação, banco, `.env`, socket Docker ou chaves GitHub no container gerado. Use usuário não root, filesystem base somente leitura, volume temporário limitado para `/work/output`, limites de CPU/memória/PIDs/tempo e política de saída restrita ao provedor oficial. O SDK recebe somente a chave necessária e o modelo configurado por `CODEX_MODEL`.

O adaptador Codex incluído retorna no máximo três arquivos estáticos via schema e não solicita comandos ao agente. Ele recusa execução fora de container Linux e fora de `/work/output`; essa verificação complementa o isolamento da infraestrutura, não o substitui. Execute validação e captura em uma segunda sandbox offline e sem credenciais: HTML/CSS/JS gerados são dados não confiáveis. Não execute código gerado no servidor principal.

Para publicar a prévia, use origem separada, sem cookies do CRM, autenticada por gateway de acesso (ex.: Cloudflare Access). O backend valida a origem dos links, mas não consegue garantir que o gateway do provedor foi configurado. A proteção de acesso e as capturas são responsabilidade do provedor e devem ser testadas antes de operar. Configure CSP restrita e sandbox de renderização para evitar requisições externas, navegação abusiva e exfiltração.

Não há endpoints de formulário falso no adaptador: se um formulário real for necessário, o provedor deve configurar destino autorizado, validação, rate limiting e proteção contra abuso antes de considerar a geração pronta. Sem destino, o site deve usar somente contato confirmado. Nenhuma foto, depoimento ou certificação é inventada.

## Aprovação e compartilhamento

O callback só aceita “Aguardando aprovação” com URL privada, capturas desktop/mobile e verificações. A transição “Aprovado” é exclusiva do administrador autenticado. “Enviado” exige aprovação e consentimento e é um registro de compartilhamento manual, sem envio automático. Não existe deploy de cliente em produção.

## Fontes oficiais

- [Codex SDK](https://developers.openai.com/codex/sdk/)
- [Políticas Places](https://developers.google.com/maps/documentation/places/web-service/policies)
- [Text Search New](https://developers.google.com/maps/documentation/places/web-service/text-search)
- [Funções Supabase](https://supabase.com/docs/guides/database/functions)

Chamadas externas de geração, instalação, captura e publicação ainda precisam de testes de aceitação no provedor escolhido. Testes locais validam contratos e estados; não comprovam geração real sem infraestrutura.
