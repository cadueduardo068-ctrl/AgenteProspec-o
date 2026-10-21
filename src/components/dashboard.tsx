'use client';
import { useEffect, useState, useCallback, type FormEvent, type ReactNode } from 'react';
import {
  LayoutDashboard,
  Radar,
  Building2,
  Sparkles,
  MessagesSquare,
  PanelsTopLeft,
  GitBranch,
  ChartNoAxesCombined,
  Settings,
  Zap,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Bell,
  Menu,
  X,
  LogOut,
  CircleHelp,
  ShieldCheck,
  Globe,
  Check,
  Circle,
  Clock3,
  Send,
  Ban,
  ExternalLink,
  Download,
  RefreshCw,
  Clipboard,
  Loader2,
  Filter,
  Users,
  Target,
  Trophy,
  CheckCheck,
  FileText,
  AlertCircle,
  KeyRound,
  ListTodo,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { stages, score, type State, type Company, type Analysis, jobStages } from '@/lib/domain';
import type { metrics } from '@/lib/metrics';
import type { integrations } from '@/lib/integrations';
import NicheSelector from './niche-selector';
import CitySelector from './city-selector';
import ContactComposer from './contact-composer';
import SitePromptEditor from './site-prompt-editor';
import CompanyProfile from './company-profile';
import ContactedCompanies from './contacted-companies';
import ResultCards, { type ResultAction, type PlaceResult } from './result-cards';
import type { Municipality } from '@/lib/localities';

type Data = Omit<State, 'exclusions' | 'webhookIds' | 'rateLimits'> & {
  metrics: ReturnType<typeof metrics>;
  integrations: ReturnType<typeof integrations>;
};
type Place = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  websiteUri?: string;
  internationalPhoneNumber?: string;
  googleMapsUri?: string;
  attributions?: { provider: string; providerUri: string }[];
};
const nav = [
  { id: 'overview', title: 'Visão geral', icon: LayoutDashboard },
  { id: 'prospect', title: 'Central de Prospecção', icon: Radar },
  { id: 'companies', title: 'Empresas encontradas', icon: Building2 },
  { id: 'opportunities', title: 'Oportunidades', icon: Sparkles },
  { id: 'queue', title: 'Fila de contatos', icon: ListTodo },
  { id: 'contacted', title: 'Empresas contatadas', icon: Users },
  { id: 'assistant', title: 'Assistente Comercial', icon: MessagesSquare },
  { id: 'sites', title: 'Sites gerados', icon: PanelsTopLeft },
  { id: 'funnel', title: 'Funil de vendas', icon: GitBranch },
  { id: 'reports', title: 'Relatórios', icon: ChartNoAxesCombined },
  { id: 'settings', title: 'Configurações', icon: Settings },
];
const date = (v: string) =>
  new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
