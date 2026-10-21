'use client';
import { useState } from 'react';
import {
  MessageCircle,
  Code2,
  ArrowUpRight,
  MapPin,
  Phone,
  Globe,
  ExternalLink,
  Check,
} from 'lucide-react';
import { score, websitePresence } from '@/lib/domain';
import { whatsappPhone } from '@/lib/phones';
import Dialog from './dialog';
export type PlaceResult = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  websiteUri?: string;
  internationalPhoneNumber?: string;
  googleMapsUri?: string;
  prospectNiche?: string;
  attributions?: { provider: string; providerUri: string }[];
};
export type ResultAction = 'whatsapp' | 'prompt' | 'details';
export default function ResultCards({
  places,
  city,
  state,
  onAction,
  verify,
  busy,
}: {
  places: PlaceResult[];
  city: string;
  state: string;
  onAction: (p: PlaceResult, action: ResultAction) => void;
  verify: (p: PlaceResult) => void;
  busy: boolean;
}) {
  const [detail, setDetail] = useState<PlaceResult | null>(null);
  function content(p: PlaceResult) {
    const phone = whatsappPhone(p.internationalPhoneNumber || '');
    const opportunity = score({
      website: p.websiteUri || '',
      phone: phone.phone || '',
      niche: p.prospectNiche || 'Segmento pesquisado',
      services: '',
      verified: false,
    });
    const presence = websitePresence(p.websiteUri || '');
    const maps =
      p.googleMapsUri ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.displayName?.text || '')}&query_place_id=${encodeURIComponent(p.id)}`;
    return (
      <>
        <div className="result-card-heading">
          <span className="company-initial">
            {(p.displayName?.text || '?').slice(0, 2).toUpperCase()}
          </span>
          <span className={`badge ${opportunity.value >= 70 ? 'green' : 'blue'}`}>
            {opportunity.value}/100 · estimado
          </span>
        </div>
        <h3>{p.displayName?.text || 'Nome não informado pelo provedor'}</h3>
        <div className="result-tags">
          <span>{p.prospectNiche || 'Nicho pesquisado'}</span>
          <span>
            {city}, {state}
          </span>
        </div>
        <div className="result-facts">
          <p>
            <MapPin size={14} />
            {p.formattedAddress || 'Endereço não informado'}
          </p>
          <p>
            <Phone size={14} />
            {p.internationalPhoneNumber || 'Telefone não informado'}
          </p>
          <p>
            <Globe size={14} />
            {presence === 'website'
              ? 'Site identificado no perfil'
              : presence === 'social'
                ? 'Rede social · site próprio não confirmado'
                : 'Ausência aparente de site no perfil'}
          </p>
        </div>
        <details className="result-reasons">
          <summary>{opportunity.label} · ver estimativa</summary>
          {opportunity.reasons.map((r) => (
            <p key={r.label}>
              <Check size={12} />
              {r.label}
            </p>
          ))}
        </details>
        <div className="result-links">
          <a className="text-btn" href={maps} target="_blank" rel="noreferrer">
            Google Maps
            <ExternalLink size={12} />
          </a>
          {p.websiteUri && (
            <a className="text-btn" href={p.websiteUri} target="_blank" rel="noreferrer">
              {presence === 'social' ? 'Canal social' : 'Site'}
              <ExternalLink size={12} />
            </a>
          )}
        </div>
        <div className="result-actions">
          <button
            className="btn whatsapp"
            disabled={busy}
            title="Criar uma mensagem comercial para revisar; nenhum envio automático"
            onClick={() => {
              setDetail(null);
              onAction(p, 'whatsapp');
            }}
          >
            <MessageCircle size={15} />
            Gerar mensagem para WhatsApp
          </button>
          <button
            className="btn primary"
            disabled={busy}
            onClick={() => {
              setDetail(null);
              onAction(p, 'prompt');
            }}
          >
            <Code2 size={14} />
            Gerar prompt do site
          </button>
          <button className="text-btn" onClick={() => setDetail(p)}>
            Ver detalhes
            <ArrowUpRight size={13} />
          </button>
        </div>
        {phone.error && (
          <small className="phone-disabled-reason">
            A mensagem pode ser gerada. Abertura do WhatsApp indisponível: {phone.error}
          </small>
        )}
        {p.attributions?.map((a, i) => (
          <a className="muted" key={i} href={a.providerUri} target="_blank" rel="noreferrer">
            {a.provider}
          </a>
        ))}
      </>
    );
  }
  return (
    <>
      <div className="prospect-result-grid">
        {places.map((p) => (
          <article className="result-card" key={p.id}>
            {content(p)}
          </article>
        ))}
      </div>
      {detail && (
        <Dialog title="Detalhes do resultado · Google Maps" close={() => setDetail(null)}>
          <div className="result-card detail-result">
            {content(detail)}
            <div className="notice">
              Dados retornados pelo Google nesta consulta. A ausência de site e a pontuação são
              estimativas; confirme os dados em fonte independente antes de salvar no CRM.
            </div>
            <div className="button-row">
              <button
                className="btn"
                onClick={() => {
                  const p = detail;
                  setDetail(null);
                  onAction(p, 'details');
                }}
              >
                Revisar e acompanhar no CRM
              </button>
              <button className="text-btn" disabled={busy} onClick={() => verify(detail)}>
                Pesquisar outras fontes
              </button>
            </div>
            <code>Place ID: {detail.id}</code>
          </div>
        </Dialog>
      )}
    </>
  );
}
