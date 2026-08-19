import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProsEvento, ProsMarca, ProsContato, ProsImportacao, StatusProspeccao, StatusContatoPros } from '../lib/types';
import {
  listProsEventos, listProsMarcas, listProsContatos, updateProsEvento, updateProsContato,
  ultimaImportacao, promoverEvento,
} from '../lib/db';
import {
  marcasDoEvento, diasAte, ehQuente, indexarContatos, indexarNomes, rotularEventos,
  csvDevolutiva, baixarArquivo, PERIODOS, janelaDe, naJanela, temDataExata, emAndamento, jaTerminou,
} from '../lib/prospeccao';
import { usePodeEscrever } from '../lib/RoleContext';
import ImportarProspeccao from '../components/ImportarProspeccao';

const STATUS_EVENTO: StatusProspeccao[] = ['novo', 'analisando', 'abordado', 'descartado'];
const STATUS_CONTATO: StatusContatoPros[] = ['novo', 'abordado', 'respondeu', 'descartado'];

const COR_URGENCIA: Record<string, { bg: string; txt: string }> = {
  urgente: { bg: 'rgba(255,94,108,.16)', txt: '#ff8f99' },
  proximo: { bg: 'rgba(245,166,35,.14)', txt: '#f5c169' },
  radar: { bg: 'rgba(0,188,212,.14)', txt: '#7fe3f0' },
  passado: { bg: 'rgba(255,255,255,.06)', txt: 'var(--dim)' },
};

const COR_FIT = ['#3a2a4a', '#ff5e6c', '#ff9d6b', '#f5a623', '#a8e05f', '#2ecc9b'];

/** Uma aba = uma tabela. Marcas é só consulta (sem status próprio, por decisão). */
type Aba = 'eventos' | 'marcas' | 'contatos';

const LOTE = 100;

