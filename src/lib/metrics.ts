import { dayInSaoPaulo, initialContacts, stages, score, type State } from './domain';
export function metrics(s: State) {
  const today = dayInSaoPaulo();
  const companies = s.companies.filter((c) => !c.archived);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 13 + i);
    return dayInSaoPaulo(d);
  });
  const confirmed = s.contacts.filter((c) => c.status === 'confirmado');
  const contacted = new Set(confirmed.map((c) => c.companyId));
  const followed = new Set(
    s.analyses.filter((a) => a.applied && contacted.has(a.companyId)).map((a) => a.companyId),
  );
  const tracked = companies.filter(
    (c) => contacted.has(c.id) && c.followup && c.followup !== 'desconhecido',
  );
  const responded = tracked.filter((c) => c.followup === 'resposta recebida').length;
  const interested = companies.filter((c) =>
    [
      'Interessado',
      'Demonstração solicitada',
      'Site em geração',
      'Demonstração pronta',
      'Demonstração enviada',
      'Em negociação',
      'Venda concluída',
    ].includes(c.stage),
  ).length;
  const sales = companies.filter((c) => c.stage === 'Venda concluída').length;
  return {
    companies: companies.length,
    noWebsite: companies.filter((c) => !c.website).length,
    qualified: companies.filter((c) => score(c).value >= 70 && !c.optedOut).length,
    prepared: companies.filter((c) => !!c.draft).length,
    opened: s.contacts.filter((c) => c.status === 'aberto').length,
    authorized: companies.filter((c) => c.consent && !c.optedOut).length,
    sentToday: confirmed.filter((c) => c.day === today).length,
    responses: s.analyses.filter((a) => a.applied).length,
    interested,
    requested:
      s.jobs.length +
      s.tasks.filter(
        (t) =>
          t.title === 'Revisar briefing e gerar demonstração' &&
          !s.jobs.some((j) => j.companyId === t.companyId),
      ).length,
    demos: s.jobs.filter((j) => ['Aguardando aprovação', 'Aprovado', 'Enviado'].includes(j.status))
      .length,
    proposals: companies.filter((c) => c.stage === 'Em negociação').length,
    sales,
    contactsToday: s.contactLedger.filter((c) => c.day === today && c.status === 'confirmed')
      .length,
    dailyLimit: s.settings.dailyLimit,
    remaining: Math.max(
      0,
      s.settings.dailyLimit -
        s.contactLedger.filter((c) => c.day === today && c.status === 'confirmed').length,
    ),
    responseRate: tracked.length ? Math.round((responded / tracked.length) * 100) : null,
    interestRate: followed.size
      ? Math.round(
          (new Set(
            s.analyses
              .filter(
                (a) =>
                  a.applied &&
                  ['interesse', 'demonstração'].includes(a.intent) &&
                  followed.has(a.companyId),
              )
              .map((a) => a.companyId),
          ).size /
            followed.size) *
            100,
        )
      : null,
    conversionRate: contacted.size
      ? Math.round(
          (companies.filter((c) => c.stage === 'Venda concluída' && contacted.has(c.id)).length /
            contacted.size) *
            100,
        )
      : null,
    followed: followed.size,
    contacted: contacted.size,
    tracked: tracked.length,
    responded,
    funnel: stages.map((stage) => ({
      stage,
      count: companies.filter((c) => c.stage === stage).length,
    })),
    performance: days.map((day) => ({
      day,
      empresas: companies.filter((c) => dayInSaoPaulo(new Date(c.createdAt)) === day).length,
      mensagens: confirmed.filter((c) => c.day === day).length,
    })),
  };
}
