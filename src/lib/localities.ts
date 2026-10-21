import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
export type Municipality = { id: number; name: string; uf: string };
export type BrazilianState = { id: number; name: string; uf: string };
const ufSchema = z
  .string()
  .regex(/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/);
const rows = z.array(
  z.object({
    id: z.number().int().positive(),
    nome: z.string().min(1),
    sigla: z.string().optional(),
  }),
);
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
type Cache = { at: number; items: BrazilianState[] };
export class LocalityService {
  private memory = new Map<string, Cache>();
  private inflight = new Map<string, Promise<BrazilianState[]>>();
  constructor(
    private fetcher: typeof fetch = (...args) => fetch(...args),
    private cacheDir?: string,
  ) {}
  private async load(key: string, url: string, uf?: string): Promise<BrazilianState[]> {
    let cached = this.memory.get(key);
    if (!cached && this.cacheDir) {
      try {
        const value = JSON.parse(await readFile(path.join(this.cacheDir, `${key}.json`), 'utf8'));
        cached = z
          .object({
            at: z.number(),
            items: z.array(z.object({ id: z.number(), name: z.string(), uf: ufSchema })),
          })
          .parse(value);
        this.memory.set(key, cached);
      } catch {}
    }
    if (cached && Date.now() - cached.at < 24 * 3600_000) return cached.items;
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const promise = (async () => {
      try {
        const response = await this.fetcher(url, {
          signal: AbortSignal.timeout(15000),
          redirect: 'error',
        });
        if (!response.ok) throw new Error('IBGE indisponível');
        const result = rows
          .parse(await response.json())
          .map((item) => ({ id: item.id, name: item.nome, uf: uf || ufSchema.parse(item.sigla) }))
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        if (!result.length) throw new Error('Lista de localidades vazia');
        const next = { at: Date.now(), items: result };
        this.memory.set(key, next);
        if (this.cacheDir) {
          await mkdir(this.cacheDir, { recursive: true });
          const temp = path.join(this.cacheDir, `${key}.${crypto.randomUUID()}.tmp`);
          await writeFile(temp, JSON.stringify(next));
          await rename(temp, path.join(this.cacheDir, `${key}.json`));
        }
        return result;
      } catch {
        if (cached) return cached.items;
        throw new Error(
          'Não foi possível carregar as localidades do IBGE. Tente novamente; nenhuma cidade foi inventada.',
        );
      }
    })();
    this.inflight.set(key, promise);
    try {
      return await promise;
    } finally {
      this.inflight.delete(key);
    }
  }
  states() {
    return this.load(
      'states',
      'https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome',
    );
  }
  cities(uf: string) {
    const state = ufSchema.parse(uf);
    return this.load(
      `cities-${state}`,
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${state}/municipios?orderBy=nome`,
      state,
    );
  }
  async validate(uf: string, name: string, id?: number) {
    const list = await this.cities(uf);
    const city = list.find(
      (c) => (id === undefined || c.id === id) && normalize(c.name) === normalize(name),
    );
    if (!city) throw new Error('Selecione um município válido na lista oficial do estado.');
    return city;
  }
}
const globals = globalThis as unknown as { caduLocalities?: LocalityService };
export function localities() {
  return (globals.caduLocalities ||= new LocalityService(
    undefined,
    path.resolve(process.env.LOCAL_DATA_DIR || '.local', 'cache', 'ibge'),
  ));
}
