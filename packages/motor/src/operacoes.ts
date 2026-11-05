import type { Conta } from './contas';
import type { DataCivil } from './datas';
import type { Centavos } from './dinheiro';
import { saldoEm } from './movimentos';
import { chaveDaOcorrencia } from './recorrencias';
import type { DadosFinanceiros, Lancamento, MovimentoReserva, Ocorrencia } from './tipos';

/**
 * Operações puras sobre os dados: devolvem uma cópia alterada, como o banco ficaria depois da
 * transação. O app grava as mesmas mudanças em uma única transação (funções do banco em
 * supabase/migrations), usando planoDePagamento para saber o que gravar.
 */

/** Ao pagar uma conta, sai da reserva o menor valor entre a conta e o saldo (regra 3.1). */
export function valorSacadoAoPagar(valorDaConta: Centavos, saldo: Centavos): Centavos {
  return Math.min(valorDaConta, Math.max(0, saldo));
}

/** O que o pagamento de uma conta grava, além de marcar a conta como paga. */
export interface PlanoDePagamento {
  valorCentavos: Centavos;
  /** Tipo do lançamento do pagamento, ou null quando não há lançamento (fixa paga no cartão). */
  tipoDoLancamento: 'despesa' | 'transferencia' | null;
  /** Quanto sai da reserva de contas. */
  saqueCentavos: Centavos;
}

/**
 * Regras do pagamento: a fatura com itens importados vira transferência (regra 4.4); a fixa paga
 * no cartão não sai da reserva nem gera lançamento, porque o dinheiro e o gasto saem pela fatura
 * (D4); nas demais, sai da reserva o menor valor entre a conta e o saldo do dia do pagamento.
 */
export function planoDePagamento(
  dados: DadosFinanceiros,
  conta: Conta,
  data: DataCivil,
): PlanoDePagamento {
  if (conta.pagoEm !== null) throw new Error(`A conta "${conta.nome}" já está paga.`);
  if (!Number.isSafeInteger(conta.valorCentavos) || conta.valorCentavos < 0) {
    throw new RangeError('O valor pago precisa ser zero ou positivo, em centavos.');
  }
  if (conta.pagaNoCartao) {
    return { valorCentavos: conta.valorCentavos, tipoDoLancamento: null, saqueCentavos: 0 };
  }
  return {
    valorCentavos: conta.valorCentavos,
    tipoDoLancamento: conta.quitaItens ? 'transferencia' : 'despesa',
    saqueCentavos: valorSacadoAoPagar(
      conta.valorCentavos,
      saldoEm(dados.movimentos, { destino: 'contas' }, data),
    ),
  };
}

/** Ajuste que leva o saldo atual ao saldo informado pela pessoa (saldos só mudam por movimento). */
export function valorDoAjuste(saldoAtual: Centavos, saldoCorreto: Centavos): Centavos {
  if (!Number.isSafeInteger(saldoAtual) || !Number.isSafeInteger(saldoCorreto)) {
    throw new RangeError('Saldos precisam ser centavos inteiros.');
  }
  return saldoCorreto - saldoAtual;
}

export interface NovoAporte {
  id: string;
  data: DataCivil;
  valorCentavos: Centavos;
  metaId?: string;
}

/** Registra um aporte na reserva de contas ou, com `metaId`, em uma meta. */
export function registrarAporte(dados: DadosFinanceiros, aporte: NovoAporte): DadosFinanceiros {
  if (!Number.isSafeInteger(aporte.valorCentavos) || aporte.valorCentavos <= 0) {
    throw new RangeError('O aporte precisa ser um valor positivo em centavos.');
  }
  const movimento: MovimentoReserva = {
    id: aporte.id,
    data: aporte.data,
    tipo: 'aporte',
    destino: aporte.metaId ? 'meta' : 'contas',
    metaId: aporte.metaId ?? null,
    valorCentavos: aporte.valorCentavos,
    ocorrenciaId: null,
    contaAvulsaId: null,
  };
  return { ...dados, movimentos: [...dados.movimentos, movimento] };
}

