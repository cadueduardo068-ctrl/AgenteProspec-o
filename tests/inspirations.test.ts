import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeState } from '../src/lib/domain';
import { SqliteStore } from '../src/lib/store';
import { provisionalCompany } from '../src/lib/crm';
import { filterInspirations, inspirationPrompt } from '../src/lib/inspirations';
import {
  saveInspiration,
  organizeInspiration,
  createCollection,
  publicReferenceUrl,
  referenceMetadata,
} from '../src/lib/inspiration-service';
import { generateSitePrompt, saveSitePrompt } from '../src/lib/site-prompts';

test('migração preserva referências removidas e dados CRM; seis referências reais têm fontes', () => {
  const old = normalizeState({ companies: [], prompts: [] });
  assert.equal(old.inspirations.length, 6);
  assert.equal(normalizeState({ ...old, inspirations: [] }).inspirations.length, 0);
  for (const r of old.inspirations) {
    assert.ok(r.sources.includes(r.url));
    assert.ok(r.creator);
    if (r.imageUrl) assert.ok(r.imagePermission);
  }
  assert.equal(old.inspirations.find((r) => r.id === 'linear')?.technologies.length, 0);
});
test('favoritos, coleções e filtros combinados são persistidos sem duplicar referência', async () => {
  const db = new SqliteStore(':memory:');
  let id = '';
  await db.mutate((s) => {
    const c = createCollection(s, { name: 'Landing pages premium' });
    assert.equal(createCollection(s, { name: 'Landing pages premium' }).id, c.id);
    id = c.id;
    organizeInspiration(s, 'linear', { favorite: true, collectionIds: [id] });
  });
  const s = await db.read();
  assert.equal(
    filterInspirations(s.inspirations, 'LINEAR', 'Tecnologia', 'Dark mode', true, id).length,
    1,
  );
  assert.equal(
    filterInspirations(s.inspirations, '', 'Arquitetura', 'Dark mode', true, id).length,
    0,
  );
  assert.throws(
    () => organizeInspiration(s, 'linear', { collectionIds: [crypto.randomUUID()] }),
    /Coleção/,
  );
  db.close();
});
test('cadastro manual recusa URL privada/credenciais e imagens sem autorização; deduplica URL', async () => {
  for (const u of [
    'http://example.com',
    'https://127.0.0.1',
    'https://[::1]',
    'https://foo.local',
    'https://user:pass@example.com',
    'https://example.com:8443',
  ])
    assert.throws(() => publicReferenceUrl(u));
  const s = initialState();
  const input = {
    name: 'Referência de teste',
    url: 'https://example.com/',
    description: 'Dados manuais de teste',
    categories: ['Tecnologia'],
    styles: ['Editorial'],
  };
  assert.throws(
    () => saveInspiration(s, { ...input, imageUrl: 'https://example.com/photo.png' }),
    /autorização/,
  );
  const r = saveInspiration(s, input);
  assert.throws(() => saveInspiration(s, input), /já está/);
  saveInspiration(s, { ...input, name: 'Editada' }, r.id);
  assert.equal(s.inspirations.find((i) => i.id === r.id)?.name, 'Editada');
  const metadata = await referenceMetadata({ url: 'https://example.com/' });
  assert.match(metadata.notice, /manualmente/);
  assert.equal(metadata.name, '');
});
test('combina empresa incompleta e design sem importar fatos comerciais; histórico associa e não duplica', async () => {
  const db = new SqliteStore(':memory:');
  const c = await db.mutate((s) =>
    provisionalCompany(s, {
      placeId: 'design-test',
      name: 'Higienização fictícia',
      niche: 'Higienização',
    }),
  );
  const generated = await generateSitePrompt(db, { companyId: c.id, inspirationId: 'porsche' });
  assert.match(generated.text, /Higienização fictícia/);
  assert.match(generated.text, /Cinematográfico/);
  assert.match(generated.text, /Não importar serviços/);
  assert.match(generated.text, /Não criar link WhatsApp/);
  assert.equal(generated.method, 'template');
  const saved = await db.mutate((s) =>
    saveSitePrompt(s, { ...generated, companyId: c.id, inspirationId: 'porsche' }),
  );
  const again = await db.mutate((s) =>
    saveSitePrompt(s, { ...generated, companyId: c.id, inspirationId: 'porsche' }),
  );
  assert.equal(saved.id, again.id);
  const s = await db.read();
  assert.equal(s.companies.length, 1);
  assert.equal(s.companies[0].verified, false);
  assert.equal(s.inspirationUses.length, 1);
  assert.equal(s.inspirationUses[0].promptId, saved.id);
  await assert.rejects(
    () => generateSitePrompt(db, { companyId: c.id, inspirationId: 'missing' }),
    /não encontrada/,
  );
  assert.match(inspirationPrompt(s.inspirations[0]), /não identificadas/);
  db.close();
});
