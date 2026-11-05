import { describe, expect, it } from 'vitest';
import { comparacao503020, mesDaComparacao503020 } from './comparacao-50-30-20';
import { avulsa, dadosVazios, despesa, fixa, meta, movimento, renda } from './testes/construtores';
import type { Categoria, DadosFinanceiros } from './tipos';

const CATEGORIAS: Categoria[] = [
  { id: 'moradia', nome: 'Moradia', grupo: 'essencial' },
  { id: 'alimentacao', nome: 'Alimentação', grupo: 'essencial' },
  { id: 'impostos', nome: 'Impostos e taxas', grupo: 'essencial' },
  { id: 'assinaturas', nome: 'Assinaturas', grupo: 'livre' },
  { id: 'restaurantes', nome: 'Restaurantes e delivery', grupo: 'livre' },
  { id: 'salario', nome: 'Salário', grupo: 'receita' },
];

/** Renda de R$ 10.000 e um mês de outubro completo (a pessoa usa o sistema desde setembro). */
function cenario(extra: Partial<DadosFinanceiros> = {}): DadosFinanceiros {
  return dadosVazios({
    perfil: { tetoVariavelCentavos: null, inicioEm: '2026-09-01' },
    categorias: CATEGORIAS,
    recorrencias: [
      renda('salario', 1_000_000, 5, { inicio: '2026-09-01' }),
      fixa('aluguel', 300_000, 10, { inicio: '2026-09-01', categoriaId: 'moradia' }),
      fixa('streaming', 5_000, 12, { inicio: '2026-09-01', categoriaId: 'assinaturas' }),
      fixa('seguro', 10_000, 20, { inicio: '2026-09-01' }),
    ],
    contasAvulsas: [
      avulsa('iptu', 40_000, '2026-10-15', { categoriaId: 'impostos' }),
      // Fatura com itens importados: os itens já são lançamentos e ela não entra (D4).
      avulsa('fatura', 100_000, '2026-10-25', { quitaItens: true }),
    ],
    lancamentos: [
      despesa('mercado', 120_000, '2026-10-08', { categoriaId: 'alimentacao' }),
      despesa('jantar', 61_000, '2026-10-18', { categoriaId: 'restaurantes' }),
      despesa('avulso', 7_000, '2026-10-21'),
      despesa('categoria-de-receita', 3_000, '2026-10-22', { categoriaId: 'salario' }),
      // Pagamento de conta não é gasto variável: a conta já entrou pelo valor dela.
      despesa('pagamento-aluguel', 300_000, '2026-10-10', { ocorrenciaId: 'aluguel-out' }),
      despesa('fora-do-mes', 50_000, '2026-11-02', { categoriaId: 'restaurantes' }),
    ],
    metas: [meta('viagem', 1_000_000, '2027-11-02', 1), meta('carro', 1_000_000, '2028-11-02', 2)],
    movimentos: [
      movimento('m1', 'aporte', 150_000, '2026-10-05', { destino: 'meta', metaId: 'viagem' }),
      movimento('m2', 'aporte', 50_000, '2026-10-12', { destino: 'meta', metaId: 'carro' }),
      // Correção de saldo e reserva de contas não são poupança do mês.
      movimento('m3', 'ajuste', 30_000, '2026-10-12', { destino: 'meta', metaId: 'carro' }),
      movimento('m4', 'aporte', 90_000, '2026-10-05'),
    ],
    ...extra,
  });
}

