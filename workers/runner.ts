import { HttpGenerationProvider, type ProviderStatus } from './provider';
import type { Job } from '../src/lib/domain';
const apiUrl = process.env.APP_URL;
if (
  !apiUrl ||
  !process.env.WORKER_TOKEN ||
  !process.env.GENERATOR_URL ||
  !process.env.GENERATOR_TOKEN
)
  throw new Error('Configure APP_URL, WORKER_TOKEN, GENERATOR_URL e GENERATOR_TOKEN no worker.');
const provider = new HttpGenerationProvider(process.env.GENERATOR_URL, process.env.GENERATOR_TOKEN);
const steps: ProviderStatus['status'][] = [
  'generating',
  'installing',
  'testing',
  'preview',
  'ready',
];
const appSteps: Job['status'][] = [
  'Gerando código',
  'Instalando dependências',
  'Executando testes',
  'Preparando prévia',
  'Aguardando aprovação',
];
let stopping = false;
process.on('SIGTERM', () => {
  stopping = true;
});
process.on('SIGINT', () => {
  stopping = true;
});
async function app(path: string, body: unknown) {
  const response = await fetch(new URL(`/api/worker/${path}`, apiUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WORKER_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Backend retornou HTTP ${response.status}.`);
  return response.json();
}
async function execute(job: Job & { brief: Record<string, string> }) {
  const remote = await provider.start({
    id: job.id,
    brief: job.brief,
    revision: job.revision,
    attempt: job.attempts,
  });
  let last = 0;
  const deadline = Date.now() + 18 * 60_000;
  while (!stopping && Date.now() < deadline) {
    const progress = await provider.status(remote);
    if (progress.status === 'failed')
      throw new Error('Provedor de geração falhou; verifique os logs isolados.');
    const index = steps.indexOf(progress.status);
    if (index < last) throw new Error('Provedor retornou regressão de estado.');
    // The provider must expose every real phase, even if the polling interval would skip it.
    if (index > last + 1)
      throw new Error('Provedor pulou fases de verificação; execução interrompida.');
    if (index === last + 1) {
      await app('callback', {
        id: job.id,
        status: appSteps[index],
        ...(progress.previewUrl ? { previewUrl: progress.previewUrl } : {}),
        ...(progress.desktopScreenshot ? { desktopScreenshot: progress.desktopScreenshot } : {}),
        ...(progress.mobileScreenshot ? { mobileScreenshot: progress.mobileScreenshot } : {}),
        ...(progress.checks ? { checks: progress.checks } : {}),
      });
      last = index;
      if (progress.status === 'ready') return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('Tempo de geração esgotado ou worker interrompido.');
}
while (!stopping) {
  try {
    const { job } = await app('claim', {});
    if (!job) {
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    console.log(JSON.stringify({ level: 'info', event: 'generation_claimed', jobId: job.id }));
    try {
      await execute(job);
    } catch {
      await app('callback', {
        id: job.id,
        status: 'Falhou',
        error: 'Geração interrompida. Revise o provedor isolado antes de solicitar nova tentativa.',
      });
    }
  } catch {
    console.error(JSON.stringify({ level: 'error', event: 'worker_request_failed' }));
    await new Promise((r) => setTimeout(r, 5000));
  }
}
