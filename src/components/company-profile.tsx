'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  MessagesSquare,
  MessageCircle,
  Code2,
  Pencil,
  Sparkles,
  MapPin,
  Phone,
  Globe,
  ExternalLink,
  Check,
  Loader2,
  Clock3,
  Plus,
  ShieldCheck,
  ListTodo,
  FileText,
  Ban,
  Trash2,
  UserRound,
} from 'lucide-react';
import { stages, score, type Company, type Analysis } from '@/lib/domain';
import { whatsappPhone } from '@/lib/phones';
import { request, type WorkspaceAction, type WorkspaceData } from './client-api';
import { commercialStageLabel, nextAction } from './contacted-companies';
import { commercialContactStatus } from '@/lib/content-templates';
import Dialog from './dialog';
export default function CompanyProfile({
  company: c,
  data,
  close,
  action,
  refresh,
  notify,
  busy,
  compose,
  prompt,
  verify,
  edit,
}: {
  company: Company;
  data: WorkspaceData;
  close: () => void;
  action: WorkspaceAction;
  refresh: () => Promise<void>;
  notify: (s: string) => void;
  busy: boolean;
  compose: () => void;
  prompt: () => void;
  verify: () => void;
  edit: () => void;
}) {
  const [notes, setNotes] = useState(c.notes);
  const saved = useRef(c.notes);
  const draft = useRef(c.notes);
  const [saving, setSaving] = useState<'saved' | 'pending' | 'saving' | 'error'>('saved');
  const [services, setServices] = useState(c.services);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [answer, setAnswer] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [confirm, setConfirm] = useState<'delete' | 'optout' | null>(null);
  const savingPromise = useRef<Promise<boolean> | null>(null);
  const mounted = useRef(true);
  const deleting = useRef(false);
  const [activeTab, setActiveTab] = useState('overview');
  draft.current = notes;
  useEffect(() => {
    if (draft.current === saved.current && c.notes !== saved.current) {
      saved.current = c.notes;
      setNotes(c.notes);
    }
  }, [c.notes]);
  async function saveNotes(): Promise<boolean> {
    if (savingPromise.current) {
      await savingPromise.current;
      if (draft.current !== saved.current) return saveNotes();
      return true;
    }
    const value = draft.current;
    if (value === saved.current) return true;
    setSaving('saving');
    const promise = (async () => {
      try {
        await request(`companies/${c.id}`, 'PATCH', { notes: value });
        saved.current = value;
        if (mounted.current) setSaving(draft.current === value ? 'saved' : 'pending');
        await refresh();
        return true;
      } catch {
        if (mounted.current) setSaving('error');
        return false;
      } finally {
        savingPromise.current = null;
      }
    })();
    savingPromise.current = promise;
    return promise;
  }
  useEffect(() => {
    if (notes === saved.current) return;
    setSaving('pending');
    const timer = setTimeout(() => void saveNotes(), 700);
    return () => clearTimeout(timer);
  }, [notes]);
  useEffect(() => {
    mounted.current = true;
    const unload = (e: BeforeUnloadEvent) => {
      if (draft.current !== saved.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', unload);
    return () => {
      mounted.current = false;
      window.removeEventListener('beforeunload', unload);
      if (!deleting.current && draft.current !== saved.current)
        void fetch(`/api/companies/${c.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: draft.current }),
          keepalive: true,
        });
    };
  }, [c.id]);
  async function leave() {
    if (await saveNotes()) close();
    else notify('As anotações ainda não foram salvas. Tente novamente antes de sair.');
  }
  const opportunity = score(c);
  const phone = whatsappPhone(c.phone);
  const pending = data.contacts.find((item) => item.companyId === c.id && item.status === 'aberto');
  const events = data.events
    .filter((e) => e.companyId === c.id)
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at));
  const tasks = data.tasks
    .filter((t) => t.companyId === c.id)
    .slice()
    .sort(
      (a, b) => Number(a.done) - Number(b.done) || (a.dueAt || 'z').localeCompare(b.dueAt || 'z'),
    );
  async function analyze() {
    setAnalyzing(true);
    try {
      const result = await request<Analysis>('analyses', 'POST', {
        companyId: c.id,
        text: answer,
        source: 'texto colado',
        retainText: false,
      });
      setAnalysis(result);
      setAnswer('');
      await refresh();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }
  return (
    <section className="company-profile-page">
      <div className="profile-breadcrumb">
        <button className="text-btn" onClick={() => void leave()}>
          <ArrowLeft size={15} />
          Voltar ao workspace
        </button>
        <span>Empresas / Acompanhamento comercial</span>
      </div>
      <header className="company-profile-heading">
        <div className="detail-identity">
          <span className="company-initial large">{c.name.slice(0, 2).toUpperCase()}</span>
          <div>
            <span className="eyebrow">
              {c.verified
                ? 'PERFIL COMERCIAL · VERIFICADO'
                : 'REGISTRO PROVISÓRIO · DADOS NÃO VERIFICADOS'}
            </span>
            <h1>{c.name}</h1>
            <p>
              {c.niche} · {c.city}, {c.state}
            </p>
          </div>
        </div>
        <div className="button-row">
          <button className="btn" onClick={edit}>
            <Pencil size={14} />
            Editar empresa
          </button>
          <button
            className="btn whatsapp"
            disabled={c.optedOut || c.archived}
            title="Criar texto comercial para revisão"
            onClick={compose}
          >
            <MessageCircle size={16} />
            Gerar mensagem para WhatsApp
          </button>
          <button className="btn primary" disabled={c.optedOut || c.archived} onClick={prompt}>
            <Code2 size={16} />
            Gerar prompt do site
          </button>
          {!c.verified && (
            <button className="btn" onClick={verify}>
              <ShieldCheck size={15} />
              Verificar informações
            </button>
          )}
        </div>
      </header>
      <div className="profile-summary-strip">
        <span className={`badge ${c.optedOut ? 'red' : 'blue'}`}>
          {commercialStageLabel(c.stage)}
        </span>
        <span>{opportunity.value}/100 · potencial estimado</span>
        <span>Atualizado em {new Date(c.updatedAt).toLocaleString('pt-BR')}</span>
        <span>
          {c.lastContactAt
            ? `Último envio confirmado: ${new Date(c.lastContactAt).toLocaleString('pt-BR')}`
            : 'Nenhum envio confirmado'}
        </span>
      </div>
      {pending && (
        <div className="notice amber">
          <Clock3 size={18} />
          <div>
            <strong>WhatsApp aberto — envio não confirmado</strong>
            <p>Você precisa informar se enviou a mensagem pelo WhatsApp.</p>
            <div className="button-row">
              <button
                className="btn primary"
                disabled={busy}
                onClick={() =>
                  void action(
                    'manual/confirm',
                    'POST',
                    { contactId: pending.id },
                    'Mensagem enviada — confirmação manual registrada.',
                  )
                }
              >
                <Check size={14} />
                Confirmar que enviei
              </button>
              <button
                className="btn"
                disabled={busy}
                onClick={() =>
                  void action(
                    'manual/cancel',
                    'POST',
                    { contactId: pending.id },
                    'Abertura corrigida. Nenhum envio contabilizado.',
                  )
                }
              >
                Não enviei
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="profile-tabs" role="tablist" aria-label="Seções do perfil">
        {[
          { id: 'overview', label: 'Visão do cliente' },
          { id: 'history', label: 'Histórico comercial' },
          { id: 'responses', label: 'Respostas e análise' },
          { id: 'commercial', label: 'Mensagens comerciais' },
          { id: 'prompts', label: 'Prompts de sites' },
        ].map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="profile-body">
        <aside className="stack">
          <section className="panel profile-panel stack">
            <h2>Informações da empresa</h2>
            <div className="detail-facts">
              <p>
                <MapPin size={15} />
                {c.address || `${c.city}, ${c.state} · endereço não confirmado`}
              </p>
              <p>
                <Phone size={15} />
                {c.phone
                  ? c.phone.startsWith('+')
                    ? c.phone
                    : `+${c.phone}`
                  : 'Telefone desconhecido'}
              </p>
              <p>
                <Globe size={15} />
                {c.website ? (
                  <a href={c.website} target="_blank" rel="noreferrer">
                    Canal digital identificado
                    <ExternalLink size={12} />
                  </a>
                ) : (
                  'Site próprio não identificado'
                )}
              </p>
              <p>
                <ShieldCheck size={15} />
                {c.source ? (
                  <a href={c.source} target="_blank" rel="noreferrer">
                    {c.verified ? 'Fonte de verificação' : 'Fonte observada · não verificada'}
                    <ExternalLink size={12} />
                  </a>
                ) : (
                  'Fonte não informada · registro provisório'
                )}
              </p>
            </div>
            <label>
              Status comercial
              <select
                value={c.stage}
                disabled={busy || c.optedOut}
                onChange={(e) =>
                  void action(`companies/${c.id}`, 'PATCH', { stage: e.target.value })
                }
              >
                {stages.map((s) => (
                  <option
                    value={s}
                    key={s}
                    disabled={
                      ['WhatsApp aberto', 'Envio confirmado', 'Não contatar'].includes(s) &&
                      s !== c.stage
                    }
                  >
                    {commercialStageLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Acompanhamento
              <select
                value={c.followup || 'desconhecido'}
                disabled={busy}
                onChange={(e) =>
                  void action(`companies/${c.id}`, 'PATCH', { followup: e.target.value })
                }
              >
                {['desconhecido', 'aguardando resposta', 'resposta recebida', 'sem resposta'].map(
                  (s) => (
                    <option key={s}>{s}</option>
                  ),
                )}
              </select>
            </label>
            <div className="profile-next-action">
              <span className="eyebrow">PRÓXIMO PASSO</span>
              <p>{nextAction(c, data)}</p>
            </div>
            <button
              className="text-btn"
              onClick={() =>
                void action(
                  `companies/${c.id}`,
                  'PATCH',
                  { human: !c.human },
                  c.human
                    ? 'Atendimento humano encerrado.'
                    : 'Atendimento transferido ao responsável.',
                )
              }
            >
              <UserRound size={14} />
              {c.human ? 'Atendimento humano ativo' : 'Transferir para o responsável'}
            </button>
          </section>
          <section className="panel profile-panel stack">
            <h2>Autorização e privacidade</h2>
            {c.optedOut ? (
              <div className="notice error">
                <Ban size={17} />
                Não contatar. Recusa registrada.
              </div>
            ) : c.consent ? (
              <div className="notice green">
                <ShieldCheck size={17} />
                <div>
                  <strong>Autorização registrada</strong>
                  <p>{c.consent.evidence}</p>
                  <small>{new Date(c.consent.at).toLocaleString('pt-BR')}</small>
                </div>
              </div>
            ) : (
              <>
                <p className="muted">Número e autorização ainda precisam de confirmação.</p>
                <button className="btn" onClick={compose} disabled={busy}>Conferir contato</button>
              </>
            )}
            <button
              className="text-btn"
              disabled={busy}
              onClick={() =>
                void action(
                  'manual/archive',
                  'POST',
                  { companyId: c.id },
                  c.archived ? 'Empresa restaurada.' : 'Empresa arquivada.',
                )
              }
            >
              {c.archived ? 'Restaurar empresa' : 'Arquivar empresa'}
            </button>
            {!c.optedOut && (
              <button className="text-btn danger" onClick={() => setConfirm('optout')}>
                Registrar recusa e não contatar
              </button>
            )}
            <button className="text-btn danger" onClick={() => setConfirm('delete')}>
              <Trash2 size={13} />
              Excluir cadastro e histórico
            </button>
          </section>
        </aside>
        <div className="stack">
          {activeTab === 'overview' && (
            <>
              <section className="panel profile-panel stack">
                <div className="section-heading">
                  <h2>Anotações</h2>
                  <span
                    className={`save-status ${saving === 'error' ? 'error' : ''}`}
                    role="status"
                  >
                    {saving === 'saving' ? (
                      <Loader2 size={13} className="spin" />
                    ) : saving === 'saved' ? (
                      <Check size={13} />
                    ) : (
                      <Clock3 size={13} />
                    )}
                    {
                      {
                        saved: 'Salvo automaticamente',
                        pending: 'Alterações pendentes',
                        saving: 'Salvando…',
                        error: 'Falha ao salvar',
                      }[saving]
                    }
                  </span>
                </div>
                <textarea
                  aria-label="Anotações da empresa"
                  value={notes}
                  maxLength={10000}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => void saveNotes()}
                  placeholder="Contexto, dúvidas do cliente e próximos passos…"
                  style={{ minHeight: 145 }}
                />
                {saving === 'error' && (
                  <button className="text-btn" onClick={() => void saveNotes()}>
                    Tentar salvar novamente
                  </button>
                )}
                <label>
                  Serviços confirmados
                  <textarea
                    value={services}
                    maxLength={3000}
                    onChange={(e) => setServices(e.target.value)}
                    placeholder="Não invente serviços. Confirme com a empresa."
                  />
                </label>
                <button
                  className="btn"
                  disabled={busy || services === c.services}
                  onClick={() =>
                    void action(
                      `companies/${c.id}`,
                      'PATCH',
                      { services },
                      'Serviços confirmados atualizados.',
                    )
                  }
                >
                  Salvar serviços
                </button>
              </section>
              <section className="panel profile-panel stack">
                <div className="section-heading">
                  <h2>Próximas ações</h2>
                  <ListTodo size={17} />
                </div>
                {tasks.map((t) => (
                  <div className={`profile-task ${t.done ? 'done' : ''}`} key={t.id}>
                    <button
                      aria-label={t.done ? 'Reabrir tarefa' : 'Concluir tarefa'}
                      className="icon-btn"
                      disabled={busy}
                      onClick={() => void action(`tasks/${t.id}`, 'PATCH')}
                    >
                      {t.done ? <Check size={16} /> : <Clock3 size={16} />}
                    </button>
                    <div>
                      <strong>{t.title}</strong>
                      {t.description && <p>{t.description}</p>}
                      <small>
                        {t.dueAt ? new Date(t.dueAt).toLocaleString('pt-BR') : 'Sem data definida'}{' '}
                        · {t.done ? 'Concluída' : 'Pendente'}
                      </small>
                    </div>
                  </div>
                ))}
                <form
                  className="stack"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const due = String(new FormData(form).get('dueAtLocal') || '');
                    const result = await action(
                      'tasks',
                      'POST',
                      {
                        companyId: c.id,
                        title,
                        description,
                        ...(due ? { dueAt: new Date(due).toISOString() } : {}),
                      },
                      'Próxima ação agendada. Nenhum lembrete automático foi enviado.',
                    );
                    if (result) {
                      setTitle('');
                      setDescription('');
                      form.reset();
                    }
                  }}
                >
                  <label>
                    Descrição da próxima ação
                    <input
                      required
                      minLength={3}
                      maxLength={300}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex.: Conversar sobre a demonstração"
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      Data e hora locais
                      <input type="datetime-local" name="dueAtLocal" />
                    </label>
                    <label>
                      Detalhes
                      <input
                        maxLength={3000}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </label>
                  </div>
                  <button className="btn" disabled={busy}>
                    <Plus size={15} />
                    Adicionar próxima ação
                  </button>
                </form>
              </section>
              <section className="panel profile-panel stack">
                <h2>Potencial comercial estimado</h2>
                {opportunity.reasons.map((r) => (
                  <div className="report-row" key={r.label}>
                    <span>{r.label}</span>
                    <strong>+{r.points}</strong>
                  </div>
                ))}
                <small className="muted">
                  Estimativa transparente. Não garante interesse ou compra.
                </small>
              </section>
            </>
          )}
          {activeTab === 'history' && (
            <section className="panel profile-panel stack">
              <h2>Linha do tempo comercial</h2>
              {events.map((e) => (
                <article className="profile-timeline-event" key={e.id}>
                  <span>
                    <Clock3 size={15} />
                  </span>
                  <div>
                    <strong>{e.title}</strong>
                    <small>
                      {new Date(e.at).toLocaleString('pt-BR')} · {e.source}
                    </small>
                  </div>
                </article>
              ))}
            </section>
          )}
          {activeTab === 'responses' && (
            <section className="panel profile-panel stack">
              <h2>Registrar resposta do cliente</h2>
              <p className="muted">
                Cole somente o trecho recebido. O texto original não será guardado; o resumo fica no
                histórico. Eventos do WhatsApp pessoal dependem de confirmação manual.
              </p>
              <textarea
                aria-label="Resposta recebida no perfil"
                minLength={2}
                maxLength={20000}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Cole a resposta comercial recebida…"
              />
              <button
                className="btn primary"
                disabled={analyzing || answer.trim().length < 2}
                onClick={() => void analyze()}
              >
                {analyzing ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />}
                Analisar resposta
              </button>
              {analysis && (
                <div className="analysis-result">
                  <span className="badge blue">{analysis.intent}</span>
                  <span className="badge">
                    {Math.round(analysis.confidence * 100)}% · estimativa
                  </span>
                  <span className="badge">
                    {analysis.method === 'openai' ? 'OpenAI' : 'Regras locais · sem IA'}
                  </span>
                  <p>{analysis.summary}</p>
                  <p>
                    <strong>Próxima ação:</strong> {analysis.nextAction}
                  </p>
                  <p>
                    <strong>Etapa sugerida:</strong>{' '}
                    {analysis.suggestedStage || 'Confirmar intenção, sem mudar etapa'}
                  </p>
                  <textarea readOnly value={analysis.suggestion} />
                  <button
                    className="btn primary"
                    disabled={busy || !!data.analyses.find((a) => a.id === analysis.id)?.applied}
                    onClick={() =>
                      void action(
                        `analyses/${analysis.id}`,
                        'PATCH',
                        undefined,
                        'Análise aprovada e histórico atualizado.',
                      )
                    }
                  >
                    Aprovar atualização do CRM
                  </button>
                </div>
              )}
              {data.analyses
                .filter((a) => a.companyId === c.id)
                .slice()
                .reverse()
                .map((a) => (
                  <article className="profile-answer" key={a.id}>
                    <span className="badge">
                      {a.intent} · {a.applied ? 'aprovada' : 'aguardando revisão'}
                    </span>
                    <p>{a.summary}</p>
                    <small>
                      {new Date(a.at).toLocaleString('pt-BR')} · {a.source}
                    </small>
                    <div className="button-row">
                      {!a.applied && (
                        <button
                          className="text-btn"
                          disabled={busy}
                          onClick={() => void action(`analyses/${a.id}`, 'PATCH')}
                        >
                          Aprovar atualização
                        </button>
                      )}
                      <button
                        className="text-btn danger"
                        disabled={busy}
                        onClick={() => void action(`analyses/${a.id}`, 'DELETE')}
                      >
                        Excluir análise
                      </button>
                    </div>
                  </article>
                ))}
            </section>
          )}
          {activeTab === 'commercial' && (
            <section className="panel profile-panel stack commercial-history">
              <div className="section-heading">
                <h2>Mensagens comerciais</h2>
                <MessageCircle size={17} />
              </div>
              <p className="muted">
                Textos para conversar com o cliente. As versões são independentes dos prompts
                técnicos e só registram envio após sua confirmação.
              </p>
              <button
                className="btn whatsapp"
                onClick={compose}
                disabled={c.optedOut || c.archived}
              >
                <MessageCircle size={16} />
                Gerar mensagem para WhatsApp
              </button>
              {data.commercialMessages
                .filter((m) => m.companyId === c.id)
                .slice()
                .reverse()
                .map((m) => (
                  <article className="profile-answer" key={m.id}>
                    <span className="badge green">{m.purpose}</span>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{m.text}</p>
                    <small>
                      {new Date(m.createdAt).toLocaleString('pt-BR')} ·{' '}
                      {m.method === 'openai' ? 'IA' : 'Modelo local'} ·{' '}
                      {commercialContactStatus(data.contacts, c.id, m.text, m.id)}
                    </small>
                    <button className="text-btn" onClick={compose}>
                      Abrir histórico, editar e copiar mensagem
                    </button>
                  </article>
                ))}
              {!data.commercialMessages.some((m) => m.companyId === c.id) && (
                <p className="muted">Nenhuma mensagem comercial gerada ainda.</p>
              )}
            </section>
          )}
          {activeTab === 'prompts' && (
            <section className="panel profile-panel stack">
              <div className="section-heading">
                <h2>Prompts de sites</h2>
                <FileText size={17} />
              </div>
              <p className="muted">
                Instruções técnicas para o Codex, com dados confirmados e pendências identificadas,
                sem inventar informações da empresa.
              </p>
              <button className="btn primary" onClick={prompt}>
                <Sparkles size={16} />
                Gerar ou editar prompt do site
              </button>
              {data.prompts
                .filter((p) => p.companyId === c.id)
                .slice()
                .reverse()
                .map((p) => (
                  <article className="profile-answer" key={p.id}>
                    <span className="badge blue">{p.plan}</span>
                    <span className="badge">
                      {p.startedAt
                        ? 'Demonstração iniciada · execução manual'
                        : 'Prompt salvo · site não gerado'}
                    </span>
                    <p>{p.text.slice(0, 200)}…</p>
                    <small>
                      {new Date(p.createdAt).toLocaleString('pt-BR')} ·{' '}
                      {p.method === 'openai' ? 'Refinado por IA' : 'Briefing estruturado'}
                    </small>
                    <button className="text-btn" onClick={prompt}>
                      Abrir histórico e copiar
                    </button>
                  </article>
                ))}
              <button
                className="btn"
                disabled={busy || c.optedOut}
                onClick={() =>
                  void action(
                    'jobs',
                    'POST',
                    { companyId: c.id, confirmed: true },
                    'Projeto adicionado à fila. Execução depende do worker isolado configurado.',
                  )
                }
              >
                Solicitar geração ao worker configurado
              </button>
            </section>
          )}
        </div>
      </div>
      {confirm && (
        <Dialog
          title={
            confirm === 'delete'
              ? 'Excluir cadastro e histórico?'
              : 'Registrar recusa e bloquear contato?'
          }
          close={() => setConfirm(null)}
        >
          <div className="stack">
            <p className="muted">
              {confirm === 'delete'
                ? 'Os dados e o histórico serão removidos. Exclusões de contato e o ledger mínimo do limite diário serão preservados.'
                : 'Não será possível iniciar novos contatos com este telefone. Confirme apenas uma recusa verdadeira.'}
            </p>
            <div className="button-row">
              <button className="btn" onClick={() => setConfirm(null)}>
                Cancelar
              </button>
              <button
                className="btn danger"
                disabled={busy}
                onClick={async () => {
                  if (confirm === 'delete') deleting.current = true;
                  const result = await action(
                    `companies/${c.id}${confirm === 'optout' ? '/optout' : ''}`,
                    confirm === 'delete' ? 'DELETE' : 'POST',
                  );
                  if (result) {
                    setConfirm(null);
                    if (confirm === 'delete') close();
                  } else deleting.current = false;
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}
