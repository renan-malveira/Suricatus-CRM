import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Negocio, HistoricoEtapa } from '../lib/types';
import { ETAPAS_ABERTAS, ETAPA_MAP, DIAS_ESTAGNADO } from '../lib/constants';
import { listNegocios, listTodoHistorico, ultimaAtividadePorNegocio } from '../lib/db';
import { calcKpis, tempoMedioPorEtapa, negociosEstagnados } from '../lib/metrics';
import { moeda, moedaCurta } from '../lib/format';

export default function Valores() {
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [historico, setHistorico] = useState<HistoricoEtapa[]>([]);
  const [ultimaAtiv, setUltimaAtiv] = useState<Map<string, string>>(new Map());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const [n, h, u] = await Promise.all([listNegocios(), listTodoHistorico(), ultimaAtividadePorNegocio()]);
        setNegocios(n);
        setHistorico(h);
        setUltimaAtiv(u);
      } catch (e) {
        setErro((e as Error).message);
      }
      setCarregando(false);
    })();
  }, []);

  const kpi = useMemo(() => calcKpis(negocios), [negocios]);
  const tempos = useMemo(() => tempoMedioPorEtapa(negocios, historico), [negocios, historico]);
  const estagnados = useMemo(() => negociosEstagnados(negocios, ultimaAtiv, DIAS_ESTAGNADO), [negocios, ultimaAtiv]);
  const maxTempo = Math.max(1, ...ETAPAS_ABERTAS.map((e) => tempos[e] ?? 0));

  if (carregando) return <div className="center-msg">Calculando…</div>;

  return (
    <div className="view">
      {erro && <div className="err">{erro}</div>}
      <div className="subbar">
        <span className="chip on">Painel de valores</span>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="kpi"><div className="l">Valor no funil</div><div className="v">{moeda(kpi.valorFunil)}</div><div className="s">{kpi.abertos} negócio(s) aberto(s)</div></div>
        <div className="kpi"><div className="l">Forecast ponderado</div><div className="v">{moeda(kpi.ponderado)}</div><div className="s">por probabilidade de fechar</div></div>
        <div className="kpi"><div className="l">Fechado no mês</div><div className="v">{moeda(kpi.fechadoMes)}</div><div className="s">{kpi.ganhosMes} negócio(s) ganho(s)</div></div>
        <div className="kpi"><div className="l">Win rate</div><div className="v">{kpi.winRate}%</div><div className="s">{kpi.totalGanho} ganhos · {kpi.totalPerdido} perdidos</div></div>
        <div className="kpi"><div className="l">Ticket médio</div><div className="v">{moeda(kpi.ticketMedio)}</div><div className="s">por negócio ganho</div></div>
        <div className="kpi"><div className="l">Ciclo de vendas</div><div className="v">{kpi.cicloMedioDias} dias</div><div className="s">do lead ao ganho (média)</div></div>
      </div>

      <div className="detail" style={{ marginTop: 6 }}>
        <div className="dcard">
          <div className="sec-h">Tempo médio por etapa</div>
          {ETAPAS_ABERTAS.map((e) => {
            const dias = tempos[e] ?? 0;
            return (
              <div key={e} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                  <span>{ETAPA_MAP[e].label}</span>
                  <span style={{ color: 'var(--muted)' }}>{dias === 0 ? '—' : `${dias} dia(s)`}</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--card-2)' }}>
                  <div style={{ height: 6, borderRadius: 3, width: `${Math.round(((dias) / maxTempo) * 100)}%`, background: ETAPA_MAP[e].cor }} />
                </div>
              </div>
            );
          })}
          <div className="legend">◆ Onde os negócios ficam mais tempo parados. Calculado a partir do histórico de etapas.</div>
        </div>

        <div className="dcard">
          <div className="sec-h" style={{ color: estagnados.length ? 'var(--warn)' : undefined }}>
            Negócios estagnados {estagnados.length > 0 && `· ${estagnados.length}`}
          </div>
          {estagnados.length === 0 ? (
            <div className="empty" style={{ textAlign: 'left' }}>Nenhum negócio parado há mais de {DIAS_ESTAGNADO} dias. 👏</div>
          ) : (
            estagnados.map((e) => (
              <div key={e.negocio.id} className="anexo" style={{ cursor: 'pointer' }} onClick={() => nav(`/negocio/${e.negocio.id}`)}>
                <div className="nm">
                  <div>{e.negocio.titulo}</div>
                  <div className="sz">{ETAPA_MAP[e.negocio.etapa]?.label} · {moedaCurta(Number(e.negocio.valor))}</div>
                </div>
                <span className="pill" style={{ background: 'rgba(245,166,35,.16)', color: '#ffcf7a' }}>{e.dias}d parado</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
