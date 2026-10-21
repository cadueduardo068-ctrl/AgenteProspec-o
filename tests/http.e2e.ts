import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { hashPassword } from '../src/lib/auth';

test(
  'fluxo HTTP real: autenticação, CRM, consentimento, contato manual, análise, fila e exclusão',
  { timeout: 120000 },
  async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'cadu-http-'));
    const password = randomBytes(24).toString('hex');
    const base = 'http://127.0.0.1:3101';
    const server = spawn(
      process.execPath,
      ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3101'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          APP_URL: base,
          LOCAL_DATA_DIR: directory,
          DATABASE_DRIVER: 'sqlite',
          ADMIN_PASSWORD_HASH: hashPassword(password),
          SESSION_SECRET: randomBytes(48).toString('hex'),
          NEXT_DIST_DIR: '.next-e2e',
          NEXT_TELEMETRY_DISABLED: '1',
          OPENAI_API_KEY: '',
          OPENAI_MODEL: '',
          GOOGLE_PLACES_API_KEY: '',
          BRAVE_SEARCH_API_KEY: '',
          GENERATOR_URL: '',
        },
        stdio: 'ignore',
      },
    );
    let cookie = '';
    async function req(route: string, method = 'GET', body?: unknown, origin = base) {
      return fetch(base + '/api/' + route, {
        method,
        headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    }
    try {
      let started = false;
      for (let i = 0; i < 100; i++) {
        try {
          if ((await fetch(base + '/api/health')).ok) {
            started = true;
            break;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 500));
      }
      assert.equal(started, true, 'servidor de teste iniciou');
      assert.equal((await req('state')).status, 401);
      assert.equal(
        (await req('auth/login', 'POST', { password }, 'https://other.example')).status,
        403,
      );
      const login = await req('auth/login', 'POST', { password });
      assert.equal(login.status, 200);
      cookie = login.headers.get('set-cookie')!.split(';')[0];
      assert.match(login.headers.get('set-cookie')!, /HttpOnly/i);
      const initial = await (await req('state')).json();
      assert.equal(initial.metrics.companies, 0);
      assert.equal(initial.metrics.responseRate, null);
      const create = await req('companies', 'POST', {
        name: 'Empresa fictícia para teste HTTP',
        niche: 'Psicólogos',
        city: 'Bauru',
        state: 'SP',
        phone: '5514999999999',
        website: '',
        source: 'https://example.org/test',
        verified: true,
        services: 'Serviço fictício exclusivo de teste',
      });
      assert.equal(create.status, 201);
      const c = await create.json();
      assert.equal(
        (await fetch(`${base}/companies/${c.id}`, { headers: { Cookie: cookie } })).status,
        200,
      );
      assert.equal(
        (
          await req(`companies/${c.id}`, 'PATCH', {
            notes: 'Cliente fictício pediu retorno amanhã.',
          })
        ).status,
        200,
      );
      assert.equal(
        (await (await req('state')).json()).companies[0].notes,
        'Cliente fictício pediu retorno amanhã.',
      );
      const commercial = await (
        await req('commercial/message', 'POST', { companyId: c.id, purpose: 'Primeira abordagem' })
      ).json();
      assert.equal(commercial.method, 'template');
      assert.match(commercial.text, /Empresa fictícia/);
      assert.equal(
        (
          await req('tasks', 'POST', {
            companyId: c.id,
            title: 'Acompanhamento fictício com data',
            description: 'Somente teste HTTP',
            dueAt: '2026-10-22T13:00:00.000Z',
          })
        ).status,
        200,
      );
      assert.equal((await (await req('state')).json()).tasks[0].dueAt, '2026-10-22T13:00:00.000Z');
      assert.equal((await req('manual/open', 'POST', { companyId: c.id })).status, 400);
      assert.equal(
        (
          await req(`companies/${c.id}/consent`, 'POST', {
            evidence: 'Autorização fictícia somente para teste automatizado',
            confirmed: true,
          })
        ).status,
        200,
      );
      assert.equal((await req('manual/prepare', 'POST', { companyId: c.id })).status, 200);
      const open = await (await req('manual/open', 'POST', { companyId: c.id })).json();
      assert.match(open.url, /^https:\/\/wa.me\//);
      assert.equal((await (await req('state')).json()).metrics.sentToday, 0);
      assert.equal(
        (await req('manual/confirm', 'POST', { contactId: open.contactId })).status,
        200,
      );
      assert.equal(
        (await req('manual/confirm', 'POST', { contactId: open.contactId })).status,
        200,
      );
      assert.equal((await (await req('state')).json()).metrics.sentToday, 1);
      const generated = await (
        await req('site-prompts/generate', 'POST', { companyId: c.id })
      ).json();
      assert.equal(generated.method, 'template');
      assert.match(generated.text, /Bauru/);
      assert.equal((await (await req('state')).json()).prompts.length, 0);
      const prompt = await (
        await req('site-prompts', 'POST', { companyId: c.id, ...generated })
      ).json();
      assert.equal((await req(`site-prompts/${prompt.id}/start`, 'POST', {})).status, 200);
      assert.equal((await req(`site-prompts/${prompt.id}/start`, 'POST', {})).status, 200);
      assert.equal((await (await req('state')).json()).tasks.length, 2);
      await req(`companies/${c.id}`, 'PATCH', { stage: 'Envio confirmado' }); // Endpoint cannot forge contact confirmations.
      const followup = await (await req('manual/followup', 'POST', { companyId: c.id })).json();
      assert.equal(
        (await req('manual/confirm', 'POST', { contactId: followup.contactId })).status,
        200,
      );
      assert.equal((await (await req('state')).json()).metrics.contactsToday, 1);
      const analysis = await (
        await req('analyses', 'POST', {
          companyId: c.id,
          text: 'Gostaria de receber uma demonstração do site',
          source: 'texto colado',
          retainText: false,
        })
      ).json();
      assert.equal(analysis.method, 'rules');
      assert.equal(analysis.rawText, undefined);
      assert.equal((await (await req('state')).json()).companies[0].stage, 'Site em geração');
      assert.equal((await req(`analyses/${analysis.id}`, 'PATCH')).status, 200);
      const jobResponse = await req('jobs', 'POST', { companyId: c.id, confirmed: true });
      assert.equal(jobResponse.status, 201);
      const job = await jobResponse.json();
      assert.equal(job.status, 'Aguardando geração');
      assert.equal((await req(`jobs/${job.id}`, 'PATCH', { action: 'approve' })).status, 400);
      assert.equal(
        (
          await req('prospect', 'POST', {
            niche: 'Psicólogos',
            city: 'Bauru',
            state: 'SP',
            limit: 5,
            priority: 'all',
          })
        ).status,
        400,
      );
      const state = await (await req('state')).json();
      assert.equal(state.companies[0].stage, 'Site em geração');
      assert.equal(state.tasks.length, 3);
      assert.equal(state.prompts.length, 1);
      assert.equal(state.contactLedger, undefined);
      assert.equal((await req(`companies/${c.id}`, 'DELETE')).status, 200);
      const after = await (await req('state')).json();
      assert.equal(after.companies.length, 0);
      assert.equal(after.analyses.length, 0);
      assert.equal(after.prompts.length, 0);
      assert.equal(
        after.metrics.contactsToday,
        1,
        'excluir cadastro não reinicia limite operacional',
      );
      const second = await (
        await req('companies', 'POST', {
          name: 'Novo cadastro fictício',
          niche: 'Clínica',
          city: 'Bauru',
          state: 'SP',
          phone: '5514999999999',
          source: 'https://example.org/test',
          verified: true,
        })
      ).json();
      await req(`companies/${second.id}/consent`, 'POST', {
        evidence: 'Evidência fictícia para testar duplicação',
        confirmed: true,
      });
      await req('manual/prepare', 'POST', { companyId: second.id });
      assert.equal((await req('manual/open', 'POST', { companyId: second.id })).status, 400);
      const provisional = await (
        await req('companies/provisional', 'POST', {
          placeId: 'http-provisional',
          name: 'Empresa incompleta de teste',
          niche: 'Oficina',
        })
      ).json();
      assert.equal(provisional.verified, false);
      const again = await (
        await req('companies/provisional', 'POST', { placeId: 'http-provisional' })
      ).json();
      assert.equal(again.id, provisional.id);
      const draft = await (
        await req('site-prompts/generate', 'POST', { companyId: provisional.id })
      ).json();
      assert.match(draft.text, /PROVISÓRIOS, NÃO CONFIRMADOS/);
      assert.doesNotMatch(draft.text, /https:\/\/wa.me\//);
      const savedDraft = await (
        await req('site-prompts', 'POST', { companyId: provisional.id, ...draft })
      ).json();
      const reopened = await (await req('state')).json();
      assert.equal(
        reopened.prompts.find((p: { id: string }) => p.id === savedDraft.id).text,
        draft.text.trim(),
      );
      assert.equal(
        reopened.companies.filter((c: { placeId: string }) => c.placeId === 'http-provisional')
          .length,
        1,
      );
      assert.equal(
        (await fetch(`${base}/companies/${provisional.id}`, { headers: { Cookie: cookie } }))
          .status,
        200,
      );
    } finally {
      if (process.platform === 'win32')
        await new Promise<void>((resolve) => {
          spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }).once(
            'exit',
            () => resolve(),
          );
        });
      else server.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 500));
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
