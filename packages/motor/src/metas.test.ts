import { describe, expect, it } from 'vitest';
import { planoDasMetas } from './metas';
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
