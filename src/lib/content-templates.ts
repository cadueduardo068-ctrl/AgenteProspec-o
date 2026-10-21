import type { Company } from './domain';
export const messagePurposes = [
  'Primeira abordagem',
  'Apresentação da proposta',
  'Cliente interessado',
  'Resposta sobre valores',
  'Apresentação da demonstração',
] as const;
export type MessagePurpose = (typeof messagePurposes)[number];
export function messageTemplate(c: Company, purpose: MessagePurpose) {
  const options: Record<MessagePurpose, string> = {
    'Primeira abordagem': `Olá, tudo bem? Estou falando com o responsável pela ${c.name}? Sou da CADU AI, trabalho com criação de sites profissionais e gostaria de apresentar uma ideia para vocês. Posso explicar brevemente?`,
    'Apresentação da proposta': `Minha ideia para ${c.name} é um site que apresente os serviços de forma clara e facilite o contato de quem procura vocês em ${c.city}. Podemos conversar sobre o que seria mais útil para a empresa?`,
    'Cliente interessado': `Obrigado pelo interesse! Para pensar em algo adequado à ${c.name}, quais serviços vocês gostariam de destacar e como preferem receber os contatos?`,
    'Resposta sobre valores':
      'O valor depende do escopo e dos recursos do site. Prefiro entender o que vocês precisam para apresentar uma proposta correta. Podemos alinhar esses pontos?',
    'Apresentação da demonstração': `A demonstração para ${c.name} estará sujeita à sua revisão. Assim que o link estiver aprovado, posso compartilhar para você avaliar a proposta visual.`,
  };
  return options[purpose];
}
