import { describe, expect, it } from 'vitest';
import { listarContas, type Conta } from './contas';
import { saldoEm } from './movimentos';
import {
  desfazerPagamento,
  pagarConta,
  planoDePagamento,
  registrarAporte,
  valorDoAjuste,
  valorSacadoAoPagar,
} from './operacoes';
import { orcamentoDoMes } from './orcamento';
import { resumoDaSemana } from './semana';
import { cenario36, HOJE_3_6 } from './testes/cenario-3-6';
import { avulsa, dadosVazios, fixa, movimento } from './testes/construtores';
import type { DadosFinanceiros } from './tipos';

function contaPorNome(dados: DadosFinanceiros, nome: string): Conta {
  const encontrada = listarContas(dados, null, '2027-12-31').find((c) => c.nome === nome);
  if (!encontrada) throw new Error(`Conta ${nome} não encontrada`);
  return encontrada;
}

const saldoDeContas = (dados: DadosFinanceiros, data: string) =>
  saldoEm(dados.movimentos, { destino: 'contas' }, data);

describe('pagar uma conta', () => {
  it('tira da reserva o menor valor entre a conta e o saldo', () => {
    expect(valorSacadoAoPagar(52_000, 80_000)).toBe(52_000);
    expect(valorSacadoAoPagar(213_000, 80_000)).toBe(80_000);
    expect(valorSacadoAoPagar(10_000, 0)).toBe(0);
    expect(valorSacadoAoPagar(10_000, -5_000)).toBe(0);
  });

  it('grava o pagamento, o lançamento vinculado e o saque da reserva', () => {
    const dados = pagarConta(
      cenario36(),
      contaPorNome(cenario36(), 'Plano de saúde'),
      '2026-11-07',
    );
    const paga = contaPorNome(dados, 'Plano de saúde');
    expect(paga.pagoEm).toBe('2026-11-07');
    expect(saldoDeContas(dados, '2026-11-07')).toBe(28_000);
    expect(dados.lancamentos.filter((l) => l.origem === 'pagamento')).toEqual([
      expect.objectContaining({
        tipo: 'despesa',
        valorCentavos: 52_000,
        ocorrenciaId: paga.ocorrenciaId,
        contaAvulsaId: null,
      }),
    ]);
    // O pagamento não vira gasto variável: está vinculado à conta.
    expect(orcamentoDoMes(dados, '2026-11').gastoVariavelCentavos).toBe(56_467);
  });

  it('a fatura com itens importados vira transferência', () => {
    const dados = dadosVazios({
      contasAvulsas: [avulsa('fatura', 184_250, '2026-11-20', { quitaItens: true })],
      movimentos: [movimento('saldo', 'ajuste', 200_000, '2026-11-01')],
    });
    const pago = pagarConta(dados, contaPorNome(dados, 'fatura'), '2026-11-20');
    expect(pago.lancamentos).toEqual([
      expect.objectContaining({ tipo: 'transferencia', contaAvulsaId: 'fatura' }),
    ]);
    expect(saldoDeContas(pago, '2026-11-20')).toBe(15_750);
  });

  it('a fixa paga no cartão não sai da reserva nem gera lançamento', () => {
    const dados = dadosVazios({
      recorrencias: [fixa('streaming', 5_590, 10, { pagaNoCartao: true })],
      movimentos: [movimento('saldo', 'ajuste', 100_000, '2026-11-01')],
    });
    const pago = pagarConta(dados, contaPorNome(dados, 'streaming'), '2026-11-10');
    expect(saldoDeContas(pago, '2026-11-10')).toBe(100_000);
    expect(pago.lancamentos).toEqual([]);
    expect(contaPorNome(pago, 'streaming').pagoEm).toBe('2026-11-10');
  });

  it('recusa pagar uma conta já paga', () => {
    const dados = pagarConta(cenario36(), contaPorNome(cenario36(), 'IPVA'), '2026-11-20');
    expect(() => pagarConta(dados, contaPorNome(dados, 'IPVA'), '2026-11-21')).toThrow(
      'já está paga',
    );
  });
});

