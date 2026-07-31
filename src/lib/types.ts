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

export interface Profile {
  id: string;
  email: string | null;
  nome: string | null;
  role: Role;
  created_at: string;
}
