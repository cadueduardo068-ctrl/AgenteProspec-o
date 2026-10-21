import { z } from 'zod';
import type { State } from './domain';
import { inspirationCategories, inspirationStyles } from './inspirations';
export function publicReferenceUrl(value: string) {
  const u = new URL(value);
  if (
    u.protocol !== 'https:' ||
    u.username ||
    u.password ||
    u.port ||
    !u.hostname.includes('.') ||
    /[\[\]:]/.test(u.hostname) ||
    /^(\d{1,3}\.){3}\d{1,3}$/.test(u.hostname) ||
    /\.(local|internal|localhost|test|invalid)$/.test(u.hostname)
  )
    throw new Error('Use uma URL HTTPS pública, sem credenciais ou porta.');
  return u.href;
}
const url = z.string().trim().max(2000).transform(publicReferenceUrl);
const schema = z.object({
  name: z.string().trim().min(2).max(150),
  url,
  creator: z.string().trim().max(150).default('Não identificado'),
  description: z.string().trim().max(3000),
  categories: z.array(z.enum(inspirationCategories)).max(12),
  styles: z.array(z.enum(inspirationStyles)).max(10),
  palette: z
    .array(z.string().regex(/^#[a-f0-9]{6}$/i))
    .max(8)
    .default([]),
  typography: z.string().max(1500).default('Não informada'),
  photography: z.string().max(1500).default('Não informada'),
  sections: z.string().max(1500).default('Não informadas'),
  interactions: z.string().max(1500).default('Não verificadas'),
  animations: z.string().max(1500).default('Não verificadas'),
  imageUrl: z.union([url, z.literal('')]).default(''),
  imagePermission: z.union([url, z.literal('')]).default(''),
  imageCaption: z.string().max(300).default('Imagem fornecida pelo administrador'),
  imageAuthorized: z.boolean().default(false),
});
export function saveInspiration(s: State, input: unknown, id?: string) {
  const data = schema.parse(input);
  if (data.imageUrl && (!data.imageAuthorized || !data.imagePermission))
    throw new Error('Confirme a autorização e informe a fonte da licença da imagem.');
  if (
    s.inspirations.some(
      (r) => r.id !== id && r.url.replace(/\/$/, '') === data.url.replace(/\/$/, ''),
    )
  )
    throw new Error('Essa referência já está na biblioteca.');
  const old = id ? s.inspirations.find((r) => r.id === id) : undefined;
  if (id && !old) throw new Error('Inspiração não encontrada.');
  if (s.inspirations.length >= 200 && !old) throw new Error('Limite de 200 referências atingido.');
  const { imageAuthorized, ...fields } = data;
  void imageAuthorized;
  const r = {
    ...fields,
    id: old?.id || crypto.randomUUID(),
    technologies: old?.technologies || [],
    sources: old?.sources || [data.url],
    checkedAt: new Date().toISOString(),
    favorite: old?.favorite || false,
    collectionIds: old?.collectionIds || [],
    custom: true,
  };
  if (old) s.inspirations[s.inspirations.indexOf(old)] = r;
  else s.inspirations.push(r);
  return r;
}
export function organizeInspiration(s: State, id: string, input: unknown) {
  const data = z
    .object({
      favorite: z.boolean().optional(),
      collectionIds: z.array(z.string().uuid()).max(30).optional(),
    })
    .parse(input);
  const r = s.inspirations.find((r) => r.id === id);
  if (!r) throw new Error('Inspiração não encontrada.');
  if (data.collectionIds?.some((id) => !s.inspirationCollections.some((c) => c.id === id)))
    throw new Error('Coleção não encontrada.');
  Object.assign(r, data);
  return r;
}
export function createCollection(s: State, input: unknown) {
  const { name } = z.object({ name: z.string().trim().min(2).max(100) }).parse(input);
  const old = s.inspirationCollections.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (old) return old;
  if (s.inspirationCollections.length >= 30) throw new Error('Limite de coleções atingido.');
  const c = { id: crypto.randomUUID(), name };
  s.inspirationCollections.push(c);
  return c;
}
// Fetch only explicitly reviewed official origins. No arbitrary URL proxy, redirects,
// cookies, images or copyrighted page bodies are stored. Other hosts use manual input.
const metadataHosts = new Set([
  'lusion.co',
  'linear.app',
  'resend.com',
  'bruno-simon.com',
  'www.snohetta.com',
  'www.porsche.com',
]);
export async function referenceMetadata(input: unknown) {
  const data = z.object({ url }).parse(input);
  const u = new URL(data.url);
  if (!metadataHosts.has(u.hostname) || u.pathname !== '/' || u.search)
    return {
      name: '',
      description: '',
      notice:
        'Metadados automáticos indisponíveis para esta URL. Preencha os dados manualmente; nenhuma imagem foi copiada.',
    };
  try {
    const res = await fetch(u, {
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'text/html' },
    });
    if (!res.ok || !res.headers.get('content-type')?.includes('text/html') || !res.body)
      throw new Error();
    const reader = res.body.getReader();
    let html = '',
      size = 0;
    const decoder = new TextDecoder();
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.length;
        if (size > 100000) break;
        html += decoder.decode(chunk.value, { stream: true });
        if (html.includes('</head>')) break;
      }
    } finally {
      await reader.cancel();
    }
    const clean = (v: string) =>
      v
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .trim();
    return {
      name: clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').slice(0, 150),
      description: clean(
        html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)/i)?.[1] || '',
      ).slice(0, 3000),
      notice:
        'Título e descrição da página oficial. Imagens não foram importadas; permissão precisa ser confirmada separadamente.',
    };
  } catch {
    return {
      name: '',
      description: '',
      notice: 'O site não disponibilizou metadados. Continue com preenchimento manual.',
    };
  }
}