describe('comparação 50/30/20', () => {
  it('usa o último mês completo, com o que aconteceu', () => {
    const comparacao = comparacao503020(cenario(), '2026-11-04')!;
    expect(comparacao).toMatchObject({
      competencia: '2026-10',
      parcial: false,
      ate: '2026-10-31',
      rendaCentavos: 1_000_000,
    });
    // Necessidades: aluguel 3.000 + IPTU 400 + mercado 1.200 = 4.600 (46%).
    // Desejos: streaming 50 + jantar 610 = 660 (6,6% → 7%).
    // Metas: aportes de 1.500 + 500 = 2.000 (20%).
    // Sem categoria: seguro 100 + avulso 70 + categoria de receita 30 = 200 (2%).
    expect(comparacao.grupos).toEqual([
      {
        chave: 'necessidades',
        valorCentavos: 460_000,
        percentual: 46,
        referenciaPercentual: 50,
        referenciaCentavos: 500_000,
        dentroDaReferencia: true,
      },
      {
        chave: 'desejos',
        valorCentavos: 66_000,
        percentual: 7,
        referenciaPercentual: 30,
        referenciaCentavos: 300_000,
        dentroDaReferencia: true,
      },
      {
        chave: 'metas',
        valorCentavos: 200_000,
        percentual: 20,
        referenciaPercentual: 20,
        referenciaCentavos: 200_000,
        dentroDaReferencia: true,
      },
    ]);
    expect(comparacao.semCategoriaCentavos).toBe(20_000);
    expect(comparacao.semCategoriaPercentual).toBe(2);
  });

  it('compara sem arredondar: 50,01% de necessidades já passa da referência', () => {
    const dados = cenario();
    const comExtra = {
      ...dados,
      lancamentos: [
        ...dados.lancamentos,
        despesa('farmacia', 40_100, '2026-10-28', { categoriaId: 'alimentacao' }),
      ],
    };
    const necessidades = comparacao503020(comExtra, '2026-11-04')!.grupos[0]!;
    expect(necessidades.valorCentavos).toBe(500_100);
    expect(necessidades.percentual).toBe(50);
    expect(necessidades.dentroDaReferencia).toBe(false);
  });

  it('metas abaixo de 20% ficam fora da referência', () => {
    const dados = cenario();
    const semUmAporte = { ...dados, movimentos: dados.movimentos.filter((m) => m.id !== 'm2') };
    const metas = comparacao503020(semUmAporte, '2026-11-04')!.grupos[2]!;
    expect(metas).toMatchObject({
      valorCentavos: 150_000,
      percentual: 15,
      dentroDaReferencia: false,
    });
  });

  it('sem mês completo, usa o mês atual: contas do mês inteiro, gastos e aportes até hoje', () => {
    const dados = cenario({ perfil: { tetoVariavelCentavos: null, inicioEm: '2026-10-10' } });
    const comNovembro = {
      ...dados,
      lancamentos: [
        ...dados.lancamentos,
        despesa('depois-de-hoje', 99_000, '2026-11-20', { categoriaId: 'alimentacao' }),
      ],
      movimentos: [
        ...dados.movimentos,
        movimento('m5', 'aporte', 40_000, '2026-11-03', { destino: 'meta', metaId: 'viagem' }),
      ],
    };
    const comparacao = comparacao503020(comNovembro, '2026-11-04')!;
    expect(comparacao).toMatchObject({ competencia: '2026-11', parcial: true, ate: '2026-11-04' });
    // Necessidades: só o aluguel de novembro (o IPTU foi em outubro); desejos: streaming e o
    // jantar de 02/11; metas: o aporte de 03/11. O gasto de 20/11 ainda não aconteceu.
    expect(comparacao.grupos.map((g) => g.valorCentavos)).toEqual([300_000, 55_000, 40_000]);
    expect(comparacao.semCategoriaCentavos).toBe(10_000);
  });

  it('diz qual mês a comparação usa', () => {
    expect(mesDaComparacao503020(cenario(), '2026-11-04')).toEqual({
      competencia: '2026-10',
      parcial: false,
      ate: '2026-10-31',
    });
    const novo = cenario({ perfil: { tetoVariavelCentavos: null, inicioEm: '2026-10-02' } });
    expect(mesDaComparacao503020(novo, '2026-11-04')).toEqual({
      competencia: '2026-11',
      parcial: true,
      ate: '2026-11-04',
    });
  });

  it('sem renda no mês, não há comparação', () => {
    const dados = cenario();
    expect(
      comparacao503020(
        { ...dados, recorrencias: dados.recorrencias.filter((r) => r.tipo !== 'renda') },
        '2026-11-04',
      ),
    ).toBeNull();
  });

  it('sem categorias carregadas, tudo aparece como sem categoria', () => {
    const { categorias: _semCategorias, ...dados } = cenario();
    const comparacao = comparacao503020(dados, '2026-11-04')!;
    expect(comparacao.grupos[0]!.valorCentavos).toBe(0);
    expect(comparacao.grupos[1]!.valorCentavos).toBe(0);
    expect(comparacao.semCategoriaCentavos).toBe(460_000 + 66_000 + 20_000);
  });
});
