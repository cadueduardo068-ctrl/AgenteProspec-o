import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, dayInSaoPaulo, score, intent, initialContacts } from '../src/lib/domain';
import { addCompany, grantConsent, optOut } from '../src/lib/crm';
import {
  openContact,
  confirmContact,
  cancelContact,
  prepareContact,
  rulesAnalysis,
  applyAnalysis,
} from '../src/lib/manual';
import { SqliteStore } from '../src/lib/store';
import { metrics } from '../src/lib/metrics';
import { hashPassword, verifyPassword, signSession, validSession } from '../src/lib/auth';
import { verifyWebhook, reserveMessage, receiveMessage } from '../src/lib/integrations';
import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { allowedOrigin } from '../src/lib/origin';
test('CSRF aceita loopback equivalente no desenvolvimento e exige origem canônica em produção', () => {
  assert.equal(
    allowedOrigin(
      'http://127.0.0.1:3000',
      'http://localhost:3000/api/auth/setup',
      undefined,
      false,
    ),
    true,
  );
  assert.equal(
    allowedOrigin(
      'https://malicious.example',
      'http://localhost:3000/api/auth/setup',
      undefined,
      false,
    ),
    false,
  );
  assert.equal(allowedOrigin(null, 'http://localhost:3000', undefined, false), false);
  assert.equal(
    allowedOrigin('https://app.example', 'https://internal:3000/api', 'https://app.example', true),
    true,
  );
  assert.equal(allowedOrigin('https://app.example', 'https://app.example', undefined, true), false);
});
const companyData = (i = 0) => ({
  name: `Empresa de teste ${i}`,
  niche: 'Psicólogos',
  city: 'Bauru',
  state: 'SP',
  phone: `551499999${String(i).padStart(4, '0')}`,
  website: '',
  source: 'https://example.org/verified',
  verified: true as const,
  services: 'Serviço de exemplo para teste',
});
function fixture() {
  const s = initialState();
  const c = addCompany(s, companyData());
  grantConsent(s, c.id, {
    evidence: 'Autorização expressa fornecida para teste unitário',
    confirmed: true,
  });
  prepareContact(s, c.id);
  return { s, c };
}
test('virada diária segue São Paulo, não UTC', () => {
  assert.equal(dayInSaoPaulo(new Date('2026-10-22T02:59:59Z')), '2026-10-21');
  assert.equal(dayInSaoPaulo(new Date('2026-10-22T03:00:00Z')), '2026-10-22');
});
test('pontuação é transparente e soma no máximo 100', () => {
  const result = score(companyData());
  assert.equal(result.value, 100);
  assert.equal(
    result.reasons.reduce((n, r) => n + r.points, 0),
    100,
  );
  assert.equal(score({ ...companyData(), website: 'https://example.org' }).value, 65);
});
test('CRM valida entradas e impede duplicação de telefone e place ID', () => {
  const s = initialState();
  addCompany(s, { ...companyData(), placeId: 'place-test' });
  assert.throws(() => addCompany(s, companyData()), /cadastrada/);
  assert.throws(() => addCompany(s, { ...companyData(1), placeId: 'place-test' }), /cadastrada/);
  assert.throws(() => addCompany(s, { ...companyData(2), source: 'javascript:alert(1)' }));
});
test('abrir wa.me não aumenta o contador; confirmar é idempotente', () => {
  const { s, c } = fixture();
  const now = new Date('2026-10-21T15:00:00Z');
  const opened = openContact(s, c.id, now);
  assert.match(opened.url, /^https:\/\/wa.me\/5514/);
  assert.equal(initialContacts(s, dayInSaoPaulo(now)), 0);
  assert.equal(c.stage, 'WhatsApp aberto');
  assert.equal(openContact(s, c.id, now).contactId, opened.contactId);
  confirmContact(s, opened.contactId, now);
  confirmContact(s, opened.contactId, now);
  assert.equal(initialContacts(s, dayInSaoPaulo(now)), 1);
  assert.equal(c.stage, 'Envio confirmado');
  assert.throws(() => openContact(s, c.id, now), /já registrado/);
});
test('cancelamento libera reserva sem incrementar contagem', () => {
  const { s, c } = fixture();
  const opened = openContact(s, c.id);
  cancelContact(s, opened.contactId);
  assert.equal(initialContacts(s), 0);
  assert.equal(c.stage, 'Abordagem preparada');
  assert.throws(() => confirmContact(s, opened.contactId), /cancelada/);
  assert.notEqual(openContact(s, c.id).contactId, opened.contactId);
});
test('sem consentimento e após recusa nenhum novo contato é aberto', () => {
  const { s, c } = fixture();
  delete c.consent;
  assert.throws(() => openContact(s, c.id), /autorização/);
  grantConsent(s, c.id, {
    evidence: 'Nova evidência explícita válida para o teste',
    confirmed: true,
  });
  const opened = openContact(s, c.id);
  optOut(s, c.id);
  assert.equal(c.stage, 'Não contatar');
  assert.equal(s.contacts[0].status, 'cancelado');
  assert.throws(() => confirmContact(s, opened.contactId));
  assert.throws(
    () =>
      grantConsent(s, c.id, {
        evidence: 'Evidência não remove exclusão permanente',
        confirmed: true,
      }),
    /exclusão/,
  );
});
test('virada do dia cancela pendência antiga e exige nova abertura', () => {
  const { s, c } = fixture();
  const old = openContact(s, c.id, new Date('2026-10-22T02:59:00Z'));
  assert.throws(
    () => confirmContact(s, old.contactId, new Date('2026-10-22T03:01:00Z')),
    /outro dia/,
  );
  const next = openContact(s, c.id, new Date('2026-10-22T03:01:00Z'));
  assert.notEqual(old.contactId, next.contactId);
  assert.equal(s.contacts[0].status, 'cancelado');
});
test('concorrência: dez vagas reservadas e no máximo dez envios confirmados', async () => {
  const db = new SqliteStore(':memory:');
  await db.mutate((s) => {
    for (let i = 0; i < 20; i++) {
      const c = addCompany(s, companyData(i));
      grantConsent(s, c.id, {
        evidence: 'Autorização explícita para teste de concorrência',
        confirmed: true,
      });
      prepareContact(s, c.id);
    }
  });
  const ids = (await db.read()).companies.map((c) => c.id);
  const openings = await Promise.allSettled(ids.map((id) => db.mutate((s) => openContact(s, id))));
  assert.equal(openings.filter((r) => r.status === 'fulfilled').length, 10);
  assert.equal(initialContacts(await db.read()), 0);
  const pending = (await db.read()).contacts;
  const confirmations = await Promise.all(
    pending.flatMap((c) => [
      db.mutate((s) => confirmContact(s, c.id)),
      db.mutate((s) => confirmContact(s, c.id)),
    ]),
  );
  assert.equal(confirmations.length, 20);
  assert.equal(initialContacts(await db.read()), 10);
  db.close();
});
test('SQLite persiste dados e faz rollback em erro', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'cadu-test-'));
  const filename = path.join(dir, 'test.sqlite');
  const db = new SqliteStore(filename);
  await db.mutate((s) => {
    addCompany(s, companyData());
  });
  await assert.rejects(
    db.mutate((s) => {
      s.companies = [];
      throw new Error('rollback');
    }),
  );
  db.close();
  const second = new SqliteStore(filename);
  assert.equal((await second.read()).companies.length, 1);
  second.close();
  rmSync(dir, { recursive: true, force: true });
});
test('análise ambígua nunca atribui interesse e só aprovação altera CRM', () => {
  const { s, c } = fixture();
  const before = c.stage;
  const r = rulesAnalysis('ok', c);
  assert.equal(r.suggestedStage, null);
  assert.equal(r.intent, 'ambígua');
  const demo = rulesAnalysis('Gostaria de receber uma demonstração do site', c);
  assert.equal(c.stage, before);
  const id = crypto.randomUUID();
  s.analyses.push({
    ...demo,
    id,
    companyId: c.id,
    at: new Date().toISOString(),
    source: 'texto colado',
    applied: false,
  });
  applyAnalysis(s, id);
  applyAnalysis(s, id);
  assert.equal(c.stage, 'Demonstração solicitada');
  assert.equal(s.tasks.length, 1);
});
test('recusa prevalece sobre sinais de interesse', () => {
  assert.equal(intent('não quero uma demonstração, pare de enviar'), 'recusa');
  const { s, c } = fixture();
  const r = rulesAnalysis('Não quero receber novas mensagens', c);
  const id = crypto.randomUUID();
  s.analyses.push({
    ...r,
    id,
    companyId: c.id,
    at: new Date().toISOString(),
    source: 'texto colado',
    applied: false,
  });
  applyAnalysis(s, id);
  assert.equal(c.optedOut, true);
  assert.equal(c.stage, 'Não contatar');
});
test('dashboard vazio não inventa dados nem taxas', () => {
  const m = metrics(initialState());
  assert.equal(m.companies, 0);
  assert.equal(m.sentToday, 0);
  assert.equal(m.responseRate, null);
  assert.equal(m.interestRate, null);
  assert.equal(m.conversionRate, null);
  assert.equal(
    m.performance.reduce((n, p) => n + p.mensagens, 0),
    0,
  );
});
test('sessão tem assinatura e expiração; senha só aceita hash correto', () => {
  process.env.ADMIN_PASSWORD_HASH = hashPassword('senha-unitaria-temporaria');
  process.env.SESSION_SECRET = 'segredo-unitario-temporario-com-mais-de-32-caracteres';
  assert.equal(verifyPassword('senha-unitaria-temporaria'), true);
  assert.equal(verifyPassword('senha-incorreta'), false);
  const token = signSession(1000);
  assert.equal(validSession(token, 1001), true);
  assert.equal(validSession(token + 'x', 1001), false);
  assert.equal(validSession(token, 1000 + 9 * 3600_000), false);
  delete process.env.ADMIN_PASSWORD_HASH;
  delete process.env.SESSION_SECRET;
});
test('webhook rejeita assinatura inválida e deduplica mensagens', () => {
  const secret = 'segredo-unitario-webhook';
  const raw = '{"test":true}';
  const sig = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
  assert.equal(verifyWebhook(raw, sig, secret), true);
  assert.equal(verifyWebhook(raw + 'x', sig, secret), false);
  assert.equal(verifyWebhook(raw, null, secret), false);
  const { s, c } = fixture();
  const data = {
    id: 'wamid.unit-test',
    from: c.phone,
    text: 'Gostaria de uma demonstração',
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  receiveMessage(s, data);
  receiveMessage(s, data);
  assert.equal(s.messages.length, 1);
  assert.equal(s.tasks.length, 1);
});
test('API opcional exige janela de atendimento e limita reservas', () => {
  const { s, c } = fixture();
  assert.throws(() => reserveMessage(s, c.id, 'Resposta', 'reply'), /24 horas/);
  reserveMessage(s, c.id, 'Template', 'initial');
  assert.throws(() => reserveMessage(s, c.id, 'Template', 'initial'), /já reservado/);
});
