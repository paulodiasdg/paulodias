import { describe, expect, it } from 'vitest';
import { orcamentoDoMes } from './orcamento';
import { agendaDeReservas, divisaoDoMes, projecaoDeMeses, simularPlano } from './plano';
import { resumoDaSemana } from './semana';
import { cenario36, HOJE_3_6 } from './testes/cenario-3-6';
import { avulsa, dadosVazios, despesa, fixa, meta, movimento, renda } from './testes/construtores';
import type { DadosFinanceiros } from './tipos';

describe('agenda de 8 semanas', () => {
  const agenda = agendaDeReservas(cenario36(), HOJE_3_6);

  it('tem 8 semanas, de segunda a domingo, começando pela atual', () => {
    expect(agenda.map((semana) => [semana.inicio, semana.fim])).toEqual([
      ['2026-11-02', '2026-11-08'],
      ['2026-11-09', '2026-11-15'],
      ['2026-11-16', '2026-11-22'],
      ['2026-11-23', '2026-11-29'],
      ['2026-11-30', '2026-12-06'],
      ['2026-12-07', '2026-12-13'],
      ['2026-12-14', '2026-12-20'],
      ['2026-12-21', '2026-12-27'],
    ]);
  });

  it('a semana atual repete o painel: R$ 925 para contas e R$ 490 para metas', () => {
    const resumo = resumoDaSemana(cenario36(), HOJE_3_6);
    expect(agenda[0]).toMatchObject({
      contasCentavos: 52_000,
      paraContasCentavos: 92_500,
      paraMetasCentavos: 49_000,
      totalCentavos: resumo.totalAReservarCentavos,
    });
    expect(agenda[0]!.paraMetas).toEqual([
      { metaId: 'emergencia', nome: 'Reserva de emergência', valorCentavos: 28_500 },
      { metaId: 'viagem', nome: 'Viagem', valorCentavos: 13_000 },
      { metaId: 'notebook', nome: 'Notebook', valorCentavos: 7_500 },
    ]);
  });

  it('recalcula cada semana supondo que a pessoa guarda o pedido e paga no vencimento', () => {
    // Semana 1: 800 + 925 − 520 = 1.205. Semana 2: 1.205 + 925 − 2.130 = 0, e o aluguel é pago
    // inteiro. Semana 3: só faltam o IPVA e o condomínio (R$ 730) nas próximas semanas apertadas.
    // Semana 4: a mais apertada passa a ser a 8ª (até 17/01), com (5.650 − 0) ÷ 8 = 706,25.
    expect(agenda.map((semana) => semana.contasCentavos)).toEqual([
      52_000, 213_000, 73_000, 0, 0, 52_000, 213_000, 35_000,
    ]);
    expect(agenda.map((semana) => semana.paraContasCentavos)).toEqual([
      92_500, 92_500, 73_000, 70_700, 70_700, 70_600, 70_600, 70_600,
    ]);
    expect(agenda.map((semana) => semana.saldoDeContasNoFimCentavos)).toEqual([
      120_500, 0, 0, 70_700, 141_400, 160_000, 17_600, 53_200,
    ]);
  });

  it('guardando o pedido, nenhuma conta da agenda fica descoberta', () => {
    for (const semana of agenda)
      expect(semana.saldoDeContasNoFimCentavos).toBeGreaterThanOrEqual(0);
    // Saldo de cada domingo = saldo anterior + guardado − contas: tudo pago inteiro.
    let saldo = 80_000;
    for (const semana of agenda) {
      saldo += semana.paraContasCentavos - semana.contasCentavos;
      expect(semana.saldoDeContasNoFimCentavos).toBe(saldo);
    }
  });

  it('em dezembro, sem o IPVA, sobra verba e o notebook recebe mais', () => {
    expect(
      agenda.map((semana) => semana.paraMetas.find((m) => m.metaId === 'notebook')?.valorCentavos),
    ).toEqual([7_500, 7_500, 7_500, 7_500, 7_500, 16_300, 16_300, 16_200]);
  });

  it('o que já foi guardado na semana não muda a agenda: a simulação só completa o que falta', () => {
    const comAporte: DadosFinanceiros = {
      ...cenario36(),
      movimentos: [
        ...cenario36().movimentos,
        movimento('parcial', 'aporte', 50_000, '2026-11-03'),
        movimento('parcial-meta', 'aporte', 10_000, '2026-11-03', {
          destino: 'meta',
          metaId: 'viagem',
        }),
      ],
    };
    const outra = agendaDeReservas(comAporte, HOJE_3_6);
    expect(outra.map((s) => s.totalCentavos)).toEqual(agenda.map((s) => s.totalCentavos));
    expect(outra.map((s) => s.saldoDeContasNoFimCentavos)).toEqual(
      agenda.map((s) => s.saldoDeContasNoFimCentavos),
    );
  });

  it('paga hoje, na simulação, a conta vencida, que não volta na semana seguinte', () => {
    const dados = dadosVazios({
      recorrencias: [fixa('luz', 20_000, 3, { inicio: '2026-11-01' })],
      contasAvulsas: [avulsa('multa', 10_000, '2026-10-20')],
    });
    const [atual, proxima] = simularPlano(dados, '2026-11-04', 2);
    expect(atual!.contas.map((c) => c.nome)).toEqual(['multa', 'luz']);
    expect(atual!.paraContasCentavos).toBe(30_000);
    expect(atual!.saldoDeContasNoFimCentavos).toBe(0);
    expect(proxima!.contas).toEqual([]);
    // Só a luz de dezembro (03/12, 4ª semana a partir de 09/11): 200 ÷ 4 = 50 por semana.
    expect(proxima!.paraContasCentavos).toBe(5_000);
  });

  it('fixa paga no cartão não pede reserva nem sai dela', () => {
    const dados = dadosVazios({
      recorrencias: [fixa('streaming', 5_000, 10, { inicio: '2026-11-01', pagaNoCartao: true })],
      movimentos: [movimento('saldo', 'ajuste', 1_000, '2026-11-01')],
    });
    for (const semana of agendaDeReservas(dados, '2026-11-04')) {
      expect(semana.paraContasCentavos).toBe(0);
      expect(semana.saldoDeContasNoFimCentavos).toBe(1_000);
    }
  });
});

