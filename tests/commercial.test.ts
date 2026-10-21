import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { brazilianPhone, whatsappPhone } from '../src/lib/phones';
import { initialState, initialContacts, websitePresence } from '../src/lib/domain';
import { addCompany, grantConsent, updateCompany, optOut } from '../src/lib/crm';
import {
  prepareContact,
  openContact,
  confirmContact,
  openFollowup,
  cancelContact,
} from '../src/lib/manual';
import { messagePurposes, messageTemplate } from '../src/lib/content-templates';
import {
  buildSitePrompt,
  sitePlan,
  saveSitePrompt,
  startPromptDemo,
  generateSitePrompt,
} from '../src/lib/site-prompts';
import { generateCommercialMessage } from '../src/lib/commercial-content';
import { SqliteStore } from '../src/lib/store';
import { nextAction } from '../src/components/contacted-companies';
const fixture = () => {
  const s = initialState();
  const c = addCompany(s, {
    name: 'Empresa fictícia de testes',
    niche: 'Psicólogos',
    city: 'Bauru',
    state: 'SP',
    phone: '(14) 99999-9999',
    source: 'https://example.org/independent',
    verified: true,
    services: 'Atendimento informado para teste',
    address: 'Endereço fictício de teste',
  });
  grantConsent(s, c.id, {
    evidence: 'Autorização expressa fictícia para teste automatizado',
    confirmed: true,
  });
  return { s, c };
};
test('telefone brasileiro normaliza sem inventar DDD ou nono dígito', () => {
  assert.equal(brazilianPhone('+55 (14) 99999-9999'), '5514999999999');
  assert.equal(brazilianPhone('(14) 3333-4444'), '551433334444');
  assert.equal(brazilianPhone('55 99999-9999'), '5555999999999');
  assert.equal(brazilianPhone('0055 14 99999-9999'), '5514999999999');
  for (const value of [
    '99999-9999',
    '14 8888-7777',
    '00 99999-9999',
    '014999999999',
    '+1 415 555 2671',
    '14 99999-9999 ramal 1',
  ])
    assert.throws(() => brazilianPhone(value));
  assert.equal(whatsappPhone('').phone, null);
});
test('link wa.me tem destinatário correto e preserva texto codificado revisado', () => {
  const { s, c } = fixture();
  const text = 'Olá, tudo bem? Uma ideia para você & sua empresa + contato';
  prepareContact(s, c.id, text);
  const result = openContact(s, c.id);
  const url = new URL(result.url);
  assert.equal(url.hostname, 'wa.me');
  assert.equal(url.pathname, '/5514999999999');
  assert.equal(url.searchParams.get('text'), text);
  assert.equal(initialContacts(s), 0);
  assert.equal(s.contacts.length, 1);
  assert.match(nextAction(c, s), /Confirmar/);
  prepareContact(s, c.id, 'Texto revisto');
  assert.equal(new URL(openContact(s, c.id).url).searchParams.get('text'), 'Texto revisto');
  assert.equal(s.contacts.length, 1);
});
test('acompanhamento não duplica novo contato nem regride etapa comercial', () => {
  const { s, c } = fixture();
  prepareContact(s, c.id);
  const first = openContact(s, c.id);
  confirmContact(s, first.contactId);
  updateCompany(s, c.id, { stage: 'Interessado' });
  prepareContact(s, c.id, 'Obrigado pelo interesse. Podemos alinhar o escopo?');
  assert.equal(c.stage, 'Interessado');
  const followup = openFollowup(s, c.id);
  confirmContact(s, followup.contactId);
  confirmContact(s, followup.contactId);
  assert.equal(initialContacts(s), 1);
  assert.equal(c.stage, 'Interessado');
  assert.equal(s.contacts.length, 2);
  const next = openFollowup(s, c.id);
  cancelContact(s, next.contactId);
  assert.equal(c.stage, 'Interessado');
  optOut(s, c.id);
  assert.throws(() => openFollowup(s, c.id));
  assert.throws(() => updateCompany(s, c.id, { stage: 'Interessado' }));
});
test('mensagens para cinco objetivos não inventam preços ou resultados', () => {
  const { c } = fixture();
  assert.equal(messagePurposes.length, 5);
  for (const purpose of messagePurposes) {
    const text = messageTemplate(c, purpose);
    assert.ok(text.length > 30 && text.length < 700);
    assert.doesNotMatch(text, /R\$|garantido|sem site|não tem site/);
  }
  assert.match(messageTemplate(c, 'Primeira abordagem'), /Empresa fictícia/);
  assert.match(messageTemplate(c, 'Resposta sobre valores'), /escopo/);
});
test('prompt é completo, por nicho e com pendências explícitas', () => {
  const { c } = fixture();
  const prompt = buildSitePrompt(c);
  assert.equal(sitePlan(c), 'site institucional');
  assert.match(prompt, /Bauru/);
  assert.match(prompt, /agendamento/);
  assert.match(prompt, /acessibilidade/);
  assert.match(prompt, /rate limiting/);
  assert.match(prompt, /5514999999999/);
  assert.match(prompt, /Não inventar depoimentos/);
  const hygiene = { ...c, niche: 'Higienização de estofados', services: '', phone: '' };
  assert.equal(sitePlan(hygiene), 'landing page');
  assert.match(buildSitePrompt(hygiene), /PENDENTE: confirmar/);
  assert.doesNotMatch(buildSitePrompt(hygiene), /wa.me\/55/);
  assert.match(buildSitePrompt(hygiene), /pedidos de orçamento/);
});
test('histórico de prompts conserva versões e início de demonstração é idempotente', () => {
  const { s, c } = fixture();
  const input = {
    companyId: c.id,
    text: buildSitePrompt(c),
    method: 'template',
    plan: sitePlan(c),
  };
  const first = saveSitePrompt(s, input);
  assert.equal(saveSitePrompt(s, input).id, first.id);
  const second = saveSitePrompt(s, {
    ...input,
    id: first.id,
    text: input.text + '\nRevisão visual solicitada.',
  });
  assert.notEqual(first.id, second.id);
  assert.equal(s.prompts.length, 2);
  assert.equal(first.text, input.text.trim());
  startPromptDemo(s, second.id);
  startPromptDemo(s, second.id);
  assert.equal(c.stage, 'Site em geração');
  assert.equal(s.tasks.length, 1);
  assert.equal(s.jobs.length, 0);
  assert.match(s.tasks[0].description || '', /Nenhuma geração/);
});
test('modelos locais e prompts persistem sem chave OpenAI e sem acessar rede', async () => {
  const db = new SqliteStore(':memory:');
  const { s, c } = fixture();
  await db.mutate((state) => Object.assign(state, s));
  const key = process.env.OPENAI_API_KEY,
    model = process.env.OPENAI_MODEL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  try {
    const result = await generateCommercialMessage(db, {
      companyId: c.id,
      purpose: 'Primeira abordagem',
    });
    assert.equal(result.method, 'template');
    assert.equal((await db.read()).companies[0].draft, result.text);
    const prompt = await generateSitePrompt(db, { companyId: c.id });
    assert.equal(prompt.method, 'template');
    assert.equal((await db.read()).prompts.length, 0, 'não salva automaticamente antes da revisão');
    await db.mutate((state) => saveSitePrompt(state, { companyId: c.id, ...prompt }));
    assert.equal((await db.read()).prompts.length, 1);
  } finally {
    if (key !== undefined) process.env.OPENAI_API_KEY = key;
    if (model !== undefined) process.env.OPENAI_MODEL = model;
    db.close();
  }
});
test('redes sociais não são apresentadas como site próprio confirmado', () => {
  assert.equal(websitePresence('https://instagram.com/example'), 'social');
  assert.equal(websitePresence('https://www.facebook.com/example'), 'social');
  assert.equal(websitePresence('https://example.org'), 'website');
  assert.equal(websitePresence(''), 'none');
});
test('worker executa o entrypoint e falha de forma explícita sem configuração', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'workers/runner.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, APP_URL: '', WORKER_TOKEN: '', GENERATOR_URL: '', GENERATOR_TOKEN: '' },
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Configure APP_URL/);
  assert.doesNotMatch(result.stderr, /Top-level await is currently not supported/);
});
test('adaptador OpenAI prepara rascunhos sem enviar e minimiza dados', async () => {
  const db = new SqliteStore(':memory:');
  const { s, c } = fixture();
  c.notes = 'Observação privada desnecessária para gerar mensagens';
  await db.mutate((state) => Object.assign(state, s));
  const key = process.env.OPENAI_API_KEY,
    model = process.env.OPENAI_MODEL;
  const originalFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = 'placeholder-de-teste-sem-credencial';
  process.env.OPENAI_MODEL = 'modelo-configurado-de-teste';
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(String(url), 'https://api.openai.com/v1/responses');
    const payload = JSON.parse(String(init?.body));
    assert.equal(payload.store, false);
    assert.equal(payload.model, 'modelo-configurado-de-teste');
    assert.doesNotMatch(payload.input, /Observação privada/);
    assert.match(payload.instructions, /Não invente|Nunca adicione/);
    return Response.json({
      output: [
        {
          content: [
            {
              type: 'output_text',
              text: 'Olá! Posso conversar com o responsável pela Empresa fictícia de testes?',
            },
          ],
        },
      ],
    });
  };
  try {
    const result = await generateCommercialMessage(db, {
      companyId: c.id,
      purpose: 'Primeira abordagem',
    });
    assert.equal(result.method, 'openai');
    assert.equal(calls, 1);
    assert.equal((await db.read()).contacts.length, 0);
    assert.equal((await db.read()).messages.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = key;
    if (model === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = model;
    db.close();
  }
});
