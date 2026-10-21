import { z } from 'zod';
import { dayInSaoPaulo, event, websitePresence } from './domain';
import type { Store } from './store';
import { localities, type LocalityService } from './localities';
const nicheName = z.string().trim().min(2).max(100);
export const prospectSchema = z
  .object({
    niches: z.array(nicheName).min(1).max(8).optional(),
    niche: nicheName.optional(),
    city: z.string().trim().min(2).max(100),
    cityId: z.number().int().positive().optional(),
    state: z.string().regex(/^[A-Z]{2}$/),
    limit: z.number().int().min(1).max(60),
    priority: z.enum(['no-site', 'all', 'old-site']),
  })
  .transform((data) => ({
    ...data,
    niches: [
      ...new Map(
        (data.niches || [data.niche || '']).map((n) => [n.toLocaleLowerCase('pt-BR'), n]),
      ).values(),
    ],
  }))
  .refine(
    (data) => data.niches.every((n) => n.length >= 2) && data.niches.length > 0,
    'Selecione pelo menos um nicho.',
  )
  .refine(
    (data) => data.limit >= data.niches.length,
    'O limite de resultados deve ser igual ou maior que a quantidade de nichos.',
  );
export async function searchPlaces(
  db: Store,
  input: unknown,
  locations: LocalityService = localities(),
) {
  const data = prospectSchema.parse(input);
  if (!process.env.GOOGLE_PLACES_API_KEY)
    throw new Error('Configure GOOGLE_PLACES_API_KEY no servidor para buscar empresas reais.');
  const city = await locations.validate(data.state, data.city, data.cityId);
  await db.mutate((s) => {
    s.recentCities = [city, ...s.recentCities.filter((c) => c.id !== city.id)].slice(0, 8);
  });
  const places: Record<string, unknown>[] = [];
  for (const [index, niche] of data.niches.entries()) {
    const allocation =
      Math.floor(data.limit / data.niches.length) +
      (index < data.limit % data.niches.length ? 1 : 0);
    let pageToken: string | undefined;
    let fetched = 0;
    let pages = 0;
    do {
      await db.mutate((s) => {
        const day = dayInSaoPaulo();
        let usage = s.usage.find((u) => u.day === day);
        if (!usage) {
          usage = { day, places: 0, search: 0 };
          s.usage.push(usage);
        }
        if (usage.places >= s.settings.placesDailyLimit)
          throw new Error('Limite diário de consultas Google atingido.');
        usage.places++;
      });
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.internationalPhoneNumber,places.googleMapsUri,places.attributions,nextPageToken',
        },
        body: JSON.stringify({
          textQuery: `${niche} em ${data.city}, ${data.state}, Brasil`,
          languageCode: 'pt-BR',
          regionCode: 'BR',
          pageSize: Math.min(20, allocation - fetched),
          ...(pageToken ? { pageToken } : {}),
        }),
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(25000),
      });
      if (!response.ok) {
        let code = '';
        try {
          const error = await response.json();
          code = error.error?.status || '';
        } catch {}
        const messages: Record<string, string> = {
          PERMISSION_DENIED:
            'Verifique se Places API (New) está ativada, com faturamento e restrições compatíveis com chamadas do servidor.',
          RESOURCE_EXHAUSTED: 'A cota ou o orçamento da API Google foi atingido.',
          INVALID_ARGUMENT: 'A API Google recusou os parâmetros da consulta.',
        };
        throw new Error(
          `Google Places retornou HTTP ${response.status}. ${messages[code] || 'Confira a configuração no Google Cloud.'}`,
        );
      }
      const result = await response.json();
      const page = Array.isArray(result.places) ? result.places.slice(0, allocation - fetched) : [];
      places.push(...page.map((p: Record<string, unknown>) => ({ ...p, prospectNiche: niche })));
      fetched += page.length;
      pageToken = result.nextPageToken;
      pages++;
    } while (pageToken && fetched < allocation && pages < 3);
  }
  const seen = new Set();
  const unique = places.filter((p) => {
    if (!p.id || seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
  const filtered =
    data.priority === 'no-site'
      ? unique.filter((p) => websitePresence(String(p.websiteUri || '')) !== 'website')
      : unique;
  await db.mutate((s) =>
    event(
      s,
      `Prospecção concluída: ${data.niches.join(', ')} em ${data.city} · ${filtered.length} resultados nesta consulta`,
    ),
  );
  return {
    places: filtered,
    notice:
      data.priority === 'old-site'
        ? 'A idade de um site não pode ser inferida do Places. Resultados exigem análise manual.'
        : 'Ausência de site no Google não confirma que a empresa não possui site. Verifique fontes independentes.',
    source: 'Google Maps',
    niches: data.niches,
  };
}
