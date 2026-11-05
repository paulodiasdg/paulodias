import { describe, expect, it } from 'vitest';
import { resumoDaSemana } from './semana';
import { cenario36, HOJE_3_6 } from './testes/cenario-3-6';

/**
 * Teste de regressão do exemplo da seção 3.6 da spec. Nunca pode quebrar (CLAUDE.md, regra 4).
 */
describe('cenário da seção 3.6', () => {
  const resumo = resumoDaSemana(cenario36(), HOJE_3_6);

  it('reproduz a tabela das oito semanas de contas', () => {
    const { semanas, saldoInicioSemanaCentavos } = resumo.reservaDeContas;
    expect(saldoInicioSemanaCentavos).toBe(80_000);
    expect(semanas.map((semana) => semana.totalCentavos)).toEqual([
      52_000, 213_000, 73_000, 0, 0, 52_000, 213_000, 35_000,
    ]);
    expect(semanas.map((semana) => semana.acumuladoCentavos)).toEqual([
      52_000, 265_000, 338_000, 338_000, 338_000, 390_000, 603_000, 638_000,
    ]);
    // (Acumulado − 800) ÷ k, para cima no centavo: −280,00; 925,00; 860,00; 645,00; 516,00;
    // 516,67; 747,15 (747,142…); 697,50.
    expect(semanas.map((semana) => semana.necessarioPorSemanaCentavos)).toEqual([
      -28_000, 92_500, 86_000, 64_500, 51_600, 51_667, 74_715, 69_750,
    ]);
  });

  it('pede R$ 925 por semana para contas, definido pela semana 2, até 15/11', () => {
    expect(resumo.reservaDeContas.valorSemanalCentavos).toBe(92_500);
    expect(resumo.reservaDeContas.semanaCritica).toBe(2);
    expect(resumo.reservaDeContas.dataLimite).toBe('2026-11-15');
  });

  it('calcula Livre de R$ 4.320 e verba das metas de R$ 2.120', () => {
    expect(resumo.orcamento.rendaCentavos).toBe(770_000);
    expect(resumo.orcamento.fixasCentavos).toBe(300_000);
    expect(resumo.orcamento.contasAvulsasCentavos).toBe(38_000);
    expect(resumo.orcamento.livreCentavos).toBe(432_000);
    expect(resumo.orcamento.estimativaVariaveis).toEqual({
      valorCentavos: 220_000,
      fonte: 'teto',
      mesesUsados: [],
    });
    expect(resumo.metas.verbaCentavos).toBe(212_000);
  });

  it('reproduz a tabela das metas', () => {
    const linhas = resumo.metas.metas.map((plano) => ({
      meta: plano.meta.nome,
      falta: plano.faltaCentavos,
      meses: plano.mesesAtePrazo.inteiros,
      necessario: plano.necessarioMensalCentavos,
      alocado: plano.alocadoMensalCentavos,
      semanal: plano.aporteSemanalCentavos,
      situacao: plano.situacao,
    }));
    expect(linhas).toEqual([
      {
        meta: 'Reserva de emergência',
        falta: 2_220_000,
        meses: 18,
        necessario: 123_333,
        alocado: 123_333,
        semanal: 28_500,
        situacao: 'completa',
      },
      {
        meta: 'Viagem',
        falta: 450_000,
        meses: 8,
        necessario: 56_250,
        alocado: 56_250,
        semanal: 13_000,
        situacao: 'completa',
      },
      {
        meta: 'Notebook',
        falta: 680_000,
        meses: 10,
        necessario: 68_000,
        alocado: 32_417,
        semanal: 7_500,
        situacao: 'parcial',
      },
    ]);
    expect(resumo.metas.metas.every((plano) => plano.mesesAtePrazo.diasRestantes === 0)).toBe(true);
  });

  it('mostra o notebook como meta sem verba completa, com nova data e falta por mês', () => {
    const notebook = resumo.metas.metas[2]!;
    expect(notebook.faltaPorMesCentavos).toBe(35_583);
    // 6.800 ÷ 324,17 = 20,98 meses → 21 meses a partir de 02/11/2026.
    expect(notebook.previsaoTermino).toBe('2028-08-02');
  });

  it('pede R$ 1.415 na semana: R$ 925 de contas e R$ 490 de metas', () => {
    expect(resumo.metas.aporteSemanalCentavos).toBe(49_000);
    expect(resumo.totalAReservarCentavos).toBe(141_500);
  });

  it('limita os gastos a R$ 2.200 no mês e R$ 513,33 na semana', () => {
    expect(resumo.limite.limiteMensalCentavos).toBe(220_000);
    expect(resumo.limite.limiteSemanalCentavos).toBe(51_333);
    expect(resumo.limite.gastoNaSemanaCentavos).toBe(56_467);
    // (2.200,00 − 564,67) ÷ 27 dias restantes = 60,56 por dia.
    expect(resumo.limite.disponivelPorDiaCentavos).toBe(6_056);
  });

  it('dá índice de saúde 82 (25 + 25 + 5 + 15 + 12), faixa saudável', () => {
    expect(resumo.saude).not.toBeNull();
    expect(resumo.saude!.componentes.map((componente) => componente.pontos)).toEqual([
      25, 25, 5, 15, 12,
    ]);
    expect(resumo.saude!.total).toBe(82);
    expect(resumo.saude!.faixa).toBe('saudavel');
  });
});
