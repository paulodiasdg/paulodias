import { describe, expect, it } from 'vitest';
import { ehGastoVariavel, orcamentoDoMes } from './orcamento';
import { avulsa, dadosVazios, despesa, fixa, receita, renda } from './testes/construtores';

describe('orçamento do mês (regra 3.2)', () => {
  it('Livre = renda − fixas − contas avulsas', () => {
    const dados = dadosVazios({
      recorrencias: [renda('salario', 500_000, 5), fixa('aluguel', 200_000, 10)],
      contasAvulsas: [
        avulsa('ipva', 50_000, '2026-11-20'),
        avulsa('dezembro', 10_000, '2026-12-01'),
      ],
      lancamentos: [receita('freela', 30_000, '2026-11-15')],
    });
    const orcamento = orcamentoDoMes(dados, '2026-11');
    expect(orcamento.rendaRecorrenteCentavos).toBe(500_000);
    expect(orcamento.receitasAvulsasCentavos).toBe(30_000);
    expect(orcamento.rendaCentavos).toBe(530_000);
    expect(orcamento.fixasCentavos).toBe(200_000);
    expect(orcamento.contasAvulsasCentavos).toBe(50_000);
    expect(orcamento.livreCentavos).toBe(280_000);
  });

  it('receita vinculada a uma renda recorrente não conta duas vezes', () => {
    const dados = dadosVazios({
      recorrencias: [renda('salario', 500_000, 5)],
      lancamentos: [receita('recebimento', 500_000, '2026-11-05', { ocorrenciaId: 'o1' })],
    });
    expect(orcamentoDoMes(dados, '2026-11').rendaCentavos).toBe(500_000);
  });

  it('fatura com itens importados fica fora; fixa paga no cartão fica dentro (D4)', () => {
    const dados = dadosVazios({
      recorrencias: [fixa('streaming', 5_590, 10, { pagaNoCartao: true })],
      contasAvulsas: [avulsa('fatura', 184_250, '2026-11-20', { quitaItens: true })],
    });
    const orcamento = orcamentoDoMes(dados, '2026-11');
    expect(orcamento.fixasCentavos).toBe(5_590);
    expect(orcamento.contasAvulsasCentavos).toBe(0);
  });

  it('gasto variável é a despesa sem vínculo com conta', () => {
    expect(ehGastoVariavel(despesa('mercado', 1, '2026-11-01'))).toBe(true);
    expect(ehGastoVariavel(despesa('luz', 1, '2026-11-01', { contaAvulsaId: 'c' }))).toBe(false);
    expect(ehGastoVariavel(despesa('aluguel', 1, '2026-11-01', { ocorrenciaId: 'o' }))).toBe(false);
    expect(ehGastoVariavel(receita('salario', 1, '2026-11-01'))).toBe(false);
    expect(ehGastoVariavel(despesa('pix', 1, '2026-11-01', { tipo: 'transferencia' }))).toBe(false);
  });
});

describe('estimativa de gastos variáveis (regra 3.2)', () => {
  it('usa o teto quando definido', () => {
    const dados = dadosVazios({ perfil: { tetoVariavelCentavos: 150_000 } });
    expect(orcamentoDoMes(dados, '2026-11').estimativaVariaveis).toEqual({
      valorCentavos: 150_000,
      fonte: 'teto',
      mesesUsados: [],
    });
  });

  it('sem teto, usa a média dos últimos 3 meses completos com dados', () => {
    const dados = dadosVazios({
      perfil: { tetoVariavelCentavos: null, inicioEm: '2026-05-01' },
      lancamentos: [
        despesa('mai', 90_000, '2026-05-10'),
        despesa('jul', 100_000, '2026-07-10'),
        despesa('set', 110_000, '2026-09-10'),
        despesa('out', 130_001, '2026-10-10'),
        despesa('nov', 999_999, '2026-11-02'), // mês corrente não entra
      ],
    });
    expect(orcamentoDoMes(dados, '2026-11').estimativaVariaveis).toEqual({
      valorCentavos: 113_334, // (130.001 + 110.000 + 100.000) ÷ 3, ao centavo mais próximo
      fonte: 'media',
      mesesUsados: ['2026-10', '2026-09', '2026-07'],
    });
  });

  it('ignora o mês parcial de entrada no sistema', () => {
    const dados = dadosVazios({
      perfil: { tetoVariavelCentavos: null, inicioEm: '2026-09-15' },
      recorrencias: [renda('salario', 400_000, 5)],
      lancamentos: [despesa('set', 50_000, '2026-09-20'), despesa('out', 80_000, '2026-10-10')],
    });
    expect(orcamentoDoMes(dados, '2026-11').estimativaVariaveis).toMatchObject({
      valorCentavos: 80_000,
      mesesUsados: ['2026-10'],
    });
  });

  it('sem histórico, usa 30% da renda', () => {
    const dados = dadosVazios({
      perfil: { tetoVariavelCentavos: null, inicioEm: '2026-11-01' },
      recorrencias: [renda('salario', 770_000, 5)],
    });
    expect(orcamentoDoMes(dados, '2026-11').estimativaVariaveis).toEqual({
      valorCentavos: 231_000,
      fonte: 'percentual_renda',
      mesesUsados: [],
    });
  });
});
