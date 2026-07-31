import { useEffect, useState } from 'react';
import type { Profile, Role } from '../lib/types';
import { ROLES } from '../lib/constants';
import { listProfiles, updateRole } from '../lib/db';
import { iniciais } from '../lib/format';

export default function Admin() {
  const [perfis, setPerfis] = useState<Profile[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  async function carregar() {
    setCarregando(true);
    try {
      setPerfis(await listProfiles());
    } catch (e) {
      setErro((e as Error).message);
    }
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function mudar(p: Profile, role: Role) {
    setPerfis((prev) => prev.map((x) => (x.id === p.id ? { ...x, role } : x)));
    try {
      await updateRole(p.id, role);
    } catch (e) {
      setErro((e as Error).message);
      carregar();
    }
  }

  if (carregando) return <div className="center-msg">Carregando equipe…</div>;

  return (
    <div className="view">
      {erro && <div className="err">{erro}</div>}
      <div className="subbar">
        <span className="chip on">Equipe · {perfis.length} pessoa(s)</span>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr><th>Pessoa</th><th>E-mail</th><th>Papel de acesso</th></tr>
          </thead>
          <tbody>
            {perfis.map((p) => (
              <tr key={p.id}>
                <td><span className="who"><span className="av" style={{ background: 'var(--purple)' }}>{iniciais(p.nome ?? p.email)}</span>{p.nome ?? '—'}</span></td>
                <td>{p.email ?? '—'}</td>
                <td>
                  <select value={p.role} onChange={(e) => mudar(p, e.target.value as Role)} style={{ maxWidth: 160 }}>
                    {ROLES.map((r) => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="legend" style={{ marginTop: 16 }}>
        {ROLES.map((r) => (
          <div key={r.id}><b style={{ color: '#fff' }}>{r.label}</b> — {r.desc}</div>
        ))}
        <div style={{ marginTop: 8 }}>
          Novos usuários são criados no painel do Supabase (Authentication → Users) e entram como <b>editor</b> por padrão.
        </div>
      </div>
    </div>
  );
}
