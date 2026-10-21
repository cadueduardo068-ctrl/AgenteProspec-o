'use client';
import { useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import type { Company } from '@/lib/domain';
import type { WorkspaceAction } from './client-api';
import Dialog from './dialog';
export default function CompanyEditor({
  company: c,
  action,
  close,
  busy,
}: {
  company: Company;
  action: WorkspaceAction;
  close: () => void;
  busy: boolean;
}) {
  const [verified, setVerified] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = await action(
      `companies/${c.id}`,
      'PUT',
      { ...Object.fromEntries(new FormData(e.currentTarget)), verified },
      'Empresa atualizada na biblioteca.',
    );
    if (result) close();
  }
  return (
    <Dialog title="Editar empresa" close={close}>
      <form className="stack" onSubmit={save}>
        <label>
          Nome da empresa
          <input name="name" defaultValue={c.name} required minLength={2} maxLength={160} />
        </label>
        <div className="form-grid">
          <label>
            Segmento
            <input name="niche" defaultValue={c.niche} maxLength={100} />
          </label>
          <label>
            Cidade
            <input name="city" defaultValue={c.city} maxLength={100} />
          </label>
        </div>
        <div className="form-grid">
          <label>
            UF
            <input name="state" defaultValue={c.state} maxLength={2} />
          </label>
          <label>
            Telefone com DDD
            <input name="phone" type="tel" defaultValue={c.phone} maxLength={30} />
          </label>
        </div>
        <label>
          Endereço
          <input name="address" defaultValue={c.address || ''} maxLength={1000} />
        </label>
        <label>
          Site ou canal digital
          <input name="website" type="url" defaultValue={c.website} maxLength={1000} />
        </label>
        <label>
          Serviços informados
          <textarea name="services" defaultValue={c.services} maxLength={3000} />
        </label>
        <label>
          Fonte das informações
          <input name="source" type="url" defaultValue={c.source} maxLength={1000} />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={verified}
            onChange={(e) => setVerified(e.target.checked)}
          />
          Verifiquei todos estes dados em fonte independente.
        </label>
        <small className="muted">
          Sem confirmação, os dados permanecem provisórios. Alterar o telefone exige uma nova
          autorização de contato.
        </small>
        <button className="btn primary" disabled={busy}>
          <Save size={15} />
          Salvar alterações
        </button>
      </form>
    </Dialog>
  );
}
