import { useEffect, useState } from 'react';
import type { Cliente, Contato } from '../lib/types';
import { listContatos, createContato, updateContato, deleteContato } from '../lib/db';
import { iniciais } from '../lib/format';

interface Props {
  cliente: Cliente;
  podeEscrever: boolean;
  onClose: () => void;
}

const vazio: Partial<Contato> = { nome: '', cargo: '', email: '', telefone: '', principal: false };

export default function ContatosModal({ cliente, podeEscrever, onClose }: Props) {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState<Partial<Contato> | null>(null);

  async function carregar() {
    try {
      setContatos(await listContatos(cliente.id));
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente.id]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form?.nome) return;
    try {
      if (form.id) await updateContato(form.id, form);
      else await createContato({ ...form, cliente_id: cliente.id });
      setForm(null);
      carregar();
    } catch (err) {
      setErro((err as Error).message);
    }
  }

  async function remover(c: Contato) {
    if (!confirm(`Remover o contato "${c.nome}"?`)) return;
    try {
      await deleteContato(c.id);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Contatos · {cliente.nome}</h3>
        {erro && <div className="err">{erro}</div>}

        {contatos.map((c) => (
          <div key={c.id} className="anexo">
            <span className="av" style={{ background: 'var(--cyan)', color: '#04222a' }}>{iniciais(c.nome)}</span>
            <div className="nm">
              <div>{c.nome} {c.principal && <span className="pill" style={{ background: 'rgba(46,204,155,.16)', color: '#8ff0d3', fontSize: 10 }}>principal</span>}</div>
              <div className="sz">{[c.cargo, c.email, c.telefone].filter(Boolean).join(' · ') || '—'}</div>
            </div>
            {podeEscrever && (
              <>
                <button className="icobtn" title="Editar" onClick={() => setForm(c)}>✎</button>
                <button className="icobtn" title="Remover" onClick={() => remover(c)}>🗑</button>
              </>
            )}
          </div>
        ))}
        {contatos.length === 0 && <div className="empty" style={{ textAlign: 'left' }}>Nenhum contato ainda.</div>}

        {podeEscrever && !form && (
          <button className="btn" style={{ marginTop: 12 }} onClick={() => setForm({ ...vazio })}>+ Novo contato</button>
        )}

        {form && (
          <form onSubmit={salvar} style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <div className="formgrid">
              <div className="full">
                <label>Nome *</label>
                <input value={form.nome ?? ''} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus />
              </div>
              <div>
                <label>Cargo</label>
                <input value={form.cargo ?? ''} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
              </div>
              <div>
                <label>Telefone</label>
                <input value={form.telefone ?? ''} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
              </div>
              <div className="full">
                <label>E-mail</label>
                <input type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="full">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', letterSpacing: 0 }}>
                  <input type="checkbox" style={{ width: 'auto' }} checked={!!form.principal} onChange={(e) => setForm({ ...form, principal: e.target.checked })} />
                  Contato principal
                </label>
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn primary">Salvar contato</button>
            </div>
          </form>
        )}

        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
