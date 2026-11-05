import type { Competencia, DataCivil } from './datas';
import type { Centavos } from './dinheiro';

/**
 * Dados de entrada do motor. Espelham as tabelas do banco (supabase/migrations), mas contêm
 * apenas o que já foi gravado e aprovado: nada que esteja em revisão de documento.
 */

export interface Perfil {
  /** Teto de gastos variáveis definido pela pessoa, ou null se não definiu. */
  tetoVariavelCentavos: Centavos | null;
  /** Dia em que a pessoa começou a usar o sistema (perfis.criado_em). */
  inicioEm?: DataCivil | null;
}

export interface Recorrencia {
  id: string;
  tipo: 'renda' | 'fixa';
  nome: string;
  valorCentavos: Centavos;
  /** Dia do vencimento ou recebimento; 31 vira o último dia nos meses menores. */
  dia: number;
  inicio: DataCivil;
  fim: DataCivil | null;
  ativa: boolean;
  rendaVariavel?: boolean;
  /** Fixa paga pela fatura do cartão (decisão D4). */
  pagaNoCartao?: boolean;
  categoriaId?: string | null;
}

export interface Ocorrencia {
  id: string;
  recorrenciaId: string;
  competencia: Competencia;
  valorCentavos: Centavos;
  status: 'pendente' | 'paga' | 'recebida';
  pagoEm: DataCivil | null;
}

export interface ContaAvulsa {
  id: string;
  nome: string;
  valorCentavos: Centavos;
  vencimento: DataCivil;
  /** Fatura cujos itens foram importados como lançamentos (decisão D4). */
  quitaItens: boolean;
  pagoEm: DataCivil | null;
  categoriaId?: string | null;
}

export interface Lancamento {
  id: string;
  data: DataCivil;
  descricao?: string;
  valorCentavos: Centavos;
  tipo: 'despesa' | 'receita' | 'transferencia';
  categoriaId?: string | null;
  /** Vínculo com uma conta: despesa vinculada não é gasto variável. */
  ocorrenciaId: string | null;
  contaAvulsaId: string | null;
  origem?: 'manual' | 'documento' | 'pagamento' | 'recebimento';
}

export interface Meta {
  id: string;
  nome: string;
  alvoCentavos: Centavos;
  prazo: DataCivil;
  prioridade: number;
  tipo: 'comum' | 'emergencia';
  concluidaEm: DataCivil | null;
}

export interface MovimentoReserva {
  id: string;
  data: DataCivil;
  tipo: 'aporte' | 'saque' | 'ajuste';
  destino: 'contas' | 'meta';
  metaId: string | null;
  /** Aporte e saque são positivos; ajuste pode ser positivo ou negativo. */
  valorCentavos: Centavos;
  ocorrenciaId: string | null;
  contaAvulsaId: string | null;
}

/** Categoria de lançamentos e contas; o grupo separa necessidades e desejos (50/30/20). */
export interface Categoria {
  id: string;
  nome: string;
  grupo: 'essencial' | 'livre' | 'receita' | 'transferencia';
}

export interface DadosFinanceiros {
  perfil: Perfil;
  recorrencias: readonly Recorrencia[];
  ocorrencias: readonly Ocorrencia[];
  contasAvulsas: readonly ContaAvulsa[];
  lancamentos: readonly Lancamento[];
  metas: readonly Meta[];
  movimentos: readonly MovimentoReserva[];
  /** Categorias da pessoa; sem elas, todo gasto conta como sem categoria. */
  categorias?: readonly Categoria[];
}
