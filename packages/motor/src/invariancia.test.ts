import { describe, expect, it } from 'vitest';
import { listarContas, type Conta } from './contas';
import { somarDias } from './datas';
import { desfazerPagamento, pagarConta, registrarAporte } from './operacoes';
import { calcularReservaContas, motivosDaMudanca } from './reserva-contas';
import { resumoDaSemana } from './semana';
import { cenario36, HOJE_3_6 } from './testes/cenario-3-6';
import { avulsa, movimento } from './testes/construtores';
import type { DadosFinanceiros } from './tipos';

/** Aceite da Etapa 2: registrar a reserva não muda o valor pedido naquela semana (D3). */

function conta(dados: DadosFinanceiros, nome: string): Conta {
  const encontrada = listarContas(dados, '2026-11-01', '2026-12-31').find((c) => c.nome === nome);
  if (!encontrada) throw new Error(`Conta ${nome} não encontrada`);
  return encontrada;
}

function valoresDaSemana(dados: DadosFinanceiros, hoje: string) {
  const resumo = resumoDaSemana(dados, hoje);
  return {
    contas: resumo.reservaDeContas.valorSemanalCentavos,
    metas: resumo.metas.metas.map((plano) => plano.aporteSemanalCentavos),
    total: resumo.totalAReservarCentavos,
  };
}

const ESPERADO = { contas: 92_500, metas: [28_500, 13_000, 7_500], total: 141_500 };

describe('o valor da semana não muda com movimentos da própria semana', () => {
  it('é o mesmo de segunda a domingo', () => {
    for (let dia = 0; dia < 7; dia++) {
      expect(valoresDaSemana(cenario36(), somarDias('2026-11-02', dia))).toEqual(ESPERADO);
    }
  });

  it('registrar a reserva de contas e das metas não muda o valor pedido', () => {
    let dados = registrarAporte(cenario36(), { id: 'a1', data: HOJE_3_6, valorCentavos: 92_500 });
    dados = registrarAporte(dados, {
      id: 'a2',
      data: HOJE_3_6,
      valorCentavos: 28_500,
      metaId: 'emergencia',
    });
    expect(valoresDaSemana(dados, HOJE_3_6)).toEqual(ESPERADO);

    const reserva = calcularReservaContas(dados, HOJE_3_6);
    expect(reserva.aportadoNaSemanaCentavos).toBe(92_500);
    expect(reserva.faltaGuardarNaSemanaCentavos).toBe(0);
    expect(reserva.saldoAtualCentavos).toBe(172_500);
  });

  it('pagar uma conta da semana não muda o valor pedido', () => {
    let dados = registrarAporte(cenario36(), { id: 'a1', data: HOJE_3_6, valorCentavos: 92_500 });
    dados = pagarConta(dados, conta(dados, 'Plano de saúde'), '2026-11-07');
    expect(valoresDaSemana(dados, '2026-11-07')).toEqual(ESPERADO);
  });

  it('pagar antes uma conta de semana futura não muda o valor pedido', () => {
    const dados = pagarConta(cenario36(), conta(cenario36(), 'Aluguel'), '2026-11-05');
    expect(valoresDaSemana(dados, '2026-11-05')).toEqual(ESPERADO);
  });

  it('pagar com saldo insuficiente não muda o valor pedido', () => {
    // Só há R$ 800 na reserva; o aluguel de R$ 2.130 tira R$ 800 dela.
    const dados = pagarConta(cenario36(), conta(cenario36(), 'Aluguel'), '2026-11-05');
    expect(calcularReservaContas(dados, '2026-11-05').saldoAtualCentavos).toBe(0);
    expect(valoresDaSemana(dados, '2026-11-05')).toEqual(ESPERADO);
  });

  it('um saque manual na semana não muda o valor pedido', () => {
    const dados = {
      ...cenario36(),
      movimentos: [...cenario36().movimentos, movimento('saque-manual', 'saque', 30_000, HOJE_3_6)],
    };
    expect(valoresDaSemana(dados, HOJE_3_6)).toEqual(ESPERADO);
  });

  it('desfazer o pagamento também não muda o valor pedido', () => {
    const antes = cenario36();
    const pago = pagarConta(antes, conta(antes, 'Aluguel'), '2026-11-05');
    const desfeito = desfazerPagamento(pago, conta(pago, 'Aluguel'));
    expect(valoresDaSemana(desfeito, '2026-11-05')).toEqual(ESPERADO);
  });
});

