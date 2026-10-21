import { z } from 'zod';
export const providerStatus = z.object({
  status: z.enum(['generating', 'installing', 'testing', 'preview', 'ready', 'failed']),
  previewUrl: z.string().url().optional(),
  desktopScreenshot: z.string().url().optional(),
  mobileScreenshot: z.string().url().optional(),
  checks: z.array(z.string().max(300)).max(30).optional(),
  error: z.string().max(500).optional(),
});
export type ProviderStatus = z.infer<typeof providerStatus>;
export interface CodeGenerationProvider {
  start(job: {
    id: string;
    brief: Record<string, string>;
    revision?: string;
    attempt?: number;
  }): Promise<string>;
  status(id: string): Promise<ProviderStatus>;
}
export class HttpGenerationProvider implements CodeGenerationProvider {
  constructor(
    private url: string,
    private token: string,
  ) {
    const u = new URL(url);
    if (u.protocol !== 'https:') throw new Error('O gerador remoto exige HTTPS.');
  }
  private async request(path: string, method = 'GET', body?: unknown) {
    const res = await fetch(new URL(path, this.url), {
      method,
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Provedor de geração retornou HTTP ${res.status}.`);
    return res.json();
  }
  async start(job: {
    id: string;
    brief: Record<string, string>;
    revision?: string;
    attempt?: number;
  }) {
    const data = z.object({ jobId: z.string().min(1).max(200) }).parse(
      await this.request('/jobs', 'POST', {
        ...job,
        idempotencyKey: `${job.id}:${job.attempt || 1}`,
      }),
    );
    return data.jobId;
  }
  async status(id: string) {
    return providerStatus.parse(await this.request(`/jobs/${encodeURIComponent(id)}`));
  }
}
