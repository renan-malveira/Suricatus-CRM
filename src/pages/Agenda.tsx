import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Atividade, Cliente, Negocio, TipoAtividade } from '../lib/types';
import { TIPOS_ATIVIDADE, TIPO_ATIVIDADE_MAP, DIAS_ESTAGNADO } from '../lib/constants';
import { listAtividadesGlobais, listClientes, listNegocios, createAtividade } from '../lib/db';
import { usePodeEscrever } from '../lib/RoleContext';

function agora(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
function efetiva(a: Atividade): string {
  return a.data_agendada ?? a.created_at;
}
function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}
function rotulo(iso: string): string {
  const dias = diasDesde(iso);
  const data = new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });
  if (dias === 0) return `hoje`;
  if (dias === 1) return `ontem`;
  if (dias < 0) return `${data} (agendado)`;
  return `${data} · ${dias}d atrás`;
}

export default function Agenda() {
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const podeEscrever = usePodeEscrever();
  const nav = useNavigate();

  // formulário de novo contato
  const [negId, setNegId] = useState('');
  const [tipo, setTipo] = useState<TipoAtividade>('reuniao');
  const [quando, setQuando] = useState(agora());
  const [desc, setDesc] = useState('');
  const [autor, setAutor] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setCarregando(true);
    try {
      const [a, c, n] = await Promise.all([listAtividadesGlobais(), listClientes(), listNegocios()]);
      setAtividades(a);
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

  // Último contato por cliente
  const porCliente = useMemo(() => {
    const ultimo = new Map<string, string>();
    for (const a of atividades) {
      const cid = a.negocio?.cliente?.id ?? a.negocio?.cliente_id;
      if (!cid) continue;
      const d = efetiva(a);
      const atual = ultimo.get(cid);
      if (!atual || new Date(d) > new Date(atual)) ultimo.set(cid, d);
    }
    return clientes
      .map((c) => ({ cliente: c, data: ultimo.get(c.id) ?? null }))
      .sort((a, b) => {
        if (!a.data) return -1;
        if (!b.data) return 1;
        return new Date(a.data).getTime() - new Date(b.data).getTime();
      });
  }, [atividades, clientes]);

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    if (!negId || !desc.trim()) return;
    setSalvando(true);
    try {
      await createAtividade({
        negocio_id: negId,
        tipo,
        descricao: desc.trim(),
        autor: autor.trim() || null,
        data_agendada: quando ? new Date(quando).toISOString() : null,
      });
      setDesc('');
      setQuando(agora());
      await carregar();
    } catch (err) {
      setErro((err as Error).message);
    }
    setSalvando(false);
  }

  if (carregando) return <div className="center-msg">Carregando agenda…</div>;

  return (
    <div className="view">
      {erro && <div className="err">{erro}</div>}
      <div className="subbar">
        <span className="chip on">Registro de contatos</span>
        <span style={{ fontSize: 12, color: 'var(--dim)' }}>quando foi a última vez que falamos com cada cliente</span>
      </div>

      <div className="detail">
        <div className="dcard">
          <div className="sec-h">Último contato por cliente</div>
          {porCliente.length === 0 ? (
            <div className="empty" style={{ textAlign: 'left' }}>Nenhum cliente cadastrado ainda.</div>
          ) : (
            porCliente.map(({ cliente, data }) => {
              const dias = data ? diasDesde(data) : null;
              const frio = data ? dias! >= DIAS_ESTAGNADO : true;
              return (
                <div key={cliente.id} className="anexo">
                  <div className="nm">
                    <div>{cliente.nome}</div>
                    <div className="sz">{data ? rotulo(data) : 'sem contato registrado'}</div>
                  </div>
                  <span className="pill" style={frio
                    ? { background: 'rgba(245,166,35,.16)', color: '#ffcf7a' }
                    : { background: 'rgba(46,204,155,.16)', color: '#8ff0d3' }}>
                    {data ? (frio ? `${dias}d sem contato` : 'em dia') : 'nunca'}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="dcard">
          {podeEscrever && (
            <>
              <div className="sec-h">Registrar contato</div>
              <form onSubmit={registrar} style={{ marginBottom: 20 }}>
                <label>Negócio / cliente</label>
                <select value={negId} onChange={(e) => setNegId(e.target.value)} required style={{ marginBottom: 10 }}>
                  <option value="">— escolha o negócio —</option>
                  {negocios.map((n) => (
                    <option key={n.id} value={n.id}>{n.titulo}{n.cliente ? ` · ${n.cliente.nome}` : ''}</option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoAtividade)} style={{ flex: 1 }}>
                    {TIPOS_ATIVIDADE.map((t) => (
                      <option key={t.id} value={t.id}>{t.icone} {t.label}</option>
                    ))}
                  </select>
                </div>
                <label>Quando aconteceu (pode ser data passada)</label>
                <input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} style={{ marginBottom: 10 }} />
                <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="O que foi conversado?" style={{ marginBottom: 10, resize: 'vertical' }} />
                <input value={autor} onChange={(e) => setAutor(e.target.value)} placeholder="Seu nome" style={{ marginBottom: 10 }} />
                <button className="btn cyan" style={{ width: '100%' }} disabled={salvando}>{salvando ? 'Registrando…' : '+ Registrar contato'}</button>
              </form>
            </>
          )}

          <div className="sec-h">Histórico de contatos</div>
          {atividades.length === 0 ? (
            <div className="empty" style={{ textAlign: 'left' }}>Nenhum contato registrado ainda.</div>
          ) : (
            <div className="tl">
              {atividades.slice(0, 40).map((a) => {
                const t = TIPO_ATIVIDADE_MAP[a.tipo] ?? TIPO_ATIVIDADE_MAP.nota;
                return (
                  <div key={a.id} className="ev">
                    <div className="d">{t.icone} {t.label} · {rotulo(efetiva(a))}{a.autor ? ` · ${a.autor}` : ''}</div>
                    <div className="x">{a.descricao}</div>
                    {a.negocio && (
                      <div className="d" style={{ marginTop: 2 }}>
                        <a style={{ color: 'var(--muted)', cursor: 'pointer' }} onClick={() => nav(`/negocio/${a.negocio!.id}`)}>
                          {a.negocio.cliente?.nome ?? a.negocio.titulo}
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
