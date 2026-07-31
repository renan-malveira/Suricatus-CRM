import type { Negocio, HistoricoEtapa, Etapa } from './types';
import { ETAPAS_ABERTAS } from './constants';

const DIA_MS = 1000 * 60 * 60 * 24;

export interface Kpis {
  abertos: number;
  valorFunil: number;
  ponderado: number;
  fechadoMes: number;
  ganhosMes: number;
  winRate: number;
  ticketMedio: number;
  cicloMedioDias: number;
  totalGanho: number;
  totalPerdido: number;
}

export function calcKpis(negocios: Negocio[]): Kpis {
  const abertos = negocios.filter((n) => ETAPAS_ABERTAS.includes(n.etapa));
  const ganhos = negocios.filter((n) => n.etapa === 'ganho');
  const perdidos = negocios.filter((n) => n.etapa === 'perdido');

  const agora = new Date();
  const ganhosMes = ganhos.filter((n) => {
    const d = new Date(n.fechado_em ?? n.created_at);
    return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
  });

  const ticketMedio = ganhos.length
    ? ganhos.reduce((s, n) => s + Number(n.valor), 0) / ganhos.length
    : 0;

  const comCiclo = ganhos.filter((n) => n.fechado_em);
  const cicloMedioDias = comCiclo.length
    ? comCiclo.reduce((s, n) => s + (new Date(n.fechado_em!).getTime() - new Date(n.created_at).getTime()) / DIA_MS, 0) / comCiclo.length
    : 0;

  return {
    abertos: abertos.length,
    valorFunil: abertos.reduce((s, n) => s + Number(n.valor), 0),
    ponderado: abertos.reduce((s, n) => s + (Number(n.valor) * n.probabilidade) / 100, 0),
    fechadoMes: ganhosMes.reduce((s, n) => s + Number(n.valor), 0),
    ganhosMes: ganhosMes.length,
    winRate: ganhos.length + perdidos.length > 0 ? Math.round((ganhos.length / (ganhos.length + perdidos.length)) * 100) : 0,
    ticketMedio,
    cicloMedioDias: Math.round(cicloMedioDias),
    totalGanho: ganhos.length,
    totalPerdido: perdidos.length,
  };
}

export interface Estagnado {
  negocio: Negocio;
  dias: number;
}

/** Negócios abertos sem atividade há mais de `limiteDias`. */
export function negociosEstagnados(
  negocios: Negocio[],
  ultimaAtividade: Map<string, string>,
  limiteDias: number,
): Estagnado[] {
  const agora = Date.now();
  return negocios
    .filter((n) => ETAPAS_ABERTAS.includes(n.etapa))
    .map((n) => {
      const ref = ultimaAtividade.get(n.id) ?? n.created_at;
      const dias = Math.floor((agora - new Date(ref).getTime()) / DIA_MS);
      return { negocio: n, dias };
    })
    .filter((e) => e.dias >= limiteDias)
    .sort((a, b) => b.dias - a.dias);
}

/** Tempo médio (em dias) que os negócios passaram em cada etapa, a partir do histórico. */
export function tempoMedioPorEtapa(
  negocios: Negocio[],
  historicos: HistoricoEtapa[],
): Partial<Record<Etapa, number>> {
  const porNegocio = new Map<string, HistoricoEtapa[]>();
  for (const h of historicos) {
    const arr = porNegocio.get(h.negocio_id) ?? [];
    arr.push(h);
    porNegocio.set(h.negocio_id, arr);
  }

  const soma: Partial<Record<Etapa, number>> = {};
  const cont: Partial<Record<Etapa, number>> = {};

  for (const n of negocios) {
    const hs = (porNegocio.get(n.id) ?? []).slice().sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    let anterior = new Date(n.created_at).getTime();
    for (const h of hs) {
      const t = new Date(h.created_at).getTime();
      const etapa = (h.etapa_de ?? 'lead') as Etapa;
      const dias = (t - anterior) / DIA_MS;
      if (dias >= 0) {
        soma[etapa] = (soma[etapa] ?? 0) + dias;
        cont[etapa] = (cont[etapa] ?? 0) + 1;
      }
      anterior = t;
    }
  }

  const media: Partial<Record<Etapa, number>> = {};
  for (const k of Object.keys(soma) as Etapa[]) {
    media[k] = Math.round((soma[k] ?? 0) / (cont[k] ?? 1));
  }
  return media;
}
