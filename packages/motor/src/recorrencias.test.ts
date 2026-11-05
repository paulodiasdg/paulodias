import { describe, expect, it } from 'vitest';
import { entraNaReservaDeContas, entraNoOrcamento, estavaEmAberto, listarContas } from './contas';
import { projetarOcorrencias } from './recorrencias';
import { avulsa, dadosVazios, fixa, renda } from './testes/construtores';

describe('projeção de recorrências', () => {
  it('projeta uma ocorrência por mês a partir do início, no dia certo', () => {
    const dados = dadosVazios({
      recorrencias: [fixa('aluguel', 213_000, 31, { inicio: '2026-01-10' })],
    });
    const ocorrencias = projetarOcorrencias(dados, 'fixa', null, '2026-04-30');
    expect(ocorrencias.map((o) => o.vencimento)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
    expect(ocorrencias.every((o) => o.ocorrenciaId === null && o.status === 'pendente')).toBe(true);
  });

  it('não projeta antes do início nem depois do fim', () => {
    const dados = dadosVazios({
      recorrencias: [fixa('curso', 50_000, 5, { inicio: '2026-03-10', fim: '2026-06-05' })],
    });
    expect(
      projetarOcorrencias(dados, 'fixa', '2026-01-01', '2026-12-31').map((o) => o.competencia),
    ).toEqual(['2026-04', '2026-05', '2026-06']);
  });

  it('usa o valor e o status da ocorrência gravada', () => {
    const dados = dadosVazios({
      recorrencias: [renda('salario', 770_000, 5)],
      ocorrencias: [
        {
          id: 'o1',
          recorrenciaId: 'salario',
          competencia: '2026-11',
          valorCentavos: 800_000,
          status: 'recebida',
          pagoEm: '2026-11-05',
        },
      ],
    });
    const [novembro, dezembro] = projetarOcorrencias(dados, 'renda', '2026-11-01', '2026-12-31');
    expect(novembro).toMatchObject({
      valorCentavos: 800_000,
      status: 'recebida',
      ocorrenciaId: 'o1',
    });
    expect(dezembro).toMatchObject({
      valorCentavos: 770_000,
      status: 'pendente',
      ocorrenciaId: null,
    });
  });

  it('recorrência inativa só aparece pelas ocorrências já pagas', () => {
    const dados = dadosVazios({
      recorrencias: [fixa('academia', 12_000, 10, { ativa: false })],
      ocorrencias: [
        {
          id: 'p',
          recorrenciaId: 'academia',
          competencia: '2026-09',
          valorCentavos: 12_000,
          status: 'paga',
          pagoEm: '2026-09-10',
        },
        {
          id: 'q',
          recorrenciaId: 'academia',
          competencia: '2026-10',
          valorCentavos: 12_000,
          status: 'pendente',
          pagoEm: null,
        },
      ],
    });
    expect(
      projetarOcorrencias(dados, 'fixa', null, '2026-12-31').map((o) => o.ocorrenciaId),
    ).toEqual(['p']);
  });

  it('separa rendas de fixas', () => {
    const dados = dadosVazios({ recorrencias: [renda('salario', 1, 5), fixa('aluguel', 1, 5)] });
    expect(
      projetarOcorrencias(dados, 'renda', '2026-11-01', '2026-11-30').map((o) => o.recorrencia.id),
    ).toEqual(['salario']);
  });
});

describe('contas a pagar', () => {
  const dados = dadosVazios({
    recorrencias: [fixa('streaming', 5_590, 10, { pagaNoCartao: true, inicio: '2026-11-01' })],
    contasAvulsas: [
      avulsa('fatura', 184_250, '2026-11-20', { quitaItens: true }),
      avulsa('ipva', 38_000, '2026-11-15', { pagoEm: '2026-11-03' }),
    ],
  });

  it('junta fixas e avulsas em ordem de vencimento', () => {
    expect(listarContas(dados, '2026-11-01', '2026-11-30').map((c) => c.chave)).toEqual([
      'fixa:streaming:2026-11',
      'avulsa:ipva',
      'avulsa:fatura',
    ]);
  });

  it('fatura com itens importados fica fora do orçamento; fixa no cartão, fora da reserva (D4)', () => {
    const [streaming, ipva, fatura] = listarContas(dados, '2026-11-01', '2026-11-30');
    expect(entraNaReservaDeContas(streaming!)).toBe(false);
    expect(entraNoOrcamento(streaming!)).toBe(true);
    expect(entraNaReservaDeContas(fatura!)).toBe(true);
    expect(entraNoOrcamento(fatura!)).toBe(false);
    // Paga em 03/11: estava em aberto no início de 02 e de 03, e não mais no de 04.
    expect(estavaEmAberto(ipva!, '2026-11-02')).toBe(true);
    expect(estavaEmAberto(ipva!, '2026-11-03')).toBe(true);
    expect(estavaEmAberto(ipva!, '2026-11-04')).toBe(false);
  });
});
