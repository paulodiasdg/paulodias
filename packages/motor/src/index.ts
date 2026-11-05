/**
 * Motor de cálculo do No Azul: funções puras, sem banco, rede, tela ou relógio. Valores em
 * centavos inteiros; a data de hoje sempre entra como parâmetro.
 */
export { alertasDaSemana, type Alerta } from './alertas';
export type { Arredondamento } from './aritmetica';
export {
  comparacao503020,
  mesDaComparacao503020,
  REFERENCIA_50_30_20,
  type ChaveDoGrupo,
  type Comparacao503020,
  type GrupoDaComparacao,
} from './comparacao-50-30-20';
export { CONFIG_SAUDE, type ConfigSaude, type FaixaDeSaude } from './config/saude';
export {
  contasVencidas,
  DIAS_DAS_PROXIMAS_CONTAS,
  entraNaReservaDeContas,
  entraNoOrcamento,
  estavaEmAberto,
  listarContas,
  proximasContas,
  type Conta,
} from './contas';
export * from './datas';
export { centavos, dividir, paraCimaEmReais, proporcao, somar, type Centavos } from './dinheiro';
export {
  gastosDaSemana,
  SEMANAS_DE_COMPARACAO,
  type GastoDaSemana,
  type GastoPorCategoria,
  type GastosDaSemana,
} from './gastos';
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
export {
  agendaDeReservas,
  divisaoDoMes,
  MESES_DA_PROJECAO,
  projecaoDeMeses,
  SEMANAS_DA_AGENDA,
  simularPlano,
  type AporteNaMeta,
  type ChaveDaParte,
  type DivisaoDoMes,
  type ParteDaDivisao,
  type SemanaDoPlano,
} from './plano';
export { chaveDaOcorrencia, projetarOcorrencias, type OcorrenciaProjetada } from './recorrencias';
export { ritmoDoMes, type RitmoDoMes } from './ritmo';
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
  type MedidaParaExibir,
} from './saude';
export {
  resumoDaSemana,
  semanaPassada,
  semanasNavegaveis,
  type ContaPagaNaSemana,
  type ResumoDaSemana,
  type SemanaPassada,
} from './semana';
export {
  simularSemanas,
  type PagamentoSimulado,
  type ResultadoDaSimulacao,
  type SemanaSimulada,
} from './simulacao';
export type * from './tipos';
