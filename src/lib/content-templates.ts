import type { Company, ManualContact } from './domain';
export function commercialContactStatus(
  contacts: ManualContact[],
  companyId: string,
  text: string,
  versionId?: string,
) {
  const matches = contacts.filter(
    (c) =>
      c.companyId === companyId &&
      c.text === text &&
      (!versionId ||
        c.commercialMessageId === versionId ||
        (!c.commercialMessageId && versionId === companyId)),
  );
  if (matches.some((c) => c.status === 'confirmado')) return 'Envio confirmado manualmente';
  if (matches.some((c) => c.status === 'aberto')) return 'WhatsApp aberto · envio não confirmado';
  if (matches.some((c) => c.status === 'cancelado'))
    return 'Abertura cancelada · sem envio confirmado';
  return 'Rascunho · nenhum envio';
}
export const messagePurposes = [
  'Primeiro contato',
  'Apresentar proposta',
  'Cliente interessado',
  'Oferecer demonstração',
  'Enviar demonstração',
] as const;
export const legacyPurposes = [
  'Primeira abordagem',
  'Apresentação da proposta',
  'Resposta sobre valores',
  'Apresentação da demonstração',
] as const;
export type MessagePurpose = (typeof messagePurposes)[number];
type Purpose = MessagePurpose | (typeof legacyPurposes)[number];
export function normalizePurpose(purpose: string): MessagePurpose {
  if (purpose === 'Primeira abordagem') return 'Primeiro contato';
  if (purpose === 'Apresentação da proposta') return 'Apresentar proposta';
  if (purpose === 'Apresentação da demonstração') return 'Enviar demonstração';
  return messagePurposes.includes(purpose as MessagePurpose)
    ? (purpose as MessagePurpose)
    : 'Primeiro contato';
}
export function nicheBenefit(niche: string) {
  if (/psic|clínic|clinic|odont|dentist|nutri|estét|pilates/i.test(niche))
    return 'apresentar os atendimentos e facilitar pedidos de agendamento';
  if (/restaur|pizz|padaria|cafet|confeit/i.test(niche))
    return 'organizar informações do negócio e facilitar pedidos de informações';
  if (/advog|contad|consult/i.test(niche))
    return 'explicar as áreas de atuação e facilitar consultas de novos clientes';
  if (/arquitet|engenh|fotógraf|constru/i.test(niche))
    return 'valorizar projetos autorizados e facilitar pedidos de orçamento';
  return 'apresentar os serviços e facilitar pedidos de orçamento';
}
export function messageTemplate(c: Company, purpose: Purpose, demoUrl?: string, variant = 0) {
  if (purpose === 'Resposta sobre valores')
    return 'O valor depende do escopo e dos recursos do site. Prefiro entender o que vocês precisam para apresentar uma proposta correta. Podemos alinhar esses pontos?';
  const type = normalizePurpose(purpose);
  const place = c.verified && c.city ? ` em ${c.city}` : '';
  const benefit = nicheBenefit(c.niche);
  const options: Record<MessagePurpose, string[]> = {
    'Primeiro contato': [
      `Olá, tudo bem? Estou falando com o responsável pela ${c.name}? Sou da CADU AI e trabalho com criação de sites. Posso compartilhar uma ideia para ${benefit}?`,
      `Oi! Este é o contato do responsável pela ${c.name}? Trabalho com sites na CADU AI e pensei em uma proposta para ${benefit}. Posso explicar brevemente?`,
    ],
    'Apresentar proposta': [
      `Minha proposta para ${c.name} é um site para ${benefit}${place}. Podemos conversar sobre o que faria sentido para a empresa?`,
      `Para ${c.name}, podemos planejar um site com foco em ${benefit}${place}. Qual seria a prioridade de vocês hoje?`,
    ],
    'Cliente interessado': [
      `Obrigado pelo interesse! Para pensar em algo adequado à ${c.name}, quais serviços vocês gostariam de destacar e como preferem receber os contatos?`,
      `Que bom conversar sobre o site da ${c.name}! Podemos alinhar os serviços a apresentar e o melhor canal de contato antes de definir a proposta?`,
    ],
    'Oferecer demonstração': [
      `Você gostaria de conhecer uma prévia personalizada de como poderia ser o site da ${c.name}? A ideia seria mostrar uma proposta visual para ${benefit}, sem compromisso.`,
      `Posso preparar uma proposta visual de site para ${c.name}, com foco em ${benefit}? Você teria interesse em avaliar essa ideia?`,
    ],
    'Enviar demonstração': demoUrl
      ? [
          `Olá! Compartilho a prévia aprovada para o site da ${c.name}: ${demoUrl} O que achou da proposta? Podemos ajustar os detalhes juntos.`,
          `Aqui está a prévia aprovada do site da ${c.name}: ${demoUrl} Quando puder, me conte o que funciona para vocês e o que gostariam de ajustar.`,
        ]
      : [
          `[PENDENTE: aprovar e informar o PDF ou link de prévia da ${c.name} antes de enviar a demonstração.]`,
        ],
  };
  return options[type][variant % options[type].length];
}
