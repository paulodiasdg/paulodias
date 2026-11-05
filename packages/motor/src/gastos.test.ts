import { describe, expect, it } from 'vitest';
import { gastosDaSemana } from './gastos';
import { limiteDeGastos } from './limite';
import { cenario36, HOJE_3_6 } from './testes/cenario-3-6';
import { dadosVazios, despesa, receita, renda } from './testes/construtores';
import type { Categoria } from './tipos';

const CATEGORIAS: Categoria[] = [
  { id: 'mercado', nome: 'Alimentação', grupo: 'essencial' },
  { id: 'lazer', nome: 'Lazer', grupo: 'livre' },
  { id: 'restaurantes', nome: 'Restaurantes e delivery', grupo: 'livre' },
];

// Semana de 02 a 08/11/2026; a pessoa usa o sistema desde 01/10/2026.
const dados = dadosVazios({
  perfil: { tetoVariavelCentavos: 300_000, inicioEm: '2026-10-01' },
  categorias: CATEGORIAS,
  recorrencias: [renda('salario', 1_000_000, 5, { inicio: '2026-10-01' })],
  lancamentos: [
    despesa('a', 20_000, '2026-11-02', { categoriaId: 'lazer' }),
    despesa('b', 35_000, '2026-11-03', { categoriaId: 'mercado' }),
    despesa('c', 15_000, '2026-11-04', { categoriaId: 'mercado' }),
    despesa('d', 20_000, '2026-11-08', { categoriaId: 'restaurantes' }),
    despesa('e', 5_000, '2026-11-06'),
    despesa('f', 1_000, '2026-11-06', { categoriaId: 'apagada' }),
    // Não entram: pagamento de conta, receita e gasto da semana seguinte.
    despesa('g', 90_000, '2026-11-05', { contaAvulsaId: 'ipva' }),
    receita('h', 50_000, '2026-11-05'),
    despesa('i', 99_000, '2026-11-09', { categoriaId: 'lazer' }),
    // Semanas anteriores.
    despesa('j', 40_000, '2026-10-27'),
    despesa('k', 30_000, '2026-10-20'),
    despesa('l', 10_000, '2026-10-01'),
  ],
});

describe('gastos da semana (painel, item 3)', () => {
  const gastos = gastosDaSemana(dados, '2026-11-04');

  it('soma o gasto variável da semana inteira, por categoria, do maior para o menor', () => {
    expect(gastos.semana).toEqual({ inicio: '2026-11-02', fim: '2026-11-08' });
    expect(gastos.totalCentavos).toBe(96_000);
    expect(gastos.porCategoria).toEqual([
      { categoriaId: 'mercado', nome: 'Alimentação', grupo: 'essencial', valorCentavos: 50_000 },
      { categoriaId: 'lazer', nome: 'Lazer', grupo: 'livre', valorCentavos: 20_000 },
      {
        categoriaId: 'restaurantes',
        nome: 'Restaurantes e delivery',
        grupo: 'livre',
        valorCentavos: 20_000,
      },
      // Sem categoria, ou com categoria que não existe mais.
      { categoriaId: null, nome: null, grupo: null, valorCentavos: 6_000 },
    ]);
  });

  it('confere com o gasto da semana e o limite semanal da regra 3.4', () => {
    const limite = limiteDeGastos(dados, '2026-11-04');
    expect(gastos.totalCentavos).toBe(limite.gastoNaSemanaCentavos);
    // Teto de R$ 3.000 em novembro: 3.000 × 7 ÷ 30 = 700.
    expect(gastos.limiteSemanalCentavos).toBe(limite.limiteSemanalCentavos);
    expect(gastos.limiteSemanalCentavos).toBe(70_000);
    expect(gastos.acimaDoLimiteCentavos).toBe(26_000);
    expect(gastos.disponivelNaSemanaCentavos).toBe(0);
    // 960 ÷ 700 = 137,1%.
    expect(gastos.usoDoLimitePercentual).toBe(137);
  });

  it('compara com as 6 semanas anteriores, sem as de antes do início do uso', () => {
    // O uso começou em 01/10 (quinta): a semana de 28/09 entra, a de 21/09 não.
    expect(gastos.semanasAnteriores).toEqual([
      { inicio: '2026-09-28', fim: '2026-10-04', gastoCentavos: 10_000 },
      { inicio: '2026-10-05', fim: '2026-10-11', gastoCentavos: 0 },
      { inicio: '2026-10-12', fim: '2026-10-18', gastoCentavos: 0 },
      { inicio: '2026-10-19', fim: '2026-10-25', gastoCentavos: 30_000 },
      { inicio: '2026-10-26', fim: '2026-11-01', gastoCentavos: 40_000 },
    ]);
    // (100 + 0 + 0 + 300 + 400) ÷ 5 = 160.
    expect(gastos.mediaDasAnterioresCentavos).toBe(16_000);
  });

  it('com 6 semanas ou mais de uso, mostra as 6 anteriores', () => {
    const antigo = { ...dados, perfil: { ...dados.perfil, inicioEm: '2026-01-01' } };
    expect(gastosDaSemana(antigo, '2026-11-04').semanasAnteriores).toHaveLength(6);
  });

  it('sem semana anterior, não há média', () => {
    const novo = { ...dados, perfil: { ...dados.perfil, inicioEm: '2026-11-03' } };
    const semana = gastosDaSemana(novo, '2026-11-04');
    expect(semana.semanasAnteriores).toEqual([]);
    expect(semana.mediaDasAnterioresCentavos).toBeNull();
  });

  it('abaixo do limite, mostra quanto ainda cabe na semana', () => {
    const semana = gastosDaSemana(cenario36(), HOJE_3_6);
    expect(semana.limiteSemanalCentavos).toBe(51_333);
    expect(semana.totalCentavos).toBe(56_467);
    const pouco = { ...cenario36(), lancamentos: [despesa('x', 10_000, '2026-11-03')] };
    expect(gastosDaSemana(pouco, HOJE_3_6).disponivelNaSemanaCentavos).toBe(41_333);
    expect(gastosDaSemana(pouco, HOJE_3_6).usoDoLimitePercentual).toBe(19);
  });

  it('com limite zero, não há percentual de uso', () => {
    const semLimite = { ...dados, perfil: { ...dados.perfil, tetoVariavelCentavos: 0 } };
    expect(gastosDaSemana(semLimite, '2026-11-04').usoDoLimitePercentual).toBeNull();
  });
});
