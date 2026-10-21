import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalityService } from '../src/lib/localities';
import { normalizeState } from '../src/lib/domain';
test('IBGE carrega estados e municípios, compartilha requisições e valida seleção', async () => {
  let count = 0;
  const service = new LocalityService(async (url) => {
    count++;
    return Response.json(
      String(url).includes('/municipios')
        ? [
            { id: 3506003, nome: 'Bauru' },
            { id: 3550308, nome: 'São Paulo' },
          ]
        : [{ id: 35, nome: 'São Paulo', sigla: 'SP' }],
    );
  });
  assert.equal((await service.states())[0].uf, 'SP');
  const [a, b] = await Promise.all([service.cities('SP'), service.cities('SP')]);
  assert.deepEqual(a, b);
  assert.equal(count, 2);
  assert.equal((await service.validate('SP', 'sao paulo', 3550308)).name, 'São Paulo');
  await assert.rejects(service.validate('SP', 'Cidade inventada'), /município válido/);
  await assert.rejects(service.validate('SP', 'Bauru', 3550308), /município válido/);
  assert.throws(() => service.cities('../invalid'));
});
test('IBGE indisponível não gera cidades fictícias', async () => {
  const service = new LocalityService(async () => {
    throw new Error('offline');
  });
  await assert.rejects(service.cities('SP'), /Não foi possível carregar/);
});
test('migração de estado preserva dados existentes e inicializa cidades recentes', () => {
  const result = normalizeState({ companies: [], events: [] });
  assert.deepEqual(result.recentCities, []);
  assert.equal(result.settings.dailyLimit, 10);
});
