import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) setErro('E-mail ou senha inválidos.');
  }

  return (
    <div className="login-wrap">
      <form className="login" onSubmit={entrar}>
        <div className="brand">
          <div className="logo">S</div>
          <div>
            <b>Suricatus</b>
            <span>CRM Comercial</span>
          </div>
        </div>
        {erro && <div className="err">{erro}</div>}
        <div style={{ marginBottom: 14 }}>
          <label>E-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label>Senha</label>
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required autoComplete="current-password" />
        </div>
        <button className="btn primary" style={{ width: '100%' }} disabled={carregando}>
          {carregando ? 'Entrando…' : 'Entrar'}
        </button>
        <p style={{ fontSize: 11, color: 'var(--dim)', marginTop: 16, textAlign: 'center' }}>
          Acesso restrito à equipe Suricatus. Usuários são criados no painel do Supabase.
        </p>
      </form>
    </div>
  );
}
