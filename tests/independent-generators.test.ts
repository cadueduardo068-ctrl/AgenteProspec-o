import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeState } from '../src/lib/domain';
import { provisionalCompany, addCompany, grantConsent } from '../src/lib/crm';
import { generateCommercialMessage, saveCommercialMessage } from '../src/lib/commercial-content';
import { generateSitePrompt, saveSitePrompt } from '../src/lib/site-prompts';
import { commercialContactStatus, messagePurposes } from '../src/lib/content-templates';
import { prepareContact, openContact, confirmContact } from '../src/lib/manual';
import { SqliteStore } from '../src/lib/store';

test('geradores independentes conservam versões e não simulam contato ou site criado', async () => {
  const db = new SqliteStore(':memory:');
  const key = process.env.OPENAI_API_KEY,
    model = process.env.OPENAI_MODEL;
  process.env.OPENAI_API_KEY = '';
  process.env.OPENAI_MODEL = '';
  try {
    const c = await db.mutate((s) =>
      provisionalCompany(s, {
        placeId: 'independent-generators',
        name: 'Oficina Fictícia',
        niche: 'Oficina',
      }),
    );
    const first = await generateCommercialMessage(db, {
      companyId: c.id,
      purpose: 'Primeiro contato',
    });
    const other = await generateCommercialMessage(db, {
      companyId: c.id,
      purpose: 'Primeiro contato',
    });
    assert.notEqual(first.text, other.text);
    assert.equal(first.text.length < 600, true);
    assert.match(first.text, /responsável pela Oficina Fictícia/);
    assert.doesNotMatch(first.text, /sem site|não possui site|pronta|garantido/);
    const technical = await generateSitePrompt(db, { companyId: c.id });
    assert.ok(technical.text.length > 5000);
    await db.mutate((s) => saveSitePrompt(s, { companyId: c.id, ...technical }));
    await db.mutate((s) =>
      saveCommercialMessage(s, {
        companyId: c.id,
        text: first.text + ' Podemos conversar?',
        purpose: 'Primeiro contato',
        method: 'template',
      }),
    );
    const s = await db.read();
    assert.equal(s.commercialMessages.length, 3);
    assert.equal(s.prompts.length, 1);
    assert.equal(s.companies.length, 1);
    assert.equal(s.companies[0].stage, 'Empresa encontrada');
    assert.equal(s.contacts.length, 0);
    assert.equal(s.messages.length, 0);
    assert.equal(s.jobs.length, 0);
    assert.equal(commercialContactStatus(s.contacts, c.id, first.text), 'Rascunho · nenhum envio');
    assert.equal(s.prompts[0].companyId, s.commercialMessages[0].companyId);
    assert.ok(s.commercialMessages[0].createdAt);
    assert.deepEqual(
      normalizeState(JSON.parse(JSON.stringify(s))).commercialMessages,
      s.commercialMessages,
    );
    const legacy = {
      ...initialState(),
      commercialMessages: undefined,
      companies: [
        {
          ...c,
          draft: 'Mensagem antiga preservada',
          draftMeta: {
            purpose: 'Primeira abordagem',
            method: 'template' as const,
            at: c.createdAt,
          },
        },
      ],
    };
    const migrated = normalizeState(legacy);
    assert.equal(migrated.commercialMessages[0].text, 'Mensagem antiga preservada');
    assert.equal(normalizeState(migrated).commercialMessages.length, 1);
  } finally {
    db.close();
    if (key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = key;
    if (model === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = model;
  }
});

test('demonstração só usa link aprovado e status de envio depende da confirmação', async () => {
  const db = new SqliteStore(':memory:');
  const key = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = '';
  try {
    const c = await db.mutate((s) =>
      addCompany(s, {
        name: 'Clínica Fictícia',
        niche: 'Psicólogos',
        city: 'Bauru',
        state: 'SP',
        phone: '5514999999999',
        source: 'https://example.org/test',
        verified: true,
      }),
    );
    assert.deepEqual(messagePurposes, [
      'Primeiro contato',
      'Apresentar proposta',
      'Cliente interessado',
      'Oferecer demonstração',
      'Enviar demonstração',
    ]);
    const offer = await generateCommercialMessage(db, {
      companyId: c.id,
      purpose: 'Oferecer demonstração',
    });
    assert.match(offer.text, /gostaria|interesse/);
    assert.doesNotMatch(offer.text, /está pronta|já criei/);
    const missing = await generateCommercialMessage(db, {
      companyId: c.id,
      purpose: 'Enviar demonstração',
    });
    assert.match(missing.text, /PENDENTE/);
    await db.mutate((s) => {
      grantConsent(s, c.id, {
        confirmed: true,
        evidence: 'Autorização fictícia para teste isolado',
      });
      prepareContact(s, c.id, missing.text);
    });
    await assert.rejects(() => db.mutate((s) => openContact(s, c.id)), /pendências/);
    await assert.rejects(() =>
      generateCommercialMessage(db, {
        companyId: c.id,
        purpose: 'Enviar demonstração',
        approvedDemo: { url: 'javascript:alert(1)', confirmed: true },
      }),
    );
    const ready = await generateCommercialMessage(db, {
      companyId: c.id,
      purpose: 'Enviar demonstração',
      approvedDemo: { url: 'https://example.org/preview.pdf', confirmed: true },
    });
    assert.match(ready.text, /https:\/\/example.org\/preview.pdf/);
    const open = await db.mutate((s) => {
      prepareContact(s, c.id, ready.text);
      return openContact(s, c.id);
    });
    const url = new URL(open.url);
    assert.equal(url.hostname, 'wa.me');
    assert.equal(url.pathname, '/5514999999999');
    assert.equal(url.searchParams.get('text'), ready.text);
    assert.match(
      commercialContactStatus((await db.read()).contacts, c.id, ready.text),
      /envio não confirmado/,
    );
    await db.mutate((s) => confirmContact(s, open.contactId));
    const state = await db.read();
    assert.equal(state.companies[0].stage, 'Envio confirmado');
    assert.match(
      commercialContactStatus(state.contacts, c.id, ready.text),
      /confirmado manualmente/,
    );
    assert.match(commercialContactStatus(state.contacts, c.id, offer.text), /nenhum envio/);
    assert.equal(state.contacts[0].commercialMessageId, ready.id);
    const duplicate = await db.mutate((s) =>
      saveCommercialMessage(
        s,
        {
          companyId: c.id,
          text: ready.text,
          purpose: 'Enviar demonstração',
          method: 'template',
          approvedDemoUrl: 'https://example.org/preview.pdf',
        },
        true,
      ),
    );
    assert.notEqual(duplicate.id, ready.id);
    assert.match(
      commercialContactStatus(state.contacts, c.id, duplicate.text, duplicate.id),
      /nenhum envio/,
    );
    assert.match(
      commercialContactStatus(state.contacts, c.id, ready.text, ready.id),
      /confirmado manualmente/,
    );
    assert.equal(state.prompts.length, 0);
  } finally {
    db.close();
    if (key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = key;
  }
});

test('resposta de IA não substitui a prévia aprovada por link inventado', async () => {
  const db = new SqliteStore(':memory:');
  const oldFetch = globalThis.fetch,
    key = process.env.OPENAI_API_KEY,
    model = process.env.OPENAI_MODEL;
  process.env.OPENAI_API_KEY = 'placeholder-de-teste';
  process.env.OPENAI_MODEL = 'modelo-ficticio';
  globalThis.fetch = async () =>
    Response.json({
      output: [
        {
          content: [
            { type: 'output_text', text: 'Sua demonstração: https://example.org/nao-aprovado' },
          ],
        },
      ],
    });
  try {
    const c = await db.mutate((s) =>
      provisionalCompany(s, {
        placeId: 'ai-preview-check',
        name: 'Empresa Fictícia',
        niche: 'Oficina',
      }),
    );
    const generated = await generateCommercialMessage(db, {
      companyId: c.id,
      purpose: 'Enviar demonstração',
      approvedDemo: { url: 'https://example.org/aprovado', confirmed: true },
    });
    assert.equal(generated.method, 'template');
    assert.match(generated.text, /https:\/\/example.org\/aprovado/);
    assert.doesNotMatch(generated.text, /nao-aprovado/);
    assert.equal((await db.read()).contacts.length, 0);
  } finally {
    db.close();
    globalThis.fetch = oldFetch;
    if (key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = key;
    if (model === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = model;
  }
});
