import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  competenciaDe,
  dataDoNumero,
  dataNaCompetencia,
  diaDaSemana,
  diasNoMes,
  diferencaEmDias,
  fimDaSemana,
  inicioDaSemana,
  lerCompetencia,
  lerData,
  maiorData,
  menorData,
  mesesDeCalendario,
  montarData,
  numeroDoDia,
  primeiroDiaDa,
  somarDias,
  somarMeses,
  somarMesesNaCompetencia,
  ultimoDiaDa,
} from './datas';

describe('datas civis', () => {
  it('converte datas em número do dia e volta, sem perder nenhum dia', () => {
    expect(numeroDoDia('1970-01-01')).toBe(0);
    expect(numeroDoDia('2026-11-04')).toBe(20_761); // conferido com Date.UTC fora do motor
    fc.assert(
      fc.property(fc.integer({ min: -200_000, max: 200_000 }), (numero) => {
        expect(numeroDoDia(dataDoNumero(numero))).toBe(numero);
      }),
    );
  });

  it('recusa datas mal formadas ou inexistentes', () => {
    expect(() => lerData('04/11/2026')).toThrow('Use AAAA-MM-DD');
    expect(() => lerData('2026-02-29')).toThrow('inexistente');
    expect(() => lerData('2026-13-01')).toThrow('inexistente');
    expect(() => montarData(2026, 4, 31)).toThrow('inexistente');
    expect(() => lerCompetencia('2026-13')).toThrow('Competência inválida');
    expect(() => lerCompetencia('nov/2026')).toThrow('Competência inválida');
  });

  it('conhece anos bissextos e o tamanho de cada mês', () => {
    expect(diasNoMes(2026, 2)).toBe(28);
    expect(diasNoMes(2028, 2)).toBe(29);
    expect(diasNoMes(2100, 2)).toBe(28);
    expect(diasNoMes(2000, 2)).toBe(29);
    expect(diasNoMes(2026, 4)).toBe(30);
    expect(diasNoMes(2026, 12)).toBe(31);
  });

  it('a semana vai de segunda a domingo', () => {
    expect(diaDaSemana('2026-11-02')).toBe(1);
    expect(diaDaSemana('2026-11-04')).toBe(3);
    expect(diaDaSemana('2026-11-08')).toBe(7);
    expect(inicioDaSemana('2026-11-08')).toBe('2026-11-02');
    expect(fimDaSemana('2026-11-02')).toBe('2026-11-08');
  });

  it('a semana pode cruzar o mês e o ano', () => {
    expect(inicioDaSemana('2026-12-31')).toBe('2026-12-28');
    expect(fimDaSemana('2026-12-31')).toBe('2027-01-03');
    expect(inicioDaSemana('2027-01-01')).toBe('2026-12-28');
  });

  it('dia 31 usa o último dia dos meses menores', () => {
    expect(dataNaCompetencia('2026-02', 31)).toBe('2026-02-28');
    expect(dataNaCompetencia('2028-02', 31)).toBe('2028-02-29');
    expect(dataNaCompetencia('2026-04', 31)).toBe('2026-04-30');
    expect(dataNaCompetencia('2026-05', 31)).toBe('2026-05-31');
  });

  it('soma dias, meses e competências', () => {
    expect(somarDias('2026-12-30', 3)).toBe('2027-01-02');
    expect(diferencaEmDias('2026-11-02', '2026-11-15')).toBe(13);
    expect(somarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(somarMeses('2026-01-31', 2)).toBe('2026-03-31');
    expect(somarMeses('2026-11-02', 21)).toBe('2028-08-02');
    expect(somarMesesNaCompetencia('2026-11', 2)).toBe('2027-01');
    expect(somarMesesNaCompetencia('2026-01', -1)).toBe('2025-12');
    expect(competenciaDe('2026-11-04')).toBe('2026-11');
    expect(primeiroDiaDa('2026-02')).toBe('2026-02-01');
    expect(ultimoDiaDa('2028-02')).toBe('2028-02-29');
    expect(menorData('2026-11-02', '2026-11-01')).toBe('2026-11-01');
    expect(maiorData('2026-11-02', '2026-11-01')).toBe('2026-11-02');
  });
});

describe('meses de calendário até o prazo (D1)', () => {
  it('dá meses inteiros quando o prazo cai no mesmo dia', () => {
    // A fração usaria o mês seguinte ao último completo: de 02/05 a 02/06 de 2028, 31 dias.
    expect(mesesDeCalendario('2026-11-02', '2028-05-02')).toEqual({
      inteiros: 18,
      diasRestantes: 0,
      diasDoMes: 31,
    });
    expect(mesesDeCalendario('2026-11-02', '2027-07-02').inteiros).toBe(8);
  });

  it('conta a fração pelos dias do mês seguinte', () => {
    // 31/01 + 1 mês = 28/02; de 28/02 a 15/03 são 15 dias de um "mês" de 31 (28/02 a 31/03).
    expect(mesesDeCalendario('2026-01-31', '2026-03-15')).toEqual({
      inteiros: 1,
      diasRestantes: 15,
      diasDoMes: 31,
    });
    expect(mesesDeCalendario('2026-11-02', '2026-11-17')).toEqual({
      inteiros: 0,
      diasRestantes: 15,
      diasDoMes: 30,
    });
  });

  it('é zero quando o prazo não está no futuro', () => {
    expect(mesesDeCalendario('2026-11-02', '2026-11-02').inteiros).toBe(0);
    expect(mesesDeCalendario('2026-11-02', '2026-10-01')).toEqual({
      inteiros: 0,
      diasRestantes: 0,
      diasDoMes: 1,
    });
  });
});
