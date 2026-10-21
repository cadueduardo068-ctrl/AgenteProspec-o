import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/lib/domain';
import { provisionalCompany, verifyContactDetails, editCompany, optOut } from '../src/lib/crm';
import { prepareContact, openContact, confirmContact } from '../src/lib/manual';
import { sectionForPath, sectionRoutes } from '../src/lib/navigation';

test('contato provisório é liberado pela confirmação do número e autorização, sem verificar todos os dados', () => {
  const s = initialState();
  const c = provisionalCompany(s, { placeId: 'contact-flow', name: 'Empresa fictícia de teste' });
  prepareContact(s, c.id, 'Olá! Posso falar com o responsável?');
  assert.throws(() => openContact(s, c.id));
  assert.throws(() =>
    verifyContactDetails(s, c.id, {
      phone: '5514999999999',
      phoneConfirmed: false,
      authorized: true,
      evidence: 'Evidência fictícia de teste',
    }),
  );
  verifyContactDetails(s, c.id, {
    phone: '(14) 99999-9999',
    phoneConfirmed: true,
    authorized: true,
    evidence: 'Autorização fictícia para teste isolado, recebida hoje',
  });
  assert.equal(c.verified, false);
  assert.equal(c.contactVerification?.phone, '5514999999999');
  const open = openContact(s, c.id);
  const url = new URL(open.url);
  assert.equal(url.pathname, '/5514999999999');
  assert.equal(url.searchParams.get('text'), c.draft);
  assert.equal(s.contactLedger.length, 0);
  confirmContact(s, open.contactId);
  assert.equal(c.stage, 'Envio confirmado');
  assert.equal(s.contactLedger.length, 1);
  const id = c.id;
  editCompany(s, id, {
    name: 'Empresa fictícia editada',
    niche: '',
    city: '',
    state: '',
    phone: '5514988888888',
    address: '',
    website: '',
    source: '',
    services: '',
    verified: false,
  });
  assert.equal(s.companies.length, 1);
  assert.equal(c.id, id);
  assert.equal(c.consent, undefined);
  assert.equal(c.contactVerification, undefined);
  optOut(s, id);
  assert.throws(
    () =>
      verifyContactDetails(s, id, {
        phone: '5514999999999',
        phoneConfirmed: true,
        authorized: true,
        evidence: 'Teste não pode remover exclusão permanente',
      }),
    /bloqueado/,
  );
});
test('biblioteca tem rota estável e navegação preserva todas as ferramentas', () => {
  assert.equal(sectionForPath('/library'), 'companies');
  assert.equal(sectionForPath('/prospect'), 'prospect');
  assert.equal(sectionForPath('/nao-existe'), undefined);
  assert.equal(sectionRoutes.contacted, '/conversations');
  assert.ok(sectionRoutes.assistant && sectionRoutes.funnel && sectionRoutes.reports);
});
