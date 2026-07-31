import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Negocio, Atividade, Anexo, Cliente, HistoricoEtapa, TipoAtividade } from '../lib/types';
import { ETAPAS, ETAPA_MAP, LINHA_MAP, TIPOS_ATIVIDADE, TIPO_ATIVIDADE_MAP } from '../lib/constants';
import {
  getNegocio, listAtividadesDoNegocio, createAtividade, listAnexos, uploadAnexo,
  urlDownload, deleteAnexo, deleteNegocio, listClientes, listHistorico, concluirAtividade,
  listPlannerProjetos,
} from '../lib/db';
import { moeda, dataCurta, tamanhoArquivo } from '../lib/format';
import { usePodeEscrever } from '../lib/RoleContext';
import NegocioForm from '../components/NegocioForm';

export default function NegocioDetalhe() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const podeEscrever = usePodeEscrever();
  const [neg, setNeg] = useState<Negocio | null>(null);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [historico, setHistorico] = useState<HistoricoEtapa[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [plannerNome, setPlannerNome] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [nota, setNota] = useState('');
  const [autor, setAutor] = useState('');
  const [tipo, setTipo] = useState<TipoAtividade>('nota');
  const [dataAg, setDataAg] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [editando, setEditando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function carregar() {
    if (!id) return;
    setCarregando(true);
    try {
      const n = await getNegocio(id);
      setNeg(n);
      const [a, x, h, c] = await Promise.all([
        listAtividadesDoNegocio(id, n?.cliente_id ?? null),
        listAnexos(id), listHistorico(id), listClientes(),
      ]);
      setAtividades(a);
      setAnexos(x);
      setHistorico(h);
      setClientes(c);
      // Projeto do Planner vem do CLIENTE (vínculo automático cliente <-> projeto).
      const cli = n?.cliente_id ? c.find((x) => x.id === n.cliente_id) : null;
      if (cli?.planner_project_id) {
        try {
          const projs = await listPlannerProjetos();
          setPlannerNome(projs.find((p) => p.id === cli.planner_project_id)?.name ?? '(projeto removido)');
        } catch {
          setPlannerNome(null);
        }
      } else {
        setPlannerNome(null);
      }
    } catch (e) {
      setErro((e as Error).message);
    }
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    if (!nota.trim() || !id) return;
    setEnviando(true);
    try {
      await createAtividade({
        negocio_id: id, cliente_id: neg?.cliente_id ?? null,
        tipo, descricao: nota.trim(), autor: autor.trim() || null,
        data_agendada: dataAg ? new Date(dataAg).toISOString() : null,
      });
      setNota('');
      setDataAg('');
      setTipo('nota');
      setAtividades(await listAtividadesDoNegocio(id, neg?.cliente_id ?? null));
    } catch (e) {
      setErro((e as Error).message);
    }
    setEnviando(false);
  }

  async function alternarConcluida(a: Atividade) {
    try {
      await concluirAtividade(a.id, !a.concluida);
      setAtividades((prev) => prev.map((x) => (x.id === a.id ? { ...x, concluida: !x.concluida } : x)));
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function subirArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setErro('');
    try {
      await uploadAnexo(id, file);
      setAnexos(await listAnexos(id));
    } catch (err) {
      setErro((err as Error).message);
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  async function baixar(a: Anexo) {
    try {
      window.open(await urlDownload(a.storage_path), '_blank');
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function removerAnexo(a: Anexo) {
    if (!confirm(`Remover o anexo "${a.nome}"?`)) return;
    try {
      await deleteAnexo(a);
      setAnexos((prev) => prev.filter((x) => x.id !== a.id));
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function removerNegocio() {
    if (!neg || !confirm(`Remover o negócio "${neg.titulo}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await deleteNegocio(neg.id);
      nav('/');
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  if (carregando) return <div className="center-msg">Carregando negócio…</div>;
  if (!neg) return <div className="center-msg">Negócio não encontrado. <button className="btn" onClick={() => nav('/')}>Voltar ao funil</button></div>;

  const etapa = ETAPA_MAP[neg.etapa];
  const linha = LINHA_MAP[neg.linha];
  const idxEtapa = ETAPAS.findIndex((e) => e.id === neg.etapa);

  return (
    <div className="view">
      {erro && <div className="err">{erro}</div>}
      <div className="subbar">
        <button className="chip" onClick={() => nav('/')}>← Voltar ao funil</button>
        <div className="spacer" />
        {podeEscrever && <button className="btn" onClick={() => setEditando(true)}>Editar</button>}
        {podeEscrever && <button className="btn ghostdanger" onClick={removerNegocio}>Remover</button>}
      </div>

      <div className="detail">
        <div className="dcard">
          <h3>{neg.titulo}</h3>
          <div className="dsub">{neg.cliente?.nome ?? 'Sem cliente vinculado'}</div>

          <div className="stage-track">
            {ETAPAS.slice(0, 6).map((e, i) => (
              <div key={e.id} className="s" style={i <= idxEtapa && idxEtapa < 6 ? { background: e.cor } : undefined} />
            ))}
          </div>

          <div className="fields">
            <div className="field"><div className="k">Etapa</div><div className="val"><span className="pill" style={{ background: 'rgba(124,77,255,.2)', color: '#c3b0ff' }}>{etapa.label} · {neg.probabilidade}%</span></div></div>
            <div className="field"><div className="k">Valor estimado</div><div className="val"><b>{moeda(Number(neg.valor))}</b></div></div>
            <div className="field"><div className="k">Linha de negócio</div><div className="val"><span className="tag" style={{ background: linha.corBg, color: linha.corTxt }}>{linha.label}</span></div></div>
            <div className="field"><div className="k">Solução</div><div className="val">{neg.solucao ?? '—'}</div></div>
            <div className="field"><div className="k">Responsável</div><div className="val">{neg.responsavel ?? '—'}</div></div>
            <div className="field"><div className="k">Previsão de fechamento</div><div className="val">{neg.previsao_fechamento ? new Date(neg.previsao_fechamento).toLocaleDateString('pt-BR') : '—'}</div></div>
            <div className="field"><div className="k">Projeto no Planner</div><div className="val">{plannerNome ? <span className="pill" style={{ background: 'rgba(0,188,212,.16)', color: '#7fe3f0' }}>🔗 {plannerNome}</span> : '—'}</div></div>
          </div>

          {neg.etapa === 'perdido' && neg.motivo_perda && (
            <div className="note" style={{ borderColor: 'rgba(255,94,108,.4)', color: '#ffb3ba' }}>✕ <b style={{ color: '#fff' }}>Motivo da perda:</b> {neg.motivo_perda}</div>
          )}
          {neg.proxima_acao && neg.etapa !== 'perdido' && (
            <div className="note">⚑ <b style={{ color: '#fff' }}>Próxima ação:</b> {neg.proxima_acao}</div>
          )}

          <div style={{ marginTop: 24 }} className="sec-h">Anexos</div>
          {anexos.map((a) => (
            <div key={a.id} className="anexo">
              <span>📎</span>
              <span className="nm">{a.nome}</span>
              <span className="sz">{tamanhoArquivo(a.tamanho)}</span>
              <button className="icobtn" title="Baixar" onClick={() => baixar(a)}>⭳</button>
              {podeEscrever && <button className="icobtn" title="Remover" onClick={() => removerAnexo(a)}>🗑</button>}
            </div>
          ))}
          {anexos.length === 0 && <div className="empty" style={{ textAlign: 'left', padding: '4px 0 10px' }}>Nenhum anexo. Suba propostas, briefings ou contratos.</div>}
          {podeEscrever && (
            <>
              <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={subirArquivo} />
              <button className="btn" style={{ marginTop: 10 }} onClick={() => fileRef.current?.click()}>+ Anexar arquivo</button>
            </>
          )}

          {historico.length > 0 && (
            <>
              <div style={{ marginTop: 26 }} className="sec-h">Histórico de etapas</div>
              <div className="tl">
                {historico.map((h) => (
                  <div key={h.id} className="ev">
                    <div className="d">{dataCurta(h.created_at)}{h.autor ? ` · ${h.autor}` : ''}</div>
                    <div className="x">{h.etapa_de ? `${ETAPA_MAP[h.etapa_de]?.label ?? h.etapa_de} → ` : 'Criado em '}<b>{ETAPA_MAP[h.etapa_para]?.label ?? h.etapa_para}</b></div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="dcard">
          <div className="sec-h">Histórico de atividades</div>
          {podeEscrever && (
            <form onSubmit={registrar} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoAtividade)} style={{ flex: 1 }}>
                  {TIPOS_ATIVIDADE.map((t) => (
                    <option key={t.id} value={t.id}>{t.icone} {t.label}</option>
                  ))}
                </select>
              </div>
              <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} placeholder="O que foi feito ou o que agendar?" style={{ marginBottom: 8, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input value={autor} onChange={(e) => setAutor(e.target.value)} placeholder="Seu nome" style={{ flex: 1 }} />
              </div>
              <label style={{ marginBottom: 4 }}>Agendar para (opcional)</label>
              <input type="datetime-local" value={dataAg} onChange={(e) => setDataAg(e.target.value)} style={{ marginBottom: 8 }} />
              <button className="btn cyan" style={{ width: '100%' }} disabled={enviando}>{enviando ? 'Registrando…' : '+ Registrar atividade'}</button>
            </form>
          )}

          {atividades.length === 0 ? (
            <div className="empty" style={{ textAlign: 'left' }}>Sem atividades ainda.</div>
          ) : (
            <div className="tl">
              {atividades.map((a) => {
                const t = TIPO_ATIVIDADE_MAP[a.tipo] ?? TIPO_ATIVIDADE_MAP.nota;
                const agendada = a.data_agendada && !a.concluida;
                return (
                  <div key={a.id} className="ev">
                    <div className="d">
                      {t.icone} {t.label} · {dataCurta(a.created_at)}{a.autor ? ` · ${a.autor}` : ''}
                      {a.origem === 'planner' && <span className="pill" style={{ background: 'rgba(0,188,212,.16)', color: '#7fe3f0', fontSize: 10, marginLeft: 6 }}>via Planner</span>}
                    </div>
                    <div className="x" style={a.concluida ? { opacity: 0.55, textDecoration: 'line-through' } : undefined}>{a.descricao}</div>
                    {a.data_agendada && (
                      <div className="d" style={{ marginTop: 3, color: agendada ? 'var(--cyan)' : 'var(--dim)' }}>
                        🗓️ {new Date(a.data_agendada).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {podeEscrever && (
                          <button className="icobtn" style={{ fontSize: 11, marginLeft: 6 }} onClick={() => alternarConcluida(a)}>
                            {a.concluida ? '↺ reabrir' : '✓ concluir'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {editando && (
        <NegocioForm
          negocio={neg}
          clientes={clientes}
          onClose={() => setEditando(false)}
          onSaved={() => { setEditando(false); carregar(); }}
        />
      )}
    </div>
  );
}