async function api<T = Record<string, unknown>>(
  path: string,
  method = 'GET',
  data?: unknown,
): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Sua sessão expirou.');
  }
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'Não foi possível concluir.');
  return result;
}
function Empty({
  icon = <Radar size={26} />,
  title,
  text,
  action,
}: {
  icon?: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
function Badge({ children, tone = '' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', f);
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', f);
      document.body.style.overflow = before;
    };
  }, [close]);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? 'wide' : ''}`}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Fechar" onClick={close}>
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export default function Dashboard({ initialCompanyId }: { initialCompanyId?: string }) {
  const [tab, setTab] = useState(initialCompanyId ? 'contacted' : 'overview');
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [sidebar, setSidebar] = useState(false);
  const [selected, setSelected] = useState<string | null>(initialCompanyId || null);
  function select(id: string | null) {
    setSelected(id);
    window.history.pushState({}, '', id ? `/companies/${id}` : '/');
  }
  useEffect(() => {
    const update = () =>
      setSelected(
        window.location.pathname.startsWith('/companies/')
          ? window.location.pathname.split('/')[2]
          : null,
      );
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  const [add, setAdd] = useState(false);
  const [composeId, setComposeId] = useState<string | null>(null);
  const [promptId, setPromptId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [noSite, setNoSite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [help, setHelp] = useState(false);
  const [view, setView] = useState('cards');
  const [stageFilter, setStageFilter] = useState('');
  const [nicheFilter, setNicheFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [minScore, setMinScore] = useState(0);
  const [archived, setArchived] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setData(await api<Data>('state'));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 20_000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 6000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  async function action(
    path: string,
    method = 'POST',
    body?: unknown,
    success = 'Alteração salva.',
  ) {
    setBusy(true);
    try {
      const res = await api(path, method, body);
      await refresh();
      setToast(success);
      return res;
    } catch (e) {
      setToast((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  function navigate(id: string) {
    setTab(id);
    if (selected) select(null);
    setSidebar(false);
    setFilter('');
  }
  const company = data?.companies.find((c) => c.id === selected);
  const visible =
    data?.companies
      .filter(
        (c) =>
          !!c.archived === archived &&
          `${c.name} ${c.city} ${c.niche}`.toLowerCase().includes(filter.toLowerCase()) &&
          (!noSite || !c.website) &&
          (!stageFilter || c.stage === stageFilter) &&
          (!nicheFilter || c.niche === nicheFilter) &&
          (!cityFilter || c.city === cityFilter) &&
          score(c).value >= minScore &&
          (tab !== 'opportunities' || score(c).value >= 40),
      )
      .sort((a, b) =>
        tab === 'opportunities'
          ? score(b).value - score(a).value
          : b.createdAt.localeCompare(a.createdAt),
      ) || [];
  return (
    <div className="app-shell">
      {sidebar && <div className="sidebar-scrim" onClick={() => setSidebar(false)} />}
      <aside className={`sidebar ${sidebar ? 'open' : ''}`}>
        <a href="/" className="brand">
          <span className="brand-symbol">
            <Zap size={20} fill="currentColor" />
          </span>
          CADU<span className="brand-ai">AI</span>
        </a>
        <div className="workspace">
          <div className="avatar">C</div>
          <div>
            <strong>Meu workspace</strong>
            <small>Administrador</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          {nav
            .filter((n) => n.id !== 'settings')
            .map((n) => (
              <button
                key={n.id}
                className={`nav-item ${tab === n.id ? 'active' : ''}`}
                onClick={() => navigate(n.id)}
              >
                <n.icon size={18} />
                <span>{n.title}</span>
                {n.id === 'conversations' &&
                  !!data?.messages.filter((m) => m.direction === 'in').length && (
                    <b>{data.messages.filter((m) => m.direction === 'in').length}</b>
                  )}
                {n.id === 'prospect' && <span className="nav-new">NOVO</span>}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="assistant-card">
            <span className="assistant-orb">
              <Sparkles size={16} />
            </span>
            <strong>
              Seu próximo cliente
              <br />
              está lá fora.
            </strong>
            <p>
              Transforme oportunidades
              <br />
              em conexões de verdade.
            </p>
            <button onClick={() => navigate('prospect')}>
              Iniciar prospecção <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className={`nav-item ${tab === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('settings')}
          >
            <Settings size={18} />
            Configurações
          </button>
          <button className="nav-item" onClick={() => setHelp(true)}>
            <CircleHelp size={18} />
            Central de ajuda
            <ArrowUpRight size={13} />
          </button>
          <div className="profile">
            <div className="avatar small">C</div>
            <div>
              <strong>Administrador</strong>
              <small>Conta principal</small>
            </div>
            <button
              className="icon-btn"
              aria-label="Sair"
              onClick={async () => {
                await api('auth/logout', 'POST');
                window.location.href = '/login';
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-menu"
              aria-label="Abrir menu"
              onClick={() => setSidebar(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{nav.find((n) => n.id === tab)?.title}</strong>
          </div>
          <div className="topbar-actions">
            <span className="live-label">
              <i />
              Workspace ativo
            </span>
            <button
              className="icon-btn"
              aria-label="Atualizar dados"
              onClick={() => void refresh()}
            >
              <RefreshCw size={17} />
            </button>
            <button
              className="icon-btn notification-btn"
              aria-label="Atividades recentes"
              onClick={() => setShowActivity(true)}
            >
              <Bell size={18} />
              {!!data?.events.length && data.settings.notifications && <i />}
            </button>
            <div className="avatar small">C</div>
          </div>
        </header>
        <main className="content" inert={!!company}>
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    {tab === 'overview'
                      ? 'SEU CENTRO DE CRESCIMENTO'
                      : 'INTELIGÊNCIA EM CADA OPORTUNIDADE'}
                  </div>
                  <h1>
                    {tab === 'overview' ? 'Visão geral' : nav.find((n) => n.id === tab)?.title}
                    <span className="title-dot">.</span>
                  </h1>
                  <p>
                    {
                      (
                        {
                          overview: 'Um olhar claro sobre suas oportunidades e o que vem a seguir.',
                          prospect:
                            'Encontre empresas que podem se beneficiar de uma presença digital melhor.',
                          companies: 'Cada empresa é o começo de uma nova conexão.',
                          opportunities:
                            'Priorize com contexto. A pontuação é uma estimativa, não uma promessa.',
                          queue:
                            'Abordagens revisadas, envios humanos e acompanhamento organizado.',
                          contacted:
                            'Conversas abertas, respostas e próximos passos em um único lugar.',
                          assistant:
                            'Interprete respostas e aprove os próximos passos com contexto.',
                          sites: 'Da primeira ideia a uma demonstração aprovada por você.',
                          funnel: 'Acompanhe cada oportunidade, do primeiro encontro à venda.',
                          reports: 'Dados reais para decisões mais inteligentes.',
                          settings: 'Seu workspace, suas integrações e seus limites.',
                        } as Record<string, string>
                      )[tab]
                    }
                  </p>
                </div>
                {tab !== 'prospect' && tab !== 'settings' && (
                  <button className="btn primary" onClick={() => navigate('prospect')}>
                    <Plus size={17} />
                    Nova prospecção
                  </button>
                )}
              </div>
              {error && (
                <div className="notice error" role="alert">
                  <AlertCircle size={18} />
                  {error}
                  <button onClick={() => void refresh()}>Tentar novamente</button>
                </div>
              )}
              {!data ? (
                <div className="skeleton-grid" aria-label="Carregando dados">
                  {Array.from({ length: 8 }, (_, i) => (
                    <div key={i} className="skeleton" />
                  ))}
                </div>
              ) : (
                <>
                  {tab === 'overview' && (
                    <Overview data={data} navigate={navigate} select={select} />
                  )}
                  {tab === 'prospect' && (
                    <Prospect
                      ready={data.integrations.places.configured}
                      recentCities={data.recentCities}
                      companies={data.companies}
                      createCompany={async (input) => {
                        const result = await action(
                          'companies',
                          'POST',
                          input,
                          'Empresa verificada salva no CRM.',
                        );
                        return result?.id ? String(result.id) : null;
                      }}
                      onCompanyAction={(id, mode) => {
                        if (mode === 'whatsapp') setComposeId(id);
                        else if (mode === 'prompt') setPromptId(id);
                        else select(id);
                      }}
                      onAdd={() => setAdd(true)}
                      notify={setToast}
                      refresh={refresh}
                    />
                  )}
                  {['companies', 'opportunities'].includes(tab) && (
                    <>
                      <div className="toolbar">
                        <div className="search-field">
                          <Search size={17} />
                          <input
                            aria-label="Pesquisar empresas"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            placeholder="Buscar empresa, segmento ou cidade…"
                          />
                        </div>
                        <button
                          className={`btn ${noSite ? 'selected' : ''}`}
                          onClick={() => setNoSite(!noSite)}
                        >
                          <Filter size={16} />
                          Sem site identificado
                        </button>
                        <button className="btn" onClick={() => setAdd(true)}>
                          <Plus size={16} />
                          Cadastrar empresa
                        </button>
                      </div>
                      <div className="filters-extra">
                        <select
                          aria-label="Filtrar por etapa"
                          value={stageFilter}
                          onChange={(e) => setStageFilter(e.target.value)}
                        >
                          <option value="">Todas as etapas</option>
                          {stages.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                        <select
                          aria-label="Filtrar por nicho"
                          value={nicheFilter}
                          onChange={(e) => setNicheFilter(e.target.value)}
                        >
                          <option value="">Todos os nichos</option>
                          {[...new Set(data.companies.map((c) => c.niche))].map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                        <select
                          aria-label="Filtrar por cidade"
                          value={cityFilter}
                          onChange={(e) => setCityFilter(e.target.value)}
                        >
                          <option value="">Todas as cidades</option>
                          {[...new Set(data.companies.map((c) => c.city))].map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                        <select
                          aria-label="Pontuação mínima"
                          value={minScore}
                          onChange={(e) => setMinScore(Number(e.target.value))}
                        >
                          <option value={0}>Qualquer pontuação</option>
                          <option value={40}>40+ pontos</option>
                          <option value={70}>70+ pontos</option>
                        </select>
                        <button
                          className={`btn ${archived ? 'selected' : ''}`}
                          onClick={() => setArchived(!archived)}
                        >
                          Arquivadas
                        </button>
                        <button
                          className="btn"
                          onClick={() => setView(view === 'cards' ? 'table' : 'cards')}
                        >
                          {view === 'cards' ? 'Ver tabela' : 'Ver cards'}
                        </button>
                      </div>
                      {view === 'table' ? (
                        <CompanyTable companies={visible} select={select} />
                      ) : (
                        <Companies companies={visible} select={select} />
                      )}
                    </>
                  )}
                  {tab === 'funnel' && (
                    <>
                      <div className="section-toolbar">
                        <Badge tone="blue">{data.companies.length} empresas no funil</Badge>
                        <span className="muted">Altere a etapa no card da empresa.</span>
                      </div>
                      <div className="kanban">
                        {stages.map((stage, i) => (
                          <section
                            key={stage}
                            className="kanban-column"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              const id = e.dataTransfer.getData('text/plain');
                              if (id) void action(`companies/${id}`, 'PATCH', { stage });
                            }}
                          >
                            <h3>
                              <i style={{ background: `hsl(${195 + i * 8} 65% 60%)` }} />
                              {stage}
                              <b>{data.companies.filter((c) => c.stage === stage).length}</b>
                            </h3>
                            {data.companies
                              .filter((c) => c.stage === stage)
                              .map((c) => (
                                <button
                                  draggable
                                  onDragStart={(e) => e.dataTransfer.setData('text/plain', c.id)}
                                  key={c.id}
                                  className="kanban-card"
                                  onClick={() => select(c.id)}
                                >
                                  <span className="company-initial">
                                    {c.name.slice(0, 2).toUpperCase()}
                                  </span>
                                  <strong>{c.name}</strong>
                                  <small>
                                    {c.niche} · {c.city}
                                  </small>
                                  <div>
                                    <Badge tone="blue">{score(c).value} pontos</Badge>
                                    {c.consent && !c.optedOut && <ShieldCheck size={15} />}
                                  </div>
                                </button>
                              ))}
                            {!data.companies.some((c) => c.stage === stage) && (
                              <p className="kanban-empty">Nenhuma empresa nesta etapa</p>
                            )}
                          </section>
                        ))}
                      </div>
                    </>
                  )}
                  {tab === 'queue' && (
                    <ContactQueue
                      data={data}
                      select={select}
                      action={action}
                      busy={busy}
                      notify={setToast}
                      assistant={() => navigate('assistant')}
                    />
                  )}
                  {tab === 'contacted' && (
                    <ContactedCompanies data={data} select={select} compose={setComposeId} />
                  )}
                  {tab === 'assistant' && (
                    <CommercialAssistant
                      data={data}
                      action={action}
                      busy={busy}
                      notify={setToast}
                      refresh={refresh}
                    />
                  )}
                  {tab === 'sites' && (
                    <Sites data={data} action={action} select={select} busy={busy} />
                  )}
                  {tab === 'reports' && <Reports data={data} notify={setToast} />}
                  {tab === 'settings' && <SettingsPanel data={data} action={action} busy={busy} />}
                </>
              )}
              <footer className="page-footer">
                <span>
                  <Zap size={12} /> CADU AI <i /> Inteligência em cada oportunidade.
                </span>
                <span>
                  America/Sao_Paulo ·{' '}
                  <a href="/privacy" target="_blank">
                    Privacidade
                  </a>{' '}
                  ·{' '}
                  <a href="/terms" target="_blank">
                    Termos
                  </a>
                </span>
              </footer>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      {toast && (
        <div role="status" className="toast">
          <AlertCircle size={18} />
          <span>{toast}</span>
          <button className="icon-btn" aria-label="Fechar notificação" onClick={() => setToast('')}>
            <X size={16} />
          </button>
        </div>
      )}
      {add && (
        <CompanyForm
          close={() => setAdd(false)}
          save={async (body) => {
            const res = await action('companies', 'POST', body, 'Empresa cadastrada no CRM.');
            if (res) setAdd(false);
          }}
          busy={busy}
        />
      )}
      {data && composeId && data.companies.find((c) => c.id === composeId) && (
        <ContactComposer
          key={`composer-${composeId}`}
          company={data.companies.find((c) => c.id === composeId)!}
          data={data}
          close={() => setComposeId(null)}
          action={action}
          busy={busy}
          notify={setToast}
        />
      )}
      {data && promptId && data.companies.find((c) => c.id === promptId) && (
        <SitePromptEditor
          key={`prompt-${promptId}`}
          company={data.companies.find((c) => c.id === promptId)!}
          data={data}
          close={() => setPromptId(null)}
          action={action}
          busy={busy}
          notify={setToast}
        />
      )}
      {company && data && (
        <CompanyProfile
          key={`profile-${company.id}`}
          company={company}
          data={data}
          refresh={refresh}
          close={() => select(null)}
          action={action}
          busy={busy}
          notify={setToast}
          compose={() => setComposeId(company.id)}
          prompt={() => setPromptId(company.id)}
        />
      )}
      {showActivity && (
        <Modal title="Atividades recentes" close={() => setShowActivity(false)}>
          <Activity data={data?.events || []} />
        </Modal>
      )}
      {help && (
        <Modal title="Primeiros passos" close={() => setHelp(false)}>
          <div className="stack help">
            <p>
              1. Configure as variáveis das integrações no arquivo local <code>.env.local</code> e
              reinicie o servidor.
            </p>
            <p>
              2. Busque empresas pela API oficial Google Places. Verifique fontes independentes
              antes de cadastrar os dados no CRM.
            </p>
            <p>
              3. Registre a autorização, prepare o texto e abra o WhatsApp pessoal por wa.me.
              Confirme o envio somente depois de enviar.
            </p>
            <p>
              4. Confirme os serviços da empresa, configure um worker isolado e solicite uma
              demonstração.
            </p>
            <p>5. Revise a prévia privada e aprove antes de compartilhar.</p>
            <div className="notice">
              <ShieldCheck size={18} />O WhatsApp pessoal não é acessado pela plataforma. Nenhum
              envio é automático.
            </div>
            <p>
              Consulte o README e a documentação na pasta <code>docs/</code> para instalação,
              segurança e contratos do worker.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Overview({
  data,
  navigate,
  select,
}: {
  data: Data;
  navigate: (v: string) => void;
  select: (v: string) => void;
}) {
  const m = data.metrics;
  const configured = Object.entries(data.integrations).filter(
    ([key, v]) => key !== 'github' && v.configured,
  ).length;
  const cards = [
    {
      label: 'Empresas encontradas',
      value: m.companies,
      icon: Building2,
      color: 'blue',
      sub: 'Cadastradas no seu CRM',
    },
    {
      label: 'Oportunidades qualificadas',
      value: m.qualified,
      icon: Globe,
      color: 'cyan',
      sub: 'Estimativa · pontuação de 70 ou mais',
    },
    {
      label: 'Contatos preparados',
      value: m.prepared,
      icon: FileText,
      color: 'green',
      sub: 'Rascunhos revisáveis, sem envio',
    },
    {
      label: 'Envios confirmados hoje',
      value: m.sentToday,
      icon: Send,
      color: 'violet',
      sub: 'Confirmados manualmente por você',
    },
    {
      label: 'Clientes interessados',
      value: m.interested,
      icon: Users,
      color: 'blue',
      sub: 'Relacionamentos em andamento',
    },
    {
      label: 'Demonstrações geradas',
      value: m.demos,
      icon: PanelsTopLeft,
      color: 'cyan',
      sub: 'Prontas para revisão ou aprovadas',
    },
    {
      label: 'Negociações abertas',
      value: m.proposals,
      icon: FileText,
      color: 'amber',
      sub: 'Etapas comerciais confirmadas',
    },
    {
      label: 'Vendas concluídas',
      value: m.sales,
      icon: Trophy,
      color: 'green',
      sub: 'Oportunidades convertidas',
    },
    {
      label: 'Respostas registradas',
      value: m.responses,
      icon: MessagesSquare,
      color: 'blue',
      sub: 'Análises aprovadas por você',
    },
    {
      label: 'Demonstrações solicitadas',
      value: m.requested,
      icon: Sparkles,
      color: 'cyan',
      sub: 'Solicitações e tarefas reais',
    },
  ];
  return (
    <>
      <section className="welcome-banner">
        <div className="banner-grid" />
        <div className="banner-copy">
          <Badge tone="blue">
            <Sparkles size={12} />
            PROSPECÇÃO COM INTELIGÊNCIA
          </Badge>
          <h2>
            Mais conexões.
            <br />
            <span>Seu próximo grande projeto.</span>
          </h2>
          <p>
            Descubra empresas, encontre oportunidades e crie
            <br className="desktop-break" /> experiências digitais que fazem a diferença.
          </p>
          <button className="btn primary" onClick={() => navigate('prospect')}>
            Encontrar oportunidades
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="radar-art" aria-hidden="true">
          <div className="orbit o1" />
          <div className="orbit o2" />
          <div className="orbit o3" />
          <div className="radar-axis" />
          <span className="radar-point p1">
            <Building2 size={18} />
          </span>
          <span className="radar-point p2">
            <Globe size={17} />
          </span>
          <span className="radar-point p3">
            <Target size={17} />
          </span>
          <span className="radar-core">
            <Zap size={36} fill="currentColor" />
          </span>
          <div className="radar-caption">
            <i />
            Conectando possibilidades
          </div>
        </div>
      </section>
      <div className="section-heading">
        <h2>Seu negócio em números</h2>
        <span>
          <i className="status-dot" />
          Dados reais do workspace
        </span>
      </div>
      <section className="metric-grid">
        {cards.map((c) => (
          <article className="metric-card" key={c.label}>
            <div className="metric-top">
              <span>{c.label}</span>
              <div className={`metric-icon ${c.color}`}>
                <c.icon size={17} />
              </div>
            </div>
            <strong className="metric-value">{c.value.toLocaleString('pt-BR')}</strong>
            <small>{c.sub}</small>
          </article>
        ))}
      </section>
      <div className="dashboard-columns">
        <section className="panel performance-panel">
          <div className="panel-heading">
            <div>
              <h2>Desempenho da prospecção</h2>
              <p>O ritmo das suas conexões ao longo do tempo</p>
            </div>
            <Badge>
              Últimos 14 dias <ChevronDown size={12} />
            </Badge>
          </div>
          <Performance data={data} />
          <div className="chart-legend">
            <span>
              <i className="legend-blue" />
              Empresas cadastradas
            </span>
            <span>
              <i className="legend-cyan" />
              Mensagens enviadas
            </span>
          </div>
        </section>
        <section className="panel funnel-panel">
          <div className="panel-heading">
            <div>
              <h2>Funil comercial</h2>
              <p>Cada etapa conta uma história</p>
            </div>
            <button
              className="icon-btn"
              aria-label="Abrir funil"
              onClick={() => navigate('funnel')}
            >
              <ArrowUpRight size={18} />
            </button>
          </div>
          <div className="funnel-bars">
            {[
              { label: 'Empresas no CRM', value: m.companies },
              { label: 'Contatos autorizados', value: m.authorized },
              { label: 'Interessadas', value: m.interested },
              { label: 'Demonstrações prontas', value: m.demos },
              { label: 'Vendas concluídas', value: m.sales },
            ].map((item, i) => (
              <div
                className={`funnel-row f${i}`}
                key={item.label}
                style={{ width: `${100 - i * 8}%` }}
              >
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
          <p className="funnel-note">
            <Target size={13} />
            Construa o próximo passo, uma conexão por vez.
          </p>
        </section>
      </div>
      <div className="dashboard-columns bottom-columns">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Próximas oportunidades</h2>
              <p>Empresas com maior potencial estimado</p>
            </div>
            <button className="text-btn" onClick={() => navigate('opportunities')}>
              Ver todas
              <ArrowRight size={14} />
            </button>
          </div>
          {!data.companies.length ? (
            <Empty
              title="Sua próxima oportunidade está por vir"
              text="Inicie uma prospecção e cadastre empresas verificadas para começar."
              action={
                <button className="text-btn" onClick={() => navigate('prospect')}>
                  Fazer primeira busca
                  <ArrowRight size={14} />
                </button>
              }
            />
          ) : (
            <div className="compact-companies">
              {[...data.companies]
                .sort((a, b) => score(b).value - score(a).value)
                .slice(0, 4)
                .map((c) => (
                  <button key={c.id} onClick={() => select(c.id)}>
                    <span className="company-initial">{c.name.slice(0, 2).toUpperCase()}</span>
                    <div>
                      <strong>{c.name}</strong>
                      <small>
                        {c.niche} · {c.city}
                      </small>
                    </div>
                    <Badge tone={score(c).value >= 70 ? 'green' : 'blue'}>
                      {score(c).value} pontos
                    </Badge>
                    <ChevronRight size={15} />
                  </button>
                ))}
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Atividades recentes</h2>
              <p>O que está acontecendo no workspace</p>
            </div>
            <Clock3 size={17} className="muted" />
          </div>
          <Activity data={data.events.slice(0, 4)} />
        </section>
      </div>
      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-heading">
          <div>
            <h2>Próximas tarefas</h2>
            <p>Ações registradas no seu CRM</p>
          </div>
          <Badge>{data.tasks.filter((t) => !t.done).length} pendentes</Badge>
        </div>
        <div className="compact-companies">
          {data.tasks
            .filter((t) => !t.done)
            .slice(0, 5)
            .map((t) => (
              <button key={t.id} onClick={() => select(t.companyId)}>
                <ListTodo size={16} />
                <div>
                  <strong>{t.title}</strong>
                  <small>{data.companies.find((c) => c.id === t.companyId)?.name}</small>
                </div>
                <ArrowRight size={14} />
              </button>
            ))}
        </div>
        {!data.tasks.some((t) => !t.done) && (
          <p className="muted" style={{ padding: 20 }}>
            Nenhuma tarefa pendente. Adicione próximos passos no cadastro de uma empresa.
          </p>
        )}
      </section>
      <div className="workspace-strip">
        <div>
          <ShieldCheck size={20} />
          <div>
            <strong>Relacionamentos com responsabilidade</strong>
            <span>
              {m.contactsToday} de {m.dailyLimit} contatos confirmados hoje · {m.remaining} contatos
              restantes
            </span>
          </div>
        </div>
        <button onClick={() => navigate('settings')}>
          {configured}/7 integrações configuradas
          <ArrowRight size={14} />
        </button>
      </div>
    </>
  );
}
function Performance({ data }: { data: Data }) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data.metrics.performance}
          margin={{ top: 20, left: -26, right: 16, bottom: 0 }}
        >
          <defs>
            <linearGradient id="areaBlue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f83ff" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#4f83ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1c2638" vertical={false} strokeDasharray="3 5" />
          <XAxis
            dataKey="day"
            tickFormatter={(v) => v.slice(8) + '/' + v.slice(5, 7)}
            stroke="#344056"
            tick={{ fill: '#74839b', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            minTickGap={22}
          />
          <YAxis
            allowDecimals={false}
            domain={[0, (max: number) => Math.max(4, max)]}
            tick={{ fill: '#74839b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: '#121e30',
              border: '1px solid #29364c',
              borderRadius: 9,
              color: '#e4ecf8',
            }}
            labelFormatter={(v) => String(v).split('-').reverse().join('/')}
          />
          <Area
            name="Empresas"
            type="monotone"
            dataKey="empresas"
            stroke="#5a8cff"
            strokeWidth={2}
            fill="url(#areaBlue)"
          />
          <Area
            name="Mensagens"
            type="monotone"
            dataKey="mensagens"
            stroke="#39c8cc"
            strokeWidth={2}
            fill="transparent"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
function Activity({ data }: { data: State['events'] }) {
  if (!data.length)
    return (
      <Empty
        icon={<Clock3 size={25} />}
        title="Tudo começa com o primeiro passo"
        text="Suas buscas, contatos e atualizações aparecerão aqui."
      />
    );
  return (
    <div className="activities">
      {data.map((e) => (
        <div className="activity" key={e.id}>
          <span>
            <Circle size={9} fill="currentColor" />
          </span>
          <div>
            <p>{e.title}</p>
            <small>
              {date(e.at)} · {e.source}
            </small>
          </div>
        </div>
      ))}
    </div>
  );
}
function Companies({ companies, select }: { companies: Company[]; select: (v: string) => void }) {
  if (!companies.length)
    return (
      <section className="panel">
        <Empty
          icon={<Building2 size={28} />}
          title="Nenhuma empresa por aqui ainda"
          text="Busque empresas ou cadastre informações verificadas para começar seu CRM."
        />
      </section>
    );
  return (
    <div className="company-grid">
      {companies.map((c) => {
        const s = score(c);
        return (
          <button className="company-card" key={c.id} onClick={() => select(c.id)}>
            <div className="company-card-top">
              <span className="company-initial">{c.name.slice(0, 2).toUpperCase()}</span>
              <Badge tone={s.value >= 70 ? 'green' : s.value >= 40 ? 'blue' : ''}>
                {s.value}/100
              </Badge>
            </div>
            <h3>{c.name}</h3>
            <p>
              {c.niche} · {c.city}, {c.state}
            </p>
            <div className="company-website">
              <Globe size={14} />
              {c.website ? 'Site informado' : 'Site não identificado'}
            </div>
            <div className="company-card-bottom">
              <Badge tone={c.optedOut ? 'red' : c.consent ? 'green' : ''}>
                {c.optedOut ? 'Contato bloqueado' : c.stage}
              </Badge>
              <ArrowUpRight size={17} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
function Prospect({
  ready,
  recentCities,
  companies,
  createCompany,
  onCompanyAction,
  onAdd,
  notify,
  refresh,
}: {
  ready: boolean;
  recentCities: Municipality[];
  companies: Company[];
  createCompany: (input: unknown) => Promise<string | null>;
  onCompanyAction: (id: string, mode: ResultAction) => void;
  onAdd: () => void;
  notify: (s: string) => void;
  refresh: () => Promise<void>;
}) {
  const [niches, setNiches] = useState<string[]>([]);
  const [candidate, setCandidate] = useState<{ place: PlaceResult; mode: ResultAction } | null>(
    null,
  );
  const [location, setLocation] = useState<Municipality | null>({
    id: 3506003,
    name: 'Bauru',
    uf: 'SP',
  });
  const [locationReady, setLocationReady] = useState(false);
  const city = location?.name || '';
  const [state, setState] = useState('SP');
  const [limit, setLimit] = useState(20);
  const [priority, setPriority] = useState('no-site');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Place[] | null>(null);
  const [notice, setNotice] = useState('');
  const [sources, setSources] = useState<{ title: string; url: string; description: string }[]>([]);
  async function search(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResults(null);
    try {
      const r = await api<{ places: Place[]; notice: string }>('prospect', 'POST', {
        niches,
        city,
        cityId: location?.id,
        state,
        limit,
        priority,
      });
      setResults(r.places);
      setNotice(r.notice);
      await refresh();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function verify(p: Place) {
    setBusy(true);
    try {
      const r = await api<{ results: typeof sources; notice: string }>('verify-website', 'POST', {
        name: p.displayName?.text,
        city,
      });
      setSources(r.results);
      notify(r.notice);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="prospect-layout">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Onde está sua próxima oportunidade?</h2>
              <p>Busca oficial, sem scraping e sem disparos automáticos.</p>
            </div>
            <div className="icon-box">
              <Radar size={22} />
            </div>
          </div>
          <form className="stack prospect-form" onSubmit={search}>
            <NicheSelector value={niches} onChange={setNiches} disabled={busy} />
            <CitySelector
              value={location}
              uf={state}
              onChange={(city, uf) => {
                setLocation(city);
                setState(uf);
              }}
              onReady={setLocationReady}
              recent={recentCities}
              disabled={busy}
              remember={(city) => {
                void api('preferences/location', 'POST', city)
                  .then(() => refresh())
                  .catch((e) => notify(e.message));
              }}
            />
            <div className="form-row">
              <label>
                Máximo de resultados
                <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
                  {[5, 10, 20, 40, 60].map((v) => (
                    <option key={v} value={v}>
                      {v} empresas
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Prioridade
                <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="no-site">Sem site identificado</option>
                  <option value="all">Todas as empresas</option>
                  <option value="old-site">Site antigo · revisão manual</option>
                </select>
              </label>
            </div>
            <button
              className="btn primary"
              disabled={busy || !locationReady || !location || !niches.length}
            >
              {busy ? <Loader2 className="spin" size={17} /> : <Search size={17} />}Buscar empresas
            </button>
          </form>
        </section>
        <aside className="stack">
          <section className="panel guide-card">
            <span className="eyebrow">BOAS OPORTUNIDADES, BOAS PRÁTICAS</span>
            <h3>Comece com contexto.</h3>
            <p>A ausência de um site no Google é um sinal para investigar, não uma conclusão.</p>
            <ul>
              <li>
                <Check size={15} />
                Resultados da API oficial
              </li>
              <li>
                <Check size={15} />
                Verificação em fontes independentes
              </li>
              <CheckItem>Dados do Google sem armazenamento permanente</CheckItem>
              <CheckItem>Contato apenas com autorização</CheckItem>
            </ul>
          </section>
          <div className={`notice ${!ready ? 'amber' : ''}`}>
            <KeyRound size={18} />
            <span>
              {ready
                ? 'Chave Google Places configurada. Cada consulta consome sua cota.'
                : 'Google Places aguarda configuração de GOOGLE_PLACES_API_KEY no servidor.'}
            </span>
          </div>
        </aside>
      </div>
      {busy && (
        <div className="skeleton-grid">
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      )}
      {results && (
        <section className="panel search-results">
          <div className="panel-heading">
            <div>
              <h2>{results.length} empresas nesta consulta</h2>
              <p>{notice}</p>
            </div>
            <button className="btn" onClick={onAdd}>
              <Plus size={16} />
              Cadastrar dados verificados
            </button>
          </div>
          <div className="google-attribution">
            <img
              alt="Google Maps"
              src="https://developers.google.com/static/maps/documentation/images/google-maps-attribution.png"
              height={20}
            />
            <span>Resultados temporários · não são salvos no CRM automaticamente</span>
          </div>
          {!results.length ? (
            <Empty
              title="Nenhum resultado para este filtro"
              text="Experimente outro nicho, cidade ou prioridade."
            />
          ) : (
            <ResultCards
              places={results}
              city={city}
              state={state}
              busy={busy}
              verify={verify}
              onAction={(place, mode) => {
                const existing = companies.find((c) => c.placeId === place.id);
                if (existing) onCompanyAction(existing.id, mode);
                else setCandidate({ place, mode });
              }}
            />
          )}
        </section>
      )}
      {!!sources.length && (
        <section className="panel stack sources">
          <h2>Fontes para revisão</h2>
          {sources.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
              <strong>
                {s.title}
                <ExternalLink size={13} />
              </strong>
              <p>{s.description}</p>
            </a>
          ))}
        </section>
      )}
      {candidate && (
        <CompanyForm
          busy={busy}
          close={() => setCandidate(null)}
          initial={{
            placeId: candidate.place.id,
            name: candidate.place.displayName?.text || '',
            niche: candidate.place.prospectNiche || niches[0] || '',
            city,
            state,
            phone: candidate.place.internationalPhoneNumber || '',
            address: candidate.place.formattedAddress || '',
            website: candidate.place.websiteUri || '',
          }}
          save={async (input) => {
            setBusy(true);
            try {
              const id = await createCompany(input);
              if (id) {
                const mode = candidate.mode;
                setCandidate(null);
                onCompanyAction(id, mode);
              }
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </>
  );
}
function CheckItem({ children }: { children: ReactNode }) {
  return (
    <li>
      <Check size={15} />
      {children}
    </li>
  );
}
function CompanyTable({
  companies,
  select,
}: {
  companies: Company[];
  select: (id: string) => void;
}) {
  return (
    <section className="panel table-wrap">
      <table>
        <thead>
          <tr>
            <th>Empresa</th>
            <th>Nicho / cidade</th>
            <th>Presença digital</th>
            <th>Estimativa</th>
            <th>Status comercial</th>
            <th>Último contato</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => (
            <tr key={c.id}>
              <td>
                <button className="table-name" onClick={() => select(c.id)}>
                  {c.name}
                  <ArrowUpRight size={12} />
                </button>
              </td>
              <td>
                {c.niche} · {c.city}
              </td>
              <td>{c.website ? 'Site identificado' : 'Site desconhecido'}</td>
              <td>{score(c).value}/100</td>
              <td>
                <Badge>{c.stage}</Badge>
              </td>
              <td>{c.lastContactAt ? date(c.lastContactAt) : 'Desconhecido'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!companies.length && (
        <Empty
          title="Nenhuma empresa neste filtro"
          text="Ajuste os filtros ou cadastre uma empresa verificada."
        />
      )}
    </section>
  );
}
function ContactQueue({
  data,
  select,
  action,
  busy,
  notify,
  assistant,
}: {
  data: Data;
  select: (id: string) => void;
  action: Action;
  busy: boolean;
  notify: (s: string) => void;
  assistant: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('');
  const [authorizedOnly, setAuthorizedOnly] = useState(false);
  const companies = data.companies
    .filter(
      (c) =>
        !c.archived &&
        !c.optedOut &&
        `${c.name} ${c.niche} ${c.city}`.toLowerCase().includes(filter.toLowerCase()) &&
        (!authorizedOnly || !!c.consent),
    )
    .sort((a, b) => score(b).value - score(a).value);
  async function open(c: Company) {
    // Open synchronously in the click gesture to avoid popup blocking; no clicks or sends are automated.
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    try {
      const text = drafts[c.id] ?? c.draft;
      if (text && text !== c.draft) {
        const saved = await action(
          'manual/prepare',
          'POST',
          { companyId: c.id, text },
          'Rascunho atualizado.',
        );
        if (!saved) {
          popup?.close();
          return;
        }
      }
      const result = await action(
        'manual/open',
        'POST',
        { companyId: c.id },
        'WhatsApp aberto. O envio ainda não foi confirmado.',
      );
      if (!result) {
        popup?.close();
        return;
      }
      if (popup) popup.location.href = String(result.url);
      else
        notify(
          'O navegador bloqueou a abertura. Permita pop-ups e tente novamente. O contato permanece pendente e pode ser cancelado.',
        );
    } catch (e) {
      popup?.close();
      notify((e as Error).message);
    }
  }
  return (
    <>
      <div className="queue-stats">
        <div>
          <strong>
            {data.metrics.contactsToday}/{data.settings.dailyLimit}
          </strong>
          <span>Contatos confirmados hoje</span>
        </div>
        <div>
          <strong>{data.metrics.remaining}</strong>
          <span>Contatos restantes no limite diário</span>
        </div>
        <div>
          <strong>{data.metrics.prepared}</strong>
          <span>Mensagens preparadas</span>
        </div>
        <div>
          <strong>{data.metrics.opened}</strong>
          <span>Conversas com envio não confirmado</span>
        </div>
      </div>
      <div className="notice">
        <ShieldCheck size={18} />
        <span>
          O WhatsApp pessoal permanece sob seu controle. Abrir uma conversa não comprova envio.
          Confirme somente depois de enviar manualmente. Aberturas pendentes reservam vagas sem
          aumentar o contador.
        </span>
      </div>
      <div className="toolbar">
        <div className="search-field">
          <Search size={16} />
          <input
            aria-label="Pesquisar fila"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar fila por empresa, nicho ou cidade…"
          />
        </div>
        <button
          className={`btn ${authorizedOnly ? 'selected' : ''}`}
          onClick={() => setAuthorizedOnly(!authorizedOnly)}
        >
          Somente autorizados
        </button>
      </div>
      <div className="queue-list">
        {!companies.length ? (
          <section className="panel">
            <Empty
              icon={<ListTodo size={27} />}
              title="Sua fila está pronta para receber oportunidades"
              text="Cadastre empresas verificadas. A fila prioriza a pontuação estimada e mantém o envio sob seu controle."
            />
          </section>
        ) : (
          companies.map((c) => {
            const pending = data.contacts.find(
              (item) => item.companyId === c.id && item.status === 'aberto',
            );
            const confirmed = data.contacts.find(
              (item) => item.companyId === c.id && item.status === 'confirmado',
            );
            return (
              <article className="panel queue-card" key={c.id}>
                <div className="queue-card-top">
                  <span className="company-initial">{c.name.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <button className="text-btn" onClick={() => select(c.id)}>
                      <h3>{c.name}</h3>
                      <ArrowUpRight size={14} />
                    </button>
                    <p>
                      {c.niche} · {c.city}, {c.state} · {c.phone || 'Telefone desconhecido'}
                    </p>
                  </div>
                  <Badge tone={score(c).value >= 70 ? 'green' : 'blue'}>
                    {score(c).value}/100 · estimado
                  </Badge>
                </div>
                <div className="queue-meta">
                  <span>{c.website ? 'Site identificado' : 'Site não identificado'}</span>
                  <span>{c.consent ? 'Autorização registrada' : 'Autorização pendente'}</span>
                  <span>
                    Último contato: {c.lastContactAt ? date(c.lastContactAt) : 'desconhecido'}
                  </span>
                  <span>{c.stage}</span>
                </div>
                {c.draft && (
                  <textarea
                    aria-label={`Mensagem para ${c.name}`}
                    value={drafts[c.id] ?? c.draft}
                    maxLength={2000}
                    onChange={(e) => setDrafts({ ...drafts, [c.id]: e.target.value })}
                  />
                )}
                <div className="button-row">
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() =>
                      void action(
                        'manual/prepare',
                        'POST',
                        { companyId: c.id, ...(drafts[c.id] ? { text: drafts[c.id] } : {}) },
                        'Abordagem personalizada preparada.',
                      )
                    }
                  >
                    <FileText size={14} />
                    {c.draft ? 'Salvar rascunho' : 'Preparar abordagem'}
                  </button>
                  <button
                    className="btn"
                    disabled={!c.draft}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(drafts[c.id] ?? c.draft ?? '');
                        notify('Mensagem copiada. Nenhum envio realizado.');
                      } catch {
                        notify('Não foi possível copiar. Selecione o texto manualmente.');
                      }
                    }}
                  >
                    <Clipboard size={14} />
                    Copiar mensagem
                  </button>
                  <button
                    className="btn primary"
                    disabled={busy || !c.draft || !c.consent || !!confirmed || data.settings.paused}
                    onClick={() => void open(c)}
                  >
                    <MessagesSquare size={14} />
                    Abrir WhatsApp
                  </button>
                  {pending && (
                    <>
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() =>
                          void action(
                            'manual/confirm',
                            'POST',
                            { contactId: pending.id },
                            'Envio confirmado e contador atualizado.',
                          )
                        }
                      >
                        <Check size={14} />
                        Confirmar envio
                      </button>
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() =>
                          void action(
                            'manual/cancel',
                            'POST',
                            { contactId: pending.id },
                            'Abertura cancelada; nenhum envio contabilizado.',
                          )
                        }
                      >
                        Não enviei
                      </button>
                    </>
                  )}
                  <button className="btn" onClick={assistant}>
                    <Sparkles size={14} />
                    Analisar resposta
                  </button>
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() =>
                      void action(
                        'jobs',
                        'POST',
                        { companyId: c.id, confirmed: true },
                        'Demonstração adicionada à fila. Aguarda worker configurado.',
                      )
                    }
                  >
                    <PanelsTopLeft size={14} />
                    Gerar demonstração
                  </button>
                  <button
                    className="text-btn"
                    onClick={() =>
                      void action(
                        'manual/archive',
                        'POST',
                        { companyId: c.id },
                        'Empresa arquivada.',
                      )
                    }
                    disabled={busy}
                  >
                    Arquivar
                  </button>
                </div>
                {pending && (
                  <div className="notice amber">
                    <Clock3 size={17} />
                    <span>
                      <strong>Envio não confirmado.</strong> Abrir o link não informa se a mensagem
                      foi enviada. Confirme ou selecione “Não enviei”.
                    </span>
                  </div>
                )}
                <p className="muted" style={{ marginTop: 14 }}>
                  Próxima ação:{' '}
                  {confirmed
                    ? 'Registrar a resposta recebida ou criar uma tarefa de acompanhamento.'
                    : pending
                      ? 'Confirmar o envio ou cancelar a abertura.'
                      : !c.consent
                        ? 'Verificar autorização de contato.'
                        : !c.draft
                          ? 'Preparar e revisar a abordagem.'
                          : 'Abrir o WhatsApp e realizar o envio manual.'}
                </p>
              </article>
            );
          })
        )}
      </div>
    </>
  );
}
function CommercialAssistant({
  data,
  action,
  busy,
  notify,
  refresh,
}: {
  data: Data;
  action: Action;
  busy: boolean;
  notify: (s: string) => void;
  refresh: () => Promise<void>;
}) {
  const [companyId, setCompanyId] = useState('');
  const [text, setText] = useState('');
  const [retain, setRetain] = useState(false);
  const [source, setSource] = useState<'texto colado' | 'arquivo importado'>('texto colado');
  const [result, setResult] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const history = data.analyses
    .filter((a) => !companyId || a.companyId === companyId)
    .slice()
    .reverse();
  async function analyze(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await api<Analysis>('analyses', 'POST', {
        companyId,
        text,
        source,
        retainText: retain,
      });
      setResult(r);
      setText('');
      await refresh();
      notify('Análise preparada. Revise antes de atualizar o CRM.');
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  function resultCard(a: Analysis) {
    return (
      <div className="analysis-result">
        <div>
          <Badge tone="blue">{a.intent}</Badge>
          <Badge>{Math.round(a.confidence * 100)}% · confiança estimada</Badge>
          <Badge>{a.method === 'openai' ? 'IA · OpenAI' : 'Regras locais · sem IA'}</Badge>
        </div>
        <p>
          <strong>Resumo:</strong> {a.summary}
        </p>
        <p>
          <strong>Próxima ação:</strong> {a.nextAction}
        </p>
        <p>
          <strong>Status sugerido:</strong>{' '}
          {a.suggestedStage || 'Sem alteração · confirme a intenção'}
        </p>
        <label>
          Sugestão de resposta
          <textarea readOnly value={a.suggestion} />
        </label>
        <div className="button-row" style={{ marginTop: 15 }}>
          <button
            className="btn"
            onClick={async () => {
              await navigator.clipboard.writeText(a.suggestion);
              notify('Sugestão copiada. Revise e envie manualmente.');
            }}
          >
            <Clipboard size={14} />
            Copiar sugestão
          </button>
          <button
            className="btn primary"
            disabled={busy || a.applied || data.analyses.find((x) => x.id === a.id)?.applied}
            onClick={async () => {
              if (
                await action(
                  `analyses/${a.id}`,
                  'PATCH',
                  undefined,
                  'Análise aprovada e CRM atualizado.',
                )
              )
                setResult(null);
            }}
          >
            {a.applied ? 'Já aplicada' : 'Aprovar atualização do CRM'}
            <Check size={14} />
          </button>
        </div>
        <small className="muted">
          A confiança é uma estimativa não calibrada. Revise negações, contexto e quem escreveu o
          trecho.
        </small>
      </div>
    );
  }
  return (
    <>
      <div className="assistant-layout">
        <section className="panel stack">
          <h2>Transforme respostas em próximos passos</h2>
          <p className="muted">
            Cole apenas uma resposta comercial recebida do cliente. Para arquivos exportados,
            selecione e mantenha somente o trecho escrito pelo cliente; não envie a conversa inteira
            desnecessariamente.
          </p>
          <form className="stack" onSubmit={analyze}>
            <label>
              Empresa correspondente
              <select
                required
                value={companyId}
                onChange={(e) => {
                  setCompanyId(e.target.value);
                  setResult(null);
                }}
              >
                <option value="">Selecione uma empresa</option>
                {data.companies.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Importar arquivo de texto voluntariamente
              <input
                aria-label="Importar conversa"
                type="file"
                accept=".txt,text/plain"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 100000) {
                    notify(
                      'Use um arquivo de até 100 KB e selecione um trecho de até 20 mil caracteres.',
                    );
                    return;
                  }
                  setText((await file.text()).slice(0, 20000));
                  setSource('arquivo importado');
                  notify(
                    'Arquivo carregado apenas no formulário. Selecione o trecho do cliente antes de analisar.',
                  );
                }}
              />
            </label>
            <label>
              Trecho recebido
              <textarea
                required
                minLength={2}
                maxLength={20000}
                style={{ minHeight: 180 }}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Cole a resposta do cliente aqui…"
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={retain}
                onChange={(e) => setRetain(e.target.checked)}
              />
              Guardar também o texto original. Por padrão, somente o resumo e a análise são
              armazenados.
            </label>
            <button
              className="btn primary"
              disabled={loading || !companyId || text.trim().length < 2}
            >
              {loading ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}Analisar
              resposta
            </button>
          </form>
          <div className="notice">
            <ShieldCheck size={18} />
            <span>
              {data.integrations.ai.configured
                ? 'O trecho selecionado será enviado à OpenAI configurada no servidor.'
                : 'Sem chave de IA: análise por regras locais, explicitamente identificada e sujeita a erro.'}{' '}
              Nenhuma mensagem é enviada ao WhatsApp.
            </span>
          </div>
        </section>
        <section className="panel stack">
          <h2>Análise para revisão</h2>
          {result ? (
            resultCard(result)
          ) : (
            <Empty
              icon={<MessagesSquare size={27} />}
              title="Contexto antes de qualquer ação"
              text="A análise aponta intenção, confiança, resumo e próximos passos. Você decide se a mudança será aplicada ao CRM."
            />
          )}
          <div className="notice amber">
            <AlertCircle size={18} />
            <span>
              Respostas ambíguas não confirmam interesse. Revise pedidos de demonstração antes de
              criar projetos. Uma recusa aprovada bloqueia novos contatos.
            </span>
          </div>
        </section>
      </div>
      <section className="analysis-history">
        <div className="section-heading">
          <h2>Histórico de análises</h2>
          <Badge>{history.length} registros</Badge>
        </div>
        {history.map((a) => (
          <article className="panel stack" key={a.id}>
            <div className="section-heading">
              <div>
                <h3>{data.companies.find((c) => c.id === a.companyId)?.name}</h3>
                <small className="muted">
                  {date(a.at)} · {a.source}
                </small>
              </div>
              <button
                className="text-btn danger"
                onClick={() =>
                  void action(
                    `analyses/${a.id}`,
                    'DELETE',
                    undefined,
                    'Análise e texto original removidos.',
                  )
                }
              >
                Excluir análise
              </button>
            </div>
            {resultCard(a)}
          </article>
        ))}
      </section>
    </>
  );
}
function CompanyForm({
  close,
  save,
  busy,
  initial,
}: {
  close: () => void;
  save: (data: unknown) => Promise<void>;
  busy: boolean;
  initial?: Partial<Company>;
}) {
  const [verified, setVerified] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await save({ ...Object.fromEntries(f.entries()), verified });
  }
  return (
    <Modal title="Cadastrar empresa verificada" close={close}>
      <form className="stack" onSubmit={submit}>
        <div className="notice">
          <ShieldCheck size={19} />
          <span>
            Revise os campos sugeridos e confirme cada informação em fonte independente ou fornecida
            pela própria empresa. Informe a fonte e marque a verificação antes de salvar; nenhum
            resultado é gravado automaticamente.
          </span>
        </div>
        <label>
          Nome comercial
          <input name="name" defaultValue={initial?.name} required minLength={2} maxLength={160} />
        </label>
        <div className="form-row">
          <label>
            Segmento
            <input
              name="niche"
              defaultValue={initial?.niche}
              required
              minLength={2}
              maxLength={100}
            />
          </label>
          <label>
            Cidade
            <input
              name="city"
              defaultValue={initial?.city}
              required
              minLength={2}
              maxLength={100}
            />
          </label>
          <label className="state-field">
            UF
            <input
              name="state"
              required
              minLength={2}
              maxLength={2}
              defaultValue={initial?.state || 'SP'}
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            Telefone internacional
            <input
              name="phone"
              defaultValue={initial?.phone}
              placeholder="+55 14 99999-9999"
              maxLength={30}
            />
          </label>
          <label>
            Site oficial confirmado
            <input
              name="website"
              defaultValue={initial?.website}
              type="url"
              placeholder="https://"
              maxLength={1000}
            />
          </label>
        </div>
        <label>
          Endereço verificado
          <input name="address" defaultValue={initial?.address} maxLength={1000} />
        </label>
        <label>
          Fonte independente de verificação
          <input
            name="source"
            type="url"
            required
            placeholder="https://site-oficial-ou-fonte-autorizada"
            maxLength={1000}
          />
        </label>
        <label>
          Place ID (opcional)
          <input name="placeId" defaultValue={initial?.placeId} maxLength={300} />
        </label>
        <label>
          Serviços confirmados
          <textarea
            name="services"
            maxLength={3000}
            placeholder="Registre apenas serviços que você verificou."
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={verified}
            required
            onChange={(e) => setVerified(e.target.checked)}
          />
          Verifiquei os dados em fonte independente e posso armazená-los.
        </label>
        <button className="btn primary" disabled={busy || !verified}>
          Salvar no CRM
          <Check size={16} />
        </button>
      </form>
    </Modal>
  );
}
type Action = (
  path: string,
  method?: string,
  body?: unknown,
  success?: string,
) => Promise<Record<string, unknown> | null>;
function Sites({
  data,
  action,
  select,
  busy,
}: {
  data: Data;
  action: Action;
  select: (id: string) => void;
  busy: boolean;
}) {
  const [revision, setRevision] = useState('');
  const [reviseId, setReviseId] = useState<string | null>(null);
  if (!data.jobs.length)
    return (
      <section className="panel">
        <Empty
          icon={<PanelsTopLeft size={28} />}
          title="Da oportunidade ao primeiro site"
          text="Abra uma empresa, confirme os serviços e solicite uma demonstração ao worker isolado. Nenhum projeto será publicado automaticamente."
        />
      </section>
    );
  return (
    <div className="site-grid">
      {data.jobs.map((j) => (
        <article className="panel site-card" key={j.id}>
          <div className="site-art">
            <PanelsTopLeft size={45} />
            <Badge
              tone={j.status === 'Falhou' ? 'red' : j.status === 'Aprovado' ? 'green' : 'blue'}
            >
              {j.status}
            </Badge>
          </div>
          <div className="stack">
            <button className="text-btn" onClick={() => select(j.companyId)}>
              <h3>
                {data.companies.find((c) => c.id === j.companyId)?.name || 'Empresa removida'}
              </h3>
              <ArrowUpRight size={15} />
            </button>
            <small className="muted">Solicitado em {date(j.createdAt)}</small>
            <div className="job-progress">
              {jobStages.slice(0, 8).map((stage, i) => (
                <i
                  key={stage}
                  title={stage}
                  className={
                    j.status !== 'Falhou' && i <= jobStages.indexOf(j.status) ? 'complete' : ''
                  }
                />
              ))}
            </div>
            {j.error && <p className="error">{j.error}</p>}
            {j.checks?.map((check) => (
              <small className="check-line" key={check}>
                <Check size={12} />
                {check}
              </small>
            ))}
            {j.previewUrl && (
              <a className="btn" href={j.previewUrl} target="_blank" rel="noreferrer">
                Abrir prévia privada
                <ExternalLink size={14} />
              </a>
            )}
            {j.desktopScreenshot && (
              <a className="text-btn" href={j.desktopScreenshot} target="_blank" rel="noreferrer">
                Captura desktop
                <ExternalLink size={12} />
              </a>
            )}
            {j.mobileScreenshot && (
              <a className="text-btn" href={j.mobileScreenshot} target="_blank" rel="noreferrer">
                Captura mobile
                <ExternalLink size={12} />
              </a>
            )}
            {j.status === 'Aguardando aprovação' && (
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => void action(`jobs/${j.id}`, 'PATCH', { action: 'approve' })}
              >
                <Check size={15} />
                Aprovar demonstração
              </button>
            )}
            {['Aguardando aprovação', 'Aprovado', 'Falhou'].includes(j.status) && (
              <button className="btn" onClick={() => setReviseId(j.id)}>
                Solicitar alterações
              </button>
            )}
            {j.status === 'Aprovado' && (
              <button
                className="btn"
                disabled={busy}
                onClick={() =>
                  void action(
                    `jobs/${j.id}`,
                    'PATCH',
                    { action: 'shared' },
                    'Compartilhamento manual registrado. Nenhuma mensagem foi enviada.',
                  )
                }
              >
                Registrar envio manual ao cliente
              </button>
            )}
            <small className="muted">
              Acesso privado deve ser controlado pelo provedor da prévia.
            </small>
          </div>
        </article>
      ))}
      {reviseId && (
        <Modal title="Solicitar alterações" close={() => setReviseId(null)}>
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await action(`jobs/${reviseId}`, 'PATCH', { action: 'revise', revision })) {
                setReviseId(null);
                setRevision('');
              }
            }}
          >
            <label>
              O que precisa mudar?
              <textarea
                required
                minLength={5}
                maxLength={3000}
                value={revision}
                onChange={(e) => setRevision(e.target.value)}
              />
            </label>
            <button className="btn primary" disabled={busy}>
              Enviar revisão ao worker
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
function Reports({ data, notify }: { data: Data; notify: (s: string) => void }) {
  async function download() {
    try {
      const result = await api('export');
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cadu-ai-exportacao.json';
      a.click();
      URL.revokeObjectURL(url);
      notify('Exportação concluída. O arquivo contém dados pessoais; armazene com cuidado.');
    } catch (e) {
      notify((e as Error).message);
    }
  }
  return (
    <>
      <div className="section-toolbar">
        <Badge>Fonte: banco de dados do workspace</Badge>
        <button className="btn" onClick={() => void download()}>
          <Download size={15} />
          Exportar dados do CRM
        </button>
      </div>
      <div className="rate-cards">
        {[
          {
            label: 'Taxa de resposta acompanhada',
            value: data.metrics.responseRate,
            note: `${data.metrics.responded} respostas em ${data.metrics.tracked} contatos com acompanhamento explícito.`,
          },
          {
            label: 'Taxa de interesse registrada',
            value: data.metrics.interestRate,
            note: 'Entre empresas com respostas aprovadas.',
          },
          {
            label: 'Conversão em vendas registrada',
            value: data.metrics.conversionRate,
            note: 'Vendas registradas entre contatos confirmados.',
          },
        ].map((r) => (
          <article className="panel rate-card" key={r.label}>
            <h3>{r.label}</h3>
            <strong>{r.value === null ? '—' : `${r.value}%`}</strong>
            <p>
              {r.value === null ? 'Sem dados suficientes. ' : ''}
              {r.note} Não inclui eventos desconhecidos no WhatsApp.
            </p>
          </article>
        ))}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Empresas e mensagens</h2>
            <p>Últimos 14 dias · fuso de São Paulo</p>
          </div>
        </div>
        <Performance data={data} />
      </section>
      <div className="dashboard-columns report-columns">
        <section className="panel stack">
          <h2>Distribuição por etapa</h2>
          {data.metrics.funnel.map((f) => (
            <div className="report-row" key={f.stage}>
              <span>{f.stage}</span>
              <strong>{f.count}</strong>
            </div>
          ))}
        </section>
        <section className="panel stack">
          <h2>Consumo de APIs</h2>
          <p className="muted">
            Consultas reservadas, incluindo falhas. O custo depende dos campos e do contrato de cada
            provedor.
          </p>
          {!data.usage.length ? (
            <p>Nenhuma consulta registrada.</p>
          ) : (
            data.usage
              .slice(-14)
              .reverse()
              .map((u) => (
                <div className="report-row" key={u.day}>
                  <span>{u.day.split('-').reverse().join('/')}</span>
                  <strong>
                    {u.places} Places · {u.search} pesquisa
                  </strong>
                </div>
              ))
          )}
          <div className="notice">
            Consulte o faturamento oficial do provedor para os valores reais. Esta versão não lê
            faturas automaticamente.
          </div>
        </section>
      </div>
    </>
  );
}
const envGroups = [
  {
    id: 'manual',
    keys: [],
    text: 'Funciona com seu WhatsApp pessoal. Links oficiais wa.me, sem outro número ou chip. A plataforma prepara o texto e você confirma o envio.',
  },
  {
    id: 'database',
    keys: ['DATABASE_DRIVER=supabase', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY'],
    text: 'Aplique a migração em supabase/migrations antes de mudar o driver. O SQLite atual funciona localmente.',
  },
  {
    id: 'places',
    keys: ['GOOGLE_PLACES_API_KEY'],
    text: 'Ative Places API (New), configure faturamento, restrinja a chave ao servidor e defina cotas no Google Cloud.',
  },
  {
    id: 'search',
    keys: ['BRAVE_SEARCH_API_KEY'],
    text: 'Pesquisa oficial complementar. Resultados são evidências para revisão, não confirmação automática.',
  },
  {
    id: 'whatsapp',
    keys: [
      'WHATSAPP_ACCESS_TOKEN',
      'WHATSAPP_PHONE_NUMBER_ID',
      'WHATSAPP_BUSINESS_ACCOUNT_ID',
      'WHATSAPP_APP_SECRET',
      'WHATSAPP_VERIFY_TOKEN',
      'WHATSAPP_GRAPH_VERSION',
      'WHATSAPP_MARKETING_TEMPLATE',
      'WHATSAPP_TEMPLATE_LANGUAGE',
    ],
    text: 'Opcional; não é necessária para o WhatsApp pessoal. Configure /api/webhooks/whatsapp na Meta e assine mensagens, status e alertas. O template inicial não pode exigir parâmetros nesta versão.',
  },
  {
    id: 'ai',
    keys: ['OPENAI_API_KEY', 'OPENAI_MODEL'],
    text: 'Provedor real de sugestões para revisão humana. Nenhuma resposta é enviada automaticamente.',
  },
  {
    id: 'generator',
    keys: ['GENERATOR_URL', 'GENERATOR_TOKEN', 'WORKER_TOKEN', 'PREVIEW_ORIGIN'],
    text: 'Exige provedor isolado com autenticação, limites de recursos e prévias privadas. Consulte docs/generation.md.',
  },
  {
    id: 'github',
    keys: [],
    text: 'O código desta plataforma é versionado no GitHub. Publicação de projetos de clientes permanece manual nesta versão.',
  },
];
function SettingsPanel({ data, action, busy }: { data: Data; action: Action; busy: boolean }) {
  const [settings, setSettings] = useState(data.settings);
  return (
    <div className="settings-layout">
      <section className="panel stack">
        <h2>Controles operacionais</h2>
        <p className="muted">
          Limites internos complementam as regras oficiais. Não garantem a ausência de restrições da
          plataforma.
        </p>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void action('settings', 'PATCH', settings);
          }}
        >
          <label>
            Novos contatos por dia
            <input
              type="number"
              min={1}
              max={100}
              value={settings.dailyLimit}
              onChange={(e) => setSettings({ ...settings, dailyLimit: Number(e.target.value) })}
            />
          </label>
          <label>
            Consultas Google Places por dia
            <input
              type="number"
              min={1}
              max={500}
              value={settings.placesDailyLimit}
              onChange={(e) =>
                setSettings({ ...settings, placesDailyLimit: Number(e.target.value) })
              }
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.paused}
              onChange={(e) => setSettings({ ...settings, paused: e.target.checked })}
            />
            Suspender todos os envios
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.notifications}
              onChange={(e) => setSettings({ ...settings, notifications: e.target.checked })}
            />
            Notificações no workspace
          </label>
          <label className="checkbox">
            <input type="checkbox" checked disabled />
            Aprovação manual obrigatória
          </label>
          <button className="btn primary" disabled={busy}>
            Salvar preferências
            <Check size={15} />
          </button>
        </form>
        <div className="notice">
          <Clock3 size={17} />A virada do dia segue America/Sao_Paulo. No modo pessoal, o registro
          de respostas e envios é manual. A API Meta opcional segue sua própria janela de
          atendimento.
        </div>
        <div className="divider" />
        <h3>Credenciais e acesso</h3>
        <p className="muted">
          As credenciais são configuradas somente no servidor em <code>.env.local</code> ou no
          gerenciador de segredos da hospedagem. Nenhum segredo é retornado ao navegador.
        </p>
      </section>
      <section className="stack">
        <div className="section-heading">
          <h2>Integrações</h2>
          <Badge>Configuração no servidor</Badge>
        </div>
        {envGroups.map((group) => {
          const status = data.integrations[group.id as keyof typeof data.integrations];
          return (
            <article className="panel integration-card" key={group.id}>
              <div>
                <span className={`integration-icon ${status.configured ? 'ready' : ''}`}>
                  <KeyRound size={17} />
                </span>
                <h3>{status.label}</h3>
                <Badge tone={status.configured ? 'green' : ''}>
                  {status.configured ? 'Configurada' : 'Pendente'}
                </Badge>
              </div>
              <p>{group.text}</p>
              {!!group.keys.length && (
                <div className="env-keys">
                  {group.keys.map((key) => (
                    <code key={key}>{key}</code>
                  ))}
                </div>
              )}
            </article>
          );
        })}
        <small className="muted">
          “Configurada” indica presença das variáveis. Uma operação bem-sucedida confirma acesso ao
          serviço.
        </small>
      </section>
    </div>
  );
}