describe('divisão do mês', () => {
  it('no cenário 3.6: fixas, contas avulsas, metas, variáveis e folga somam a renda', () => {
    const divisao = divisaoDoMes(cenario36(), HOJE_3_6);
    expect(divisao).toMatchObject({
      competencia: '2026-11',
      rendaCentavos: 770_000,
      fixasCentavos: 300_000,
      contasAvulsasCentavos: 38_000,
      livreCentavos: 432_000,
      metasCentavos: 212_000,
      variaveisCentavos: 220_000,
      fonteDosVariaveis: 'teto',
      folgaCentavos: 0,
    });
    // 3.000 ÷ 7.700 = 38,96%; 380 ÷ 7.700 = 4,94%; 2.120 ÷ 7.700 = 27,53%; 2.200 ÷ 7.700 = 28,57%.
    expect(divisao.partes.map((p) => [p.chave, p.percentual])).toEqual([
      ['fixas', 39],
      ['contasAvulsas', 5],
      ['metas', 28],
      ['variaveis', 29],
      ['folga', 0],
    ]);
  });

  it('mostra a folga quando sobra dinheiro depois das metas', () => {
    const dados = dadosVazios({
      perfil: { tetoVariavelCentavos: 100_000, inicioEm: '2026-11-01' },
      recorrencias: [
        renda('salario', 500_000, 5, { inicio: '2026-11-01' }),
        fixa('aluguel', 150_000, 10, { inicio: '2026-11-01' }),
      ],
      metas: [meta('viagem', 120_000, '2027-11-02', 1)],
    });
    const divisao = divisaoDoMes(dados, '2026-11-04');
    // Livre 3.500, variáveis 1.000, meta 12.000 ÷ 12 = 100/mês: folga = 3.500 − 1.000 − 100.
    expect(divisao.metasCentavos).toBe(10_000);
    expect(divisao.folgaCentavos).toBe(240_000);
    expect(divisao.partes.find((p) => p.chave === 'folga')).toEqual({
      chave: 'folga',
      valorCentavos: 240_000,
      percentual: 48,
    });
  });

  it('com folga negativa, as metas ficam sem verba e o percentual é sobre o total', () => {
    const dados = dadosVazios({
      perfil: { tetoVariavelCentavos: 200_000, inicioEm: '2026-11-01' },
      recorrencias: [
        renda('salario', 300_000, 5, { inicio: '2026-11-01' }),
        fixa('aluguel', 200_000, 10, { inicio: '2026-11-01' }),
      ],
      metas: [meta('viagem', 100_000, '2027-11-02', 1)],
    });
    const divisao = divisaoDoMes(dados, '2026-11-04');
    expect(divisao.folgaCentavos).toBe(-100_000);
    expect(divisao.metasCentavos).toBe(0);
    // Comprometido: 2.000 + 2.000 = 4.000, maior que a renda de 3.000.
    expect(divisao.partes.map((p) => p.percentual)).toEqual([50, 0, 0, 50, 0]);
  });

  it('sem renda, os percentuais são zero', () => {
    const divisao = divisaoDoMes(
      dadosVazios({ recorrencias: [fixa('aluguel', 0, 10, { inicio: '2026-11-01' })] }),
      '2026-11-04',
    );
    expect(divisao.partes.every((p) => p.percentual === 0)).toBe(true);
  });
});

