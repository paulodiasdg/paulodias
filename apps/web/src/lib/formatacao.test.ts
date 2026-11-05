import { describe, expect, it } from 'vitest';
import {
  centavosParaTexto,
  comMaiuscula,
  dataCivilEm,
  ErroDeValidacao,
  formatarCompetencia,
  formatarData,
  formatarDecimos,
  formatarDiaEMes,
  formatarMesCurto,
  formatarMesesDecimos,
  formatarPercentualDecimos,
  formatarReais,
  formatarSemana,
  hojeNoBrasil,
  lerReais,
} from './formatacao';

describe('formatação para a tela', () => {
  it('mostra reais no padrão brasileiro', () => {
    expect(formatarReais(123_456)).toBe('R$ 1.234,56');
    expect(formatarReais(0)).toBe('R$ 0,00');
    expect(formatarReais(-5_000)).toBe('-R$ 50,00');
    expect(centavosParaTexto(123_456)).toBe('1234,56');
    expect(centavosParaTexto(-5)).toBe('-0,05');
  });

  it('mostra datas e meses', () => {
    expect(formatarData('2026-11-05')).toBe('05/11/2026');
    expect(formatarCompetencia('2026-11')).toBe('novembro de 2026');
    expect(formatarCompetencia('2027-03')).toBe('março de 2027');
    expect(comMaiuscula(formatarCompetencia('2026-11'))).toBe('Novembro de 2026');
    expect(formatarDiaEMes('2026-11-05')).toBe('05/11');
    expect(formatarSemana('2026-11-02', '2026-11-08')).toBe('02/11 a 08/11');
    expect(formatarSemana('2026-12-28', '2027-01-03')).toBe('28/12/2026 a 03/01/2027');
    expect(formatarMesCurto('2027-03')).toBe('mar/2027');
  });

  it('mostra medidas em décimos sem ponto flutuante', () => {
    expect(formatarDecimos(439)).toBe('43,9');
    expect(formatarDecimos(0)).toBe('0,0');
    expect(formatarDecimos(-15)).toBe('-1,5');
    expect(formatarPercentualDecimos(1100)).toBe('110,0%');
    expect(formatarMesesDecimos(15)).toBe('1,5 mês');
    expect(formatarMesesDecimos(60)).toBe('6,0 meses');
  });
});

describe('leitura de valores digitados', () => {
  it.each([
    ['1.234,56', 123_456],
    ['1234,56', 123_456],
    ['1234.56', 123_456],
    ['1234', 123_400],
    ['7.700', 770_000],
    ['R$ 2.130,00', 213_000],
    ['0,5', 50],
    [',99', 99],
    ['-30,00', -3_000],
  ])('lê %s como %i centavos', (texto, centavos) => {
    expect(lerReais(texto)).toBe(centavos);
  });

  it.each(['', 'abc', '1,234,56', '12,345', '1.2.3,4x'])('recusa "%s"', (texto) => {
    expect(() => lerReais(texto, 'valor')).toThrow(ErroDeValidacao);
  });
});

describe('hoje no horário de Brasília', () => {
  it('usa o fuso de São Paulo, não o do servidor', () => {
    // 02h00 UTC de 05/11 ainda é 04/11 em Brasília (UTC−3).
    expect(hojeNoBrasil(new Date('2026-11-05T02:00:00Z'))).toBe('2026-11-04');
    expect(hojeNoBrasil(new Date('2026-11-05T03:00:00Z'))).toBe('2026-11-05');
    expect(dataCivilEm(new Date('2026-11-05T02:00:00Z'), 'UTC')).toBe('2026-11-05');
  });
});
