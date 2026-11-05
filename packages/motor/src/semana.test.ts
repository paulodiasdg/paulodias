import { describe, expect, it } from 'vitest';
import { listarContas } from './contas';
import { pagarConta } from './operacoes';
import { resumoDaSemana, semanaPassada, semanasNavegaveis } from './semana';
import { cenario36, HOJE_3_6 } from './testes/cenario-3-6';
import { dadosVazios, movimento } from './testes/construtores';
import type { DadosFinanceiros } from './tipos';

describe('resumo da semana (painel)', () => {
  it('soma o guardado e o que falta guardar em contas e metas', () => {
    const dados: DadosFinanceiros = {
      ...cenario36(),
      movimentos: [
        ...cenario36().movimentos,
        movimento('contas', 'aporte', 50_000, '2026-11-03'),
        movimento('viagem', 'aporte', 13_000, '2026-11-03', { destino: 'meta', metaId: 'viagem' }),
      ],
    };
    const resumo = resumoDaSemana(dados, HOJE_3_6);
    expect(resumo.totalAReservarCentavos).toBe(141_500);
    expect(resumo.guardadoNaSemanaCentavos).toBe(63_000);
    // Contas: 925 − 500 = 425. Metas: 285 + 0 + 75 = 360.
    expect(resumo.faltaGuardarNaSemanaCentavos).toBe(42_500 + 36_000);
  });

  it('lista as contas dos próximos 14 dias, com as vencidas e sem as pagas', () => {
    expect(resumoDaSemana(cenario36(), HOJE_3_6).proximasContas.map((c) => c.nome)).toEqual([
      'Plano de saúde',
      'Aluguel',
    ]);
    // Em 18/11, o plano de saúde de 07/11 está vencido; o IPVA (20/11) e o condomínio (21/11)
    // vencem até 01/12; o aluguel de 15/11 foi pago; o plano de 07/12 fica para depois.
    const dados = cenario36();
    const aluguel = listarContas(dados, null, '2026-11-30').find((c) => c.nome === 'Aluguel')!;
    const resumo = resumoDaSemana(pagarConta(dados, aluguel, '2026-11-15'), '2026-11-18');
    expect(resumo.proximasContas.map((c) => [c.nome, c.vencimento])).toEqual([
      ['Plano de saúde', '2026-11-07'],
      ['IPVA', '2026-11-20'],
      ['Condomínio', '2026-11-21'],
    ]);
  });

  it('traz alertas, gastos e divisão do mês calculados com os mesmos dados', () => {
    const resumo = resumoDaSemana(cenario36(), HOJE_3_6);
    expect(resumo.alertas.map((a) => a.tipo)).toEqual(['meta_sem_verba', 'gasto_acima_do_ritmo']);
    expect(resumo.gastos.totalCentavos).toBe(resumo.limite.gastoNaSemanaCentavos);
    expect(resumo.gastos.limiteSemanalCentavos).toBe(resumo.limite.limiteSemanalCentavos);
    expect(resumo.divisaoDoMes.metasCentavos).toBe(resumo.metas.alocadoMensalCentavos);
    expect(resumo.divisaoDoMes.livreCentavos).toBe(resumo.orcamento.livreCentavos);
  });
});

describe('semana passada', () => {
  // Cenário 3.6 vivido até 18/11: reserva das semanas 1 e 2, plano de saúde e aluguel pagos,
  // aporte nas metas e pagamento antecipado do IPVA (vence 20/11, pago em 12/11).
  function vivido(): DadosFinanceiros {
    let dados: DadosFinanceiros = {
      ...cenario36(),
      movimentos: [
        ...cenario36().movimentos,
        movimento('s1', 'aporte', 92_500, '2026-11-02'),
        movimento('s1-emergencia', 'aporte', 28_500, '2026-11-02', {
          destino: 'meta',
          metaId: 'emergencia',
        }),
        movimento('s2', 'aporte', 92_500, '2026-11-09'),
        movimento('s2-viagem', 'aporte', 13_000, '2026-11-10', {
          destino: 'meta',
          metaId: 'viagem',
        }),
      ],
    };
    const conta = (nome: string) =>
      listarContas(dados, null, '2026-11-30').find((c) => c.nome === nome && c.pagoEm === null)!;
    dados = pagarConta(dados, conta('Plano de saúde'), '2026-11-07');
    dados = pagarConta(dados, conta('IPVA'), '2026-11-12');
    dados = pagarConta(dados, conta('Aluguel'), '2026-11-15');
    return dados;
  }

  it('mostra o guardado em contas e em cada meta', () => {
    const semana = semanaPassada(vivido(), '2026-11-11');
    expect(semana.semana).toEqual({ inicio: '2026-11-09', fim: '2026-11-15' });
    expect(semana.guardadoContasCentavos).toBe(92_500);
    expect(semana.guardadoMetas).toEqual([
      { metaId: 'viagem', nome: 'Viagem', valorCentavos: 13_000 },
    ]);
    expect(semana.guardadoTotalCentavos).toBe(105_500);
  });

  it('lista as contas pagas na semana, inclusive as antecipadas, e quanto saiu da reserva', () => {
    // Saldo: 800 + 925 − 520 (07/11) + 925 = 2.130 em 09/11; o IPVA tira 380 e o aluguel,
    // os 1.750 que sobram dos 2.130.
    const semana = semanaPassada(vivido(), '2026-11-15');
    expect(
      semana.contasPagas.map((p) => [p.conta.nome, p.conta.pagoEm, p.saiuDaReservaCentavos]),
    ).toEqual([
      ['Aluguel', '2026-11-15', 175_000],
      ['IPVA', '2026-11-12', 38_000],
    ]);
  });

  it('mostra os gastos da semana contra o limite daquela semana', () => {
    const semana = semanaPassada(vivido(), '2026-11-04');
    expect(semana.gastos.totalCentavos).toBe(56_467);
    expect(semana.gastos.limiteSemanalCentavos).toBe(51_333);
    expect(semana.contasPagas.map((p) => p.conta.nome)).toEqual(['Plano de saúde']);
  });
});

describe('semanas que o painel deixa visitar', () => {
  it('vão da semana do início do uso até a última semana da agenda', () => {
    expect(semanasNavegaveis(cenario36(), '2026-11-18')).toEqual({
      primeira: '2026-10-26',
      atual: '2026-11-16',
      ultima: '2027-01-04',
    });
  });

  it('sem data de início, a primeira é a semana atual', () => {
    expect(semanasNavegaveis(dadosVazios(), '2026-11-04').primeira).toBe('2026-11-02');
  });
});
