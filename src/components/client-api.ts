import type { State } from '@/lib/domain';
import type { metrics } from '@/lib/metrics';
import type { integrations } from '@/lib/integrations';
export type WorkspaceData = Omit<
  State,
  'exclusions' | 'webhookIds' | 'rateLimits' | 'contactLedger'
> & { metrics: ReturnType<typeof metrics>; integrations: ReturnType<typeof integrations> };
export type WorkspaceAction = (
  path: string,
  method?: string,
  body?: unknown,
  success?: string,
) => Promise<Record<string, unknown> | null>;
export async function request<T = Record<string, unknown>>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir.');
  return data;
}
