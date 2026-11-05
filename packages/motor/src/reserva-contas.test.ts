import { describe, expect, it } from 'vitest';
import { calcularReservaContas } from './reserva-contas';
import { avulsa, dadosVazios, fixa, movimento } from './testes/construtores';

const HOJE = '2026-11-04'; // semana de 02 a 08/11

describe('reserva semanal para contas (regra 3.1)', () => {
  it('sem contas, não pede nada', () => {
    const reserva = calcularReservaContas(dadosVazios(), HOJE);
    expect(reserva.valorSemanalCentavos).toBe(0);
    expect(reserva.semanaCritica).toBeNull();
    expect(reserva.dataLimite).toBeNull();
    expect(reserva.semanas).toHaveLength(8);
  });

  it('com saldo maior que todas as contas, não pede nada', () => {
    const dados = dadosVazios({
      contasAvulsas: [avulsa('boleto', 50_000, '2026-11-20')],
      movimentos: [movimento('saldo', 'ajuste', 60_000, '2026-10-30')],
    });
    expect(calcularReservaContas(dados, HOJE).valorSemanalCentavos).toBe(0);
  });

  it('conta vencida e não paga entra na semana 1', () => {
    const dados = dadosVazios({ contasAvulsas: [avulsa('atrasada', 30_000, '2026-10-20')] });
    const reserva = calcularReservaContas(dados, HOJE);
    expect(reserva.semanas[0]!.contas.map((c) => c.chave)).toEqual(['avulsa:atrasada']);
    expect(reserva.valorSemanalCentavos).toBe(30_000);
    expect(reserva.dataLimite).toBe('2026-11-08');
  });

  it('fixas não pagas desde o início da recorrência contam como vencidas', () => {
    const dados = dadosVazios({
      recorrencias: [fixa('luz', 20_000, 10, { inicio: '2026-09-01' })],
    });
    // Setembro e outubro vencidos (semana 1) e novembro na semana 2.
    const reserva = calcularReservaContas(dados, HOJE);
    expect(reserva.semanas[0]!.totalCentavos).toBe(40_000);
    expect(reserva.semanas[1]!.totalCentavos).toBe(20_000);
  });

  it('conta paga antes da semana não entra; paga nesta semana continua na semana original (D3)', () => {
    const dados = dadosVazios({
      contasAvulsas: [
        avulsa('paga-antes', 10_000, '2026-11-10', { pagoEm: '2026-10-31' }),
        avulsa('paga-agora', 20_000, '2026-11-10', { pagoEm: '2026-11-03' }),
      ],
    });
    expect(calcularReservaContas(dados, HOJE).semanas[1]!.contas.map((c) => c.chave)).toEqual([
      'avulsa:paga-agora',
    ]);
  });

  it('ignora contas além de 8 semanas e fixas pagas no cartão', () => {
    const dados = dadosVazios({
      recorrencias: [fixa('streaming', 5_590, 10, { pagaNoCartao: true })],
      contasAvulsas: [avulsa('longe', 99_900, '2027-01-04')],
    });
    // A semana 8 termina em 27/12/2026.
    expect(calcularReservaContas(dados, HOJE).valorSemanalCentavos).toBe(0);
  });

  it('a fatura com itens importados entra na reserva', () => {
    const dados = dadosVazios({
      contasAvulsas: [avulsa('fatura', 184_250, '2026-11-20', { quitaItens: true })],
    });
    // 1.842,50 ÷ 3 semanas = 614,17 → R$ 615.
    expect(calcularReservaContas(dados, HOJE).valorSemanalCentavos).toBe(61_500);
  });

  it('arredonda para cima em reais e informa quanto falta guardar na semana', () => {
    const dados = dadosVazios({
      contasAvulsas: [avulsa('boleto', 100_001, '2026-11-08')],
      movimentos: [movimento('aporte', 'aporte', 40_000, HOJE)],
    });
    const reserva = calcularReservaContas(dados, HOJE);
    expect(reserva.valorSemanalCentavos).toBe(100_100);
    expect(reserva.aportadoNaSemanaCentavos).toBe(40_000);
    expect(reserva.faltaGuardarNaSemanaCentavos).toBe(60_100);
  });

  it('em empate, a semana crítica é a mais próxima', () => {
    const dados = dadosVazios({
      contasAvulsas: [avulsa('a', 10_000, '2026-11-05'), avulsa('b', 10_000, '2026-11-12')],
    });
    const reserva = calcularReservaContas(dados, HOJE);
    expect(reserva.valorSemanalCentavos).toBe(10_000);
    expect(reserva.semanaCritica).toBe(1);
  });
});
