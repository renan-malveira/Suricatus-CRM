import { supabase, BUCKET_ANEXOS } from './supabase';
import type {
  Cliente, Negocio, Atividade, Anexo, Contato, HistoricoEtapa, Profile, Role, Etapa, PlannerProjeto,
  ProsEvento, ProsMarca, ProsContato, ProsImportacao,
} from './types';
import { PROBABILIDADE_PADRAO } from './constants';

/* ---------- Clientes ---------- */

export async function listClientes(): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createCliente(c: Partial<Cliente>): Promise<Cliente> {
  const { data, error } = await supabase.from('clientes').insert(c).select().single();
  if (error) throw error;
  return data;
}

export async function updateCliente(id: string, c: Partial<Cliente>): Promise<void> {
  const { error } = await supabase.from('clientes').update(c).eq('id', id);
  if (error) throw error;
}

export async function deleteCliente(id: string): Promise<void> {
  const { error } = await supabase.from('clientes').delete().eq('id', id);
  if (error) throw error;
}

/* ---------- Negócios ---------- */

const NEGOCIO_SELECT = '*, cliente:clientes(id, nome, tipo)';

export async function listNegocios(): Promise<Negocio[]> {
  const { data, error } = await supabase
    .from('negocios')
    .select(NEGOCIO_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as Negocio[]) ?? [];
}

export async function getNegocio(id: string): Promise<Negocio | null> {
  const { data, error } = await supabase
    .from('negocios')
    .select(NEGOCIO_SELECT)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as unknown as Negocio;
}

export async function createNegocio(n: Partial<Negocio>): Promise<Negocio> {
  const payload = { ...n };
  delete (payload as { cliente?: unknown }).cliente;
  const { data, error } = await supabase.from('negocios').insert(payload).select(NEGOCIO_SELECT).single();
  if (error) throw error;
  return data as unknown as Negocio;
}

