'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X, Plus } from 'lucide-react';
const groups = [
  {
    title: 'Saúde e bem-estar',
    items: [
      'Psicólogos',
      'Clínicas de estética',
      'Dentistas',
      'Fisioterapeutas',
      'Nutricionistas',
      'Clínicas médicas',
      'Academias',
      'Estúdios de pilates',
      'Veterinários',
    ],
  },
  {
    title: 'Serviços locais',
    items: [
      'Higienização de estofados',
      'Lava-rápidos',
      'Oficinas mecânicas',
      'Eletricistas',
      'Encanadores',
      'Limpeza residencial',
      'Jardinagem',
      'Dedetizadoras',
      'Ar-condicionado',
      'Assistência técnica',
    ],
  },
  {
    title: 'Beleza e cuidados',
    items: [
      'Salões de beleza',
      'Barbearias',
      'Manicures',
      'Designers de sobrancelhas',
      'Massoterapeutas',
      'Estúdios de tatuagem',
    ],
  },
  {
    title: 'Alimentação e comércio',
    items: [
      'Restaurantes',
      'Pizzarias',
      'Cafeterias',
      'Padarias',
      'Confeitarias',
      'Lojas de roupas',
      'Pet shops',
      'Floriculturas',
      'Lojas de móveis',
    ],
  },
  {
    title: 'Negócios e profissionais',
    items: [
      'Advogados',
      'Contadores',
      'Imobiliárias',
      'Corretores de imóveis',
      'Arquitetos',
      'Engenheiros',
      'Construtoras',
      'Fotógrafos',
      'Agências de turismo',
      'Escolas de idiomas',
      'Escolas de música',
    ],
  },
];
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export default function NicheSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const dismiss = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', dismiss);
    return () => document.removeEventListener('mousedown', dismiss);
  }, []);
  useEffect(() => {
    if (open) search.current?.focus();
  }, [open]);
  const allNames = [...groups.flatMap((g) => g.items), ...value];
  const custom = query.trim();
  const canAdd =
    custom.length >= 2 &&
    custom.length <= 100 &&
    !allNames.some((n) => normalize(n) === normalize(custom));
  function toggle(niche: string) {
    if (value.includes(niche)) onChange(value.filter((n) => n !== niche));
    else if (value.length < 8) onChange([...value, niche]);
  }
  return (
    <div
      className="niche-selector"
      ref={root}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setOpen(false);
          e.stopPropagation();
        }
      }}
    >
      <span className="field-label" id="niche-label">
        Nichos de mercado
      </span>
      <button
        type="button"
        className={`niche-trigger ${open ? 'opened' : ''}`}
        aria-labelledby="niche-label"
        aria-expanded={open}
        aria-controls="niche-options"
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <span>
          {value.length
            ? `${value.length} ${value.length === 1 ? 'nicho selecionado' : 'nichos selecionados'}`
            : 'Selecione um ou mais nichos…'}
        </span>
        <ChevronDown size={16} />
      </button>
      {!!value.length && (
        <div className="niche-chips">
          {value.map((n) => (
            <span key={n}>
              {n}
              <button
                type="button"
                aria-label={`Remover ${n}`}
                onClick={() => toggle(n)}
                disabled={disabled}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      <small className="muted">
        Até 8 nichos por busca. O total de resultados é dividido entre eles.
      </small>
      {open && (
        <div className="niche-dropdown">
          <div className="niche-search">
            <Search size={15} />
            <input
              ref={search}
              aria-label="Pesquisar nichos"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={100}
              placeholder="Buscar ou adicionar um nicho…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (canAdd && value.length < 8) {
                    toggle(custom);
                    setQuery('');
                  }
                }
              }}
            />
          </div>
          <div
            id="niche-options"
            role="listbox"
            aria-label="Nichos disponíveis"
            aria-multiselectable="true"
            className="niche-options"
          >
            {groups.map((g) => {
              const filtered = g.items.filter((n) => normalize(n).includes(normalize(query)));
              return (
                !!filtered.length && (
                  <div className="niche-group" key={g.title}>
                    <span>{g.title}</span>
                    {filtered.map((n) => (
                      <button
                        type="button"
                        role="option"
                        aria-selected={value.includes(n)}
                        key={n}
                        disabled={value.length >= 8 && !value.includes(n)}
                        onClick={() => toggle(n)}
                      >
                        <span className={`niche-check ${value.includes(n) ? 'checked' : ''}`}>
                          {value.includes(n) && <Check size={12} />}
                        </span>
                        {n}
                      </button>
                    ))}
                  </div>
                )
              );
            })}
            {value
              .filter(
                (n) =>
                  !groups.some((g) => g.items.includes(n)) &&
                  normalize(n).includes(normalize(query)),
              )
              .map((n) => (
                <button type="button" role="option" aria-selected key={n} onClick={() => toggle(n)}>
                  <span className="niche-check checked">
                    <Check size={12} />
                  </span>
                  {n}
                </button>
              ))}
            {canAdd && (
              <button
                type="button"
                className="custom-niche"
                role="option"
                aria-selected="false"
                disabled={value.length >= 8}
                onClick={() => {
                  toggle(custom);
                  setQuery('');
                }}
              >
                <Plus size={14} />
                Adicionar “{custom}”
              </button>
            )}
          </div>
          <div className="niche-dropdown-footer">
            <span>{value.length}/8 selecionados</span>
            <button type="button" onClick={() => setOpen(false)}>
              Concluir
              <Check size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
