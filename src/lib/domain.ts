import {
  curatedInspirations,
  type Inspiration,
  type InspirationCollection,
  type InspirationUse,
} from './inspirations';
export const stages = [
  'Empresa encontrada',
  'Oportunidade qualificada',
  'Abordagem preparada',
  'WhatsApp aberto',
  'Envio confirmado',
  'Respondeu',
  'Interessado',
  'Demonstração solicitada',
  'Site em geração',
  'Demonstração pronta',
  'Demonstração enviada',
  'Em negociação',
  'Venda concluída',
  'Sem interesse',
  'Não contatar',
] as const;
export type Stage = (typeof stages)[number];
export type Company = {
  id: string;
  placeId?: string;
  name: string;
  niche: string;
  city: string;
  state: string;
  phone: string;
  website: string;
  source: string;
  address?: string;
  verified: boolean;
  contactVerification?: { phone: string; at: string };
  services: string;
  stage: Stage;
  notes: string;
  createdAt: string;
  updatedAt: string;
  consent?: { at: string; evidence: string; phone: string };
  optedOut: boolean;
  human: boolean;
  archived?: boolean;
  draft?: string;
  draftMeta?: { purpose: string; method: 'template' | 'openai'; at: string };
  lastContactAt?: string;
  followup?: 'desconhecido' | 'aguardando resposta' | 'resposta recebida' | 'sem resposta';
};
export type Message = {
  id: string;
  companyId: string;
  direction: 'in' | 'out';
  text: string;
  at: string;
  status: string;
  providerId?: string;
  intent?: string;
  kind?: 'initial' | 'reply';
  day?: string;
};
export const jobStages = [
  'Aguardando geração',
  'Gerando código',
  'Instalando dependências',
  'Executando testes',
  'Preparando prévia',
  'Aguardando aprovação',
  'Aprovado',
  'Enviado',
  'Falhou',
] as const;
export type Job = {
  id: string;
  companyId: string;
  status: (typeof jobStages)[number];
  createdAt: string;
  updatedAt: string;
  previewUrl?: string;
  desktopScreenshot?: string;
  mobileScreenshot?: string;
  error?: string;
  revision?: string;
  leaseUntil?: string;
  attempts: number;
  checks?: string[];
  approvedAt?: string;
  brief?: Record<string, string>;
};
export type Task = {
  id: string;
  companyId: string;
  title: string;
  done: boolean;
  at: string;
  dueAt?: string;
  description?: string;
};
export type ManualContact = {
  id: string;
  companyId: string;
  phone: string;
  text: string;
  commercialMessageId?: string;
  status: 'aberto' | 'confirmado' | 'cancelado';
  openedAt: string;
  confirmedAt?: string;
  day: string;
  kind?: 'initial' | 'followup';
};
export type Analysis = {
  id: string;
  companyId: string;
  intent: string;
  confidence: number;
  summary: string;
  nextAction: string;
  suggestion: string;
  suggestedStage: Stage | null;
  method: 'rules' | 'openai';
  at: string;
  applied: boolean;
  source: 'texto colado' | 'arquivo importado';
  rawText?: string;
};
export type State = {
  inspirations: Inspiration[];
  inspirationCollections: InspirationCollection[];
  inspirationUses: InspirationUse[];
  commercialMessages: CommercialMessage[];
  prompts: SitePrompt[];
  recentCities: { id: number; name: string; uf: string }[];
  companies: Company[];
  messages: Message[];
  jobs: Job[];
  tasks: Task[];
  contacts: ManualContact[];
  analyses: Analysis[];
  contactLedger: {
    id: string;
    phoneHash: string;
    day: string;
    status: 'reserved' | 'confirmed' | 'cancelled';
    origin: 'manual' | 'api';
  }[];
  events: { id: string; title: string; at: string; companyId?: string; source: string }[];
  exclusions: string[];
  webhookIds: string[];
  settings: {
    dailyLimit: number;
    placesDailyLimit: number;
    paused: boolean;
    notifications: boolean;
    manualApproval: boolean;
  };
  usage: { day: string; places: number; search: number }[];
  rateLimits: Record<string, { start: number; count: number }>;
};
export const initialState = (): State => ({
  inspirations: curatedInspirations(),
  inspirationCollections: [],
  inspirationUses: [],
  commercialMessages: [],
  prompts: [],
  recentCities: [],
  companies: [],
  messages: [],
  jobs: [],
  tasks: [],
  contacts: [],
  analyses: [],
  contactLedger: [],
  events: [],
  exclusions: [],
  webhookIds: [],
  settings: {
    dailyLimit: 10,
    placesDailyLimit: 30,
    paused: false,
    notifications: true,
    manualApproval: true,
  },
  usage: [],
  rateLimits: {},
});
export type SitePrompt = {
  inspirationId?: string;
  id: string;
  companyId: string;
  text: string;
  method: 'template' | 'openai';
  plan: 'landing page' | 'site institucional';
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
};
export type CommercialMessage = {
  id: string;
  companyId: string;
  text: string;
  purpose: string;
  method: 'template' | 'openai';
  createdAt: string;
  approvedDemoUrl?: string;
};
export function normalizeState(saved: Partial<State>): State {
  return {
    ...initialState(),
    ...saved,
    commercialMessages:
      saved.commercialMessages ??
      (saved.companies || [])
        .filter((c) => c.draft?.trim())
        .map((c) => ({
          id: c.id,
          companyId: c.id,
          text: c.draft!,
          purpose: c.draftMeta?.purpose || 'Primeiro contato',
          method: c.draftMeta?.method || 'template',
          createdAt: c.draftMeta?.at || c.updatedAt,
        })),
    settings: { ...initialState().settings, ...saved.settings },
  };
}
export function dayInSaoPaulo(at = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}
export function phoneNumber(value: string) {
  const clean = value.replace(/[\s()+.-]/g, '');
  if (!/^[1-9]\d{9,14}$/.test(clean))
    throw new Error('Use telefone internacional válido, incluindo o código do país (ex.: +55).');
  return clean;
}
export function score(
  company: Pick<Company, 'website' | 'phone' | 'niche' | 'services' | 'verified'>,
) {
  const reasons: { label: string; points: number }[] = [];
  if (websitePresence(company.website) !== 'website')
    reasons.push({
      label:
        websitePresence(company.website) === 'social'
          ? 'Canal social identificado; site próprio ainda não confirmado'
          : 'Site ainda não identificado; precisa de verificação adicional',
      points: 35,
    });
  if (company.phone)
    reasons.push({ label: 'Canal comercial informado (não implica consentimento)', points: 15 });
  if (
    /psic|clín|clinic|estét|estet|limpeza|higien|lava|odont|advog|salão|salao/i.test(company.niche)
  )
    reasons.push({ label: 'Segmento com potencial para agendamentos ou orçamentos', points: 20 });
  if (company.services)
    reasons.push({ label: 'Serviços confirmados para orientar uma página', points: 15 });
  if (company.verified)
    reasons.push({ label: 'Informações revisadas pelo administrador', points: 15 });
  const value = reasons.reduce((sum, r) => sum + r.points, 0);
  return {
    value,
    label:
      value >= 70 ? 'Alta oportunidade' : value >= 40 ? 'Média oportunidade' : 'Baixa oportunidade',
    reasons,
  };
}
export function websitePresence(value: string): 'none' | 'social' | 'website' {
  if (!value) return 'none';
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
    return [
      'instagram.com',
      'facebook.com',
      'fb.com',
      'wa.me',
      'api.whatsapp.com',
      'tiktok.com',
      'linktr.ee',
      'youtube.com',
      'x.com',
      'twitter.com',
    ].some((s) => host === s || host.endsWith(`.${s}`))
      ? 'social'
      : 'website';
  } catch {
    return 'none';
  }
}
export function intent(text: string) {
  if (
    /\b(não quero|nao quero|não tenho interesse|nao tenho interesse|não estou interessad|nao estou interessad|não preciso|nao preciso|pare|parar|remover|sair|cancelar|sem interesse|não autorizo|nao autorizo|stop)/i.test(
      text,
    )
  )
    return 'recusa';
  if (/humano|atendente|pessoa/i.test(text)) return 'humano';
  if (/demonstra|demonstre|demo\b|prévia|previa|ver o site/i.test(text)) return 'demonstração';
  if (/preço|preco|valor|custa|orçamento|orcamento/i.test(text)) return 'preço';
  if (/interess|quero conhecer|pode mostrar/i.test(text)) return 'interesse';
  return 'informações';
}
export function event(state: State, title: string, companyId?: string, source = 'CADU AI') {
  const at = new Date().toISOString();
  const company = state.companies.find((c) => c.id === companyId);
  if (company) company.updatedAt = at;
  state.events.unshift({
    id: crypto.randomUUID(),
    title,
    companyId,
    at,
    source,
  });
}
export function initialContacts(state: State, day = dayInSaoPaulo()) {
  return state.contactLedger.filter((c) => c.day === day && c.status !== 'cancelled').length;
}
