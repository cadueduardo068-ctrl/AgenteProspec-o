'use client';
import { useEffect, useRef, useState } from 'react';
import { Search, ChevronDown, Loader2, Check, MapPin, RefreshCw } from 'lucide-react';
import type { Municipality, BrazilianState } from '@/lib/localities';
type Props = {
  value: Municipality | null;
  uf: string;
  onChange: (city: Municipality | null, uf: string) => void;
  disabled?: boolean;
  onReady?: (ready: boolean) => void;
  recent?: Municipality[];
  remember?: (city: Municipality) => void;
};
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export default function CitySelector({
  value,
  uf,
  onChange,
  disabled,
  onReady,
  recent = [],
  remember,
}: Props) {
  const [states, setStates] = useState<BrazilianState[]>([]);
  const [cities, setCities] = useState<Municipality[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef({ onChange, onReady, value });
  latest.current = { onChange, onReady, value };
  useEffect(() => {
    let alive = true;
    fetch('/api/localities/states')
      .then((r) => r.json())
      .then((data) => {
        if (alive && data.states) setStates(data.states);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [attempt]);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setCities([]);
    setError('');
    setOpen(false);
    setQuery('');
    latest.current.onReady?.(false);
    fetch(`/api/localities/cities?uf=${encodeURIComponent(uf)}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        return data.cities as Municipality[];
      })
      .then((list) => {
        if (!alive) return;
        setCities(list);
        const current = latest.current.value;
        const found =
          list.find((c) => c.id === current?.id) ||
          (!current && uf === 'SP' ? list.find((c) => c.name === 'Bauru') : null);
        latest.current.onChange(found || null, uf);
        latest.current.onReady?.(!!found);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [uf, attempt]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  const filtered = cities.filter((c) => norm(c.name).includes(norm(query)));
  const recentHere = recent.filter((c) => c.uf === uf && cities.some((city) => city.id === c.id));
  function choose(city: Municipality) {
    onChange(city, uf);
    onReady?.(true);
    remember?.(city);
    setOpen(false);
    setQuery('');
  }
  return (
    <div className="location-selector">
      <div className="form-row">
        <label>
          Estado
          <select
            aria-label="Estado"
            value={uf}
            disabled={disabled || !states.length}
            onChange={(e) => {
              onChange(null, e.target.value);
              onReady?.(false);
            }}
          >
            {!states.length && <option value={uf}>{uf === 'SP' ? 'São Paulo' : uf}</option>}
            {states.map((s) => (
              <option key={s.uf} value={s.uf}>
                {s.name} · {s.uf}
              </option>
            ))}
          </select>
        </label>
        <div className="city-combobox" ref={root}>
          <span className="field-label" id="city-label">
            Cidade
          </span>
          <button
            type="button"
            className="niche-trigger"
            role="combobox"
            aria-labelledby="city-label"
            aria-controls="city-options"
            aria-expanded={open}
            aria-haspopup="listbox"
            disabled={disabled || loading || !!error}
            onClick={() => setOpen(!open)}
          >
            {loading ? (
              <>
                <Loader2 className="spin" size={15} />
                Carregando municípios…
              </>
            ) : (
              <>
                <span>{value?.name || 'Selecione uma cidade'}</span>
                <ChevronDown size={15} />
              </>
            )}
          </button>
          {open && (
            <div className="niche-dropdown city-dropdown">
              <div className="niche-search">
                <Search size={15} />
                <input
                  ref={input}
                  role="combobox"
                  aria-label="Pesquisar cidade"
                  aria-controls="city-options"
                  aria-expanded="true"
                  aria-autocomplete="list"
                  aria-activedescendant={
                    filtered[active] ? `municipality-${filtered[active].id}` : undefined
                  }
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpen(false);
                    }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setActive((i) => Math.min(i + 1, filtered.length - 1));
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setActive((i) => Math.max(i - 1, 0));
                    }
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (filtered[active]) choose(filtered[active]);
                    }
                  }}
                  placeholder="Buscar município…"
                />
              </div>
              <div
                className="niche-options"
                id="city-options"
                role="listbox"
                aria-label="Municípios do estado"
              >
                {!query && !!recentHere.length && (
                  <div className="niche-group">
                    <span>Recentes</span>
                    {recentHere.map((c) => (
                      <button type="button" key={`recent-${c.id}`} onClick={() => choose(c)}>
                        <MapPin size={13} />
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
                {filtered.map((c, i) => (
                  <button
                    type="button"
                    role="option"
                    id={`municipality-${c.id}`}
                    key={c.id}
                    className={i === active ? 'keyboard-active' : ''}
                    aria-selected={c.id === value?.id}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(c)}
                  >
                    {c.name}
                    {c.id === value?.id && <Check size={14} />}
                  </button>
                ))}
                {!filtered.length && (
                  <p className="city-empty">Nenhum município encontrado neste estado.</p>
                )}
              </div>
              <div className="niche-dropdown-footer">
                <span>{cities.length} municípios · IBGE</span>
                <span>↑↓ navegar · Enter selecionar</span>
              </div>
            </div>
          )}
        </div>
      </div>
      {error ? (
        <div className="notice error">
          {error}
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>
            <RefreshCw size={14} />
            Tentar novamente
          </button>
        </div>
      ) : (
        <small className="muted">Municípios oficiais do IBGE · seleção validada</small>
      )}
    </div>
  );
}
