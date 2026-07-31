import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function DefinirSenha({ onDone }: { onDone: () => void }) {
  const [senha, setSenha] = useState('');
  const [senha2, setSenha2] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (senha.length < 6) {
      setErro('A senha precisa ter ao menos 6 caracteres.');
      return;
    }
    if (senha !== senha2) {
      setErro('As senhas não conferem.');
      return;
    }
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) {
      setErro('Não foi possível definir a senha. O link pode ter expirado — peça um novo convite.');
      return;
    }
    // limpa o token do convite da URL e entra no app
    window.history.replaceState(null, '', window.location.pathname);
    onDone();
  }

  return (
    <div className="login-wrap">
      <form className="login" onSubmit={salvar}>
        <div className="brand">
          <div className="logo">S</div>
          <div>
            <b>Suricatus</b>
            <span>Definir senha</span>
          </div>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '-6px 0 16px' }}>
          Bem-vindo(a) à equipe! Crie uma senha para acessar o CRM e o Planner.
        </p>
        {erro && <div className="err">{erro}</div>}
        <div style={{ marginBottom: 14 }}>
          <label>Nova senha</label>
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required autoFocus autoComplete="new-password" />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label>Confirmar senha</label>
          <input type="password" value={senha2} onChange={(e) => setSenha2(e.target.value)} required autoComplete="new-password" />
        </div>
        <button className="btn primary" style={{ width: '100%' }} disabled={salvando}>
          {salvando ? 'Salvando…' : 'Definir senha e entrar'}
        </button>
      </form>
    </div>
  );
}
