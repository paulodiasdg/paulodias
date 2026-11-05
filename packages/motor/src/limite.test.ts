import { describe, expect, it } from 'vitest';
import { limiteDeGastos, limiteMensal } from './limite';
import { dadosVazios, despesa, fixa, meta, renda } from './testes/construtores';

describe('limite de gastos (regra 3.4)', () => {
  it('sem teto, vale Livre − metas alocadas', () => {
    const dados = dadosVazios({
      perfil: { tetoVariavelCentavos: null, inicioEm: '2026-11-01' },
      recorrencias: [renda('salario', 500_000, 5), fixa('aluguel', 200_000, 10)],
      metas: [meta('viagem', 120_000, '2027-11-02', 1)],
    });
    // Livre 3.000; variáveis estimados 30% da renda = 1.500; meta pede 100/mês.
    expect(limiteMensal(dados, '2026-11', '2026-11-04')).toBe(290_000);
  });

  it('nunca fica negativo', () => {
    const dados = dadosVazios({
      recorrencias: [renda('salario', 100_000, 5), fixa('aluguel', 200_000, 10)],
    });
    expect(limiteMensal(dados, '2026-11', '2026-11-04')).toBe(0);
    expect(limiteDeGastos(dados, '2026-11-04')).toMatchObject({
      limiteSemanalCentavos: 0,
      disponivelPorDiaCentavos: 0,
    });
  });

  it('semana que cruza dois meses soma o limite de cada dia (C8)', () => {
    const dados = dadosVazios({
      perfil: { tetoVariavelCentavos: 300_000 },
      recorrencias: [renda('salario', 1_000_000, 5)],
    });
    // 30/11 a 06/12: 1 dia de novembro (3.000 ÷ 30) + 6 de dezembro (3.000 × 6 ÷ 31) = 680,64.
    const limite = limiteDeGastos(dados, '2026-12-02');
    expect(limite.semana).toEqual({ inicio: '2026-11-30', fim: '2026-12-06' });
    expect(limite.limiteSemanalCentavos).toBe(68_064);
  });

  it('mostra quanto ainda pode gastar por dia até o fim do mês', () => {
    const dados = dadosVazios({
      perfil: { tetoVariavelCentavos: 300_000 },
      recorrencias: [renda('salario', 1_000_000, 5)],
      lancamentos: [
        despesa('mercado', 100_000, '2026-11-03'),
        despesa('futuro', 50_000, '2026-11-20'),
      ],
    });
    const limite = limiteDeGastos(dados, '2026-11-11');
    expect(limite.gastoNoMesCentavos).toBe(100_000);
    expect(limite.diasRestantesNoMes).toBe(20);
    expect(limite.disponivelPorDiaCentavos).toBe(10_000);
  });
});
