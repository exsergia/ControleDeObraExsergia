export type ObraStatus = 'Ativa' | 'Concluída' | 'Pausada';
export type MaterialStatus = 'Pendente' | 'Conferido' | 'Divergente';

export interface Obra {
  id: string;
  nome: string;
  cliente?: string;
  endereco?: string;
  responsavel?: string;
  centroCusto?: string;
  status: ObraStatus;
  operadoresIds?: string[];
  equipe?: { operatorId: string; nivel: string }[];
  createdAt: any;
}

export interface Material {
  id: string;
  obraId: string;
  codigoEntrega: string;
  descricao: string;
  unidade: string;
  categoria: string;
  fornecedor: string;
  quantidade: number;
  precoUnitario: number;
  valorTotal: number;
  dataEntrega: any;
  observacoes?: string;
  statusConferencia: MaterialStatus;
  photoUrl?: string;
}

export interface Operator {
  id: string;
  nome: string;
  sobrenome?: string;
  funcao?: string;
  email: string;
  telefone?: string;
  cpf?: string;
  role: 'admin' | 'operator';
}

export interface Atividade {
  id: string;
  obraId: string;
  descricao: string;
  unidade: string;
  quantidadePrevista: number;
  quantidadeExecutada: number;
  percentual: number;
  valorUnitario?: number;
  equipeResponsavel?: string;
}

export interface Attachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface Tool {
  id: string;
  nome: string;
  codigo?: string;
  modelo?: string;
  valor?: number;
  dataCompra?: string;
  descricao?: string;
  status: 'Disponível' | 'Em Uso' | 'Manutenção';
  lastLogId?: string;
}

export interface ToolLog {
  id: string;
  toolId: string;
  obraId: string;
  responsavelNome: string;
  responsavelId?: string;
  responsavelEmail?: string;
  dataSaida: any;
  dataDevolucao?: any;
  fotoDevolucaoUrl?: string;
  statusLog: 'Aberta' | 'Concluída';
  movementHash?: string;
  activityId?: string;
}

export interface Checklist {
  id: string;
  obraId: string;
  operatorId: string;
  data: any;
  nomeResponsavel: string;
  observacoes?: string;
  photoUrl?: string;
  attachments?: Attachment[];
  equipeIds?: string[];
  materiais: { materialId: string; qtdConferida: number }[];
  progresso: { atividadeId: string; qtdExecutadaNoDia: number }[];
}