export default function Prospeccao() {
  const [eventos, setEventos] = useState<ProsEvento[]>([]);
  const [marcas, setMarcas] = useState<ProsMarca[]>([]);
  const [contatos, setContatos] = useState<ProsContato[]>([]);
  const [ultima, setUltima] = useState<ProsImportacao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [importando, setImportando] = useState(false);
  const [aba, setAba] = useState<Aba>('eventos');
  const [aberto, setAberto] = useState<Record<string, boolean>>({});
  const [limite, setLimite] = useState(LOTE);
  const [promovendo, setPromovendo] = useState<string | null>(null);

  // filtros
  const [busca, setBusca] = useState('');
  const [urgencia, setUrgencia] = useState('');
  const [setor, setSetor] = useState('');
  const [uf, setUf] = useState('');
  const [fitMin, setFitMin] = useState('');
  const [cota, setCota] = useState('');
  const [statusF, setStatusF] = useState('');
  const [soQuentes, setSoQuentes] = useState(false);
  const [periodo, setPeriodo] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  // "sem data" é um modo à parte: são os eventos que NENHUMA janela alcança.
  const [soSemData, setSoSemData] = useState(false);

  const podeEscrever = usePodeEscrever();
  const navigate = useNavigate();

  async function carregar() {
    setCarregando(true);
    try {
      const [e, m, c, imp] = await Promise.all([
        listProsEventos(), listProsMarcas(), listProsContatos(), ultimaImportacao(),
      ]);
      setEventos(e); setMarcas(m); setContatos(c); setUltima(imp);
    } catch (err) {
      setErro((err as Error).message);
    }
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []);

  function limpar() {
    setBusca(''); setUrgencia(''); setSetor(''); setUf(''); setFitMin('');
    setCota(''); setStatusF(''); setSoQuentes(false);
    setPeriodo(''); setDe(''); setAte(''); setSoSemData(false); setLimite(LOTE);
  }

  useEffect(() => {
    setLimite(LOTE);
  }, [aba, busca, urgencia, setor, uf, fitMin, cota, statusF, soQuentes, periodo, de, ate, soSemData]);

  const ctPorMarca = useMemo(() => indexarContatos(contatos), [contatos]);
  const nomesEv = useMemo(() => indexarNomes(eventos), [eventos]);

  const quentes = useMemo(() => eventos.filter((e) => ehQuente(e) && !e.negocio_id), [eventos]);
  // Mesmo critério do filtro "próximos 30 dias" que este KPI aciona — senão o
  // número da tela e o da lista discordam (evento em andamento entra num e não no outro).
  const prox30 = useMemo(
    () => eventos.filter((e) => naJanela(e, ...janelaDe('proximos30'))),
    [eventos],
  );
  const semTriagem = useMemo(() => eventos.filter((e) => e.status_comercial === 'novo').length, [eventos]);
  const noFunil = useMemo(() => eventos.filter((e) => e.negocio_id).length, [eventos]);

  const setores = useMemo(
    () => [...new Set(eventos.map((e) => e.setor).filter(Boolean))].sort((a, b) => a!.localeCompare(b!, 'pt-BR')) as string[],
    [eventos],
  );
  const ufs = useMemo(
    () => [...new Set(eventos.map((e) => e.uf).filter(Boolean))].sort() as string[],
    [eventos],
  );

  /** Janela ativa: o período pronto e o intervalo digitado se cruzam (AND). */
  const [janelaDe_, janelaAte_] = useMemo(() => {
    const [pDe, pAte] = janelaDe(periodo);
    const maior = (a: string | null, b: string | null) => (a && b ? (a > b ? a : b) : a ?? b);
    const menor = (a: string | null, b: string | null) => (a && b ? (a < b ? a : b) : a ?? b);
    return [maior(pDe, de || null), menor(pAte, ate || null)];
  }, [periodo, de, ate]);

  const filtrandoPorData = !!(janelaDe_ || janelaAte_);

  /** Eventos que nenhum filtro de data alcança, porque o robô ainda não achou a data. */
  const semData = useMemo(() => eventos.filter((e) => !temDataExata(e)), [eventos]);

  const eventosFiltrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    const hoje = new Date().toISOString().slice(0, 10);
    return eventos
      .filter((e) => {
        if (soSemData) return !temDataExata(e);
        // "já aconteceram" pede evento TERMINADO, não sobreposição de intervalo.
        if (periodo === 'passados' && !jaTerminou(e)) return false;
        if (!naJanela(e, janelaDe_, janelaAte_)) return false;
        if (soQuentes && !ehQuente(e)) return false;
        if (urgencia && e.urgencia !== urgencia) return false;
        if (setor && e.setor !== setor) return false;
        if (uf && e.uf !== uf) return false;
        if (cota && e.cota !== cota) return false;
        if (statusF && e.status_comercial !== statusF) return false;
        if (fitMin && (e.fit ?? 0) < Number(fitMin)) return false;
        if (q) {
          const alvo = `${e.nome} ${e.cidade ?? ''} ${e.setor ?? ''} ${e.organizador ?? ''} ${e.patrocinadores ?? ''} ${e.expositores ?? ''}`;
          if (!alvo.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      // Agenda: acontecendo agora no topo, depois o que vem, e o que já passou no fim.
      .sort((a, b) => {
        const ordem = (e: ProsEvento) => {
          if (emAndamento(e)) return 0;
          return (e.data_inicio ?? '9999') < hoje ? 2 : 1;
        };
        const oa = ordem(a), ob = ordem(b);
        if (oa !== ob) return oa - ob;
        return (a.data_inicio ?? '9999').localeCompare(b.data_inicio ?? '9999');
      });
  }, [eventos, busca, urgencia, setor, uf, cota, statusF, fitMin, soQuentes, janelaDe_, janelaAte_, soSemData, periodo]);

  const marcasFiltradas = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return marcas.filter((m) => {
      if (setor && !(m.setores ?? '').includes(setor)) return false;
      if (cota === 'tem contato' && !(m.n_contatos ?? 0)) return false;
      if (cota === 'sem contato' && (m.n_contatos ?? 0) > 0) return false;
      if (!q) return true;
      const rotulos = rotularEventos(m.eventos, nomesEv).join(' ');
      return `${m.marca} ${m.setores ?? ''} ${rotulos}`.toLowerCase().includes(q);
    });
  }, [marcas, busca, setor, cota, nomesEv]);

  const contatosFiltrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return contatos.filter((c) => {
      if (fitMin && c.prioridade !== Number(fitMin)) return false;
      if (setor && c.area !== setor) return false;
      if (cota && c.confianca !== cota) return false;
      if (statusF && c.status_contato !== statusF) return false;
      if (!q) return true;
      return `${c.nome} ${c.marca ?? ''} ${c.cargo ?? ''}`.toLowerCase().includes(q);
    });
  }, [contatos, busca, fitMin, setor, cota, statusF]);

  async function mudarStatusEvento(e: ProsEvento, valor: StatusProspeccao) {
    setEventos((prev) => prev.map((x) => (x.id === e.id ? { ...x, status_comercial: valor } : x)));
    try {
      await updateProsEvento(e.id, { status_comercial: valor });
    } catch (err) {
      setErro((err as Error).message);
      carregar(); // desfaz o otimismo se o banco recusou
    }
  }

  async function mudarStatusContato(c: ProsContato, valor: StatusContatoPros) {
    setContatos((prev) => prev.map((x) => (x.id === c.id ? { ...x, status_contato: valor } : x)));
    try {
      await updateProsContato(c.id, { status_contato: valor });
    } catch (err) {
      setErro((err as Error).message);
      carregar();
    }
  }

  async function salvarNota(e: ProsEvento, notas: string) {
    if ((e.notas ?? '') === notas) return;
    setEventos((prev) => prev.map((x) => (x.id === e.id ? { ...x, notas } : x)));
    try {
      await updateProsEvento(e.id, { notas: notas || null });
    } catch (err) {
      setErro((err as Error).message);
    }
  }

  async function virarNegocio(e: ProsEvento) {
    if (!confirm(`Criar um negócio no funil para "${e.nome}"?\n\nO cliente será "${e.organizador ?? e.nome}" e o negócio nasce em Lead.`)) return;
    setPromovendo(e.id);
    setErro('');
    try {
      const r = await promoverEvento(e, null);
      setEventos((prev) => prev.map((x) =>
        (x.id === e.id ? { ...x, negocio_id: r.negocioId, status_comercial: 'abordado' } : x)));
      navigate(`/negocio/${r.negocioId}`);
    } catch (err) {
      setErro(`Não consegui criar o negócio: ${(err as Error).message}`);
    }
    setPromovendo(null);
  }

  function baixarDevolutiva() {
    const hoje = new Date().toISOString().slice(0, 10);
    baixarArquivo(`prospeccao-status-${hoje}.csv`, csvDevolutiva(eventos, contatos));
  }

  if (carregando) return <div className="center-msg">Carregando o radar…</div>;

  const vazio = !eventos.length && !marcas.length && !contatos.length;

  return (
    <div className="view">
      {erro && <div className="err">{erro}</div>}
      {aviso && <div className="ok-msg">{aviso}</div>}

      {vazio ? (
        <div className="empty" style={{ padding: '50px 20px', lineHeight: 1.7 }}>
          <b style={{ fontSize: 15, color: '#fff', display: 'block', marginBottom: 8 }}>O radar está vazio.</b>
          Importe o <code>base_prospeccao.xlsx</code> que o robô entrega para começar.
          {podeEscrever && (
            <div style={{ marginTop: 18 }}>
              <button className="btn primary" onClick={() => setImportando(true)}>Importar planilha</button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="kpis kpis-5">
            <div className="kpi">
              <div className="l">Agir agora</div>
              <div className="v" style={{ color: 'var(--pink)' }}>{quentes.length}</div>
              <div className="s">urgente · cota aberta · fit 4-5</div>
            </div>
            <button
              className={`kpi kpi-btn ${periodo === 'proximos30' ? 'on' : ''}`}
              onClick={() => { setAba('eventos'); limpar(); setPeriodo(periodo === 'proximos30' ? '' : 'proximos30'); }}
            >
              <div className="l">Próximos 30 dias</div>
              <div className="v" style={{ color: 'var(--warn)' }}>{prox30.length}</div>
              <div className="s">{periodo === 'proximos30' ? 'filtro ativo — clique pra tirar' : 'clique pra filtrar'}</div>
            </button>
            <div className="kpi">
              <div className="l">Eventos mapeados</div>
              <div className="v">{eventos.length}</div>
              <div className="s">{eventos.filter((e) => e.cota === 'aberta').length} com cota aberta</div>
            </div>
            <div className="kpi">
              <div className="l">Marcas · contatos</div>
              <div className="v" style={{ color: 'var(--cyan)' }}>{marcas.length.toLocaleString('pt-BR')}</div>
              <div className="s">{contatos.length} contatos · {contatos.filter((c) => c.prioridade === 1).length} prio. 1</div>
            </div>
            <div className="kpi">
              <div className="l">Sem triagem</div>
              <div className="v" style={{ color: 'var(--dim)' }}>{semTriagem}</div>
              <div className="s">{noFunil} já viraram negócio</div>
            </div>
          </div>

          <div className="subbar">
            <button className={`chip ${aba === 'eventos' ? 'on' : ''}`} onClick={() => { setAba('eventos'); limpar(); }}>
              Eventos <b>{eventos.length}</b>
            </button>
            <button className={`chip ${aba === 'marcas' ? 'on' : ''}`} onClick={() => { setAba('marcas'); limpar(); }}>
              Marcas <b>{marcas.length.toLocaleString('pt-BR')}</b>
            </button>
            <button className={`chip ${aba === 'contatos' ? 'on' : ''}`} onClick={() => { setAba('contatos'); limpar(); }}>
              Contatos <b>{contatos.length}</b>
            </button>
            <div className="spacer" />
            <span className="legend" style={{ margin: 0 }}>
              {ultima
                ? `Importado em ${new Date(ultima.created_at).toLocaleDateString('pt-BR')}`
                : 'Importação não registrada'}
            </span>
            <button className="btn" onClick={baixarDevolutiva} title="CSV com id + status/notas, pra devolver a quem opera o robô">
              ↓ Devolutiva
            </button>
            {podeEscrever && <button className="btn cyan" onClick={() => setImportando(true)}>Importar planilha</button>}
          </div>

          <div className="filtros">
            <input
              type="search"
              placeholder={aba === 'eventos' ? 'Buscar evento, cidade, marca…' : aba === 'marcas' ? 'Buscar marca ou evento…' : 'Buscar pessoa, marca, cargo…'}
              value={busca}
              onChange={(ev) => setBusca(ev.target.value)}
            />
            {aba === 'eventos' && (
              <>
                <button className={`chip ${soQuentes ? 'on quente' : ''}`} onClick={() => setSoQuentes(!soQuentes)}>
                  🔥 Só as quentes
                </button>
                <select value={periodo} onChange={(e) => { setPeriodo(e.target.value); setSoSemData(false); }}>
                  <option value="">Quando: qualquer data</option>
                  {PERIODOS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                <div className="periodo">
                  <span>de</span>
                  <input type="date" value={de} onChange={(e) => { setDe(e.target.value); setSoSemData(false); }} />
                  <span>até</span>
                  <input type="date" value={ate} onChange={(e) => { setAte(e.target.value); setSoSemData(false); }} />
                </div>
                <select value={urgencia} onChange={(e) => setUrgencia(e.target.value)}>
                  <option value="">Urgência: todas</option>
                  {['urgente', 'proximo', 'radar', 'passado'].map((u) => <option key={u}>{u}</option>)}
                </select>
                <select value={setor} onChange={(e) => setSetor(e.target.value)}>
                  <option value="">Setor: todos</option>
                  {setores.map((s) => <option key={s}>{s}</option>)}
                </select>
                <select value={uf} onChange={(e) => setUf(e.target.value)}>
                  <option value="">UF: todas</option>
                  {ufs.map((u) => <option key={u}>{u}</option>)}
                </select>
                <select value={fitMin} onChange={(e) => setFitMin(e.target.value)}>
                  <option value="">Fit: qualquer</option>
                  <option value="5">só 5</option>
                  <option value="4">4 ou mais</option>
                  <option value="3">3 ou mais</option>
                </select>
                <select value={cota} onChange={(e) => setCota(e.target.value)}>
                  <option value="">Cota: qualquer</option>
                  {['aberta', 'indefinida', 'encerrada'].map((c) => <option key={c}>{c}</option>)}
                </select>
                <select value={statusF} onChange={(e) => setStatusF(e.target.value)}>
                  <option value="">Status: todos</option>
                  {STATUS_EVENTO.map((s) => <option key={s}>{s}</option>)}
                </select>
              </>
            )}
            {aba === 'marcas' && (
              <>
                <select value={setor} onChange={(e) => setSetor(e.target.value)}>
                  <option value="">Setor: todos</option>
                  {setores.map((s) => <option key={s}>{s}</option>)}
                </select>
                <select value={cota} onChange={(e) => setCota(e.target.value)}>
                  <option value="">Contatos: qualquer</option>
                  <option value="tem contato">com contato mapeado</option>
                  <option value="sem contato">sem contato ainda</option>
                </select>
              </>
            )}
            {aba === 'contatos' && (
              <>
                <select value={fitMin} onChange={(e) => setFitMin(e.target.value)}>
                  <option value="">Prioridade: todas</option>
                  {[1, 2, 3].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={setor} onChange={(e) => setSetor(e.target.value)}>
                  <option value="">Área: todas</option>
                  {[...new Set(contatos.map((c) => c.area).filter(Boolean))].sort().map((a) => <option key={a}>{a}</option>)}
                </select>
                <select value={cota} onChange={(e) => setCota(e.target.value)}>
                  <option value="">Confiança: qualquer</option>
                  {['alta', 'media', 'baixa'].map((c) => <option key={c}>{c}</option>)}
                </select>
                <select value={statusF} onChange={(e) => setStatusF(e.target.value)}>
                  <option value="">Status: todos</option>
                  {STATUS_CONTATO.map((s) => <option key={s}>{s}</option>)}
                </select>
              </>
            )}
            <button className="btn" onClick={limpar}>Limpar</button>
          </div>

          {aba === 'eventos' && (filtrandoPorData || soSemData) && semData.length > 0 && (
            <div className="nota-data">
              {soSemData ? (
                <>
                  Mostrando só os <b>{semData.length} eventos sem data definida</b> — o robô ainda não achou
                  quando acontecem. Continuam valendo: {semData.filter((e) => (e.fit ?? 0) >= 4).length} têm fit 4 ou 5.
                  <button className="btn" onClick={() => setSoSemData(false)}>Voltar</button>
                </>
              ) : (
                <>
                  <b>{semData.length} eventos sem data definida</b> não entram em nenhum filtro de data.
                  <button className="btn" onClick={() => setSoSemData(true)}>Ver só eles</button>
                </>
              )}
            </div>
          )}

          {aba === 'eventos' && (
            <Tabela
              total={eventosFiltrados.length}
              limite={limite}
              onMais={() => setLimite((l) => l + 200)}
              cabecalho={<tr>
                <th>Data</th><th>Evento</th><th>Local</th><th>Fit</th>
                <th>Urgência</th><th>Cota</th><th>Marcas</th><th>Status</th>
              </tr>}
            >
              {eventosFiltrados.slice(0, limite).map((e) => {
                const d = diasAte(e.data_inicio);
                const mks = marcasDoEvento(e);
                const cor = COR_URGENCIA[e.urgencia ?? 'passado'] ?? COR_URGENCIA.passado;
                return (
                  <ExpandirEvento
                    key={e.id}
                    aberto={!!aberto[e.id]}
                    onToggle={() => setAberto((a) => ({ ...a, [e.id]: !a[e.id] }))}
                    linha={
                      <>
                        <td className="nowrap">
                          {/* precisão != dia_exato: o robô só sabe o mês/ano, não o dia */}
                          {e.precisao_data && e.precisao_data !== 'dia_exato' && !temDataExata(e) ? (
                            <span className="mini">sem data</span>
                          ) : (
                            <>
                              {e.precisao_data && e.precisao_data !== 'dia_exato' && '~'}
                              {fmtData(e.data_inicio)}
                              {e.precisao_data && e.precisao_data !== 'dia_exato' && (
                                <div className="mini">só o {e.precisao_data}</div>
                              )}
                              {emAndamento(e)
                                ? <div className="mini agora">acontecendo agora</div>
                                : d !== null && d >= 0 && d <= 60 && <div className="mini warn">em {d}d</div>}
                            </>
                          )}
                        </td>
                        <td>
                          <b>{e.nome}</b>
                          {e.negocio_id && <span className="pill nofunil">no funil</span>}
                          <div className="mini">{[e.formato, e.edicao].filter(Boolean).join(' · ')}</div>
                        </td>
                        <td className="nowrap">{e.cidade ?? '—'}<div className="mini">{e.uf ?? ''}</div></td>
                        <td><span className="fitbox" style={{ background: COR_FIT[e.fit ?? 0] }}>{e.fit ?? '–'}</span></td>
                        <td><span className="pill" style={{ background: cor.bg, color: cor.txt }}>{e.urgencia ?? '—'}</span></td>
                        <td>
                          <span className="pill" style={e.cota === 'aberta'
                            ? { background: 'rgba(46,204,155,.16)', color: '#8ff0d3' }
                            : { background: 'rgba(255,255,255,.06)', color: 'var(--dim)' }}>
                            {e.cota ?? '—'}
                          </span>
                        </td>
                        <td className="mini">{mks.length || '—'}</td>
                        <td onClick={(ev) => ev.stopPropagation()}>
                          <select
                            className={`stsel st-${e.status_comercial}`}
                            value={e.status_comercial}
                            disabled={!podeEscrever}
                            onChange={(ev) => mudarStatusEvento(e, ev.target.value as StatusProspeccao)}
                          >
                            {STATUS_EVENTO.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                      </>
                    }
                    detalhe={
                      <DetalheEvento
                        e={e}
                        marcas={mks}
                        contatos={mks.flatMap((m) => ctPorMarca.get(m.toLowerCase()) ?? [])}
                        podeEscrever={podeEscrever}
                        promovendo={promovendo === e.id}
                        onPromover={() => virarNegocio(e)}
                        onAbrirNegocio={() => navigate(`/negocio/${e.negocio_id}`)}
                        onNota={(t) => salvarNota(e, t)}
                      />
                    }
                  />
                );
              })}
            </Tabela>
          )}

          {aba === 'marcas' && (
            <Tabela
              total={marcasFiltradas.length}
              limite={limite}
              onMais={() => setLimite((l) => l + 200)}
              cabecalho={<tr><th>Marca</th><th>Eventos</th><th>Onde aparece</th><th>Papel</th><th>Contatos</th><th>Links</th></tr>}
            >
              {marcasFiltradas.slice(0, limite).map((m) => (
                <tr key={m.id}>
                  <td><b>{m.marca}</b><div className="mini">{m.setores ?? ''}</div></td>
                  <td><b>{m.n_eventos ?? 0}</b></td>
                  <td className="wrapcell">
                    <div className="chips">
                      {rotularEventos(m.eventos, nomesEv).slice(0, 3).map((n) => <span key={n} className="minichip">{n}</span>)}
                      {(m.n_eventos ?? 0) > 3 && <span className="minichip">+{(m.n_eventos ?? 0) - 3}</span>}
                    </div>
                  </td>
                  <td className="mini">{m.papeis ?? '—'}</td>
                  <td>{m.n_contatos ? <b style={{ color: 'var(--good)' }}>{m.n_contatos}</b> : <span className="mini">—</span>}</td>
                  <td className="nowrap mini">
                    {m.site && <a href={m.site} target="_blank" rel="noopener noreferrer" className="lk">site ↗</a>}
                    {m.linkedin && <a href={m.linkedin} target="_blank" rel="noopener noreferrer" className="lk">in ↗</a>}
                    {!m.site && !m.linkedin && '—'}
                  </td>
                </tr>
              ))}
            </Tabela>
          )}

          {aba === 'contatos' && (
            <Tabela
              total={contatosFiltrados.length}
              limite={limite}
              onMais={() => setLimite((l) => l + 200)}
              cabecalho={<tr><th>Prio</th><th>Pessoa</th><th>Marca</th><th>Área</th><th>Nível</th><th>Confiança</th><th>Links</th><th>Status</th></tr>}
            >
              {contatosFiltrados.slice(0, limite).map((c) => (
                <tr key={c.id}>
                  <td><span className={`pill prio${c.prioridade ?? 3}`}>{c.prioridade ?? '—'}</span></td>
                  <td><b>{c.nome}</b><div className="mini">{c.cargo ?? ''}</div></td>
                  <td className="mini">{c.marca ?? '—'}</td>
                  <td className="mini">{c.area ?? '—'}</td>
                  <td className="mini">{c.nivel ?? '—'}</td>
                  <td>
                    <span className={`pill conf-${c.confianca ?? 'baixa'}`}>{c.confianca ?? '—'}</span>
                    <div className="mini">{c.tipo_fonte ?? ''}</div>
                  </td>
                  <td className="nowrap mini">
                    {c.linkedin && <a href={c.linkedin} target="_blank" rel="noopener noreferrer" className="lk">in ↗</a>}
                    {c.email && <a href={`mailto:${c.email}`} className="lk">e-mail</a>}
                    {!c.linkedin && !c.email && '—'}
                  </td>
                  <td>
                    <select
                      className={`stsel st-${c.status_contato}`}
                      value={c.status_contato}
                      disabled={!podeEscrever}
                      onChange={(ev) => mudarStatusContato(c, ev.target.value as StatusContatoPros)}
                    >
                      {STATUS_CONTATO.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </Tabela>
          )}
        </>
      )}

      {importando && (
        <ImportarProspeccao
          autor={null}
          onFechar={() => setImportando(false)}
          onPronto={(r) => {
            setImportando(false);
            setAviso(`Importado: ${r.eventos} eventos, ${r.marcas.toLocaleString('pt-BR')} marcas, ${r.contatos} contatos. Suas anotações foram preservadas.`);
            carregar();
          }}
        />
      )}
    </div>
  );
}

/* ---------- pedaços ---------- */

function fmtData(iso: string | null): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : iso;
}

function Tabela({ cabecalho, children, total, limite, onMais }: {
  cabecalho: React.ReactNode;
  children: React.ReactNode;
  total: number;
  limite: number;
  onMais(): void;
}) {
  if (!total) return <div className="empty">Nada com esses filtros.</div>;
  return (
    <>
      <div className="tbl-wrap">
        <table><thead>{cabecalho}</thead><tbody>{children}</tbody></table>
      </div>
      <div className="tbl-foot">
        <span>{Math.min(limite, total).toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')}</span>
        {total > limite && <button className="btn" onClick={onMais}>Mostrar mais</button>}
      </div>
    </>
  );
}

function ExpandirEvento({ linha, detalhe, aberto, onToggle }: {
  linha: React.ReactNode; detalhe: React.ReactNode; aberto: boolean; onToggle(): void;
}) {
  return (
    <>
      <tr className="rowlink" onClick={onToggle}>{linha}</tr>
      {aberto && <tr className="det"><td colSpan={8}>{detalhe}</td></tr>}
    </>
  );
}

function DetalheEvento({ e, marcas, contatos, podeEscrever, promovendo, onPromover, onAbrirNegocio, onNota }: {
  e: ProsEvento;
  marcas: string[];
  contatos: ProsContato[];
  podeEscrever: boolean;
  promovendo: boolean;
  onPromover(): void;
  onAbrirNegocio(): void;
  onNota(t: string): void;
}) {
  const [nota, setNota] = useState(e.notas ?? '');
  const priorizados = [...contatos].sort((a, b) => (a.prioridade ?? 9) - (b.prioridade ?? 9)).slice(0, 10);

  return (
    <div className="detgrid">
      {e.justificativa_fit && (
        <div><h4>Por que esse fit</h4><p>{e.justificativa_fit}</p></div>
      )}
      <div>
        <h4>Onde e quando</h4>
        <p>
          {e.local ?? '—'}<br />
          {fmtData(e.data_inicio)} → {fmtData(e.data_fim)}
          {e.precisao_data && e.precisao_data !== 'dia_exato' && <span className="mini"> (precisão: {e.precisao_data})</span>}
          {e.publico_estimado && <><br />Público estimado: <b>{e.publico_estimado}</b></>}
        </p>
      </div>
      <div>
        <h4>Organizador</h4>
        <p>
          {e.organizador ?? '—'}<br />
          {e.organizador_site && <a href={e.organizador_site} target="_blank" rel="noopener noreferrer" className="lk">site ↗</a>}
          {e.email_comercial && <><br /><a href={`mailto:${e.email_comercial}`} className="lk">{e.email_comercial}</a></>}
          {e.telefone && <><br />{e.telefone}</>}
        </p>
      </div>
      <div>
        <h4>Patrocínio</h4>
        <p>
          Cota <b>{e.cota ?? '—'}</b>{e.cota_prazo && ` · prazo ${e.cota_prazo}`}<br />
          Área expositiva: {e.area_expositiva ?? '—'}<br />
          {e.patrocinio_pagina && <a href={e.patrocinio_pagina} target="_blank" rel="noopener noreferrer" className="lk">página de patrocínio ↗</a>}
          {e.site && <a href={e.site} target="_blank" rel="noopener noreferrer" className="lk">site do evento ↗</a>}
        </p>
      </div>
      <div className="full">
        <h4>Marcas presentes ({marcas.length})</h4>
        {marcas.length ? (
          <div className="chips">
            {marcas.slice(0, 30).map((m) => <span key={m} className="minichip pat">{m}</span>)}
            {marcas.length > 30 && <span className="minichip">+{marcas.length - 30}</span>}
          </div>
        ) : <p className="mini">Nenhuma identificada ainda.</p>}
      </div>
      <div className="full">
        <h4>Contatos já mapeados nessas marcas ({contatos.length})</h4>
        {priorizados.length ? (
          <div className="chips">
            {priorizados.map((c) => (
              <span key={c.id} className="minichip">
                <b>{c.nome}</b> · {c.cargo} <span className="mini">({c.marca})</span>
                {c.linkedin && <a href={c.linkedin} target="_blank" rel="noopener noreferrer" className="lk">in ↗</a>}
              </span>
            ))}
            {contatos.length > 10 && <span className="minichip">+{contatos.length - 10}</span>}
          </div>
        ) : <p className="mini">Nenhum ainda — o robô não buscou contatos dessas marcas.</p>}
      </div>
      <div className="full">
        <h4>Suas notas</h4>
        <textarea
          rows={2}
          value={nota}
          disabled={!podeEscrever}
          placeholder="O que você já sabe ou combinou sobre esse evento…"
          onChange={(ev) => setNota(ev.target.value)}
          onBlur={() => onNota(nota)}
        />
      </div>
      <div className="full detacoes">
        {e.negocio_id ? (
          <button className="btn cyan" onClick={onAbrirNegocio}>Abrir negócio no funil →</button>
        ) : (
          podeEscrever && (
            <button className="btn primary" onClick={onPromover} disabled={promovendo}>
              {promovendo ? 'Criando…' : '→ Virar negócio no funil'}
            </button>
          )
        )}
        <span className="mini">Última verificação do robô: {fmtData(e.ultima_verificacao)}</span>
      </div>
    </div>
  );
}
