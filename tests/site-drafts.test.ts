import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/lib/domain';
import { provisionalCompany, addCompany, grantConsent } from '../src/lib/crm';
import { buildSitePrompt, saveSitePrompt } from '../src/lib/site-prompts';

test('rascunho incompleto dispensa cadastro verificado e não inventa fatos ou WhatsApp', () => {
  const s = initialState();
  const c = provisionalCompany(s, {
    placeId: 'fixture-draft',
    name: 'Clínica Fictícia',
    niche: 'Psicólogos',
  });
  assert.equal(c.verified, false);
  const text = buildSitePrompt(c);
  assert.match(text, /PROVISÓRIOS, NÃO CONFIRMADOS/);
  assert.match(text, /PENDENTE: confirmar a lista de serviços/);
  assert.match(text, /PENDENTE: fonte de verificação/);
  assert.doesNotMatch(text, /https:\/\/wa.me\//);
  assert.equal(provisionalCompany(s, { placeId: 'fixture-draft' }).id, c.id);
  assert.equal(s.companies.length, 1);
  const first = saveSitePrompt(s, {
    companyId: c.id,
    text,
    method: 'template',
    plan: 'site institucional',
  });
  const second = saveSitePrompt(s, {
    companyId: c.id,
    text: text + '\nRevisão de design.',
    method: 'template',
    plan: 'site institucional',
    id: first.id,
  });
  assert.notEqual(first.id, second.id);
  assert.equal(s.prompts.length, 2);
  assert.ok(first.createdAt);
  assert.equal(
    saveSitePrompt(s, { companyId: c.id, text, method: 'template', plan: 'site institucional' }).id,
    first.id,
  );
  const restored = JSON.parse(JSON.stringify(s));
  assert.equal(restored.prompts[0].companyId, c.id);
  assert.equal(restored.prompts[0].text, text.trim());
});
test('telefone observado não vira contato confirmado e verificação preserva empresa e histórico', () => {
  const s = initialState();
  const c = provisionalCompany(s, {
    placeId: 'fixture-phone',
    name: 'Oficina Fictícia',
    niche: 'Oficina',
    phone: '5514999999999',
  });
  assert.doesNotMatch(buildSitePrompt(c), /https:\/\/wa.me\//);
  assert.equal(
    provisionalCompany(s, { placeId: 'another-provider-id', phone: '(14) 99999-9999' }).id,
    c.id,
  );
  assert.throws(
    () => grantConsent(s, c.id, { confirmed: true, evidence: 'Autorização fictícia de teste' }),
    /Verifique/,
  );
  const prompt = saveSitePrompt(s, {
    companyId: c.id,
    text: buildSitePrompt(c),
    method: 'template',
    plan: 'landing page',
  });
  const verified = addCompany(s, {
    placeId: c.placeId,
    name: c.name,
    niche: c.niche,
    city: 'Bauru',
    state: 'SP',
    phone: c.phone,
    verified: true,
    source: 'https://example.org/verified',
  });
  assert.equal(verified.id, c.id);
  assert.equal(s.companies.length, 1);
  assert.equal(s.prompts[0].id, prompt.id);
  assert.match(buildSitePrompt(verified), /https:\/\/wa.me\/5514999999999/);
});
