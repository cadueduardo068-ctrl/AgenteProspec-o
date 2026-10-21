'use client';
import { useState } from 'react';
import { ArrowRight, ShieldCheck, Zap } from 'lucide-react';
export default function Login({ setup }: { setup: boolean }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/auth/${setup ? 'setup' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = '/';
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand">
          <span className="brand-symbol">
            <Zap fill="currentColor" size={22} />
          </span>
          CADU<span className="brand-ai">AI</span>
        </div>
        <div>
          <span className="eyebrow">SEU PRÓXIMO CLIENTE COMEÇA AQUI</span>
          <h1>
            Boas oportunidades.
            <br />
            <span>Grandes conexões.</span>
          </h1>
          <p>
            Encontre empresas, construa relacionamentos e transforme interesse em presença digital.
          </p>
          <div className="login-flow">
            <span>01 · Descubra</span>
            <i />
            <span>02 · Conecte</span>
            <i />
            <span>03 · Crie</span>
          </div>
        </div>
        <small>Inteligência aplicada ao seu crescimento.</small>
      </section>
      <section className="login-form-wrap">
        <form onSubmit={submit} className="login-form">
          <div className="icon-box">
            <ShieldCheck />
          </div>
          <span className="eyebrow">ÁREA DO ADMINISTRADOR</span>
          <h2>{setup ? 'Vamos começar.' : 'Bem-vindo de volta.'}</h2>
          <p>
            {setup
              ? 'Crie sua senha de acesso local. Ela será armazenada como hash, fora do Git.'
              : 'Entre para acompanhar suas oportunidades.'}
          </p>
          <label>
            Senha
            <input
              autoFocus
              type="password"
              minLength={12}
              maxLength={128}
              autoComplete={setup ? 'new-password' : 'current-password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="No mínimo 12 caracteres"
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="btn primary" disabled={busy}>
            {busy ? 'Aguarde…' : setup ? 'Criar acesso seguro' : 'Entrar na plataforma'}
            <ArrowRight size={17} />
          </button>
          <small>Um administrador. Acesso protegido.</small>
        </form>
      </section>
    </main>
  );
}