describe('mudanças de cadastro recalculam e mostram o motivo', () => {
  it('cadastrar uma conta nova muda o valor e informa qual conta', () => {
    const antes = cenario36();
    const depois = {
      ...antes,
      contasAvulsas: [
        ...antes.contasAvulsas,
        avulsa('luz', 40_000, '2026-11-12', { nome: 'Conta de luz' }),
      ],
    };
    const reservaAntes = calcularReservaContas(antes, HOJE_3_6);
    const reservaDepois = calcularReservaContas(depois, HOJE_3_6);
    // Semana 2 passa a somar R$ 3.050 − R$ 800 = R$ 2.250 ÷ 2 = R$ 1.125.
    expect(reservaDepois.valorSemanalCentavos).toBe(112_500);
    expect(motivosDaMudanca(reservaAntes, reservaDepois)).toEqual([
      { tipo: 'conta_incluida', conta: expect.objectContaining({ nome: 'Conta de luz' }) },
    ]);
  });

  it('alterar o valor de uma conta informa o valor anterior e o novo', () => {
    const antes = cenario36();
    const depois = {
      ...antes,
      contasAvulsas: antes.contasAvulsas.map((c) => ({ ...c, valorCentavos: 50_000 })),
    };
    expect(
      motivosDaMudanca(
        calcularReservaContas(antes, HOJE_3_6),
        calcularReservaContas(depois, HOJE_3_6),
      ),
    ).toEqual([
      {
        tipo: 'valor_alterado',
        conta: expect.objectContaining({ nome: 'IPVA' }),
        deCentavos: 38_000,
        paraCentavos: 50_000,
      },
    ]);
  });

  it('um ajuste do saldo na semana recalcula e é informado', () => {
    const antes = cenario36();
    const depois = {
      ...antes,
      movimentos: [...antes.movimentos, movimento('correcao', 'ajuste', 20_000, HOJE_3_6)],
    };
    const reservaDepois = calcularReservaContas(depois, HOJE_3_6);
    // (2.650 − 1.000) ÷ 2 = 825.
    expect(reservaDepois.valorSemanalCentavos).toBe(82_500);
    expect(motivosDaMudanca(calcularReservaContas(antes, HOJE_3_6), reservaDepois)).toEqual([
      { tipo: 'saldo_ajustado', deCentavos: 80_000, paraCentavos: 100_000 },
    ]);
  });

  it('a virada da semana é informada como nova semana', () => {
    const dados = cenario36();
    expect(
      motivosDaMudanca(
        calcularReservaContas(dados, HOJE_3_6),
        calcularReservaContas(dados, '2026-11-09'),
      ),
    ).toEqual([{ tipo: 'nova_semana' }]);
  });

  it('mudar a data de vencimento informa a data anterior e a nova', () => {
    const antes = cenario36();
    const depois = {
      ...antes,
      contasAvulsas: antes.contasAvulsas.map((c) => ({ ...c, vencimento: '2026-11-19' })),
    };
    expect(
      motivosDaMudanca(
        calcularReservaContas(antes, HOJE_3_6),
        calcularReservaContas(depois, HOJE_3_6),
      ),
    ).toEqual([
      {
        tipo: 'vencimento_alterado',
        conta: expect.objectContaining({ nome: 'IPVA' }),
        de: '2026-11-20',
        para: '2026-11-19',
      },
    ]);
  });

  it('remover uma conta é informado', () => {
    const antes = cenario36();
    const depois = { ...antes, contasAvulsas: [] };
    expect(
      motivosDaMudanca(
        calcularReservaContas(antes, HOJE_3_6),
        calcularReservaContas(depois, HOJE_3_6),
      ),
    ).toEqual([{ tipo: 'conta_removida', conta: expect.objectContaining({ nome: 'IPVA' }) }]);
  });
});
