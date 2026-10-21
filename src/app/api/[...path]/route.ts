import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  cookieName,
  configured,
  rateLimit,
  setup,
  signSession,
  validSession,
  verifyPassword,
} from '@/lib/auth';
import { store } from '@/lib/store';
import {
  addCompany,
  provisionalCompany,
  getCompany,
  updateCompany,
  grantConsent,
  verifyContactDetails,
  editCompany,
  optOut,
  draftApproach,
} from '@/lib/crm';
import { event } from '@/lib/domain';
import { metrics } from '@/lib/metrics';
import { integrations, integrationRoute } from '@/lib/integrations';
import { allowedOrigin } from '@/lib/origin';
import { localities } from '@/lib/localities';
import { generateSitePrompt, saveSitePrompt, startPromptDemo } from '@/lib/site-prompts';
import { saveCommercialMessage } from '@/lib/commercial-content';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
async function handle(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const parts = (await context.params).path;
  const route = parts.join('/');
  const method = req.method;
  try {
    if (route === 'health' && method === 'GET') return json({ status: 'ok', service: 'cadu-ai' });
    if (route.startsWith('webhooks/') || route.startsWith('worker/'))
      return await integrationRoute(req, parts, null);
    if (!['GET', 'HEAD'].includes(method)) {
      const origin = req.headers.get('origin');
      if (!allowedOrigin(origin, req.url))
        return json({ error: 'Origem da solicitação não autorizada.' }, 403);
    }
    if (route.startsWith('auth/')) {
      if (method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
      await rateLimit('login-global', 20, 15 * 60_000);
      if (route === 'auth/logout') {
        const res = json({ ok: true });
        res.cookies.delete(cookieName);
        return res;
      }
      const data = z.object({ password: z.string().min(12).max(128) }).parse(await body(req));
      if (route === 'auth/setup') {
        if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(req.url).hostname))
          return json({ error: 'Cadastro apenas no ambiente local.' }, 403);
        setup(data.password);
      } else if (route !== 'auth/login' || !configured() || !verifyPassword(data.password))
        return json({ error: 'Credenciais inválidas ou acesso não configurado.' }, 401);
      const res = json({ ok: true });
      res.cookies.set(cookieName, signSession(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 8 * 3600,
      });
      return res;
    }
    if (!validSession(req.cookies.get(cookieName)?.value))
      return json({ error: 'Entre para continuar.' }, 401);
    await rateLimit('admin-api', 300, 60_000);
    const db = store();
    if (route === 'commercial/messages' && method === 'POST') {
      const input = await body(req);
      return json(await db.mutate((s) => saveCommercialMessage(s, input)), 201);
    }
    if (route === 'site-prompts/generate' && method === 'POST')
      return json(await generateSitePrompt(db, await body(req)));
    if (route === 'site-prompts' && method === 'POST') {
      const input = await body(req);
      return json(await db.mutate((s) => saveSitePrompt(s, input)), 201);
    }
    if (parts[0] === 'site-prompts' && parts[1] && parts[2] === 'start' && method === 'POST')
      return json(await db.mutate((s) => startPromptDemo(s, parts[1])));
    if (route === 'localities/states' && method === 'GET')
      return json({ states: await localities().states() });
    if (route === 'localities/cities' && method === 'GET')
      return json({ cities: await localities().cities(req.nextUrl.searchParams.get('uf') || '') });
    if (route === 'preferences/location' && method === 'POST') {
      const data = z
        .object({
          uf: z.string().length(2),
          name: z.string().min(1).max(100),
          id: z.number().int(),
        })
        .parse(await body(req));
      const city = await localities().validate(data.uf, data.name, data.id);
      await db.mutate((s) => {
        s.recentCities = [city, ...s.recentCities.filter((c) => c.id !== city.id)].slice(0, 8);
      });
      return json({ city });
    }
    if (route === 'state' && method === 'GET') {
      const state = await db.read();
      const { exclusions, webhookIds, rateLimits, contactLedger, ...safe } = state;
      void exclusions;
      void webhookIds;
      void rateLimits;
      void contactLedger;
      return json({ ...safe, metrics: metrics(state), integrations: integrations() });
    }
    if (route === 'companies/provisional' && method === 'POST') {
      const input = await body(req);
      return json(await db.mutate((s) => provisionalCompany(s, input)), 201);
    }
    if (route === 'companies' && method === 'POST') {
      const input = await body(req);
      return json(await db.mutate((s) => addCompany(s, input)), 201);
    }
    if (parts[0] === 'companies' && parts[1]) {
      const id = parts[1];
      if (parts.length === 2 && method === 'PUT') {
        const input = await body(req);
        return json(await db.mutate((s) => editCompany(s, id, input)));
      }
      if (parts[2] === 'contact-details' && method === 'POST') {
        const input = await body(req);
        return json(await db.mutate((s) => verifyContactDetails(s, id, input)));
      }
      if (parts.length === 2 && method === 'PATCH') {
        const input = await body(req);
        return json(await db.mutate((s) => updateCompany(s, id, input)));
      }
      if (parts.length === 2 && method === 'DELETE') {
        await db.mutate((s) => {
          getCompany(s, id);
          s.companies = s.companies.filter((c) => c.id !== id);
          s.messages = s.messages.filter((m) => m.companyId !== id);
          s.contacts = s.contacts.filter((c) => c.companyId !== id);
          s.analyses = s.analyses.filter((a) => a.companyId !== id);
          s.jobs = s.jobs.filter((j) => j.companyId !== id);
          s.tasks = s.tasks.filter((t) => t.companyId !== id);
          s.prompts = s.prompts.filter((p) => p.companyId !== id);
          s.commercialMessages = s.commercialMessages.filter((m) => m.companyId !== id);
          s.events = s.events.filter((e) => e.companyId !== id);
          event(s, 'Cadastro e histórico removidos por solicitação do administrador');
        });
        return json({ ok: true });
      }
      if (parts[2] === 'consent' && method === 'POST') {
        const input = await body(req);
        await db.mutate((s) => grantConsent(s, id, input));
        return json({ ok: true });
      }
      if (parts[2] === 'optout' && method === 'POST') {
        await db.mutate((s) => optOut(s, id));
        return json({ ok: true });
      }
      if (parts[2] === 'draft' && method === 'GET')
        return json({ text: draftApproach(getCompany(await db.read(), id)) });
    }
    if (route === 'settings' && method === 'PATCH') {
      const input = z
        .object({
          dailyLimit: z.number().int().min(1).max(100),
          placesDailyLimit: z.number().int().min(1).max(500),
          paused: z.boolean(),
          notifications: z.boolean(),
          manualApproval: z.literal(true),
        })
        .strict()
        .parse(await body(req));
      await db.mutate((s) => {
        s.settings = input;
        event(s, 'Preferências operacionais atualizadas');
      });
      return json({ ok: true });
    }
    if (route === 'tasks' && method === 'POST') {
      const data = z
        .object({
          companyId: z.string().uuid(),
          title: z.string().trim().min(3).max(300),
          description: z.string().trim().max(3000).optional(),
          dueAt: z.string().datetime().optional(),
        })
        .parse(await body(req));
      await db.mutate((s) => {
        getCompany(s, data.companyId);
        s.tasks.push({
          ...data,
          id: crypto.randomUUID(),
          done: false,
          at: new Date().toISOString(),
        });
        event(s, `Tarefa criada: ${data.title}`, data.companyId, 'ação do administrador');
      });
      return json({ ok: true });
    }
    if (parts[0] === 'tasks' && parts[1] && method === 'PATCH') {
      await db.mutate((s) => {
        const t = s.tasks.find((t) => t.id === parts[1]);
        if (!t) throw new Error('Tarefa não encontrada.');
        t.done = !t.done;
        event(
          s,
          `Tarefa ${t.done ? 'concluída' : 'reaberta'}: ${t.title}`,
          t.companyId,
          'ação do administrador',
        );
      });
      return json({ ok: true });
    }
    if (route === 'export' && method === 'GET') {
      const s = await db.read();
      return json({
        exportedAt: new Date().toISOString(),
        companies: s.companies,
        contacts: s.contacts,
        analyses: s.analyses,
        messages: s.messages,
        tasks: s.tasks,
        prompts: s.prompts,
        commercialMessages: s.commercialMessages,
        jobs: s.jobs,
        events: s.events,
      });
    }
    return await integrationRoute(req, parts, db);
  } catch (error) {
    const id = crypto.randomUUID();
    console.error(
      JSON.stringify({
        level: 'error',
        requestId: id,
        route,
        type: error instanceof z.ZodError ? 'validation' : 'request_failed',
      }),
    );
    if (error instanceof z.ZodError)
      return json(
        {
          error: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          requestId: id,
        },
        400,
      );
    // Provider errors never include raw upstream bodies or credentials.
    const message = error instanceof Error ? error.message : 'Falha ao processar solicitação.';
    return json(
      {
        error: message.startsWith('fetch') ? 'Serviço externo indisponível.' : message,
        requestId: id,
      },
      message.includes('Muitas solicitações') ? 429 : 400,
    );
  }
}
export async function body(req: Request) {
  if (Number(req.headers.get('content-length') || 0) > 64_000)
    throw new Error('Solicitação muito grande.');
  const raw = await req.text();
  if (Buffer.byteLength(raw) > 64_000) throw new Error('Solicitação muito grande.');
  return JSON.parse(raw);
}
export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
