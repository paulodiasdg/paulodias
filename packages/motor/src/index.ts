/**
 * Motor de cálculo do No Azul: funções puras, sem banco, rede, tela ou relógio. Valores em
 * centavos inteiros; a data de hoje sempre entra como parâmetro.
 */
export type { Arredondamento } from './aritmetica';
export { CONFIG_SAUDE, type ConfigSaude, type FaixaDeSaude } from './config/saude';
export {
  entraNaReservaDeContas,
  entraNoOrcamento,
  estavaEmAberto,
  listarContas,
  type Conta,
} from './contas';
export * from './datas';
export { centavos, dividir, paraCimaEmReais, proporcao, somar, type Centavos } from './dinheiro';
export { gastoVariavelEntre, limiteDeGastos, limiteMensal, type LimiteDeGastos } from './limite';
export { planoDasMetas, type PlanoDaMeta, type PlanoDasMetas, type SituacaoDaMeta } from './metas';
export { aportesEntre, saldoEm, saldoNoInicioDaSemana, type Destino } from './movimentos';
export {
  desfazerPagamento,
  pagarConta,
  planoDePagamento,
  registrarAporte,
  valorDoAjuste,
  valorSacadoAoPagar,
  type NovoAporte,
  type PlanoDePagamento,
} from './operacoes';
export {
  ehGastoVariavel,
  gastoVariavelNoMes,
  orcamentoDoMes,
  type EstimativaDeVariaveis,
  type OrcamentoDoMes,
} from './orcamento';
export { chaveDaOcorrencia, projetarOcorrencias, type OcorrenciaProjetada } from './recorrencias';
export {
  calcularReservaContas,
  motivosDaMudanca,
  SEMANAS_DO_HORIZONTE,
  type MotivoDeMudanca,
  type ReservaDeContas,
  type SemanaDaReserva,
} from './reserva-contas';
export {
  indiceDeSaude,
  type ChaveDoComponente,
  type ComponenteDaSaude,
  type IndiceDeSaude,
} from './saude';
export { resumoDaSemana, type ResumoDaSemana } from './semana';
export {
  simularSemanas,
  type PagamentoSimulado,
  type ResultadoDaSimulacao,
  type SemanaSimulada,
} from './simulacao';
export type * from './tipos';
