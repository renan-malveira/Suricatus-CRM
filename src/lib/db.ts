import { supabase, BUCKET_ANEXOS } from './supabase';
import type {
  Cliente, Negocio, Atividade, Anexo, Contato, HistoricoEtapa, Profile, Role, Etapa, PlannerProjeto,
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

/** Todas as atividades, com negócio e cliente vinculados (para o registro de contatos). */
export async function listAtividadesGlobais(): Promise<Atividade[]> {
  const { data, error } = await supabase
    .from('atividades')
    .select('*, negocio:negocios(id, titulo, cliente_id, cliente:clientes(id, nome))')
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
