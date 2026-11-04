/**
 * Motor de cálculo do No Azul: funções puras, sem banco, rede, tela ou relógio. Valores em
 * centavos inteiros; a data de hoje sempre entra como parâmetro.
 */
export type { Arredondamento } from './aritmetica.js';
export { CONFIG_SAUDE, type ConfigSaude, type FaixaDeSaude } from './config/saude.js';
export {
  entraNaReservaDeContas,
  entraNoOrcamento,
  estavaEmAberto,
  listarContas,
  type Conta,
} from './contas.js';
export * from './datas.js';
export { centavos, dividir, paraCimaEmReais, proporcao, somar, type Centavos } from './dinheiro.js';
export { gastoVariavelEntre, limiteDeGastos, limiteMensal, type LimiteDeGastos } from './limite.js';
export {
  planoDasMetas,
  type PlanoDaMeta,
  type PlanoDasMetas,
  type SituacaoDaMeta,
} from './metas.js';
export { aportesEntre, saldoEm, saldoNoInicioDaSemana, type Destino } from './movimentos.js';
export {
  desfazerPagamento,
  pagarConta,
  registrarAporte,
  valorSacadoAoPagar,
  type NovoAporte,
} from './operacoes.js';
export {
  ehGastoVariavel,
  gastoVariavelNoMes,
  orcamentoDoMes,
  type EstimativaDeVariaveis,
  type OrcamentoDoMes,
} from './orcamento.js';
export {
  chaveDaOcorrencia,
  projetarOcorrencias,
  type OcorrenciaProjetada,
} from './recorrencias.js';
export {
  calcularReservaContas,
  motivosDaMudanca,
  SEMANAS_DO_HORIZONTE,
  type MotivoDeMudanca,
  type ReservaDeContas,
  type SemanaDaReserva,
} from './reserva-contas.js';
export {
  indiceDeSaude,
  type ChaveDoComponente,
  type ComponenteDaSaude,
  type IndiceDeSaude,
} from './saude.js';
export { resumoDaSemana, type ResumoDaSemana } from './semana.js';
export {
  simularSemanas,
  type PagamentoSimulado,
  type ResultadoDaSimulacao,
  type SemanaSimulada,
} from './simulacao.js';
export type * from './tipos.js';
