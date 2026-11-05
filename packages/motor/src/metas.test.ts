import { describe, expect, it } from 'vitest';
import { planoDasMetas } from './metas';
import { simularPlano } from './plano';
import { cenario36, HOJE_3_6 } from './testes/cenario-3-6';
import { dadosVazios, meta, movimento, renda } from './testes/construtores';
import type { DadosFinanceiros, Meta } from './tipos';

const HOJE = '2026-11-04'; // segunda de referência: 02/11/2026

/** Renda de R$ 3.000 e teto de R$ 1.000: verba das metas de R$ 2.000. */
function comMetas(metas: Meta[], extra: Partial<DadosFinanceiros> = {}): DadosFinanceiros {
  return dadosVazios({
    perfil: { tetoVariavelCentavos: 100_000 },
    recorrencias: [renda('salario', 300_000, 5)],
    metas,
    ...extra,
  });
}

describe('plano das metas (regra 3.3)', () => {
  it('ordena por prioridade e, no empate, pelo prazo mais próximo', () => {
    const plano = planoDasMetas(
      comMetas([
        meta('c', 100_000, '2027-11-02', 2),
        meta('b', 100_000, '2027-05-02', 2),
        meta('a', 100_000, '2027-11-02', 1),
      ]),
      HOJE,
    );
    expect(plano.metas.map((p) => p.meta.id)).toEqual(['a', 'b', 'c']);
  });

  it('sem verba, a meta fica sem previsão de término', () => {
    const plano = planoDasMetas(
      comMetas([
        meta('cara', 4_000_000, '2027-11-02', 1),
        meta('depois', 100_000, '2027-11-02', 2),
      ]),
      HOJE,
    );
    expect(plano.metas.map((p) => p.situacao)).toEqual(['parcial', 'sem_verba']);
    expect(plano.metas[1]).toMatchObject({
      alocadoMensalCentavos: 0,
      aporteSemanalCentavos: 0,
      previsaoTermino: null,
    });
    expect(plano.sobraDaVerbaCentavos).toBe(0);
  });

  it('meta completa termina no prazo e deixa sobra da verba', () => {
    const plano = planoDasMetas(comMetas([meta('viagem', 120_000, '2027-11-02', 1)]), HOJE);
    expect(plano.metas[0]).toMatchObject({
      necessarioMensalCentavos: 10_000,
      situacao: 'completa',
      previsaoTermino: '2027-11-02',
      faltaPorMesCentavos: 0,
    });
    expect(plano.sobraDaVerbaCentavos).toBe(190_000);
  });

  it('meta concluída, ou com o alvo já guardado, não recebe verba', () => {
    const plano = planoDasMetas(
      comMetas(
        [
          meta('feita', 50_000, '2027-11-02', 1, { concluidaEm: '2026-10-01' }),
          meta('cheia', 50_000, '2027-11-02', 1),
        ],
        {
          movimentos: [
            movimento('m', 'ajuste', 50_000, '2026-10-01', { destino: 'meta', metaId: 'cheia' }),
          ],
        },
      ),
      HOJE,
    );
    expect(plano.metas.map((p) => [p.situacao, p.alocadoMensalCentavos])).toEqual([
      ['concluida', 0],
      ['concluida', 0],
    ]);
  });

  it('prazo vencido ou a menos de um mês pede tudo o que falta neste mês', () => {
    const plano = planoDasMetas(
      comMetas([
        meta('vencida', 80_000, '2026-10-01', 1),
        meta('proxima', 30_000, '2026-11-20', 2),
      ]),
      HOJE,
    );
    expect(plano.metas[0]).toMatchObject({ necessarioMensalCentavos: 80_000, prazoVencido: true });
    expect(plano.metas[1]).toMatchObject({ necessarioMensalCentavos: 30_000, prazoVencido: false });
  });

  describe('a menos de um mês do prazo (decisão de 05/11/2026)', () => {
    it('com verba completa, pede o que falta dividido pelas semanas até o prazo', () => {
      // De 02/11 até a semana de 26/11: semanas de 02, 09, 16 e 23/11. 845 ÷ 4 = 211,25 → 212.
      const plano = planoDasMetas(comMetas([meta('curta', 84_500, '2026-11-26', 1)]), HOJE);
      expect(plano.metas[0]).toMatchObject({
        situacao: 'completa',
        necessarioMensalCentavos: 84_500,
        aporteSemanalCentavos: 21_200,
      });
    });

    it('termina no prazo: cada semana recalcula e a soma dá o que faltava', () => {
      const dados = comMetas([meta('curta', 84_500, '2026-11-26', 1)]);
      const semanas = simularPlano(dados, HOJE, 5);
      const aportes = semanas.map((s) => s.paraMetas[0]?.valorCentavos ?? 0);
      expect(aportes).toEqual([21_200, 21_100, 21_100, 21_100, 0]);
      expect(aportes.reduce((a, b) => a + b, 0)).toBe(84_500);
      expect(semanas[4]!.planoDasMetas.metas[0]!.situacao).toBe('concluida');
    });

    it('com o prazo vencido, pede na semana tudo o que falta', () => {
      const plano = planoDasMetas(comMetas([meta('vencida', 80_000, '2026-10-01', 1)]), HOJE);
      expect(plano.metas[0]).toMatchObject({ prazoVencido: true, aporteSemanalCentavos: 80_000 });
    });

    it('com verba parcial, segue mensal × 12 ÷ 52 sobre o alocado', () => {
      // Verba de R$ 2.000 para R$ 3.000 que faltam: 2.000 × 12 ÷ 52 = 461,54 → 462.
      const plano = planoDasMetas(comMetas([meta('grande', 300_000, '2026-11-26', 1)]), HOJE);
      expect(plano.metas[0]).toMatchObject({
        situacao: 'parcial',
        alocadoMensalCentavos: 200_000,
        aporteSemanalCentavos: 46_200,
      });
    });

    it('a partir de um mês inteiro, vale a regra da spec', () => {
      // 02/11 a 02/12: exatamente 1 mês. 600 × 12 ÷ 52 = 138,46 → 139.
      const plano = planoDasMetas(comMetas([meta('um-mes', 60_000, '2026-12-02', 1)]), HOJE);
      expect(plano.metas[0]!.aporteSemanalCentavos).toBe(13_900);
    });
  });

  it('dá o progresso em percentual inteiro, para baixo, e o que falta guardar na semana', () => {
    const dados = {
      ...cenario36(),
      movimentos: [
        ...cenario36().movimentos,
        movimento('hoje', 'aporte', 10_000, HOJE_3_6, {
          destino: 'meta' as const,
          metaId: 'emergencia',
        }),
      ],
    };
    const plano = planoDasMetas(dados, HOJE_3_6);
    // 7.900 ÷ 30.000 = 26,33%.
    expect(plano.metas[0]).toMatchObject({
      progressoPercentual: 26,
      aporteSemanalCentavos: 28_500,
      aportadoNaSemanaCentavos: 10_000,
      faltaGuardarNaSemanaCentavos: 18_500,
    });
    expect(plano.aportadoNaSemanaCentavos).toBe(10_000);
    expect(plano.faltaGuardarNaSemanaCentavos).toBe(49_000 - 10_000);
  });

  it('o progresso fica entre 0 e 100', () => {
    const dados = comMetas(
      [meta('cheia', 10_000, '2027-11-02', 1), meta('vazia', 10_000, '2027-11-02', 2)],
      {
        movimentos: [
          movimento('a', 'ajuste', 15_000, '2026-10-01', { destino: 'meta', metaId: 'cheia' }),
          movimento('b', 'ajuste', -5_000, '2026-10-01', { destino: 'meta', metaId: 'vazia' }),
        ],
      },
    );
    expect(planoDasMetas(dados, HOJE).metas.map((p) => p.progressoPercentual)).toEqual([100, 0]);
  });

  it('usa o guardado de segunda-feira (D3): aporte desta semana não muda o pedido', () => {
    const base = comMetas([meta('viagem', 120_000, '2027-11-02', 1)]);
    const comAporte = {
      ...base,
      movimentos: [
        movimento('a', 'aporte', 10_000, HOJE, { destino: 'meta' as const, metaId: 'viagem' }),
      ],
    };
    const plano = planoDasMetas(comAporte, HOJE).metas[0]!;
    expect(plano.guardadoInicioSemanaCentavos).toBe(0);
    expect(plano.guardadoAtualCentavos).toBe(10_000);
    expect(plano.aportadoNaSemanaCentavos).toBe(10_000);
    expect(plano.aporteSemanalCentavos).toBe(
      planoDasMetas(base, HOJE).metas[0]!.aporteSemanalCentavos,
    );
  });

  it('com renda menor que os compromissos, a verba é zero', () => {
    const dados = dadosVazios({
      perfil: { tetoVariavelCentavos: 400_000 },
      recorrencias: [renda('salario', 300_000, 5)],
      metas: [meta('x', 10_000, '2027-11-02', 1)],
    });
    expect(planoDasMetas(dados, HOJE).verbaCentavos).toBe(0);
  });
});
