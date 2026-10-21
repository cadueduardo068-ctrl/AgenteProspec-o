'use client';
import { useState } from 'react';
import {
  Clipboard,
  MessagesSquare,
  Check,
  ShieldCheck,
  Sparkles,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { messagePurposes, messageTemplate, type MessagePurpose } from '@/lib/content-templates';
import { whatsappPhone } from '@/lib/phones';
import type { Company } from '@/lib/domain';
import Dialog from './dialog';
import { request, type WorkspaceAction, type WorkspaceData } from './client-api';
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
  const [purpose, setPurpose] = useState<MessagePurpose>('Primeira abordagem');
  const [text, setText] = useState(c.draft || messageTemplate(c, 'Primeira abordagem'));
  const [method, setMethod] = useState(c.draftMeta?.method || 'template');
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
  async function generate() {
    setWorking(true);
    try {
      const result = await action(
        'commercial/message',
        'POST',
        { companyId: c.id, purpose },
        'Mensagem preparada para revisão.',
      );
      if (result) {
        setText(String(result.text));
        setMethod(result.method === 'openai' ? 'openai' : 'template');
        setApproved(false);
      }
    } finally {
      setWorking(false);
    }
  }
  async function open() {
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    setWorking(true);
    try {
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
    <Dialog title={`WhatsApp · ${c.name}`} close={close}>
      <div className="stack">
        <div className="contact-recipient">
          <span className="company-initial">{c.name.slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>{c.name}</strong>
            <small>{phone.phone ? `+${phone.phone}` : phone.error}</small>
          </div>
          <span className="badge green">Envio manual</span>
        </div>
        {blocked && (
          <div className="notice error">
            Contato bloqueado, arquivado ou suspenso. Não será aberto.
          </div>
        )}
        <label>
          Objetivo da mensagem
          <select
            value={purpose}
            onChange={(e) => {
              setPurpose(e.target.value as MessagePurpose);
              setText(messageTemplate(c, e.target.value as MessagePurpose));
              setMethod('template');
              setApproved(false);
            }}
          >
            {messagePurposes.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <div className="button-row">
          <button
            className="btn"
            disabled={busy || working || blocked}
            onClick={() => void generate()}
          >
            {working ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}Preparar
            mensagem {data.integrations.ai.configured ? 'com IA' : 'com modelo local'}
          </button>
          <span className="badge">
            {method === 'openai' ? 'Gerada por IA' : 'Modelo local · sem IA'}
          </span>
        </div>
        <label>
          Prévia editável
          <textarea
            aria-label="Mensagem comercial"
            value={text}
            minLength={1}
            maxLength={2000}
            style={{ minHeight: 150 }}
            onChange={(e) => {
              setText(e.target.value);
              setApproved(false);
            }}
          />
        </label>
        <button
          className="text-btn"
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
        {!c.consent && !blocked && (
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
            busy || working || !approved || !text.trim() || !phone.phone || !c.consent || blocked
          }
          onClick={() => void open()}
        >
          <MessagesSquare size={17} />
          Abrir WhatsApp com mensagem
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
      </div>
    </Dialog>
  );
}
