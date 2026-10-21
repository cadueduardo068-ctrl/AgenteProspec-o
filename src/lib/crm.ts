import { z } from 'zod';
import { event, stages, type Company, type State } from './domain';
import { brazilianPhone, whatsappPhone } from './phones';
const samePhone = (a: string, b: string) => {
  const first = whatsappPhone(a).phone;
  return !!first && first === whatsappPhone(b).phone;
};
const url = z
  .string()
  .max(1000)
  .refine((v) => !v || /^https?:\/\//.test(v), 'Informe uma URL http(s).');
export const companySchema = z.object({
  name: z.string().trim().min(2).max(160),
  niche: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  state: z.string().length(2),
  phone: z
    .string()
    .max(30)
    .default('')
    .transform((v) => (v ? brazilianPhone(v) : '')),
  address: z.string().trim().max(1000).default(''),
  website: url.default(''),
  source: url.min(8),
  verified: z.literal(true),
  services: z.string().max(3000).default(''),
  placeId: z.string().max(300).optional(),
});
export function addCompany(s: State, input: unknown) {
  const data = companySchema.parse(input);
  const provisional =
    data.placeId && s.companies.find((c) => c.placeId === data.placeId && !c.verified);
  if (provisional) {
    if (
      data.phone &&
      s.companies.some((c) => c.id !== provisional.id && samePhone(c.phone, data.phone))
    )
      throw new Error('Telefone associado a outra empresa.');
    Object.assign(provisional, data, { updatedAt: new Date().toISOString() });
    event(s, `${provisional.name}: informações verificadas pelo administrador`, provisional.id);
    return provisional;
  }
  if (
    s.companies.some(
      (c) => (data.placeId && c.placeId === data.placeId) || samePhone(c.phone, data.phone),
    )
  )
    throw new Error('Empresa já cadastrada.');
  const company: Company = {
    ...data,
    id: crypto.randomUUID(),
    stage: 'Empresa encontrada',
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    optedOut: false,
    human: false,
  };
  s.companies.push(company);
  event(s, `${company.name} adicionada ao CRM`, company.id);
  return company;
}
/** A draft is deliberately independent from the verified registration schema. */
export function provisionalCompany(s: State, input: unknown) {
  const data = z
    .object({
      placeId: z.string().trim().min(1).max(300),
      name: z.string().trim().max(160).default(''),
      niche: z.string().trim().max(100).default(''),
      city: z.string().trim().max(100).default(''),
      state: z.string().max(2).default(''),
      phone: z.string().max(30).default(''),
      address: z.string().max(1000).default(''),
      website: url.default(''),
      source: url.default(''),
    })
    .parse(input);
  const existing = s.companies.find(
    (c) => c.placeId === data.placeId || samePhone(c.phone, data.phone),
  );
  if (existing) return existing;
  const now = new Date().toISOString();
  const c: Company = {
    ...data,
    name: data.name || 'Empresa sem nome confirmado',
    id: crypto.randomUUID(),
    verified: false,
    services: '',
    notes: '',
    stage: 'Empresa encontrada',
    createdAt: now,
    updatedAt: now,
    optedOut: false,
    human: false,
  };
  s.companies.push(c);
  event(s, `${c.name}: registro provisório, dados não verificados`, c.id);
  return c;
}
export function getCompany(s: State, id: string) {
  const c = s.companies.find((c) => c.id === id);
  if (!c) throw new Error('Empresa não encontrada.');
  return c;
}
export function updateCompany(s: State, id: string, input: unknown) {
  const patch = z
    .object({
      stage: z.enum(stages).optional(),
      notes: z.string().max(10000).optional(),
      human: z.boolean().optional(),
      services: z.string().max(3000).optional(),
      followup: z
        .enum(['desconhecido', 'aguardando resposta', 'resposta recebida', 'sem resposta'])
        .optional(),
    })
    .strict()
    .parse(input);
  const c = getCompany(s, id);
  if (patch.stage && c.optedOut && patch.stage !== 'Não contatar')
    throw new Error('Uma recusa não pode ser removida pela alteração de etapa.');
  if (patch.stage && ['WhatsApp aberto', 'Envio confirmado', 'Não contatar'].includes(patch.stage))
    throw new Error('Esta etapa é controlada pelas ações auditáveis de contato e exclusão.');
  if (Object.entries(patch).every(([key, value]) => c[key as keyof Company] === value)) return c;
  if (patch.stage === 'Sem interesse') optOut(s, id);
  Object.assign(c, patch, { updatedAt: new Date().toISOString() });
  event(
    s,
    `${c.name}: ${patch.stage ? `etapa alterada para ${patch.stage}` : patch.notes !== undefined ? 'anotações atualizadas' : 'cadastro atualizado'}`,
    id,
    'edição do administrador',
  );
  return c;
}
export function optOut(s: State, id: string) {
  const c = getCompany(s, id);
  c.optedOut = true;
  delete c.consent;
  c.stage = 'Não contatar';
  if (c.phone && !s.exclusions.includes(c.phone)) s.exclusions.push(c.phone);
  // Never remove exclusions when deleting the company.
  for (const m of s.messages)
    if (m.companyId === id && m.status === 'reservado') {
      m.status = 'cancelado';
      const ledger = s.contactLedger.find((l) => l.id === m.id);
      if (ledger) ledger.status = 'cancelled';
    }
  for (const contact of s.contacts)
    if (contact.companyId === id && contact.status === 'aberto') contact.status = 'cancelado';
  event(s, `${c.name}: contato bloqueado por recusa`, id);
}
export function grantConsent(s: State, id: string, input: unknown) {
  const data = z
    .object({ evidence: z.string().trim().min(15).max(2000), confirmed: z.literal(true) })
    .parse(input);
  const c = getCompany(s, id);
  if (!c.verified)
    throw new Error(
      'Verifique as informações antes de autorizar contato. O prompt pode ser gerado sem verificação.',
    );
  if (!c.phone || c.optedOut || s.exclusions.includes(c.phone))
    throw new Error('Contato ausente ou na lista permanente de exclusão.');
  c.consent = { at: new Date().toISOString(), evidence: data.evidence, phone: c.phone };
  event(s, `${c.name}: autorização registrada`, id);
}
export function draftApproach(c: Company) {
  return `Olá, tudo bem? Estou falando com o responsável pela ${c.name}? Trabalho com criação de sites profissionais na CADU AI e gostaria de apresentar uma ideia para vocês. Posso explicar brevemente?`;
}