function idDaOcorrencia(dados: DadosFinanceiros, conta: Conta): string {
  const existente = dados.ocorrencias.find(
    (ocorrencia) =>
      ocorrencia.recorrenciaId === conta.recorrenciaId &&
      ocorrencia.competencia === conta.competencia,
  );
  return (
    existente?.id ?? `ocorrencia:${chaveDaOcorrencia(conta.recorrenciaId!, conta.competencia!)}`
  );
}

/** Paga a conta: grava o pagamento e, conforme o planoDePagamento, o lançamento e o saque. */
export function pagarConta(
  dados: DadosFinanceiros,
  conta: Conta,
  data: DataCivil,
): DadosFinanceiros {
  const plano = planoDePagamento(dados, conta, data);

  const vinculo =
    conta.origem === 'fixa'
      ? { ocorrenciaId: idDaOcorrencia(dados, conta), contaAvulsaId: null }
      : { ocorrenciaId: null, contaAvulsaId: conta.contaAvulsaId };

  let ocorrencias = dados.ocorrencias;
  let contasAvulsas = dados.contasAvulsas;
  if (conta.origem === 'fixa') {
    const paga: Ocorrencia = {
      id: vinculo.ocorrenciaId!,
      recorrenciaId: conta.recorrenciaId!,
      competencia: conta.competencia!,
      valorCentavos: conta.valorCentavos,
      status: 'paga',
      pagoEm: data,
    };
    ocorrencias = [...dados.ocorrencias.filter((o) => o.id !== paga.id), paga];
  } else {
    contasAvulsas = dados.contasAvulsas.map((avulsa) =>
      avulsa.id === conta.contaAvulsaId ? { ...avulsa, pagoEm: data } : avulsa,
    );
  }

  if (plano.tipoDoLancamento === null) return { ...dados, ocorrencias, contasAvulsas };

  const lancamento: Lancamento = {
    id: `pagamento:${conta.chave}`,
    data,
    descricao: conta.nome,
    valorCentavos: conta.valorCentavos,
    tipo: plano.tipoDoLancamento,
    ...vinculo,
    origem: 'pagamento',
  };

  const sacado = plano.saqueCentavos;
  const movimentos =
    sacado > 0
      ? [
          ...dados.movimentos,
          {
            id: `saque:${conta.chave}`,
            data,
            tipo: 'saque',
            destino: 'contas',
            metaId: null,
            valorCentavos: sacado,
            ...vinculo,
          } satisfies MovimentoReserva,
        ]
      : dados.movimentos;

  return {
    ...dados,
    ocorrencias,
    contasAvulsas,
    lancamentos: [...dados.lancamentos, lancamento],
    movimentos,
  };
}

/** Desfaz o pagamento: devolve à reserva o que saiu dela e apaga o lançamento do pagamento. */
export function desfazerPagamento(dados: DadosFinanceiros, conta: Conta): DadosFinanceiros {
  const ligadoAConta = (item: { ocorrenciaId: string | null; contaAvulsaId: string | null }) =>
    conta.origem === 'fixa'
      ? item.ocorrenciaId !== null && item.ocorrenciaId === idDaOcorrencia(dados, conta)
      : item.contaAvulsaId !== null && item.contaAvulsaId === conta.contaAvulsaId;

  // A ocorrência só existe por causa do pagamento: sem ela, o mês volta à previsão da recorrência.
  return {
    ...dados,
    ocorrencias: dados.ocorrencias.filter(
      (ocorrencia) => !(conta.origem === 'fixa' && ocorrencia.id === idDaOcorrencia(dados, conta)),
    ),
    contasAvulsas: dados.contasAvulsas.map((avulsa) =>
      avulsa.id === conta.contaAvulsaId ? { ...avulsa, pagoEm: null } : avulsa,
    ),
    lancamentos: dados.lancamentos.filter(
      (lancamento) => !(lancamento.origem === 'pagamento' && ligadoAConta(lancamento)),
    ),
    movimentos: dados.movimentos.filter(
      (movimento) => !(movimento.tipo === 'saque' && ligadoAConta(movimento)),
    ),
  };
}
