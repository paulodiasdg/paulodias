import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { montarData, somarDias } from './datas';
import { simularSemanas } from './simulacao';
import { cenario36, HOJE_3_6 } from './testes/cenario-3-6';
import { avulsa, dadosVazios, fixa, movimento } from './testes/construtores';
import type { DadosFinanceiros } from './tipos';

/** Gera uma data entre 2026 e 2030, sempre existente (dia até 28). */
const dataArbitraria = fc
  .record({
    ano: fc.integer({ min: 2026, max: 2030 }),
    mes: fc.integer({ min: 1, max: 12 }),
    dia: fc.integer({ min: 1, max: 28 }),
  })
  .map(({ ano, mes, dia }) => montarData(ano, mes, dia));

/** Contas fixas e avulsas aleatórias em torno do início da simulação. */
const cenarioArbitrario = fc
  .record({
    inicio: dataArbitraria,
    saldoInicial: fc.integer({ min: 0, max: 1_000_000 }),
    fixas: fc.array(
      fc.record({
        valor: fc.integer({ min: 1, max: 500_000 }),
        dia: fc.integer({ min: 1, max: 31 }),
        mesesAntes: fc.integer({ min: 0, max: 3 }),
        pagaNoCartao: fc.boolean(),
      }),
      { maxLength: 8 },
    ),
    avulsas: fc.array(
      fc.record({
        valor: fc.integer({ min: 1, max: 1_000_000 }),
        // Algumas já vencidas no início da simulação.
        diasDepois: fc.integer({ min: -30, max: 400 }),
        quitaItens: fc.boolean(),
      }),
      { maxLength: 20 },
    ),
  })
  .map(({ inicio, saldoInicial, fixas, avulsas }) => {
    const dados: DadosFinanceiros = dadosVazios({
      recorrencias: fixas.map((item, indice) =>
        fixa(`fixa-${indice}`, item.valor, item.dia, {
          inicio: somarDias(inicio, -30 * item.mesesAntes),
          pagaNoCartao: item.pagaNoCartao,
        }),
      ),
      contasAvulsas: avulsas.map((item, indice) =>
        avulsa(`avulsa-${indice}`, item.valor, somarDias(inicio, item.diasDepois), {
          quitaItens: item.quitaItens,
        }),
      ),
      movimentos:
        saldoInicial > 0
          ? [movimento('saldo-inicial', 'ajuste', saldoInicial, somarDias(inicio, -60))]
          : [],
    });
    return { dados, inicio };
  });

describe('simulação de 52 semanas (aceite da Etapa 2, critério D2)', () => {
  it('no cenário 3.6, guardando o valor pedido, toda conta é paga inteira pela reserva', () => {
    const resultado = simularSemanas(cenario36(), HOJE_3_6, 52);
    expect(resultado.semanas).toHaveLength(52);
    expect(resultado.semanas[0]!.valorPedidoCentavos).toBe(92_500);
    expect(resultado.contasDescobertas).toEqual([]);
    const pagas = resultado.semanas.flatMap((semana) => semana.pagamentos);
    // 3 fixas × 12 meses (novembro a outubro) e o IPVA.
    expect(pagas).toHaveLength(37);
    for (const semana of resultado.semanas) {
      expect(semana.saldoFinalCentavos).toBeGreaterThanOrEqual(0);
    }
  });

  it('com contas aleatórias, nenhuma conta fica descoberta no vencimento', () => {
    fc.assert(
      fc.property(cenarioArbitrario, ({ dados, inicio }) => {
        const resultado = simularSemanas(dados, inicio, 52);
        expect(resultado.contasDescobertas).toEqual([]);
        for (const semana of resultado.semanas) {
          expect(semana.saldoFinalCentavos).toBeGreaterThanOrEqual(0);
          expect(semana.valorPedidoCentavos % 100).toBe(0);
        }
      }),
      { numRuns: 150, seed: 20261104 },
    );
  });

  it('guardando R$ 1 a menos por semana, a reserva deixa conta descoberta', () => {
    // Controle negativo: prova que o valor pedido é o mínimo e que o teste detecta a falha.
    const resultado = simularSemanas(cenario36(), HOJE_3_6, 8, {
      quantoGuardar: (valorPedido) => Math.max(0, valorPedido - 100),
    });
    expect(resultado.contasDescobertas.map((pagamento) => pagamento.conta.nome)).toContain(
      'Aluguel',
    );
  });
});
