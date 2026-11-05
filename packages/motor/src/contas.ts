import { somarDias, type Competencia, type DataCivil } from './datas';
import type { Centavos } from './dinheiro';
import { projetarOcorrencias } from './recorrencias';
import type { DadosFinanceiros } from './tipos';

/** Conta a pagar: ocorrência de despesa fixa ou conta avulsa. */
export interface Conta {
  /** `fixa:<recorrenciaId>:<AAAA-MM>` ou `avulsa:<id>`. */
  chave: string;
  origem: 'fixa' | 'avulsa';
  nome: string;
  valorCentavos: Centavos;
  vencimento: DataCivil;
  pagoEm: DataCivil | null;
  recorrenciaId: string | null;
  competencia: Competencia | null;
  ocorrenciaId: string | null;
  contaAvulsaId: string | null;
  /** Fatura com itens importados: entra na reserva, fica fora do orçamento (D4). */
  quitaItens: boolean;
  /** Fixa paga pela fatura do cartão: entra no orçamento, fica fora da reserva (D4). */
  pagaNoCartao: boolean;
  categoriaId: string | null;
}

/** Contas com vencimento até `ate` (e a partir de `de`, se informado), em ordem de vencimento. */
export function listarContas(
  dados: DadosFinanceiros,
  de: DataCivil | null,
  ate: DataCivil,
): Conta[] {
  const fixas: Conta[] = projetarOcorrencias(dados, 'fixa', de, ate).map((ocorrencia) => ({
    chave: `fixa:${ocorrencia.chave}`,
    origem: 'fixa',
    nome: ocorrencia.recorrencia.nome,
    valorCentavos: ocorrencia.valorCentavos,
    vencimento: ocorrencia.vencimento,
    pagoEm: ocorrencia.pagoEm,
    recorrenciaId: ocorrencia.recorrencia.id,
    competencia: ocorrencia.competencia,
    ocorrenciaId: ocorrencia.ocorrenciaId,
    contaAvulsaId: null,
    quitaItens: false,
    pagaNoCartao: ocorrencia.recorrencia.pagaNoCartao ?? false,
    categoriaId: ocorrencia.recorrencia.categoriaId ?? null,
  }));

  const avulsas: Conta[] = dados.contasAvulsas
    .filter((conta) => (de === null || conta.vencimento >= de) && conta.vencimento <= ate)
    .map((conta) => ({
      chave: `avulsa:${conta.id}`,
      origem: 'avulsa',
      nome: conta.nome,
      valorCentavos: conta.valorCentavos,
      vencimento: conta.vencimento,
      pagoEm: conta.pagoEm,
      recorrenciaId: null,
      competencia: null,
      ocorrenciaId: null,
      contaAvulsaId: conta.id,
      quitaItens: conta.quitaItens,
      pagaNoCartao: false,
      categoriaId: conta.categoriaId ?? null,
    }));

  return [...fixas, ...avulsas].sort(
    (a, b) => a.vencimento.localeCompare(b.vencimento) || a.chave.localeCompare(b.chave),
  );
}

/** Conta que precisa de dinheiro da reserva de contas (fixa paga no cartão sai pela fatura). */
export function entraNaReservaDeContas(conta: Conta): boolean {
  return !conta.pagaNoCartao;
}

/** Conta que entra nas fixas e avulsas do orçamento (fatura com itens importados não entra). */
export function entraNoOrcamento(conta: Conta): boolean {
  return !conta.quitaItens;
}

/** A conta estava em aberto na data (pagamentos feitos nesse dia ou depois não contam). */
export function estavaEmAberto(conta: Conta, data: DataCivil): boolean {
  return conta.pagoEm === null || conta.pagoEm >= data;
}

/**
 * Conta vencida: em aberto e com vencimento antes de hoje. Fixa paga no cartão não conta, porque
 * sai pela fatura (é a mesma regra do índice de saúde e do alerta do painel).
 */
export function contasVencidas(dados: DadosFinanceiros, hoje: DataCivil): Conta[] {
  return listarContas(dados, null, somarDias(hoje, -1)).filter(
    (conta) => entraNaReservaDeContas(conta) && conta.pagoEm === null,
  );
}

/** Quantos dias o painel mostra em "próximas contas", contando hoje. */
export const DIAS_DAS_PROXIMAS_CONTAS = 14;

/** Contas em aberto com vencimento até os próximos 14 dias, incluindo as vencidas. */
export function proximasContas(dados: DadosFinanceiros, hoje: DataCivil): Conta[] {
  return listarContas(dados, null, somarDias(hoje, DIAS_DAS_PROXIMAS_CONTAS - 1)).filter(
    (conta) => conta.pagoEm === null,
  );
}
