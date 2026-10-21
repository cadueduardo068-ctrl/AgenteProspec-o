'use client';
import { useState } from 'react';
import { Search, ArrowUpRight, MessagesSquare } from 'lucide-react';
import { stages, type Company, type State } from '@/lib/domain';
export const commercialStageLabel = (stage: string) =>
  stage === 'WhatsApp aberto'
    ? 'WhatsApp aberto — envio não confirmado'
    : stage === 'Envio confirmado'
      ? 'Mensagem enviada'
      : stage;
export function nextAction(c: Company, state: Pick<State, 'tasks' | 'contacts'>) {
  if (c.optedOut) return 'Não realizar novos contatos';
  if (state.contacts.some((item) => item.companyId === c.id && item.status === 'aberto'))
    return 'Confirmar envio ou informar que não enviou';
  const task = state.tasks
    .filter((t) => t.companyId === c.id && !t.done)
    .sort((a, b) => (a.dueAt || 'z').localeCompare(b.dueAt || 'z'))[0];
  if (task) return task.title;
  if (!state.contacts.some((item) => item.companyId === c.id && item.status === 'confirmado'))
    return c.consent
      ? 'Revisar a abordagem e abrir novamente, se autorizado'
      : 'Verificar autorização antes do contato';
  if (c.stage === 'Demonstração solicitada') return 'Gerar briefing e prompt do site';
  if (c.stage === 'Venda concluída') return 'Acompanhar entrega';
  if (c.stage === 'Interessado') return 'Alinhar necessidades e próximos passos';
  return 'Registrar resposta ou agendar acompanhamento';
}
export default function ContactedCompanies({
  data,
  select,
  compose,
}: {
  data: Pick<State, 'companies' | 'contacts' | 'tasks'>;
  select: (id: string) => void;
  compose: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState('');
  const [sort, setSort] = useState('updated');
  const [archived, setArchived] = useState(false);
  const first = (id: string) =>
    data.contacts
      .filter((item) => item.companyId === id)
      .reduce((at, item) => (!at || item.openedAt < at ? item.openedAt : at), '');
  const rows = data.companies
    .filter(
      (c) =>
        first(c.id) &&
        !!c.archived === archived &&
        (!stage || c.stage === stage) &&
        `${c.name} ${c.niche} ${c.city}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name, 'pt-BR')
        : sort === 'first'
          ? first(b.id).localeCompare(first(a.id))
          : b.updatedAt.localeCompare(a.updatedAt),
    );
  const date = (at: string) =>
    new Date(at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return (
    <>
      <div className="toolbar">
        <div className="search-field">
          <Search size={16} />
          <input
            aria-label="Pesquisar empresas contatadas"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Empresa, nicho ou cidade…"
          />
        </div>
        <select
          aria-label="Status das contatadas"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
        >
          <option value="">Todos os status</option>
          {stages.map((s) => (
            <option key={s} value={s}>
              {commercialStageLabel(s)}
            </option>
          ))}
        </select>
        <select
          aria-label="Ordenar empresas contatadas"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="updated">Atualização mais recente</option>
          <option value="first">Primeiro contato mais recente</option>
          <option value="name">Nome de A a Z</option>
        </select>
        <button
          className={`btn ${archived ? 'selected' : ''}`}
          onClick={() => setArchived(!archived)}
        >
          Arquivadas
        </button>
      </div>
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Empresa / nicho</th>
              <th>Cidade</th>
              <th>Primeiro contato aberto</th>
              <th>Última atualização</th>
              <th>Status atual</th>
              <th>Próxima ação</th>
              <th>Acompanhar</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <button className="table-name" onClick={() => select(c.id)}>
                    <strong>{c.name}</strong>
                  </button>
                  <small className="table-subtitle">{c.niche}</small>
                </td>
                <td>
                  {c.city}, {c.state}
                </td>
                <td>{date(first(c.id))}</td>
                <td>{date(c.updatedAt)}</td>
                <td>
                  <span
                    className={`badge ${c.optedOut ? 'red' : c.stage === 'Envio confirmado' ? 'green' : 'blue'}`}
                  >
                    {commercialStageLabel(c.stage)}
                  </span>
                  {data.contacts.some(
                    (item) => item.companyId === c.id && item.status === 'aberto',
                  ) &&
                    c.stage !== 'WhatsApp aberto' && (
                      <small className="table-subtitle queue-status">
                        Há envio pendente de confirmação
                      </small>
                    )}
                </td>
                <td className="next-action-cell">{nextAction(c, data)}</td>
                <td>
                  <div className="button-row">
                    <button className="text-btn" onClick={() => select(c.id)}>
                      Ver detalhes
                      <ArrowUpRight size={14} />
                    </button>
                    <button
                      className="icon-btn"
                      aria-label={`WhatsApp de ${c.name}`}
                      disabled={!c.phone || c.optedOut}
                      onClick={() => compose(c.id)}
                    >
                      <MessagesSquare size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="empty">
            <div className="empty-icon">
              <MessagesSquare size={26} />
            </div>
            <h3>Seu acompanhamento comercial começa aqui</h3>
            <p>
              Empresas entram nesta lista quando você abre uma conversa pela plataforma. Abrir não
              confirma envio.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
