import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Cliente, Negocio, Etapa } from '../lib/types';
import { ETAPAS, LINHA_MAP } from '../lib/constants';
import { listNegocios, listClientes, moverEtapa } from '../lib/db';
import { moeda, moedaCurta, iniciais } from '../lib/format';
import { usePodeEscrever } from '../lib/RoleContext';
import NegocioForm from '../components/NegocioForm';
import MotivoPerdaModal from '../components/MotivoPerdaModal';

export default function Funil() {
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [colAlvo, setColAlvo] = useState<Etapa | null>(null);
  const [perdaPendente, setPerdaPendente] = useState<{ neg: Negocio } | null>(null);
  const [params, setParams] = useSearchParams();
  const novoAberto = params.get('novo') === '1';
  const podeEscrever = usePodeEscrever();
  const nav = useNavigate();

  async function carregar() {
    setCarregando(true);
    try {
      const [n, c] = await Promise.all([listNegocios(), listClientes()]);
      setNegocios(n);
      setClientes(c);
    } catch (e) {
      setErro((e as Error).message);
    }
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function aplicarEtapa(neg: Negocio, etapa: Etapa, motivo?: string | null) {
    setNegocios((prev) => prev.map((n) => (n.id === neg.id ? { ...n, etapa } : n)));
    try {
      await moverEtapa(neg, etapa, null, motivo);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
      carregar();
    }
  }

  function soltar(etapa: Etapa) {
    setColAlvo(null);
    const id = arrastando;
    setArrastando(null);
    if (!id) return;
    const neg = negocios.find((n) => n.id === id);
    if (!neg || neg.etapa === etapa) return;
    if (etapa === 'perdido') {
      setPerdaPendente({ neg });
      return;
    }
    aplicarEtapa(neg, etapa);
  }

  if (carregando) return <div className="center-msg">Carregando funil…</div>;

  return (
    <div className="view">
      {erro && <div className="err">{erro}</div>}

      <div className="subbar">
        <span className="chip on">Agrupar por: Etapa</span>
        <div className="spacer" />
        {podeEscrever && <button className="btn primary" onClick={() => setParams({ novo: '1' })}>+ Novo negócio</button>}
      </div>

      <div className="board">
        {ETAPAS.map((et) => {
          const doGrupo = negocios.filter((n) => n.etapa === et.id);
          const soma = doGrupo.reduce((s, n) => s + Number(n.valor), 0);
          return (
            <div
              key={et.id}
              className={`col ${colAlvo === et.id ? 'drop' : ''}`}
              onDragOver={(e) => { if (podeEscrever) { e.preventDefault(); setColAlvo(et.id); } }}
              onDragLeave={() => setColAlvo((c) => (c === et.id ? null : c))}
              onDrop={() => podeEscrever && soltar(et.id)}
            >
              <div className="col-h">
                <span className="bar" style={{ background: et.cor }} />
                {et.label}
                <span className="n">{doGrupo.length}</span>
              </div>
              <div className="col-sum">{moedaCurta(soma)}</div>
              {doGrupo.map((n) => {
                const linha = LINHA_MAP[n.linha];
                const perdido = n.etapa === 'perdido';
                return (
                  <div
                    key={n.id}
                    className="deal"
                    style={perdido ? { opacity: 0.6 } : undefined}
                    draggable={podeEscrever}
                    onDragStart={() => setArrastando(n.id)}
                    onDragEnd={() => { setArrastando(null); setColAlvo(null); }}
                    onClick={() => nav(`/negocio/${n.id}`)}
                  >
                    <div className="t">{n.titulo}</div>
                    <span className="tag" style={{ background: linha.corBg, color: linha.corTxt }}>{linha.label}</span>
                    <div className="meta">
                      {n.responsavel && <span className="av" style={{ background: 'var(--purple)' }}>{iniciais(n.responsavel)}</span>}
                      <span className="val">{moedaCurta(Number(n.valor))}</span>
                      <span>· {n.probabilidade}%</span>
                    </div>
                    {perdido && n.motivo_perda && <div className="next" style={{ color: 'var(--bad)' }}>✕ {n.motivo_perda}</div>}
                    {n.proxima_acao && !perdido && <div className="next">⚑ {n.proxima_acao}</div>}
                  </div>
                );
              })}
              {doGrupo.length === 0 && <div className="empty">—</div>}
            </div>
          );
        })}
      </div>

      <div className="legend">
        {podeEscrever ? '◆ Arraste os cards entre as colunas para mudar a etapa · clique para abrir o negócio' : '◆ Modo leitor — clique para abrir o negócio'}
        {' · '}Total ganho acumulado: {moeda(negocios.filter((n) => n.etapa === 'ganho').reduce((s, n) => s + Number(n.valor), 0))}
      </div>

      {novoAberto && podeEscrever && (
        <NegocioForm clientes={clientes} onClose={() => setParams({})} onSaved={() => { setParams({}); carregar(); }} />
      )}

      {perdaPendente && (
        <MotivoPerdaModal
          titulo={perdaPendente.neg.titulo}
          onCancel={() => setPerdaPendente(null)}
          onConfirm={(motivo) => { const p = perdaPendente; setPerdaPendente(null); aplicarEtapa(p.neg, 'perdido', motivo); }}
        />
      )}
    </div>
  );
}
