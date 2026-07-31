import type { Etapa, Linha, TipoCliente, TipoAtividade } from './types';

export const ETAPAS: { id: Etapa; label: string; cor: string }[] = [
  { id: 'lead', label: 'Lead', cor: '#6f6580' },
  { id: 'qualificacao', label: 'Qualificação', cor: '#00bcd4' },
  { id: 'diagnostico', label: 'Diagnóstico', cor: '#7c4dff' },
  { id: 'proposta', label: 'Proposta', cor: '#f5a623' },
  { id: 'ganho', label: 'Ganho', cor: '#2ecc9b' },
  { id: 'perdido', label: 'Perdido', cor: '#ff5e6c' },
  { id: 'standby', label: 'Stand-by', cor: '#a197b0' },
];

export const ETAPA_MAP = Object.fromEntries(ETAPAS.map((e) => [e.id, e]));

/** Etapas abertas (excluem ganho/perdido) usadas no cálculo do funil. */
export const ETAPAS_ABERTAS: Etapa[] = ['lead', 'qualificacao', 'diagnostico', 'proposta'];

export const LINHAS: { id: Linha; label: string; corBg: string; corTxt: string }[] = [
  { id: 'evento', label: 'Ativação em evento', corBg: 'rgba(124,77,255,.18)', corTxt: '#c3b0ff' },
  { id: 'plataforma', label: 'Plataforma de engajamento', corBg: 'rgba(0,188,212,.16)', corTxt: '#7fe3f0' },
  { id: 'publico', label: 'Setor público', corBg: 'rgba(46,204,155,.16)', corTxt: '#8ff0d3' },
  { id: 'corporativo', label: 'Corporativo/Agência', corBg: 'rgba(233,30,99,.16)', corTxt: '#ff9ab7' },
];

export const LINHA_MAP = Object.fromEntries(LINHAS.map((l) => [l.id, l]));

export const TIPOS_CLIENTE: { id: TipoCliente; label: string }[] = [
  { id: 'publico', label: 'Setor público' },
  { id: 'corporativo', label: 'Corporativo' },
  { id: 'agencia', label: 'Agência' },
];

export const TIPO_CLIENTE_MAP = Object.fromEntries(TIPOS_CLIENTE.map((t) => [t.id, t]));

/** Catálogo real da Suricatus (site + PDFs). */
export const SOLUCOES = [
  'Quiz Premiado',
  'Raspadinha Digital',
  'Pacman Customizado',
  'Caça ao Tesouro (QR)',
  'Quiz educacional customizado',
  'Plataforma de engajamento',
  'VR / AR',
  'Outro',
];

export const ORIGENS = ['Inbound (site)', 'Indicação', 'Feira/Evento', 'Prospecção ativa', 'Edital/Licitação'];

export const PROBABILIDADE_PADRAO: Record<Etapa, number> = {
  lead: 15,
  qualificacao: 25,
  diagnostico: 40,
  proposta: 60,
  ganho: 100,
  perdido: 0,
  standby: 20,
};

export const TIPOS_ATIVIDADE: { id: TipoAtividade; label: string; icone: string }[] = [
  { id: 'nota', label: 'Nota', icone: '📝' },
  { id: 'ligacao', label: 'Ligação', icone: '📞' },
  { id: 'reuniao', label: 'Reunião', icone: '🗓️' },
  { id: 'email', label: 'E-mail', icone: '✉️' },
  { id: 'whatsapp', label: 'WhatsApp', icone: '💬' },
  { id: 'proposta', label: 'Proposta', icone: '📄' },
];

export const TIPO_ATIVIDADE_MAP = Object.fromEntries(TIPOS_ATIVIDADE.map((t) => [t.id, t]));

export const MOTIVOS_PERDA = [
  'Sem verba / orçamento',
  'Escolheu concorrente',
  'Timing / adiado',
  'Sem retorno / esfriou',
  'Fora do perfil',
  'Preço',
  'Outro',
];

/** Dias sem atividade para um negócio ser considerado estagnado. */
export const DIAS_ESTAGNADO = 14;

export const ROLES: { id: 'admin' | 'editor' | 'leitor'; label: string; desc: string }[] = [
  { id: 'admin', label: 'Admin', desc: 'Acesso total + gerencia papéis da equipe' },
  { id: 'editor', label: 'Editor', desc: 'Cria e edita clientes, negócios e atividades' },
  { id: 'leitor', label: 'Leitor', desc: 'Só visualiza (não edita nada)' },
];
