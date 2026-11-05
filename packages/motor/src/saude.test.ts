import { describe, expect, it } from 'vitest';
import { indiceDeSaude } from './saude';
import { cenario36, HOJE_3_6 } from './testes/cenario-3-6';
import { avulsa, dadosVazios, despesa, fixa, meta, movimento, renda } from './testes/construtores';
import type { DadosFinanceiros } from './tipos';

function pontos(dados: DadosFinanceiros, hoje: string) {
  const indice = indiceDeSaude(dados, hoje);
  return indice && Object.fromEntries(indice.componentes.map((c) => [c.chave, c.pontos]));
}

describe('índice de saúde financeira (regra 3.5)', () => {
  it('sem renda no mês, não há índice', () => {
    expect(indiceDeSaude(dadosVazios(), '2026-11-04')).toBeNull();
    expect(
      indiceDeSaude(dadosVazios({ recorrencias: [fixa('aluguel', 1, 5)] }), '2026-11-04'),
    ).toBeNull();
  });

  it('pontua proporcionalmente entre os limites', () => {
    const dados = dadosVazios({
      perfil: { tetoVariavelCentavos: 100_000 },
      recorrencias: [
        renda('salario', 1_000_000, 5),
        fixa('aluguel', 650_000, 10, { inicio: '2026-11-01' }),
      ],
      metas: [meta('emergencia', 1, '2028-01-01', 1, { tipo: 'emergencia' })],
      movimentos: [
        movimento('e', 'ajuste', 2_250_000, '2026-11-01', {
          destino: 'meta',
          metaId: 'emergencia',
        }),
      ],
    });
    expect(pontos(dados, '2026-11-04')).toEqual({
      compromissoDaRenda: 12.5, // 65%: metade do caminho entre 50% e 80%
      capacidadeDePoupar: 25, // (10.000 − 6.500 − 1.000) ÷ 10.000 = 25%
      reservaDeEmergencia: 10, // 22.500 ÷ 7.500 = 3 meses
      contasEmDia: 15,
      ritmoDeGastos: 15,
    });
  });

  it('nota zero nos extremos e faixa crítica', () => {
    const dados = dadosVazios({
      perfil: { tetoVariavelCentavos: 50_000 },
      recorrencias: [
        renda('salario', 100_000, 1),
        fixa('aluguel', 90_000, 1, { inicio: '2026-10-01' }),
      ],
      lancamentos: [despesa('gasto', 50_000, '2026-11-02')],
    });
    // Aluguel de outubro e de novembro vencidos: 180% dos compromissos do mês.
    const indice = indiceDeSaude(dados, '2026-11-04')!;
    expect(indice.componentes.map((c) => c.pontos)).toEqual([0, 0, 0, 0, 0]);
    expect(indice).toMatchObject({ total: 0, faixa: 'critico', nomeDaFaixa: 'Crítico' });
  });

  it('contas em dia caem com o valor vencido', () => {
    const dados = {
      ...cenario36(),
      contasAvulsas: [...cenario36().contasAvulsas, avulsa('atrasada', 84_500, '2026-11-01')],
    };
    // Vencido 845 ÷ compromissos 3.380 + 845 = 20% → 15 × 0,8 = 12.
    expect(pontos(dados, HOJE_3_6)!.contasEmDia).toBe(12);
  });

  it('no começo do mês, usa a fração mínima de 7 dias no ritmo (C8)', () => {
    const dados = {
      ...cenario36(),
      lancamentos: [despesa('dia-1', 51_333, '2026-11-01')],
    };
    // Gasto de 513,33 no dia 01: sem o mínimo seria 700% do ritmo; com 7 dias, é 100%.
    expect(pontos(dados, '2026-11-01')!.ritmoDeGastos).toBe(15);
  });

  it('com limite zero, o ritmo vale 15 sem gasto e 0 com gasto', () => {
    const base = dadosVazios({
      perfil: { tetoVariavelCentavos: 0 },
      recorrencias: [renda('salario', 100_000, 1)],
    });
    expect(pontos(base, '2026-11-10')!.ritmoDeGastos).toBe(15);
    const comGasto = { ...base, lancamentos: [despesa('x', 1, '2026-11-02')] };
    expect(pontos(comGasto, '2026-11-10')!.ritmoDeGastos).toBe(0);
  });

  it('sem compromissos nem custos, contas e reserva usam os casos de borda', () => {
    const semCusto = dadosVazios({
      perfil: { tetoVariavelCentavos: 0 },
      recorrencias: [renda('salario', 100_000, 1)],
    });
    expect(pontos(semCusto, '2026-11-10')).toMatchObject({
      contasEmDia: 15,
      reservaDeEmergencia: 0,
    });

    const comReserva = {
      ...semCusto,
      metas: [meta('emergencia', 10_000, '2027-01-01', 1, { tipo: 'emergencia' as const })],
      movimentos: [
        movimento('e', 'ajuste', 5_000, '2026-11-01', {
          destino: 'meta' as const,
          metaId: 'emergencia',
        }),
      ],
    };
    expect(pontos(comReserva, '2026-11-10')!.reservaDeEmergencia).toBe(20);

    const vencidaSemCompromisso = {
      ...semCusto,
      contasAvulsas: [avulsa('outubro', 10_000, '2026-10-20')],
    };
    expect(pontos(vencidaSemCompromisso, '2026-11-10')!.contasEmDia).toBe(0);
  });

  it('classifica as faixas pelos limites da configuração', () => {
    const faixa = (total: number) =>
      [
        { minimo: 80, faixa: 'saudavel' },
        { minimo: 60, faixa: 'estavel' },
        { minimo: 40, faixa: 'atencao' },
        { minimo: 0, faixa: 'critico' },
      ].find((item) => total >= item.minimo)!.faixa;
    expect(indiceDeSaude(cenario36(), HOJE_3_6)!.faixa).toBe(faixa(82));
    expect([faixa(80), faixa(79), faixa(60), faixa(59), faixa(40), faixa(39)]).toEqual([
      'saudavel',
      'estavel',
      'estavel',
      'atencao',
      'atencao',
      'critico',
    ]);
  });
});