export async function updateNegocio(id: string, n: Partial<Negocio>): Promise<void> {
  const payload = { ...n };
  delete (payload as { cliente?: unknown }).cliente;
  const { error } = await supabase.from('negocios').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteNegocio(id: string): Promise<void> {
  const { error } = await supabase.from('negocios').delete().eq('id', id);
  if (error) throw error;
}

/** Move um negócio de etapa: atualiza etapa/probabilidade/fechamento e grava o histórico. */
export async function moverEtapa(
  neg: Negocio,
  novaEtapa: Etapa,
  autor: string | null,
  motivoPerda?: string | null,
): Promise<void> {
  if (neg.etapa === novaEtapa) return;
  const fechou = novaEtapa === 'ganho' || novaEtapa === 'perdido';
  const patch: Partial<Negocio> = {
    etapa: novaEtapa,
    probabilidade: PROBABILIDADE_PADRAO[novaEtapa],
    fechado_em: fechou ? new Date().toISOString() : null,
    motivo_perda: novaEtapa === 'perdido' ? motivoPerda ?? null : null,
  };
  const { error } = await supabase.from('negocios').update(patch).eq('id', neg.id);
  if (error) throw error;
  await registrarHistorico(neg.id, neg.etapa, novaEtapa, autor);
}

export async function registrarHistorico(
  negocioId: string,
  de: string | null,
  para: string,
  autor: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('negocio_etapa_historico')
    .insert({ negocio_id: negocioId, etapa_de: de, etapa_para: para, autor });
  if (error) throw error;
}

export async function listHistorico(negocioId: string): Promise<HistoricoEtapa[]> {
  const { data, error } = await supabase
    .from('negocio_etapa_historico')
    .select('*')
    .eq('negocio_id', negocioId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listTodoHistorico(): Promise<HistoricoEtapa[]> {
  const { data, error } = await supabase.from('negocio_etapa_historico').select('*');
  if (error) throw error;
  return data ?? [];
}

/* ---------- Atividades ---------- */

export async function listAtividades(negocioId: string): Promise<Atividade[]> {
  const { data, error } = await supabase
    .from('atividades')
    .select('*')
    .eq('negocio_id', negocioId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Atividades de um negócio + as atividades no nível do cliente (negocio_id nulo),
 * para que anotações vindas do Planner (que são do cliente) apareçam no negócio.
 */
export async function listAtividadesDoNegocio(negocioId: string, clienteId: string | null): Promise<Atividade[]> {
  let q = supabase.from('atividades').select('*');
  if (clienteId) {
    q = q.or(`negocio_id.eq.${negocioId},and(cliente_id.eq.${clienteId},negocio_id.is.null)`);
  } else {
    q = q.eq('negocio_id', negocioId);
  }
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as Atividade[]) ?? [];
}

export async function createAtividade(a: Partial<Atividade>): Promise<Atividade> {
  const { data, error } = await supabase.from('atividades').insert(a).select().single();
  if (error) throw error;
  return data;
}

/* ---------- Anexos (Supabase Storage) ---------- */

export async function listAnexos(negocioId: string): Promise<Anexo[]> {
  const { data, error } = await supabase
    .from('anexos')
    .select('*')
    .eq('negocio_id', negocioId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function uploadAnexo(negocioId: string, file: File): Promise<Anexo> {
  const path = `${negocioId}/${Date.now()}-${file.name}`;
  const up = await supabase.storage.from(BUCKET_ANEXOS).upload(path, file);
  if (up.error) throw up.error;

  const { data, error } = await supabase
    .from('anexos')
    .insert({ negocio_id: negocioId, nome: file.name, tamanho: file.size, storage_path: path })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Gera uma URL assinada temporária para baixar o arquivo. */
export async function urlDownload(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_ANEXOS)
    .createSignedUrl(path, 60 * 5, { download: true });
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteAnexo(anexo: Anexo): Promise<void> {
  await supabase.storage.from(BUCKET_ANEXOS).remove([anexo.storage_path]);
  const { error } = await supabase.from('anexos').delete().eq('id', anexo.id);
  if (error) throw error;
}

/* ---------- Contatos ---------- */

export async function listContatos(clienteId: string): Promise<Contato[]> {
  const { data, error } = await supabase
    .from('contatos')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('principal', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createContato(c: Partial<Contato>): Promise<Contato> {
  const { data, error } = await supabase.from('contatos').insert(c).select().single();
  if (error) throw error;
  return data;
}

export async function updateContato(id: string, c: Partial<Contato>): Promise<void> {
  const { error } = await supabase.from('contatos').update(c).eq('id', id);
  if (error) throw error;
}

export async function deleteContato(id: string): Promise<void> {
  const { error } = await supabase.from('contatos').delete().eq('id', id);
  if (error) throw error;
}

/* ---------- Agenda de atividades ---------- */

export async function concluirAtividade(id: string, concluida: boolean): Promise<void> {
  const { error } = await supabase.from('atividades').update({ concluida }).eq('id', id);
  if (error) throw error;
}

/** Todas as atividades, com cliente e negócio vinculados (para o registro de contatos). */
export async function listAtividadesGlobais(): Promise<Atividade[]> {
  const { data, error } = await supabase
    .from('atividades')
    .select('*, cliente:clientes(id, nome), negocio:negocios(id, titulo, cliente_id, cliente:clientes(id, nome))')
    .order('data_agendada', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as Atividade[]) ?? [];
}

/** Map negocio_id -> data da última atividade (para detectar estagnados). */
export async function ultimaAtividadePorNegocio(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('atividades')
    .select('negocio_id, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const m = new Map<string, string>();
  for (const a of data ?? []) if (!m.has(a.negocio_id)) m.set(a.negocio_id, a.created_at);
  return m;
}

/* ---------- Perfis / papéis ---------- */

export async function getMeuProfile(): Promise<Profile | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', auth.user.id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function updateRole(id: string, role: Role): Promise<void> {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
  if (error) throw error;
}

/* ---------- Radar de prospecção ---------- */

/**
 * O Supabase corta em 1000 linhas por resposta por padrão. A base tem ~3.800
 * marcas, então sem paginar a aba Marcas viria silenciosamente truncada.
 */
const PAGINA = 1000;

async function lerTudo<T>(tabela: string, ordenar: string, asc = true): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase
      .from(tabela)
      .select('*')
      .order(ordenar, { ascending: asc, nullsFirst: false })
      .range(de, de + PAGINA - 1);
    if (error) throw error;
    const lote = (data ?? []) as T[];
    out.push(...lote);
    if (lote.length < PAGINA) return out;
  }
}

export function listProsEventos(): Promise<ProsEvento[]> {
  return lerTudo<ProsEvento>('pros_eventos', 'data_inicio');
}

export function listProsMarcas(): Promise<ProsMarca[]> {
  return lerTudo<ProsMarca>('pros_marcas', 'n_eventos', false);
}

export function listProsContatos(): Promise<ProsContato[]> {
  return lerTudo<ProsContato>('pros_contatos', 'prioridade');
}

export async function updateProsEvento(id: string, patch: Partial<ProsEvento>): Promise<void> {
  const { error } = await supabase.from('pros_eventos').update(patch).eq('id', id);
  if (error) throw error;
}

export async function updateProsContato(id: string, patch: Partial<ProsContato>): Promise<void> {
  const { error } = await supabase.from('pros_contatos').update(patch).eq('id', id);
  if (error) throw error;
}

export async function ultimaImportacao(): Promise<ProsImportacao | null> {
  const { data, error } = await supabase
    .from('pros_importacoes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Manda as linhas da planilha pro banco em lotes, via as funções pros_upsert_*.
 * São elas que garantem que as colunas comerciais não sejam sobrescritas —
 * por isso NÃO usar supabase.from(...).upsert() aqui.
 */
async function enviarLote(
  fn: 'pros_upsert_eventos' | 'pros_upsert_marcas' | 'pros_upsert_contatos',
  linhas: Record<string, unknown>[],
  aoProgredir?: (feitas: number) => void,
): Promise<number> {
  const TAM = 400;
  let total = 0;
  for (let i = 0; i < linhas.length; i += TAM) {
    const fatia = linhas.slice(i, i + TAM);
    const { error } = await supabase.rpc(fn, { linhas: fatia });
    if (error) throw error;
    total += fatia.length;
    aoProgredir?.(total);
  }
  return total;
}

export interface ResultadoImport {
  eventos: number;
  marcas: number;
  contatos: number;
}

export async function importarProspeccao(
  p: { eventos: Record<string, unknown>[]; marcas: Record<string, unknown>[]; contatos: Record<string, unknown>[] },
  arquivo: string,
  autor: string | null,
  aoProgredir?: (etapa: string, feitas: number, total: number) => void,
): Promise<ResultadoImport> {
  const eventos = await enviarLote('pros_upsert_eventos', p.eventos, (n) =>
    aoProgredir?.('Eventos', n, p.eventos.length));
  const marcas = await enviarLote('pros_upsert_marcas', p.marcas, (n) =>
    aoProgredir?.('Marcas', n, p.marcas.length));
  const contatos = await enviarLote('pros_upsert_contatos', p.contatos, (n) =>
    aoProgredir?.('Contatos', n, p.contatos.length));

  const { error } = await supabase
    .from('pros_importacoes')
    .insert({ arquivo, eventos, marcas, contatos, autor });
  if (error) throw error; // o log falhou, mas os dados entraram — melhor a pessoa saber
  return { eventos, marcas, contatos };
}

/**
 * Promove um evento do radar a negócio no funil.
 * Reusa cliente + negócio existentes: o "cliente" é o ORGANIZADOR do evento
 * (é com ele que se negocia a ativação), e o negócio nasce em `lead` na linha
 * de ativação em evento. Se já existir cliente com o mesmo nome, reaproveita
 * em vez de duplicar.
 */
export async function promoverEvento(
  ev: ProsEvento,
  responsavel: string | null,
): Promise<{ negocioId: string; clienteId: string; clienteNovo: boolean }> {
  const nomeCliente = ev.organizador?.trim() || ev.nome;

  const { data: existentes, error: buscaErr } = await supabase
    .from('clientes')
    .select('id')
    .ilike('nome', nomeCliente)
    .limit(1);
  if (buscaErr) throw buscaErr;

  let clienteId = existentes?.[0]?.id as string | undefined;
  const clienteNovo = !clienteId;

  if (!clienteId) {
    const cliente = await createCliente({
      nome: nomeCliente,
      tipo: 'corporativo',
      segmento: ev.setor,
      email: ev.email_comercial,
      telefone: ev.telefone,
      uf: ev.uf,
      origem: 'Prospecção ativa',
      responsavel,
      status: 'Lead',
    });
    clienteId = cliente.id;
    // Mesmo comportamento do cadastro manual de cliente: abre o projeto no
    // Planner. Melhor-esforço — se falhar, o negócio ainda tem que nascer.
    try {
      const projetoId = await criarProjetoNoPlanner(nomeCliente);
      await updateCliente(clienteId, { planner_project_id: projetoId });
    } catch (e) {
      console.warn('Não criou o projeto no Planner:', e);
    }
  }

  const quando = ev.data_inicio ? ` — ${ev.data_inicio.split('-').reverse().join('/')}` : '';
  const negocio = await createNegocio({
    titulo: `${ev.nome}${quando}`,
    cliente_id: clienteId,
    linha: 'evento',
    etapa: 'lead',
    probabilidade: PROBABILIDADE_PADRAO.lead,
    valor: 0,
    responsavel,
    previsao_fechamento: ev.data_inicio && /^\d{4}-\d{2}-\d{2}$/.test(ev.data_inicio) ? ev.data_inicio : null,
    proxima_acao: ev.cota === 'aberta' ? 'Falar com o organizador sobre a cota de patrocínio' : 'Qualificar o evento',
  });

  await registrarHistorico(negocio.id, null, 'lead', responsavel);

  // Deixa no negócio o que o robô descobriu, pra ninguém ter que voltar no radar.
  const contexto = [
    `Veio do radar de prospecção (evento ${ev.id}).`,
    ev.local ? `Local: ${ev.local}` : null,
    ev.publico_estimado ? `Público estimado: ${ev.publico_estimado}` : null,
    ev.cota ? `Cota de patrocínio: ${ev.cota}${ev.cota_prazo ? ` (prazo ${ev.cota_prazo})` : ''}` : null,
    ev.site ? `Site: ${ev.site}` : null,
    ev.patrocinio_pagina ? `Patrocínio: ${ev.patrocinio_pagina}` : null,
    ev.justificativa_fit ? `Fit ${ev.fit}/5 — ${ev.justificativa_fit}` : null,
  ].filter(Boolean).join('\n');

  await createAtividade({
    negocio_id: negocio.id,
    cliente_id: clienteId,
    tipo: 'nota',
    descricao: contexto,
    autor: responsavel,
    origem: 'crm',
  });

  await updateProsEvento(ev.id, { negocio_id: negocio.id, status_comercial: 'abordado' });

  return { negocioId: negocio.id, clienteId, clienteNovo };
}

/* ---------- Integração com o Suricatus Planner ---------- */

const PLANNER_ROW_ID = 'main';

/** Lê a lista de projetos do planner (todos moram no doc JSON da linha 'main' de projects). */
export async function listPlannerProjetos(): Promise<PlannerProjeto[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('data')
    .eq('id', PLANNER_ROW_ID)
    .maybeSingle();
  if (error) throw error;
  const projetos = (data?.data?.projects ?? []) as { id: string; name: string }[];
  return projetos
    .filter((p) => p && p.id)
    .map((p) => ({ id: p.id, name: p.name ?? '(sem nome)' }));
}

/** Mesmo formato de id que o planner usa (uid()). */
function gerarUidPlanner(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * Cria um projeto novo no Planner (coluna TO-DO) a partir de um cliente do CRM.
 * Lê o doc atual, adiciona o projeto e grava de volta (mesmo padrão do saveData do planner).
 * Retorna o id do projeto criado.
 */
export async function criarProjetoNoPlanner(nome: string): Promise<string> {
  const { data, error } = await supabase
    .from('projects')
    .select('data')
    .eq('id', PLANNER_ROW_ID)
    .maybeSingle();
  if (error) throw error;

  const doc = (data?.data ?? {}) as { projects?: unknown[]; [k: string]: unknown };
  const projetos = Array.isArray(doc.projects) ? doc.projects : [];
  const id = gerarUidPlanner();
  projetos.push({
    id, name: nome, status: 'TODO', team: [], milestones: [], log: [], tasks: [], origem: 'crm',
  });
  doc.projects = projetos;

  const { error: upErr } = await supabase
    .from('projects')
    .upsert({ id: PLANNER_ROW_ID, data: doc, updated_at: new Date().toISOString() });
  if (upErr) throw upErr;
  return id;
}
