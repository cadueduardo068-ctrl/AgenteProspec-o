import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { hashPassword } from '../src/lib/auth';

test(
  'Cloudflare workerd + D1 real local: login, biblioteca, geração e persistência após reiniciar',
  { timeout: 180000 },
  async () => {
    const root = path.resolve('.local/cloudflare-qa');
    const directory = path.join(root, `${Date.now()}-${process.pid}`);
    mkdirSync(directory, { recursive: true });
    const base = 'http://127.0.0.1:8787',
      password = randomBytes(24).toString('hex'),
      secret = randomBytes(48).toString('hex');
    const hash = hashPassword(password);
    const config = path.join(directory, 'wrangler.jsonc'),
      persist = path.join(directory, 'data');
    writeFileSync(
      config,
      JSON.stringify(
        {
          name: 'cadu-ai',
          main: path.resolve('.open-next/worker.js'),
          compatibility_date: '2026-10-01',
          compatibility_flags: ['nodejs_compat', 'global_fetch_strictly_public'],
          assets: { directory: path.resolve('.open-next/assets'), binding: 'ASSETS' },
          services: [{ binding: 'WORKER_SELF_REFERENCE', service: 'cadu-ai' }],
          d1_databases: [
            {
              binding: 'DB',
              database_name: 'cadu-ai',
              database_id: '00000000-0000-0000-0000-000000000000',
            },
          ],
          vars: { DATABASE_DRIVER: 'd1', APP_URL: base },
        },
        null,
        2,
      ),
    );
    writeFileSync(
      path.join(directory, '.dev.vars'),
      `NEXTJS_ENV=production\nADMIN_PASSWORD_HASH=${hash}\nSESSION_SECRET=${secret}\nOPENAI_API_KEY=\nGOOGLE_PLACES_API_KEY=\nBRAVE_SEARCH_API_KEY=\n`,
      { mode: 0o600 },
    );
    const cli = path.resolve('node_modules/wrangler/bin/wrangler.js');
    const env = { ...process.env, WRANGLER_SEND_METRICS: 'false' };
    const migration = spawnSync(
      process.execPath,
      [
        cli,
        'd1',
        'execute',
        'DB',
        '--config',
        config,
        '--local',
        '--persist-to',
        persist,
        '--file',
        path.resolve('migrations/d1/0001_state.sql'),
      ],
      { encoding: 'utf8', env },
    );
    assert.equal(migration.status, 0, migration.stderr);
    let server: ChildProcess | undefined,
      logs = '';
    let cookie = '';
    async function stop() {
      if (!server?.pid) return;
      const current = server;
      server = undefined;
      if (process.platform === 'win32')
        await new Promise<void>((resolve) => {
          spawn('taskkill', ['/PID', String(current.pid), '/T', '/F'], { stdio: 'ignore' }).once(
            'exit',
            () => resolve(),
          );
        });
      else current.kill('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    async function start() {
      logs = '';
      server = spawn(
        process.execPath,
        [
          cli,
          'dev',
          '--config',
          config,
          '--local',
          '--persist-to',
          persist,
          '--ip',
          '127.0.0.1',
          '--port',
          '8787',
          '--show-interactive-dev-session=false',
          '--log-level',
          'error',
        ],
        { env, stdio: ['ignore', 'pipe', 'pipe'] },
      );
      const collect = (chunk: Buffer) => {
        logs = (logs + String(chunk)).slice(-12000);
      };
      server.stdout?.on('data', collect);
      server.stderr?.on('data', collect);
      for (let i = 0; i < 120; i++) {
        try {
          if ((await fetch(base + '/api/health')).ok) return;
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      throw new Error(
        'Worker não iniciou: ' + logs.split(secret).join('[oculto]').split(hash).join('[oculto]'),
      );
    }
    async function req(route: string, method = 'GET', body?: unknown) {
      const response = await fetch(base + '/api/' + route, {
        method,
        headers: { Origin: base, 'Content-Type': 'application/json', Cookie: cookie },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      assert.equal(
        response.ok,
        true,
        `${route}: HTTP ${response.status} ${await response.clone().text()}`,
      );
      return response;
    }
    try {
      await start();
      const login = await req('auth/login', 'POST', { password });
      cookie = login.headers.get('set-cookie')!.split(';')[0];
      assert.ok(cookie);
      const c = await (
        await req('companies/provisional', 'POST', {
          placeId: 'worker-test-only',
          name: '[TESTE FICTÍCIO] Empresa Cloudflare',
          niche: 'Oficina',
        })
      ).json();
      const message = await (
        await req('commercial/message', 'POST', { companyId: c.id, purpose: 'Primeiro contato' })
      ).json();
      assert.match(message.text, /Empresa Cloudflare/);
      const collection = await (
        await req('inspiration-collections', 'POST', { name: 'Referências do teste' })
      ).json();
      await req('inspirations/porsche', 'PATCH', {
        favorite: true,
        collectionIds: [collection.id],
      });
      const prompt = await (
        await req('site-prompts/generate', 'POST', { companyId: c.id, inspirationId: 'porsche' })
      ).json();
      assert.match(prompt.text, /Cinematográfico/);
      await req('site-prompts', 'POST', { companyId: c.id, inspirationId: 'porsche', ...prompt });
      for (const route of [
        '/',
        '/library',
        '/inspirations',
        '/prospect',
        '/conversations',
        `/companies/${c.id}`,
      ])
        assert.equal(
          (await fetch(base + route, { headers: { Cookie: cookie } })).status,
          200,
          route,
        );
      await req(`companies/${c.id}/contact-details`, 'POST', {
        phone: '5514999999999',
        phoneConfirmed: true,
        authorized: true,
        evidence: 'Autorização fictícia para teste local do Worker, sem envio externo',
      });
      await req('manual/prepare', 'POST', { companyId: c.id, text: message.text });
      const opened = await (await req('manual/open', 'POST', { companyId: c.id })).json();
      assert.equal(new URL(opened.url).searchParams.get('text'), message.text);
      assert.equal((await (await req('state')).json()).metrics.contactsToday, 0);
      await stop();
      await start();
      const state = await (await req('state')).json();
      assert.equal(state.companies.length, 1);
      assert.equal(state.companies[0].id, c.id);
      assert.equal(state.commercialMessages.length, 1);
      assert.equal(state.prompts.length, 1);
      assert.equal(state.inspirationUses.length, 1);
      assert.equal(state.inspirationCollections.length, 1);
      assert.equal(
        state.inspirations.find((r: { id: string }) => r.id === 'porsche').favorite,
        true,
      );
      assert.equal(state.contacts[0].status, 'aberto');
      assert.equal(state.integrations.database.label, 'Cloudflare D1');
    } finally {
      await stop();
      const resolved = path.resolve(directory);
      if (!resolved.startsWith(root + path.sep))
        throw new Error('Diretório de QA fora da área prevista.');
      rmSync(resolved, { recursive: true, force: true });
    }
  },
);