describe('desfazer o pagamento', () => {
  it.each(['Plano de saúde', 'Aluguel', 'IPVA'])(
    'devolve lançamentos e saldos ao estado anterior (%s)',
    (nome) => {
      const antes = registrarAporte(cenario36(), {
        id: 'a1',
        data: HOJE_3_6,
        valorCentavos: 92_500,
      });
      const pago = pagarConta(antes, contaPorNome(antes, nome), '2026-11-05');
      expect(saldoDeContas(pago, '2026-11-05')).toBeLessThan(saldoDeContas(antes, '2026-11-05'));

      const desfeito = desfazerPagamento(pago, contaPorNome(pago, nome));
      expect(saldoDeContas(desfeito, '2026-11-05')).toBe(saldoDeContas(antes, '2026-11-05'));
      expect(desfeito.lancamentos).toEqual(antes.lancamentos);
      expect(desfeito.movimentos).toEqual(antes.movimentos);
      expect(contaPorNome(desfeito, nome).pagoEm).toBeNull();
      expect(desfeito).toEqual(antes);
      expect(resumoDaSemana(desfeito, '2026-11-05')).toEqual(resumoDaSemana(antes, '2026-11-05'));
    },
  );

  it('pago com outro valor, volta à previsão da recorrência', () => {
    const antes = cenario36();
    const aluguel = { ...contaPorNome(antes, 'Aluguel'), valorCentavos: 220_000 };
    const pago = pagarConta(antes, aluguel, '2026-11-15');
    expect(contaPorNome(pago, 'Aluguel').valorCentavos).toBe(220_000);
    const desfeito = desfazerPagamento(pago, contaPorNome(pago, 'Aluguel'));
    expect(contaPorNome(desfeito, 'Aluguel').valorCentavos).toBe(213_000);
    expect(desfeito).toEqual(antes);
  });
});

describe('registrar aporte', () => {
  it('soma na reserva de contas ou na meta indicada', () => {
    let dados = registrarAporte(dadosVazios(), {
      id: 'a',
      data: '2026-11-02',
      valorCentavos: 10_000,
    });
    dados = registrarAporte(dados, {
      id: 'b',
      data: '2026-11-02',
      valorCentavos: 5_000,
      metaId: 'm',
    });
    expect(saldoDeContas(dados, '2026-11-02')).toBe(10_000);
    expect(saldoEm(dados.movimentos, { destino: 'meta', metaId: 'm' }, '2026-11-02')).toBe(5_000);
  });

  it('recusa aporte zero, negativo ou fracionado', () => {
    for (const valorCentavos of [0, -100, 10.5]) {
      expect(() =>
        registrarAporte(dadosVazios(), { id: 'x', data: '2026-11-02', valorCentavos }),
      ).toThrow(RangeError);
    }
  });
});

describe('plano de pagamento (o que o app grava no banco)', () => {
  it('despesa comum: lançamento de despesa e saque até o saldo', () => {
    const dados = cenario36();
    expect(planoDePagamento(dados, contaPorNome(dados, 'Aluguel'), '2026-11-15')).toEqual({
      valorCentavos: 213_000,
      tipoDoLancamento: 'despesa',
      saqueCentavos: 80_000,
    });
  });

  it('fatura com itens importados: transferência; fixa no cartão: sem lançamento nem saque', () => {
    const dados = dadosVazios({
      recorrencias: [fixa('streaming', 5_590, 10, { pagaNoCartao: true })],
      contasAvulsas: [avulsa('fatura', 184_250, '2026-11-20', { quitaItens: true })],
      movimentos: [movimento('saldo', 'ajuste', 500_000, '2026-11-01')],
    });
    expect(planoDePagamento(dados, contaPorNome(dados, 'fatura'), '2026-11-20')).toEqual({
      valorCentavos: 184_250,
      tipoDoLancamento: 'transferencia',
      saqueCentavos: 184_250,
    });
    expect(planoDePagamento(dados, contaPorNome(dados, 'streaming'), '2026-11-10')).toEqual({
      valorCentavos: 5_590,
      tipoDoLancamento: null,
      saqueCentavos: 0,
    });
  });

  it('usa o valor efetivamente pago quando ele muda na hora de pagar', () => {
    const dados = cenario36();
    const luz = { ...contaPorNome(dados, 'Plano de saúde'), valorCentavos: 54_321 };
    expect(planoDePagamento(dados, luz, '2026-11-07').saqueCentavos).toBe(54_321);
    expect(() => planoDePagamento(dados, { ...luz, valorCentavos: -1 }, '2026-11-07')).toThrow(
      RangeError,
    );
  });

  it('o pagarConta segue exatamente o plano', () => {
    const dados = cenario36();
    const conta = contaPorNome(dados, 'Aluguel');
    const plano = planoDePagamento(dados, conta, '2026-11-15');
    const pago = pagarConta(dados, conta, '2026-11-15');
    expect(pago.lancamentos.at(-1)).toMatchObject({
      tipo: plano.tipoDoLancamento,
      valorCentavos: plano.valorCentavos,
    });
    expect(pago.movimentos.at(-1)).toMatchObject({
      tipo: 'saque',
      valorCentavos: plano.saqueCentavos,
    });
  });
});

describe('ajuste de saldo', () => {
  it('é a diferença entre o saldo correto e o atual', () => {
    expect(valorDoAjuste(80_000, 100_000)).toBe(20_000);
    expect(valorDoAjuste(80_000, 50_000)).toBe(-30_000);
    expect(valorDoAjuste(80_000, 80_000)).toBe(0);
    expect(() => valorDoAjuste(0.5, 1)).toThrow(RangeError);
  });
});
