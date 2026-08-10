export type Etapa =
  | 'lead'
  | 'qualificacao'
  | 'diagnostico'
  | 'proposta'
  | 'ganho'
  | 'perdido'
  | 'standby';

export type Linha = 'evento' | 'plataforma' | 'publico' | 'corporativo';

export type TipoCliente = 'publico' | 'corporativo' | 'agencia';

export type Role = 'admin' | 'editor' | 'leitor';

export type TipoAtividade = 'nota' | 'ligacao' | 'reuniao' | 'email' | 'whatsapp' | 'proposta';

export interface Cliente {
  id: string;
  nome: string;
  tipo: TipoCliente;
  segmento: string | null;
  contato_nome: string | null;
  contato_cargo: string | null;
  email: string | null;
  telefone: string | null;
  uf: string | null;
  origem: string | null;
  responsavel: string | null;
  status: string | null;
  planner_project_id: string | null;
  created_at: string;
}

export interface Contato {
  id: string;
  cliente_id: string;
  nome: string;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  principal: boolean;
  created_at: string;
}

export interface Negocio {
  id: string;
  titulo: string;
  cliente_id: string | null;
  linha: Linha;
  solucao: string | null;
  valor: number;
  etapa: Etapa;
  probabilidade: number;
  responsavel: string | null;
  previsao_fechamento: string | null;
  proxima_acao: string | null;
  motivo_perda: string | null;
  fechado_em: string | null;
  planner_project_id: string | null;
  created_at: string;
  cliente?: Pick<Cliente, 'id' | 'nome' | 'tipo'> | null;
}

export interface PlannerProjeto {
  id: string;
  name: string;
}

export interface Atividade {
  id: string;
  negocio_id: string | null;
  cliente_id: string | null;
  tipo: TipoAtividade;
  descricao: string;
  autor: string | null;
  origem: 'crm' | 'planner';
  data_agendada: string | null;
  concluida: boolean;
  created_at: string;
  cliente?: { id: string; nome: string } | null;
  negocio?: {
    id: string;
    titulo: string;
    cliente_id: string | null;
    cliente?: { id: string; nome: string } | null;
  } | null;
}

export interface Anexo {
  id: string;
  negocio_id: string;
  nome: string;
  tamanho: number;
  storage_path: string;
  created_at: string;
}

export interface HistoricoEtapa {
  id: string;
  negocio_id: string;
  etapa_de: string | null;
  etapa_para: string;
  autor: string | null;
  created_at: string;
}

/* ---------- Radar de prospecção ---------- */

/** Status comercial de um evento/marca no radar (não é etapa do funil). */
export type StatusProspeccao = 'novo' | 'analisando' | 'abordado' | 'descartado';

/** Status de um contato do radar. */
export type StatusContatoPros = 'novo' | 'abordado' | 'respondeu' | 'descartado';

export interface ProsEvento {
  id: string;
  nome: string;
  edicao: string | null;
  setor: string | null;
  setores_secundarios: string | null;
  formato: string | null;
  status: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  precisao_data: string | null;
  urgencia: string | null;
  cidade: string | null;
  uf: string | null;
  local: string | null;
  site: string | null;
  fit: number | null;
  justificativa_fit: string | null;
  alvo: string | null;
  publico_estimado: string | null;
  organizador: string | null;
  organizador_site: string | null;
  email_comercial: string | null;
  telefone: string | null;
  patrocinio_pagina: string | null;
  cota: string | null;
  cota_prazo: string | null;
  area_expositiva: string | null;
  patrocinadores: string | null;
  expositores: string | null;
  marcas_pesquisadas: string | null;
  primeiro_visto: string | null;
  ultima_verificacao: string | null;
  proxima_revisita: string | null;
  fonte: string | null;
  status_comercial: StatusProspeccao;
  responsavel: string | null;
  notas: string | null;
  negocio_id: string | null;
  importado_em: string;
}

export interface ProsMarca {
  id: string;
  marca: string;
  setores: string | null;
  n_eventos: number | null;
  eventos: string | null;
  papeis: string | null;
  site: string | null;
  linkedin: string | null;
  status_busca: string | null;
  n_contatos: number | null;
  primeiro_visto: string | null;
  importado_em: string;
}

export interface ProsContato {
  id: string;
  marca: string | null;
  nome: string;
  cargo: string | null;
  area: string | null;
  nivel: string | null;
  prioridade: number | null;
  linkedin: string | null;
  email: string | null;
  telefone: string | null;
  confianca: string | null;
  fonte: string | null;
  tipo_fonte: string | null;
  primeiro_visto: string | null;
  status_contato: StatusContatoPros;
  notas: string | null;
  importado_em: string;
}

export interface ProsImportacao {
  id: string;
  arquivo: string | null;
  eventos: number;
  marcas: number;
  contatos: number;
  autor: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  nome: string | null;
  role: Role;
  created_at: string;
}
