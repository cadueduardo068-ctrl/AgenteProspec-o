'use client';
import { useState, type FormEvent } from 'react';
import {
  Heart,
  Plus,
  ExternalLink,
  Sparkles,
  Clipboard,
  FolderPlus,
  ImageOff,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  filterInspirations,
  inspirationCategories,
  inspirationStyles,
  inspirationPrompt,
  type Inspiration,
} from '@/lib/inspirations';
import { request, type WorkspaceData, type WorkspaceAction } from './client-api';
import Dialog from './dialog';
export default function InspirationLibrary({
  data,
  action,
  notify,
  busy,
  companyId,
  onChoose,
}: {
  data: WorkspaceData;
  action: WorkspaceAction;
  notify: (s: string) => void;
  busy: boolean;
  companyId?: string;
  onChoose: (companyId: string, inspirationId: string) => void;
}) {
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState(''),
    [style, setStyle] = useState(''),
    [favorites, setFavorites] = useState(false),
    [collection, setCollection] = useState('');
  const [detail, setDetail] = useState<string | null>(null),
    [form, setForm] = useState<Inspiration | true | null>(null),
    [collectionForm, setCollectionForm] = useState(false),
    [collectionName, setCollectionName] = useState('');
  const [target, setTarget] = useState(companyId || ''),
    [pending, setPending] = useState(false),
    [deleteId, setDeleteId] = useState<string | null>(null);
  const selected = data.inspirations.find((r) => r.id === detail);
  const items = filterInspirations(
    data.inspirations,
    query,
    category,
    style,
    favorites,
    collection,
  );
  async function copy(r: Inspiration) {
    try {
      await navigator.clipboard.writeText(inspirationPrompt(r));
      notify('Prompt de inspiração copiado.');
    } catch {
      notify('Não foi possível copiar. Selecione o texto na área do prompt.');
    }
  }
  return (
    <div className="stack inspiration-library">
      <div className="section-heading">
        <p className="muted">Referências reais. Direção original para o próximo site.</p>
        <button className="btn primary" onClick={() => setForm(true)}>
          <Plus size={15} />
          Adicionar inspiração
        </button>
      </div>
      {companyId && (
        <p className="notice">
          Escolhendo design para{' '}
          <strong>{data.companies.find((c) => c.id === companyId)?.name}</strong>. Os dados
          comerciais da referência não serão importados.
        </p>
      )}
      <div className="inspiration-filters">
        <label>
          Buscar
          <input
            aria-label="Buscar inspirações"
            placeholder="Nome, categoria ou estilo"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          Categoria
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Todas as categorias</option>
            {inspirationCategories.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Estilo
          <select value={style} onChange={(e) => setStyle(e.target.value)}>
            <option value="">Todos os estilos</option>
            {inspirationStyles.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Coleção
          <select value={collection} onChange={(e) => setCollection(e.target.value)}>
            <option value="">Todas as coleções</option>
            {data.inspirationCollections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className={`btn ${favorites ? 'primary' : ''}`}
          aria-pressed={favorites}
          onClick={() => setFavorites(!favorites)}
        >
          <Heart size={15} />
          Favoritos
        </button>
        <button className="btn" onClick={() => setCollectionForm(true)}>
          <FolderPlus size={15} />
          Criar coleção
        </button>
      </div>
      <p className="muted">
        {items.length} referências · Paletas aproximadas e classificações editoriais. Tecnologias
        somente quando verificadas.
      </p>
      <div className="inspiration-grid">
        {items.map((r) => (
          <article className="inspiration-card" key={r.id}>
            <button
              className="inspiration-cover"
              aria-label={`Ver inspiração ${r.name}`}
              onClick={() => setDetail(r.id)}
            >
              {r.imageUrl ? (
                <img
                  src={r.imageUrl}
                  alt={r.imageCaption}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="inspiration-placeholder">
                  <ImageOff size={26} />
                  <strong>{r.name}</strong>
                  <span>Sem captura autorizada</span>
                </div>
              )}
            </button>
            <div className="inspiration-card-body">
              <div className="section-heading">
                <h2>
                  <button className="text-btn" onClick={() => setDetail(r.id)}>
                    {r.name}
                  </button>
                </h2>
                <button
                  className="btn icon"
                  aria-label={`${r.favorite ? 'Desfavoritar' : 'Favoritar'} ${r.name}`}
                  aria-pressed={r.favorite}
                  disabled={busy}
                  onClick={() =>
                    void action(`inspirations/${r.id}`, 'PATCH', { favorite: !r.favorite })
                  }
                >
                  <Heart size={17} fill={r.favorite ? 'currentColor' : 'none'} />
                </button>
              </div>
              <p>{r.description}</p>
              <div className="inspiration-tags">
                {[...r.categories, ...r.styles].map((v) => (
                  <span className="badge" key={v}>
                    {v}
                  </span>
                ))}
              </div>
              <button className="btn" onClick={() => setDetail(r.id)}>
                Explorar referência <ExternalLink size={14} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {!items.length && (
        <div className="panel">
          <h3>Nenhuma referência neste filtro</h3>
          <p className="muted">Combine outros filtros ou adicione uma referência real.</p>
        </div>
      )}
      {!!data.inspirationUses.length && (
        <section className="panel stack">
          <h3>Inspirações utilizadas</h3>
          {data.inspirationUses.slice(0, 15).map((u) => (
            <div key={u.id} className="section-heading">
              <span>
                {data.inspirations.find((r) => r.id === u.inspirationId)?.name ||
                  'Referência removida'}{' '}
                · {data.companies.find((c) => c.id === u.companyId)?.name || 'Empresa removida'}
              </span>
              <small className="muted">
                {new Date(u.at).toLocaleString('pt-BR')} ·{' '}
                {u.promptId ? 'Prompt salvo' : 'Projeto solicitado'}
              </small>
            </div>
          ))}
        </section>
      )}
      {selected && (
        <Dialog wide title={selected.name} close={() => setDetail(null)}>
          <div className="stack">
            {selected.imageUrl ? (
              <figure className="inspiration-detail-image">
                <img
                  src={selected.imageUrl}
                  alt={selected.imageCaption}
                  referrerPolicy="no-referrer"
                />
                <figcaption>
                  {selected.imageCaption}{' '}
                  <a href={selected.imagePermission} target="_blank" rel="noreferrer">
                    Permissão / fonte
                  </a>
                </figcaption>
              </figure>
            ) : (
              <div className="inspiration-placeholder">
                <ImageOff />
                <span>Sem captura autorizada. Consulte o site original.</span>
              </div>
            )}
            <div className="section-heading">
              <div>
                <span className="muted">Criador / estúdio</span>
                <p>{selected.creator}</p>
              </div>
              <a className="btn" href={selected.url} target="_blank" rel="noreferrer">
                Visitar original <ExternalLink size={14} />
              </a>
            </div>
            <p>{selected.description}</p>
            <div className="inspiration-tags">
              {selected.palette.map((c) => (
                <span key={c} className="inspiration-swatch">
                  <i style={{ background: c }} />
                  {c}
                </span>
              ))}
            </div>
            <small className="muted">
              Paleta aproximada para adaptação; não representa tokens oficiais.
            </small>
            <dl className="inspiration-analysis">
              {Object.entries({
                'Tipografia e hierarquia': selected.typography,
                'Fotografias e imagens': selected.photography,
                'Organização das seções': selected.sections,
                Interações: selected.interactions,
                'Animações observadas': selected.animations,
                'Tecnologias verificadas':
                  selected.technologies.join(', ') || 'Não identificadas — sem atribuição de stack',
              }).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="inspiration-tags">
              {selected.sources.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer">
                  Fonte oficial <ExternalLink size={12} />
                </a>
              ))}
            </div>
            <small className="muted">
              Registro editorial: {selected.checkedAt.slice(0, 10)}. A análise por IA considera
              somente os dados cadastrados, sem presumir visão ou acesso ao site.
            </small>
            <button
              className="btn"
              disabled={busy || !data.integrations.ai.configured}
              onClick={() =>
                void action(
                  `inspirations/${selected.id}/analyze`,
                  'POST',
                  {},
                  'Análise com IA salva.',
                )
              }
            >
              <Sparkles size={15} />
              Analisar dados com IA
            </button>
            {!data.integrations.ai.configured && (
              <small className="muted">
                Configure a integração OpenAI para a análise com IA. O briefing estruturado funciona
                sem ela.
              </small>
            )}
            {selected.analysis && <p className="inspiration-ai-output">{selected.analysis.text}</p>}
            <details>
              <summary>Organizar em coleções</summary>
              <div className="stack">
                {data.inspirationCollections.map((c) => (
                  <label key={c.id} className="check-row">
                    <input
                      type="checkbox"
                      checked={selected.collectionIds.includes(c.id)}
                      disabled={busy}
                      onChange={(e) =>
                        void action(`inspirations/${selected.id}`, 'PATCH', {
                          collectionIds: e.target.checked
                            ? [...selected.collectionIds, c.id]
                            : selected.collectionIds.filter((id) => id !== c.id),
                        })
                      }
                    />
                    {c.name}
                  </label>
                ))}
                {!data.inspirationCollections.length && (
                  <p>Crie uma coleção na biblioteca para organizar esta referência.</p>
                )}
              </div>
            </details>
            <label>
              Empresa para combinar com o design
              <select value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">Selecione uma empresa do CRM</option>
                {data.companies
                  .filter((c) => !c.optedOut && !c.archived)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="prompt-actions">
              <button
                className="btn primary"
                disabled={!target || busy}
                onClick={() => {
                  onChoose(target, selected.id);
                  setDetail(null);
                }}
              >
                Gerar site inspirado neste design
              </button>
              <button className="btn" onClick={() => void copy(selected)}>
                <Clipboard size={15} />
                Copiar prompt para o Codex
              </button>
              <button
                className="btn"
                disabled={!target || busy || pending || !data.integrations.generator.configured}
                onClick={async () => {
                  setPending(true);
                  try {
                    await action(
                      'jobs',
                      'POST',
                      { companyId: target, confirmed: true, inspirationId: selected.id },
                      'Projeto solicitado ao serviço de geração configurado.',
                    );
                  } finally {
                    setPending(false);
                  }
                }}
              >
                {pending ? <Loader2 size={15} /> : <Sparkles size={15} />}Gerar projeto com IA
              </button>
            </div>
            <small className="muted">
              “Gerar site inspirado” abre o prompt personalizado para revisão.{' '}
              {data.integrations.generator.configured
                ? 'A geração de código exige empresa verificada e serviços confirmados. Revise a prévia antes de publicar.'
                : 'A geração automática de código precisa de um serviço configurado em Configurações. Nenhum projeto será simulado.'}
            </small>
            <label>
              Prompt de desenvolvimento original
              <textarea
                className="inspiration-prompt"
                rows={16}
                readOnly
                value={inspirationPrompt(selected)}
              />
            </label>
            <div className="prompt-actions">
              <button
                className="btn"
                onClick={() => {
                  setForm(selected);
                  setDetail(null);
                }}
              >
                <Pencil size={14} />
                Editar referência
              </button>
              <button className="btn danger" onClick={() => setDeleteId(selected.id)}>
                <Trash2 size={14} />
                Remover da biblioteca
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {form && (
        <ReferenceForm
          initial={form === true ? undefined : form}
          close={() => setForm(null)}
          action={action}
          notify={notify}
          busy={busy}
        />
      )}
      {collectionForm && (
        <Dialog title="Criar coleção" close={() => setCollectionForm(false)}>
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await action(
                  'inspiration-collections',
                  'POST',
                  { name: collectionName },
                  'Coleção criada.',
                )
              ) {
                setCollectionForm(false);
                setCollectionName('');
              }
            }}
          >
            <label>
              Nome da coleção
              <input
                required
                minLength={2}
                maxLength={100}
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="Landing pages premium"
              />
            </label>
            <button className="btn primary" disabled={busy}>
              Salvar coleção
            </button>
          </form>
        </Dialog>
      )}
      {deleteId && (
        <Dialog title="Remover referência?" close={() => setDeleteId(null)}>
          <div className="stack">
            <p>A referência sairá da biblioteca. Prompts já salvos no CRM serão preservados.</p>
            <button
              className="btn danger"
              disabled={busy}
              onClick={async () => {
                if (
                  await action(`inspirations/${deleteId}`, 'DELETE', {}, 'Referência removida.')
                ) {
                  setDeleteId(null);
                  setDetail(null);
                }
              }}
            >
              Confirmar remoção
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
function ReferenceForm({
  initial,
  close,
  action,
  notify,
  busy,
}: {
  initial?: Inspiration;
  close: () => void;
  action: WorkspaceAction;
  notify: (s: string) => void;
  busy: boolean;
}) {
  const [name, setName] = useState(initial?.name || ''),
    [url, setUrl] = useState(initial?.url || ''),
    [description, setDescription] = useState(initial?.description || ''),
    [category, setCategory] = useState(initial?.categories[0] || inspirationCategories[0]),
    [style, setStyle] = useState(initial?.styles[0] || inspirationStyles[0]);
  const [loading, setLoading] = useState(false),
    [image, setImage] = useState(initial?.imageUrl || ''),
    [permission, setPermission] = useState(initial?.imagePermission || ''),
    [authorized, setAuthorized] = useState(false);
  const [creator, setCreator] = useState(initial?.creator || ''),
    [visual, setVisual] = useState(initial?.typography || '');
  async function metadata() {
    setLoading(true);
    try {
      const r = await request<{ name: string; description: string; notice: string }>(
        'inspirations/metadata',
        'POST',
        { url },
      );
      if (r.name) setName(r.name);
      if (r.description) setDescription(r.description);
      notify(r.notice);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const result = await action(
      `inspirations${initial ? `/${initial.id}` : ''}`,
      initial ? 'PUT' : 'POST',
      {
        name,
        url,
        description,
        creator: creator || 'Não identificado',
        categories: [category],
        styles: [style],
        palette: initial?.palette || [],
        typography: visual,
        photography: initial?.photography || 'Não informada',
        sections: initial?.sections || 'Não informadas',
        interactions: initial?.interactions || 'Não verificadas',
        animations: initial?.animations || 'Não verificadas',
        imageUrl: image,
        imagePermission: permission,
        imageCaption: initial?.imageCaption || 'Imagem autorizada fornecida pelo administrador',
        imageAuthorized: authorized,
      },
      'Referência salva.',
    );
    if (result) close();
  }
  return (
    <Dialog title={initial ? 'Editar inspiração' : 'Adicionar inspiração'} close={close}>
      <form className="stack" onSubmit={submit}>
        <label>
          URL do site real
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
          />
        </label>
        <button
          type="button"
          className="btn"
          disabled={loading || !url}
          onClick={() => void metadata()}
        >
          {loading ? <Loader2 size={15} /> : <ExternalLink size={15} />}Buscar metadados permitidos
        </button>
        <small className="muted">
          Importação limitada a páginas oficiais revisadas. Outros sites podem ser cadastrados
          manualmente. Não importamos imagens automaticamente.
        </small>
        <label>
          Nome
          <input required maxLength={150} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Criador ou estúdio, se conhecido
          <input maxLength={150} value={creator} onChange={(e) => setCreator(e.target.value)} />
        </label>
        <label>
          Categoria
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {inspirationCategories.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Estilo
          <select value={style} onChange={(e) => setStyle(e.target.value)}>
            {inspirationStyles.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Descrição
          <textarea
            maxLength={3000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label>
          Características visuais observadas
          <textarea maxLength={1500} value={visual} onChange={(e) => setVisual(e.target.value)} />
        </label>
        <label>
          URL HTTPS de imagem autorizada, opcional
          <input type="url" value={image} onChange={(e) => setImage(e.target.value)} />
        </label>
        {image && (
          <>
            <label>
              Fonte da autorização ou licença
              <input
                required
                type="url"
                value={permission}
                onChange={(e) => setPermission(e.target.value)}
              />
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                required
                checked={authorized}
                onChange={(e) => setAuthorized(e.target.checked)}
              />
              Confirmo que esta imagem pode ser exibida na biblioteca.
            </label>
          </>
        )}
        <button className="btn primary" disabled={busy || loading}>
          Salvar referência
        </button>
      </form>
    </Dialog>
  );
}
