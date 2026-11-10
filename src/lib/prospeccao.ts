/**
 * Tradução entre a planilha do robô (base_prospeccao.xlsx) e as tabelas pros_*.
 * Os nomes de coluna aqui são os do cabeçalho da planilha — se o robô mudar
 * um cabeçalho, é aqui que quebra, e de propósito: melhor falhar na validação
 * do import do que importar uma coluna em silêncio como vazia.
 */
import type { Linha } from './xlsx';
import type { ProsEvento, ProsMarca, ProsContato } from './types';

export const ABAS = { eventos: 'Eventos', prioritarios: '⭐ Prioritários', marcas: 'Marcas', contatos: 'Contatos' } as const;

/**
 * O robô escreve esta frase quando não achou o dado. Ela é informação para
 * quem lê a planilha, mas no banco é ruído: vira null pra "—" aparecer na tela
 * e pros filtros não tratarem "não achei" como se fosse um valor.
 */
const SEM_DADO = /^n[ãa]o informado na fonte$/i;

function txt(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || SEM_DADO.test(s)) return null;
  return s;
}

function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = txt(v);
  if (!s) return null;
  const n = Number(s.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Público estimado vem ora número (4000), ora texto ("~5 mil"). Guardamos como texto. */
function txtOuNum(v: unknown): string | null {
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : null;
  return txt(v);
}

export interface Payloads {
  eventos: Record<string, unknown>[];
  prioritarios: string[];
  marcas: Record<string, unknown>[];
  contatos: Record<string, unknown>[];
}

export class ErroImport extends Error {}

/** Confere que as abas e as colunas-chave existem antes de mandar qualquer coisa pro banco. */
export function validar(abas: string[], amostras: Record<string, Linha[]>): void {
  const faltando = Object.values(ABAS).filter((a) => !abas.includes(a));
  if (faltando.length) {
    throw new ErroImport(
      `A planilha não tem ${faltando.length > 1 ? 'as abas' : 'a aba'} ${faltando.join(', ')}. ` +
        `Encontrei: ${abas.join(', ')}. Esse arquivo é mesmo o base_prospeccao.xlsx?`,
    );
  }
  const obrigatorias: Record<string, string[]> = {
    [ABAS.eventos]: ['id', 'Nome', 'Urgência', 'Fit'],
    [ABAS.prioritarios]: ['id', 'Evento', 'Data início'],
    [ABAS.marcas]: ['id', 'Marca'],
    [ABAS.contatos]: ['id', 'Nome', 'Marca'],
  };
  for (const [aba, cols] of Object.entries(obrigatorias)) {
    const linhas = amostras[aba] ?? [];
    if (!linhas.length) throw new ErroImport(`A aba ${aba} está vazia.`);
    const presentes = Object.keys(linhas[0]);
    const ausentes = cols.filter((c) => !presentes.includes(c));
    if (ausentes.length) {
      throw new ErroImport(
        `A aba ${aba} não tem a(s) coluna(s): ${ausentes.join(', ')}. ` +
          `O robô pode ter mudado o cabeçalho — me avise antes de importar.`,
      );
    }
  }
  if (!(amostras[ABAS.prioritarios] ?? []).some((linha) => txt(linha.id))) {
    throw new ErroImport(`A aba ${ABAS.prioritarios} não contém nenhum ID de evento.`);
  }
}

export function mapearEvento(l: Linha): Record<string, unknown> {
  return {
    id: txt(l['id']),
    nome: txt(l['Nome']) ?? '',
    edicao: txt(l['Edição']),
    setor: txt(l['Setor']),
    setores_secundarios: txt(l['Setores secundários']),
    formato: txt(l['Formato']),
    status: txt(l['Status']),
    data_inicio: txt(l['Data início']),
    data_fim: txt(l['Data fim']),
    precisao_data: txt(l['Precisão data']),
    urgencia: txt(l['Urgência']),
    cidade: txt(l['Cidade']),
    uf: txt(l['UF']),
    local: txt(l['Local']),
    site: txt(l['Site oficial']),
    fit: num(l['Fit']),
    justificativa_fit: txt(l['Justificativa do fit']),
    alvo: txt(l['Alvo']),
    publico_estimado: txtOuNum(l['Público estimado']),
    organizador: txt(l['Organizador']),
    organizador_site: txt(l['Site do organizador']),
    email_comercial: txt(l['E-mail comercial']),
    telefone: txt(l['Telefone']),
    patrocinio_pagina: txt(l['Página de patrocínio']),
    cota: txt(l['Cota de patrocínio']),
    cota_prazo: txt(l['Prazo da cota']),
    area_expositiva: txt(l['Tem área expositiva']),
    patrocinadores: txt(l['Patrocinadores']),
    expositores: txt(l['Expositores conhecidos']),
    marcas_pesquisadas: txt(l['Marcas pesquisadas']),
    primeiro_visto: txt(l['Primeiro visto']),
    ultima_verificacao: txt(l['Última verificação']),
    proxima_revisita: txt(l['Próxima revisita']),
    fonte: txt(l['Fonte principal']),
    // Só têm efeito na primeira vez que a linha entra (ver schema.sql).
    status_comercial: txt(l['✏️ Status comercial']),
    responsavel: txt(l['✏️ Responsável']),
    notas: txt(l['✏️ Notas']),
  };
}

export function mapearMarca(l: Linha): Record<string, unknown> {
  return {
    id: txt(l['id']),
    marca: txt(l['Marca']) ?? '',
    setores: txt(l['Setores']),
    n_eventos: num(l['Nº de eventos']),
    eventos: txt(l['Eventos']),
    papeis: txt(l['Papéis']),
    site: txt(l['Site']),
    linkedin: txt(l['LinkedIn']),
    status_busca: txt(l['Status busca contato']),
    n_contatos: num(l['Nº de contatos']),
    primeiro_visto: txt(l['Primeiro visto']),
  };
}

export function mapearContato(l: Linha): Record<string, unknown> {
  return {
    id: txt(l['id']),
    marca: txt(l['Marca']),
    nome: txt(l['Nome']) ?? '',
    cargo: txt(l['Cargo']),
    area: txt(l['Área']),
    nivel: txt(l['Nível']),
    prioridade: num(l['Prioridade']),
    linkedin: txt(l['LinkedIn']),
    email: txt(l['E-mail']),
    telefone: txt(l['Telefone']),
    confianca: txt(l['Confiança']),
    fonte: txt(l['Fonte']),
    tipo_fonte: txt(l['Tipo de fonte']),
    primeiro_visto: txt(l['Primeiro visto']),
    status_contato: txt(l['✏️ Status contato']),
    notas: txt(l['✏️ Notas']),
  };
}

/* ---------- Helpers de leitura usados nas telas ---------- */

/** "A, B, C" -> ['A','B','C'] (o robô grava listas como texto separado por vírgula). */
export function lista(s: string | null): string[] {
  if (!s) return [];
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

/** Marcas de um evento = patrocinadores + expositores, sem repetir. */
export function marcasDoEvento(e: Pick<ProsEvento, 'patrocinadores' | 'expositores'>): string[] {
  return [...new Set([...lista(e.patrocinadores), ...lista(e.expositores)])];
}

/** Dias até a data (negativo = já passou). null se a data não for um dia exato. */
export function diasAte(data: string | null): number | null {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const alvo = new Date(`${data}T00:00:00`);
  const hoje = new Date(new Date().toDateString());
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

/** A data é um dia exato utilizável em filtro? O robô também grava mês/ano/indefinida. */
export function temDataExata(e: Pick<ProsEvento, 'data_inicio'>): boolean {
  return !!e.data_inicio && /^\d{4}-\d{2}-\d{2}$/.test(e.data_inicio);
}

/**
 * Períodos prontos do filtro "Quando".
 * Nada aqui é relativo a "hoje" na hora de comparar: a janela é resolvida uma
 * vez em `janelaDe` e comparada como string ISO, que ordena igual a data.
 */
export const PERIODOS = [
  { id: 'proximos7', label: 'próximos 7 dias' },
  { id: 'proximos30', label: 'próximos 30 dias' },
  { id: 'proximos60', label: 'próximos 60 dias' },
  { id: 'proximos90', label: 'próximos 90 dias' },
  { id: 'futuros', label: 'ainda vão acontecer' },
  { id: 'passados', label: 'já aconteceram' },
] as const;

export type Periodo = (typeof PERIODOS)[number]['id'];

const iso = (d: Date): string => d.toISOString().slice(0, 10);

/** Resolve um período em [de, ate] no formato ISO. `null` em uma ponta = sem limite. */
export function janelaDe(periodo: string): [string | null, string | null] {
  const hoje = new Date(new Date().toDateString());
  const mais = (dias: number) => {
    const d = new Date(hoje);
    d.setDate(d.getDate() + dias);
    return iso(d);
  };
  switch (periodo) {
    case 'proximos7': return [iso(hoje), mais(7)];
    case 'proximos30': return [iso(hoje), mais(30)];
    case 'proximos60': return [iso(hoje), mais(60)];
    case 'proximos90': return [iso(hoje), mais(90)];
    case 'futuros': return [iso(hoje), null];
    case 'passados': return [null, mais(-1)];
    default: return [null, null];
  }
}

/**
 * O evento cai na janela? Compara o INTERVALO do evento (início→fim) com a
 * janela, não só a data de início: uma feira que começa dia 28 e termina dia 2
 * tem que aparecer em "próximos 30 dias" mesmo que a janela feche dia 30.
 */
export function naJanela(
  e: Pick<ProsEvento, 'data_inicio' | 'data_fim'>,
  de: string | null,
  ate: string | null,
): boolean {
  if (!de && !ate) return true;
  const ini = e.data_inicio;
  if (!ini || !/^\d{4}-\d{2}-\d{2}$/.test(ini)) return false;
  const fim = fimDoEvento(e)!;
  if (de && fim < de) return false;
  if (ate && ini > ate) return false;
  return true;
}

/** Último dia do evento (cai no início quando não há fim válido). */
export function fimDoEvento(e: Pick<ProsEvento, 'data_inicio' | 'data_fim'>): string | null {
  if (!temDataExata(e)) return null;
  const ini = e.data_inicio!;
  return e.data_fim && /^\d{4}-\d{2}-\d{2}$/.test(e.data_fim) && e.data_fim > ini ? e.data_fim : ini;
}

/**
 * Já terminou? Usado só pelo período "já aconteceram", que NÃO pode usar a
 * sobreposição de intervalo: uma feira que começou ontem e termina amanhã
 * sobrepõe a janela do passado, mas não aconteceu — está acontecendo.
 */
export function jaTerminou(e: Pick<ProsEvento, 'data_inicio' | 'data_fim'>): boolean {
  const fim = fimDoEvento(e);
  return !!fim && fim < new Date().toISOString().slice(0, 10);
}

/** Está rolando agora? Começou e ainda não terminou. É o mais urgente que existe. */
export function emAndamento(e: Pick<ProsEvento, 'data_inicio' | 'data_fim'>): boolean {
  if (!temDataExata(e)) return false;
  const hoje = new Date().toISOString().slice(0, 10);
  return e.data_inicio! <= hoje && fimDoEvento(e)! >= hoje;
}

/** É oportunidade quente? urgente + cota aberta + fit alto. É o recorte que cabe numa semana. */
export function ehQuente(e: Pick<ProsEvento, 'urgencia' | 'cota' | 'fit'>): boolean {
  return e.urgencia === 'urgente' && e.cota === 'aberta' && (e.fit ?? 0) >= 4;
}

/** Índice marca (minúscula) -> contatos, pra cruzar evento com quem já foi mapeado. */
export function indexarContatos(cts: ProsContato[]): Map<string, ProsContato[]> {
  const m = new Map<string, ProsContato[]>();
  for (const c of cts) {
    const k = (c.marca ?? '').toLowerCase().trim();
    if (!k) continue;
    const arr = m.get(k);
    if (arr) arr.push(c);
    else m.set(k, [c]);
  }
  return m;
}

/** Índice id do evento -> nome, porque a aba Marcas guarda só os ids. */
export function indexarNomes(evs: Pick<ProsEvento, 'id' | 'nome'>[]): Map<string, string> {
  return new Map(evs.map((e) => [e.id, e.nome]));
}

export function rotularEventos(ids: string | null, nomes: Map<string, string>): string[] {
  return lista(ids).map((id) => nomes.get(id) ?? id.replace(/-20\d\d$/, '').replace(/-/g, ' '));
}

/* ---------- Devolutiva pro robô ---------- */

function campoCsv(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV com `id` + as colunas ✏️, pra quem opera o robô reinjetar na base dele.
 *
 * Separador ";" e BOM porque o destino provável é o Excel em pt-BR, que com
 * vírgula joga tudo numa coluna só e sem BOM come os acentos.
 */
export function csvDevolutiva(evs: ProsEvento[], cts: ProsContato[]): string {
  const linhas: string[] = ['aba;id;status;responsavel;notas'];
  for (const e of evs) {
    linhas.push(['Eventos', e.id, e.status_comercial, e.responsavel, e.notas].map(campoCsv).join(';'));
  }
  for (const c of cts) {
    linhas.push(['Contatos', c.id, c.status_contato, '', c.notas].map(campoCsv).join(';'));
  }
  return `﻿${linhas.join('\r\n')}\r\n`;
}

/** Dispara o download de um texto como arquivo, sem passar por servidor. */
export function baixarArquivo(nome: string, conteudo: string, tipo = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export type { ProsEvento, ProsMarca, ProsContato };
