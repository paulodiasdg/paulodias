import { entraNaReservaDeContas, listarContas, type Conta } from './contas.js';
import { inicioDaSemana, somarDias, type DataCivil } from './datas.js';
import type { Centavos } from './dinheiro.js';
import { saldoEm } from './movimentos.js';
import { pagarConta, registrarAporte, valorSacadoAoPagar } from './operacoes.js';
import { calcularReservaContas } from './reserva-contas.js';
import type { DadosFinanceiros } from './tipos.js';

export interface PagamentoSimulado {
  conta: Conta;
  pagoEm: DataCivil;
  sacadoCentavos: Centavos;
}

export interface SemanaSimulada {
  inicio: DataCivil;
  valorPedidoCentavos: Centavos;
  saldoAntesDoAporteCentavos: Centavos;
  pagamentos: PagamentoSimulado[];
  saldoFinalCentavos: Centavos;
}

export interface ResultadoDaSimulacao {
  semanas: SemanaSimulada[];
  /** Contas que a reserva não cobriu inteiras no vencimento. */
  contasDescobertas: PagamentoSimulado[];
  dados: DadosFinanceiros;
}

/**
 * Simula `quantidade` semanas a partir da semana de `inicio`: na segunda-feira a pessoa guarda o
 * valor pedido (ou o que `quantoGuardar` disser), e cada conta é paga no vencimento com o dinheiro
 * da reserva. Contas vencidas antes da simulação são pagas na primeira segunda-feira.
 */
export function simularSemanas(
  dadosIniciais: DadosFinanceiros,
  inicio: DataCivil,
  quantidade: number,
  opcoes: { quantoGuardar?: (valorPedido: Centavos) => Centavos } = {},
): ResultadoDaSimulacao {
  const quantoGuardar = opcoes.quantoGuardar ?? ((valorPedido: Centavos) => valorPedido);
  let dados = dadosIniciais;
  const semanas: SemanaSimulada[] = [];
  const contasDescobertas: PagamentoSimulado[] = [];
  const destino = { destino: 'contas' } as const;

  for (let numero = 0; numero < quantidade; numero++) {
    const segunda = somarDias(inicioDaSemana(inicio), numero * 7);
    const domingo = somarDias(segunda, 6);
    const valorPedido = calcularReservaContas(dados, segunda).valorSemanalCentavos;
    const saldoAntes = saldoEm(dados.movimentos, destino, segunda);
    const guardado = quantoGuardar(valorPedido);
    if (guardado > 0) {
      dados = registrarAporte(dados, {
        id: `aporte:${segunda}`,
        data: segunda,
        valorCentavos: guardado,
      });
    }

    const pagamentos: PagamentoSimulado[] = [];
    const contasDaSemana = listarContas(dados, null, domingo).filter(
      (conta) => entraNaReservaDeContas(conta) && conta.pagoEm === null,
    );
    for (const conta of contasDaSemana) {
      const pagoEm = conta.vencimento < segunda ? segunda : conta.vencimento;
      const sacado = valorSacadoAoPagar(
        conta.valorCentavos,
        saldoEm(dados.movimentos, destino, pagoEm),
      );
      dados = pagarConta(dados, conta, pagoEm);
      const pagamento = { conta, pagoEm, sacadoCentavos: sacado };
      pagamentos.push(pagamento);
      if (sacado < conta.valorCentavos) contasDescobertas.push(pagamento);
    }

    semanas.push({
      inicio: segunda,
      valorPedidoCentavos: valorPedido,
      saldoAntesDoAporteCentavos: saldoAntes,
      pagamentos,
      saldoFinalCentavos: saldoEm(dados.movimentos, destino, domingo),
    });
  }

  return { semanas, contasDescobertas, dados };
}
