import { useEffect, useState } from 'react';
import type { Cliente, TipoCliente, Profile } from '../lib/types';
import { TIPOS_CLIENTE, ORIGENS } from '../lib/constants';
import { createCliente, updateCliente, criarProjetoNoPlanner, listProfiles } from '../lib/db';

interface Props {
  cliente?: Cliente | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Nome de exibição de um perfil (nome, ou e-mail como fallback). */
export function nomeProfile(p: Profile): string {
  return p.nome || p.email || 'Sem nome';
}

export default function ClienteForm({ cliente, onClose, onSaved }: Props) {
  const [f, setF] = useState<Partial<Cliente>>(
    cliente ?? { tipo: 'corporativo', status: 'Lead' },
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [clienteCriado, setClienteCriado] = useState(false);
  const [responsaveis, setResponsaveis] = useState<string[]>([]);

  useEffect(() => {
    listProfiles()
      .then((ps) => setResponsaveis(ps.map(nomeProfile)))
      .catch(() => setResponsaveis([]));
  }, []);

  function set<K extends keyof Cliente>(k: K, v: Cliente[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  // opções do dropdown de responsável, incluindo o valor atual se for antigo/livre
  const opcoesResp = f.responsavel && !responsaveis.includes(f.responsavel)
    ? [f.responsavel, ...responsaveis]
    : responsaveis;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (clienteCriado) { onSaved(); return; } // já criado; botão vira "Concluir"
    if (!f.nome) return;
    setSalvando(true);
    setErro('');
    try {
      if (cliente) {
        await updateCliente(cliente.id, f);
        onSaved();
        return;
      }
      const novo = await createCliente(f);
      // Cliente novo criado: cria automaticamente um projeto no Planner (coluna TO-DO)
      // e guarda o vínculo cliente <-> projeto para a sincronização de anotações.
      try {
        const projId = await criarProjetoNoPlanner(f.nome!);
        await updateCliente(novo.id, { planner_project_id: projId });
        onSaved();
      } catch (e) {
        setClienteCriado(true);
        setSalvando(false);
        setAviso('Cliente criado ✓, mas não consegui criar o projeto no Planner: ' + ((e as Error).message || 'erro desconhecido') + '. Você pode concluir mesmo assim.');
      }
    } catch (err) {
      setErro((err as Error).message ?? 'Erro ao salvar.');
      setSalvando(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={salvar}>
        <h3>{cliente ? 'Editar cliente' : 'Novo cliente'}</h3>
        {erro && <div className="err">{erro}</div>}
        {aviso && <div className="err" style={{ background: 'rgba(245,166,35,.12)', borderColor: 'rgba(245,166,35,.4)', color: '#ffcf7a' }}>{aviso}</div>}
        <div className="formgrid">
          <div className="full">
            <label>Nome do cliente *</label>
            <input value={f.nome ?? ''} onChange={(e) => set('nome', e.target.value)} required autoFocus />
          </div>
          <div>
            <label>Tipo</label>
            <select value={f.tipo} onChange={(e) => set('tipo', e.target.value as TipoCliente)}>
              {TIPOS_CLIENTE.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Segmento</label>
            <input value={f.segmento ?? ''} onChange={(e) => set('segmento', e.target.value)} placeholder="Ex.: Educação, RH, Varejo" />
          </div>
          <div>
            <label>Contato (nome)</label>
            <input value={f.contato_nome ?? ''} onChange={(e) => set('contato_nome', e.target.value)} />
          </div>
          <div>
            <label>Cargo do contato</label>
            <input value={f.contato_cargo ?? ''} onChange={(e) => set('contato_cargo', e.target.value)} />
          </div>
          <div>
            <label>E-mail</label>
            <input type="email" value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div>
            <label>Telefone</label>
            <input value={f.telefone ?? ''} onChange={(e) => set('telefone', e.target.value)} />
          </div>
          <div>
            <label>UF</label>
            <input value={f.uf ?? ''} maxLength={2} onChange={(e) => set('uf', e.target.value.toUpperCase())} placeholder="SP" />
          </div>
          <div>
            <label>Origem do lead</label>
            <select value={f.origem ?? ''} onChange={(e) => set('origem', e.target.value)}>
              <option value="">—</option>
              {ORIGENS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Responsável Suricatus</label>
            <select value={f.responsavel ?? ''} onChange={(e) => set('responsavel', e.target.value || null)}>
              <option value="">— escolha —</option>
              {opcoesResp.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Status</label>
            <input value={f.status ?? ''} onChange={(e) => set('status', e.target.value)} placeholder="Ex.: Lead, Cliente ativo" />
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={salvando}>
            {clienteCriado ? 'Concluir' : salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}