describe('projeção de 6 meses', () => {
  it('no cenário 3.6, vai de novembro a abril e dezembro já não tem o IPVA', () => {
    const projecao = projecaoDeMeses(cenario36(), HOJE_3_6);
    expect(projecao.map((mes) => mes.competencia)).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
      '2027-03',
      '2027-04',
    ]);
    expect(projecao[0]).toEqual(divisaoDoMes(cenario36(), HOJE_3_6));
    expect(projecao[1]).toMatchObject({
      contasAvulsasCentavos: 0,
      livreCentavos: 470_000,
      // Verba de 4.700 − 2.200 = 2.500, toda usada: o notebook segue com verba parcial.
      metasCentavos: 250_000,
      folgaCentavos: 0,
    });
    expect(projecao[1]!.metas.map((m) => m.situacao)).toEqual(['completa', 'completa', 'parcial']);
  });

  it('folga = Livre − variáveis − metas, e as metas nunca passam da verba', () => {
    for (const mes of projecaoDeMeses(cenario36(), HOJE_3_6)) {
      expect(mes.folgaCentavos).toBe(mes.livreCentavos - mes.variaveisCentavos - mes.metasCentavos);
      expect(mes.metasCentavos).toBeLessThanOrEqual(
        Math.max(0, mes.livreCentavos - mes.variaveisCentavos),
      );
    }
  });

  it('meta que termina libera verba para a seguinte', () => {
    // Verba de R$ 1.000 por mês. A curta pede 1.000 até janeiro; a longa fica sem verba até lá.
    const dados = dadosVazios({
      perfil: { tetoVariavelCentavos: 100_000, inicioEm: '2026-11-01' },
      recorrencias: [
        renda('salario', 300_000, 5, { inicio: '2026-11-01' }),
        fixa('aluguel', 100_000, 10, { inicio: '2026-11-01' }),
      ],
      metas: [meta('curta', 200_000, '2027-01-02', 1), meta('longa', 1_200_000, '2028-11-06', 2)],
    });
    const projecao = projecaoDeMeses(dados, '2026-11-04');
    const daMeta = (id: string) =>
      projecao.map((mes) => mes.metas.find((m) => m.metaId === id)!.situacao);
    expect(daMeta('curta')).toEqual([
      'completa',
      'completa',
      'concluida',
      'concluida',
      'concluida',
      'concluida',
    ]);
    expect(daMeta('longa')).toEqual([
      'sem_verba',
      'parcial',
      'completa',
      'completa',
      'completa',
      'completa',
    ]);
  });

  it('meses futuros estimam os variáveis sem o mês de hoje, que está pela metade', () => {
    const dados = dadosVazios({
      perfil: { tetoVariavelCentavos: null, inicioEm: '2026-07-01' },
      recorrencias: [renda('salario', 500_000, 5, { inicio: '2026-07-01' })],
      lancamentos: [
        despesa('agosto', 90_000, '2026-08-10'),
        despesa('setembro', 120_000, '2026-09-10'),
        despesa('outubro', 150_000, '2026-10-10'),
        despesa('novembro', 10_000, '2026-11-02'),
      ],
    });
    const hoje = '2026-11-04';
    const novembro = orcamentoDoMes(dados, '2026-11', hoje).estimativaVariaveis;
    const dezembro = orcamentoDoMes(dados, '2026-12', hoje).estimativaVariaveis;
    expect(novembro).toEqual({
      valorCentavos: 120_000,
      fonte: 'media',
      mesesUsados: ['2026-10', '2026-09', '2026-08'],
    });
    expect(dezembro).toEqual(novembro);
    // Sem a data de hoje, dezembro usaria novembro, que só tem 4 dias de gastos.
    expect(orcamentoDoMes(dados, '2026-12').estimativaVariaveis.mesesUsados).toEqual([
      '2026-11',
      '2026-10',
      '2026-09',
    ]);
    expect(projecaoDeMeses(dados, hoje).map((mes) => mes.variaveisCentavos)).toEqual([
      120_000, 120_000, 120_000, 120_000, 120_000, 120_000,
    ]);
  });

  it('com 1 mês, é só a divisão do mês atual', () => {
    expect(projecaoDeMeses(cenario36(), HOJE_3_6, 1)).toEqual([
      divisaoDoMes(cenario36(), HOJE_3_6),
    ]);
  });
});
