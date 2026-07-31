import { useEffect, useMemo, useState } from 'react';
import type { Cliente, Negocio } from '../lib/types';
import { TIPO_CLIENTE_MAP, LINHAS } from '../lib/constants';
import { listClientes, listNegocios, deleteCliente } from '../lib/db';
import { moedaCurta, iniciais } from '../lib/format';
import { usePodeEscrever } from '../lib/RoleContext';
import ClienteForm from '../components/ClienteForm';
import ContatosModal from '../components/ContatosModal';

const CORES_TIPO: Record<string, { bg: string; txt: string }> = {
  publico: { bg: 'rgba(46,204,155,.16)', txt: '#8ff0d3' },
  corporativo: { bg: 'rgba(233,30,99,.16)', txt: '#ff9ab7' },
  agencia: { bg: 'rgba(124,77,255,.18)', txt: '#c3b0ff' },
};

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [editando, setEditando] = useState<Cliente | null | undefined>(undefined);
  const [contatosDe, setContatosDe] = useState<Cliente | null>(null);
  const podeEscrever = usePodeEscrever();

  async function carregar() {
    setCarregando(true);
    try {
      const [c, n] = await Promise.all([listClientes(), listNegocios()]);
      setClientes(c);
      setNegocios(n);
    } catch (e) {
      setErro((e as Error).message);
    }
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  const abertosPorCliente = useMemo(() => {
    const m = new Map<string, { qtd: number; valor: number }>();
    for (const n of negocios) {
      if (!n.cliente_id) continue;
      const cur = m.get(n.cliente_id) ?? { qtd: 0, valor: 0 };
      if (n.etapa !== 'ganho' && n.etapa !== 'perdido') {
        cur.qtd += 1;
        cur.valor += Number(n.valor);
      }
      m.set(n.cliente_id, cur);
    }
    return m;
  }, [negocios]);

  async function remover(c: Cliente) {
    if (!confirm(`Remover o cliente "${c.nome}"? Os negócios ficam sem cliente vinculado.`)) return;
    try {
      await deleteCliente(c.id);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  if (carregando) return <div className="center-msg">Carregando clientes…</div>;

  return (
    <div className="view">
      {erro && <div className="err">{erro}</div>}
      <div className="subbar">
        <span className="chip on">{clientes.length} cliente(s)</span>
        <div className="spacer" />
        {podeEscrever && <button className="btn cyan" onClick={() => setEditando(null)}>+ Novo cliente</button>}
      </div>

      {clientes.length === 0 ? (
        <div className="empty">Nenhum cliente cadastrado ainda.{podeEscrever && ' Clique em “+ Novo cliente”.'}</div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Cliente</th><th>Tipo</th><th>Segmento</th><th>UF</th>
                <th>Origem</th><th>Responsável</th><th>Negócios abertos</th><th></th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => {
                const tipo = CORES_TIPO[c.tipo] ?? CORES_TIPO.corporativo;
                const ab = abertosPorCliente.get(c.id);
                return (
                  <tr key={c.id}>
                    <td><b>{c.nome}</b></td>
                    <td><span className="pill" style={{ background: tipo.bg, color: tipo.txt }}>{TIPO_CLIENTE_MAP[c.tipo]?.label ?? c.tipo}</span></td>
                    <td>{c.segmento ?? '—'}</td>
                    <td>{c.uf ?? '—'}</td>
                    <td>{c.origem ?? '—'}</td>
                    <td>{c.responsavel ? <span className="who"><span className="av" style={{ background: 'var(--pink)' }}>{iniciais(c.responsavel)}</span>{c.responsavel}</span> : '—'}</td>
                    <td>{ab && ab.qtd > 0 ? `${ab.qtd} · ${moedaCurta(ab.valor)}` : '—'}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="icobtn" title="Contatos" onClick={() => setContatosDe(c)}>☎</button>
                      {podeEscrever && <button className="icobtn" title="Editar" onClick={() => setEditando(c)}>✎</button>}
                      {podeEscrever && <button className="icobtn" title="Remover" onClick={() => remover(c)}>🗑</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="legend" style={{ marginTop: 16 }}>
        ◆ Linha de negócio: {LINHAS.map((l) => <span key={l.id} style={{ color: l.corTxt, marginRight: 12 }}>{l.label}</span>)}
      </div>

      {editando !== undefined && (
        <ClienteForm cliente={editando} onClose={() => setEditando(undefined)} onSaved={() => { setEditando(undefined); carregar(); }} />
      )}
      {contatosDe && (
        <ContatosModal cliente={contatosDe} podeEscrever={podeEscrever} onClose={() => setContatosDe(null)} />
      )}
    </div>
  );
}
