'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Clipboard,
  MessagesSquare,
  Check,
  ShieldCheck,
  Loader2,
  ExternalLink,
  MessageCircle,
  Pencil,
  Save,
  History,
} from 'lucide-react';
import {
  messagePurposes,
  messageTemplate,
  normalizePurpose,
  commercialContactStatus,
  type MessagePurpose,
} from '@/lib/content-templates';
import { whatsappPhone } from '@/lib/phones';
import type { Company } from '@/lib/domain';
import Dialog from './dialog';
import type { WorkspaceAction, WorkspaceData } from './client-api';
export default function ContactComposer({
  company: c,
  data,
  close,
  action,
  notify,
  busy,
}: {
  company: Company;
  data: WorkspaceData;
  close: () => void;
  action: WorkspaceAction;
  notify: (s: string) => void;
  busy: boolean;
}) {
  const history = data.commercialMessages
    .filter((m) => m.companyId === c.id)
    .slice()
    .reverse();
  const latest = history[0];
  const defaultPurpose = normalizePurpose(
    c.draftMeta?.purpose ||
      latest?.purpose ||
      (['Interessado', 'Em negociação'].includes(c.stage)
        ? 'Cliente interessado'
        : 'Primeiro contato'),
  );
  const [purpose, setPurpose] = useState<MessagePurpose>(defaultPurpose);
  const [text, setText] = useState(c.draft || latest?.text || messageTemplate(c, defaultPurpose));
  const [method, setMethod] = useState(c.draftMeta?.method || 'template');
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>(latest?.id);
  const approvedJob = data.jobs
    .slice()
    .reverse()
    .find(
      (j) =>
        j.companyId === c.id &&
        j.approvedAt &&
        ['Aprovado', 'Enviado'].includes(j.status) &&
        j.previewUrl,
    );
  const [demoUrl, setDemoUrl] = useState(latest?.approvedDemoUrl || approvedJob?.previewUrl || '');
  const [demoApproved, setDemoApproved] = useState(
    !!(latest?.approvedDemoUrl || approvedJob?.previewUrl),
  );
  const once = useRef(false);
  const variant = useRef(0);
  const [evidence, setEvidence] = useState('');
  const [working, setWorking] = useState(false);
  const [opened, setOpened] = useState<{ id: string; url: string } | null>(null);
  const [approved, setApproved] = useState(false);
  const phone = whatsappPhone(c.phone);
  const pending = data.contacts.find((item) => item.companyId === c.id && item.status === 'aberto');
  const contacted = data.contacts.some(
    (item) => item.companyId === c.id && item.status === 'confirmado',
  );
  const blocked = c.optedOut || c.archived || data.settings.paused;
  async function generate(nextPurpose = purpose) {
    setWorking(true);
    try {
      const result = await action(
        'commercial/message',
        'POST',
        {
          companyId: c.id,
          purpose: nextPurpose,
          variant: variant.current++,
          ...(nextPurpose === 'Enviar demonstração' && demoApproved && demoUrl.trim()
            ? { approvedDemo: { url: demoUrl.trim(), confirmed: true } }
            : {}),
        },
        'Mensagem preparada para revisão.',
      );
      if (result) {
        setText(String(result.text));
        setMethod(result.method === 'openai' ? 'openai' : 'template');
        setApproved(false);
        setEditing(false);
        setSelectedId(String(result.id));
      }
    } finally {
      setWorking(false);
    }
  }
  useEffect(() => {
    if (!once.current) {
      once.current = true;
      if (!history.length && !blocked) void generate();
    }
  }, []);
  async function save() {
    const result = await action(
      'commercial/messages',
      'POST',
      {
        companyId: c.id,
        text,
        purpose,
        method,
        ...(purpose === 'Enviar demonstração' && demoApproved && demoUrl.trim()
          ? { approvedDemoUrl: demoUrl.trim() }
          : {}),
      },
      'Mensagem salva no histórico comercial.',
    );
    if (result) {
      setSelectedId(String(result.id));
      setText(String(result.text));
    }
    return result;
  }
  async function open() {
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    setWorking(true);
    try {
      if (!(await save())) {
        popup?.close();
        return;
      }
      const saved = await action(
        'manual/prepare',
        'POST',
        { companyId: c.id, text },
        'Mensagem revisada e salva.',
      );
      if (!saved) {
        popup?.close();
        return;
      }
      const result = await action(
        contacted ? 'manual/followup' : 'manual/open',
        'POST',
        { companyId: c.id },
        'Conversa aberta — envio não confirmado.',
      );
      if (!result) {
        popup?.close();
        return;
      }
      setOpened({ id: String(result.contactId), url: String(result.url) });
      if (popup) popup.location.href = String(result.url);
      else notify('Pop-up bloqueado. Use o link “Continuar no WhatsApp” abaixo.');
    } catch {
      popup?.close();
      notify('Não foi possível abrir o WhatsApp. Nenhum envio foi confirmado.');
    } finally {
      setWorking(false);
    }
  }
  return (
    <Dialog title="Mensagem comercial com IA" close={close} tone="commercial">
      <div className="stack">
        <div className="contact-recipient">
          <span className="company-initial">{c.name.slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>{c.name}</strong>
            <small>{phone.phone ? `+${phone.phone}` : phone.error}</small>
          </div>
          <span className="badge green">
            <MessageCircle size={12} /> Texto para WhatsApp
          </span>
        </div>
        {blocked && (
          <div className="notice error">
            Contato bloqueado, arquivado ou suspenso. Não será aberto.
          </div>
        )}
        <label>
          Tipo de mensagem
          <select
            value={purpose}
            disabled={busy || working}
            onChange={(e) => {
              setPurpose(e.target.value as MessagePurpose);
              setSelectedId(undefined);
              setApproved(false);
              void generate(e.target.value as MessagePurpose);
            }}
          >
            {messagePurposes.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        {purpose === 'Enviar demonstração' && (
          <div className="consent-box stack">
            <label>
              PDF ou link de prévia aprovado
              <input
                type="url"
                value={demoUrl}
                placeholder="https://"
                maxLength={1000}
                onChange={(e) => {
                  setDemoUrl(e.target.value);
                  setDemoApproved(false);
                  setApproved(false);
                }}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={demoApproved}
                onChange={(e) => setDemoApproved(e.target.checked)}
              />
              Revisei e aprovei este link para compartilhar com o cliente.
            </label>
            <small className="muted">
              Após confirmar o link, gere outra versão. Sem prévia aprovada, o texto permanece como
              pendência.
            </small>
          </div>
        )}
        <div className="button-row">
          <button
            className="btn whatsapp"
            disabled={busy || working || blocked}
            onClick={() => void generate()}
          >
            {working ? <Loader2 size={15} className="spin" /> : <MessageCircle size={15} />}
            {working ? 'Preparando mensagem…' : 'Gerar outra versão'}
          </button>
          <span className="badge">
            {method === 'openai' ? 'Gerada por IA' : 'Modelo local · sem IA'}
          </span>
        </div>
        {working && (
          <p role="status" className="muted">
            Preparando uma mensagem curta para {c.name}…
          </p>
        )}
        <label>
          {editing ? 'Editar mensagem' : 'Texto da mensagem'}
          <textarea
            aria-label="Mensagem comercial"
            value={text}
            readOnly={!editing}
            minLength={1}
            maxLength={2000}
            style={{ minHeight: 150 }}
            onChange={(e) => {
              setText(e.target.value);
              setApproved(false);
            }}
          />
        </label>
        <div className="button-row">
          <button
            className="btn"
            disabled={working || busy}
            onClick={() => setEditing((value) => !value)}
          >
            <Pencil size={14} />
            {editing ? 'Concluir edição' : 'Editar'}
          </button>
          <button
            className="btn"
            disabled={working || busy || !text.trim()}
            onClick={() => void save()}
          >
            <Save size={14} />
            Salvar no CRM
          </button>
          <button
            className="text-btn"
            disabled={working || !text.trim()}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                notify('Mensagem copiada. Nenhum envio foi realizado.');
              } catch {
                notify('Selecione e copie o texto manualmente.');
              }
            }}
          >
            <Clipboard size={14} />
            Copiar mensagem
          </button>
        </div>
        {!c.verified && (
          <div className="notice amber">
            Dados provisórios. Você pode gerar, copiar e salvar a mensagem. Para abrir a conversa,
            verifique as informações no perfil e registre a autorização de contato.
          </div>
        )}
        {!c.consent && !blocked && c.verified && (
          <div className="consent-box stack">
            <h3>Autorização de contato</h3>
            <p className="muted">
              Número público não equivale a consentimento. Informe quando, por qual canal e para
              qual finalidade a empresa autorizou o contato.
            </p>
            <label>
              Evidência de autorização
              <textarea
                value={evidence}
                minLength={15}
                maxLength={2000}
                onChange={(e) => setEvidence(e.target.value)}
              />
            </label>
            <button
              className="btn"
              disabled={busy || evidence.trim().length < 15 || !phone.phone}
              onClick={() =>
                void action(
                  `companies/${c.id}/consent`,
                  'POST',
                  { evidence, confirmed: true },
                  'Autorização registrada.',
                )
              }
            >
              <ShieldCheck size={15} />
              Registrar autorização
            </button>
          </div>
        )}
        <label className="checkbox">
          <input
            type="checkbox"
            checked={approved}
            onChange={(e) => setApproved(e.target.checked)}
          />
          Revisei o destinatário, a autorização e o texto. Vou enviar pessoalmente.
        </label>
        <button
          className="btn whatsapp"
          disabled={
            busy ||
            working ||
            !approved ||
            !text.trim() ||
            !phone.phone ||
            !c.verified ||
            !c.consent ||
            blocked ||
            /\[PENDENTE:/.test(text)
          }
          onClick={() => void open()}
        >
          <MessagesSquare size={17} />
          Abrir WhatsApp
        </button>
        {(opened || pending) && (
          <div className="notice amber stack">
            <strong>WhatsApp aberto — envio não confirmado</strong>
            <p>
              A plataforma não sabe se você enviou a mensagem. Confirme apenas depois do envio no
              WhatsApp.
            </p>
            {opened && (
              <a className="text-btn" href={opened.url} target="_blank" rel="noreferrer">
                Continuar no WhatsApp
                <ExternalLink size={13} />
              </a>
            )}
            <div className="button-row">
              <button
                className="btn primary"
                disabled={busy}
                onClick={async () => {
                  const result = await action(
                    'manual/confirm',
                    'POST',
                    { contactId: opened?.id || pending?.id },
                    'Mensagem enviada — confirmação manual registrada.',
                  );
                  if (result) {
                    setOpened(null);
                    setApproved(false);
                  }
                }}
              >
                <Check size={15} />
                Confirmar que enviei
              </button>
              <button
                className="btn"
                disabled={busy}
                onClick={async () => {
                  const result = await action(
                    'manual/cancel',
                    'POST',
                    { contactId: opened?.id || pending?.id },
                    'Você informou que não enviou; nenhum novo contato contabilizado.',
                  );
                  if (result) {
                    setOpened(null);
                    setApproved(false);
                  }
                }}
              >
                Não enviei
              </button>
            </div>
          </div>
        )}
        <small className="muted">
          {contacted
            ? 'Acompanhamento de contato existente: não consome nova vaga diária.'
            : `${data.metrics.contactsToday} de ${data.settings.dailyLimit} novos contatos confirmados hoje · ${data.metrics.remaining} restantes.`}{' '}
          Nenhuma mensagem é enviada automaticamente. Ter telefone não garante que ele esteja
          cadastrado no WhatsApp.
        </small>
        <div className="section-heading">
          <h3>
            <History size={15} /> Histórico de mensagens comerciais
          </h3>
          <span className="badge green">{history.length} versões</span>
        </div>
        <div className="prompt-history-list commercial-history">
          {history.map((m) => (
            <button
              key={m.id}
              disabled={working || busy}
              className={selectedId === m.id ? 'selected' : ''}
              onClick={() => {
                setSelectedId(m.id);
                setPurpose(normalizePurpose(m.purpose));
                setText(m.text);
                setMethod(m.method);
                setEditing(false);
                setApproved(false);
                setDemoUrl(m.approvedDemoUrl || '');
                setDemoApproved(!!m.approvedDemoUrl);
              }}
            >
              <MessageCircle size={15} />
              <span>
                {m.purpose}
                <small>
                  {new Date(m.createdAt).toLocaleString('pt-BR')} ·{' '}
                  {commercialContactStatus(data.contacts, c.id, m.text, m.id)}
                </small>
              </span>
            </button>
          ))}
          {!history.length && (
            <p className="muted">As mensagens geradas e as edições salvas aparecem aqui.</p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