describe('medidas do índice para exibir', () => {
  it('no cenário 3.6, dá cada medida e os limites da tabela 3.5, em décimos', () => {
    const saude = indiceDeSaude(cenario36(), HOJE_3_6)!;
    expect(saude.componentes.map((c) => [c.chave, c.exibicao, c.limites])).toEqual([
      // (3.000 + 380) ÷ 7.700 = 43,9%.
      [
        'compromissoDaRenda',
        { unidade: 'percentual', decimos: 439 },
        {
          notaMaxima: { unidade: 'percentual', decimos: 500 },
          notaZero: { unidade: 'percentual', decimos: 800 },
        },
      ],
      // (4.320 − 2.200) ÷ 7.700 = 27,5%.
      [
        'capacidadeDePoupar',
        { unidade: 'percentual', decimos: 275 },
        {
          notaMaxima: { unidade: 'percentual', decimos: 200 },
          notaZero: { unidade: 'percentual', decimos: 0 },
        },
      ],
      // 7.800 ÷ (3.000 + 2.200) = 1,5 mês.
      [
        'reservaDeEmergencia',
        { unidade: 'meses', decimos: 15 },
        {
          notaMaxima: { unidade: 'meses', decimos: 60 },
          notaZero: { unidade: 'meses', decimos: 0 },
        },
      ],
      [
        'contasEmDia',
        { unidade: 'percentual', decimos: 0 },
        {
          notaMaxima: { unidade: 'percentual', decimos: 0 },
          notaZero: { unidade: 'percentual', decimos: 1000 },
        },
      ],
      // 564,67 ÷ (2.200 × 7 ÷ 30) = 110,0%.
      [
        'ritmoDeGastos',
        { unidade: 'percentual', decimos: 1100 },
        {
          notaMaxima: { unidade: 'percentual', decimos: 1000 },
          notaZero: { unidade: 'percentual', decimos: 1500 },
        },
      ],
    ]);
  });

  it('sem medida (limite zero ou sem custo mensal), não há o que exibir', () => {
    const dados = dadosVazios({
      perfil: { tetoVariavelCentavos: 0 },
      recorrencias: [renda('salario', 500_000, 5)],
    });
    const saude = indiceDeSaude(dados, '2026-11-04')!;
    const exibicao = Object.fromEntries(saude.componentes.map((c) => [c.chave, c.exibicao]));
    expect(exibicao.reservaDeEmergencia).toBeNull();
    expect(exibicao.contasEmDia).toBeNull();
    expect(exibicao.ritmoDeGastos).toBeNull();
  });
});
