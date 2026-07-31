import { useState } from 'react';
import type { Cliente, TipoCliente } from '../lib/types';
import { TIPOS_CLIENTE, ORIGENS } from '../lib/constants';
import { createCliente, updateCliente } from '../lib/db';

interface Props {
  cliente?: Cliente | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function ClienteForm({ cliente, onClose, onSaved }: Props) {
  const [f, setF] = useState<Partial<Cliente>>(
    cliente ?? { tipo: 'corporativo', status: 'Lead' },
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  function set<K extends keyof Cliente>(k: K, v: Cliente[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nome) return;
    setSalvando(true);
    setErro('');
    try {
      if (cliente) await updateCliente(cliente.id, f);
      else await createCliente(f);
      onSaved();
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
            <input value={f.responsavel ?? ''} onChange={(e) => set('responsavel', e.target.value)} placeholder="Ex.: Luis Junior" />
          </div>
          <div>
            <label>Status</label>
            <input value={f.status ?? ''} onChange={(e) => set('status', e.target.value)} placeholder="Ex.: Lead, Cliente ativo" />
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </div>
  );
}
