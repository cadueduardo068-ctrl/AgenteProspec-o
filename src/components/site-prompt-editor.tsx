'use client';
import { useEffect, useRef, useState } from 'react';
import { Sparkles, Clipboard, Save, RefreshCw, Play, History, Loader2, Pencil } from 'lucide-react';
import type { Company, SitePrompt } from '@/lib/domain';
import { request, type WorkspaceAction, type WorkspaceData } from './client-api';
import Dialog from './dialog';
export default function SitePromptEditor({
  company,
  inspirationId: initialInspiration,
  data,
  close,
  action,
  notify,
  busy,
}: {
  company: Company;
  inspirationId?: string;
  data: WorkspaceData;
  close: () => void;
  action: WorkspaceAction;
  notify: (s: string) => void;
  busy: boolean;
}) {
  const history = data.prompts
    .filter((p) => p.companyId === company.id)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [inspirationId, setInspirationId] = useState(
    initialInspiration || history[0]?.inspirationId,
  );
  const [generatedInspiration, setGeneratedInspiration] = useState(history[0]?.inspirationId);
  const [text, setText] = useState(history[0]?.text || '');
  const [method, setMethod] = useState<'template' | 'openai'>(history[0]?.method || 'template');
  const [plan, setPlan] = useState<SitePrompt['plan']>(history[0]?.plan || 'landing page');
  const [id, setId] = useState<string | undefined>(history[0]?.id);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const once = useRef(false);
  async function generate() {
    setLoading(true);
    try {
      const result = await request<{
        text: string;
        method: 'template' | 'openai';
        plan: SitePrompt['plan'];
      }>('site-prompts/generate', 'POST', { companyId: company.id, inspirationId });
      setText(result.text);
      setGeneratedInspiration(inspirationId);
      setMethod(result.method);
      setPlan(result.plan);
      setId(undefined);
      setEditing(false);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!once.current) {
      once.current = true;
      if (!history.length || initialInspiration) void generate();
    }
  }, []);
  async function save() {
    const result = await action(
      'site-prompts',
      'POST',
      {
        companyId: company.id,
        text,
        method,
        plan,
        inspirationId: generatedInspiration,
        ...(id ? { id } : {}),
      },
      'Prompt salvo no histórico da empresa.',
    );
    if (result?.id) {
      setId(String(result.id));
      setText(String(result.text));
    }
    return result;
  }
  const saved = data.prompts.find((p) => p.id === id);
  const edited = saved && saved.text !== text;
  return (
    <Dialog title="Prompt para criação do site" close={close} wide tone="site">
      <div className="stack">
        <section className="prompt-company-summary">
          <div className="section-heading">
            <h3>{company.name}</h3>
            <span className={`badge ${company.verified ? 'green' : ''}`}>
              {company.verified ? 'Cadastro verificado' : 'Registro provisório · não verificado'}
            </span>
          </div>
          <p className="muted">
            O rascunho usa os dados disponíveis. Campos ausentes continuam como pendências.
          </p>
          <dl className="prompt-facts">
            {Object.entries({
              Segmento: company.niche,
              Localização: [company.city, company.state].filter(Boolean).join(' / '),
              Endereço: company.address,
              Telefone: company.phone,
              Site: company.website,
              Serviços: company.services,
              Fonte: company.source,
            }).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  {label === 'Fonte' && value ? (
                    <a href={value} target="_blank" rel="noreferrer">
                      Consultar fonte observada
                    </a>
                  ) : (
                    value || 'Não informado'
                  )}
                  <small>
                    {value
                      ? company.verified ||
                        (label === 'Telefone' &&
                          company.contactVerification?.phone === company.phone)
                        ? 'Confirmado pelo administrador'
                        : 'Não confirmado'
                      : 'Pendente · não bloqueia a geração'}
                  </small>
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <label>
          Inspiração visual
          <select
            value={inspirationId || ''}
            onChange={(e) => setInspirationId(e.target.value || undefined)}
          >
            <option value="">Direção do nicho, sem referência</option>
            {data.inspirations.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <small className="muted">Após trocar, regenere o prompt para aplicar o design.</small>
        </label>
        <div className="prompt-toolbar">
          <div>
            <span className="badge blue">{plan}</span>
            <span className="badge">
              {method === 'openai' ? 'Refinado com IA' : 'Briefing estruturado · sem IA'}
            </span>
          </div>
          <button
            className="btn primary"
            disabled={loading || busy}
            onClick={() => void generate()}
          >
            <Sparkles size={14} />
            Gerar prompt do site
          </button>
        </div>
        <p className="muted">
          Briefing com o estado de verificação de cada empresa. Informações ausentes aparecem como
          pendências; público e direção visual são sugestões para revisão.
        </p>
        {loading ? (
          <div className="prompt-loading" role="status" aria-live="polite">
            <Loader2 className="spin" size={24} />
            <p>Preparando um briefing específico para {company.name}…</p>
          </div>
        ) : (
          <label>
            {editing ? 'Editar prompt' : 'Prompt completo para o Codex'}
            <textarea
              className="prompt-textarea"
              aria-label="Prompt personalizado do site"
              value={text}
              readOnly={!editing}
              maxLength={30000}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
            />
          </label>
        )}
        <div className="button-row">
          <button
            className="btn"
            disabled={loading || busy || !text}
            onClick={() => void generate()}
          >
            <RefreshCw size={15} />
            Regenerar
          </button>
          <button
            className="btn"
            disabled={!text || loading}
            onClick={() => setEditing((value) => !value)}
          >
            <Pencil size={15} />
            {editing ? 'Concluir edição' : 'Editar'}
          </button>
          <button
            className="btn"
            disabled={!text || loading}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                notify('Prompt copiado. Revise o ambiente antes de executar no Codex.');
              } catch {
                notify('Selecione o texto e copie manualmente.');
              }
            }}
          >
            <Clipboard size={15} />
            Copiar para o Codex
          </button>
          <button
            className="btn primary"
            disabled={loading || busy || text.trim().length < 200}
            onClick={() => void save()}
          >
            <Save size={15} />
            Salvar no CRM
          </button>
          <button
            className="btn"
            disabled={loading || busy || !saved || !!edited || !!saved.startedAt}
            onClick={() =>
              void action(
                `site-prompts/${id}/start`,
                'POST',
                {},
                'Demonstração marcada como iniciada. Execução no Codex ainda é manual.',
              )
            }
          >
            <Play size={15} />
            {saved?.startedAt ? 'Demonstração iniciada' : 'Marcar demonstração como iniciada'}
          </button>
        </div>
        <small className="muted">
          Salvar não gera nem publica um site. Iniciar registra a etapa e cria uma tarefa para
          executar o prompt em ambiente isolado.
        </small>
        <div className="section-heading">
          <h3>
            <History size={14} /> Histórico de prompts de sites
          </h3>
          <span className="badge">{history.length} versões</span>
        </div>
        <div className="prompt-history-list">
          {history.map((p) => (
            <button
              key={p.id}
              className={id === p.id ? 'selected' : ''}
              onClick={() => {
                setId(p.id);
                setText(p.text);
                setPlan(p.plan);
                setMethod(p.method);
                setInspirationId(p.inspirationId);
                setGeneratedInspiration(p.inspirationId);
              }}
            >
              <Sparkles size={15} />
              <span>
                {p.plan}
                <small>
                  {new Date(p.createdAt).toLocaleString('pt-BR')} ·{' '}
                  {p.method === 'openai' ? 'IA' : 'estruturado'}
                </small>
              </span>
              {p.startedAt && <span className="badge green">Iniciada</span>}
            </button>
          ))}
          {!history.length && (
            <p className="muted">Revise e salve o primeiro prompt para iniciar seu histórico.</p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
