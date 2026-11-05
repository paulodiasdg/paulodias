import { describe, expect, it } from 'vitest';
import { dividirInteiros, exigirInteiro, paraInteiroSeguro } from './aritmetica';
import { centavos, dividir, paraCimaEmReais, proporcao, somar } from './dinheiro';

describe('dinheiro', () => {
  it('soma valores em centavos inteiros', () => {
    expect(somar([52_000, 213_000, 73_000])).toBe(338_000);
    expect(somar([])).toBe(0);
  });

  it('recusa valores que não são centavos inteiros', () => {
    expect(() => centavos(10.5)).toThrow(RangeError);
    expect(() => somar([100, 0.1])).toThrow(RangeError);
    expect(() => centavos(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
    expect(() => proporcao(100, 1.5, 2, 'cima')).toThrow(RangeError);
  });

  it('arredonda para cima em reais inteiros', () => {
    expect(paraCimaEmReais(92_500)).toBe(92_500);
    expect(paraCimaEmReais(28_462)).toBe(28_500);
    expect(paraCimaEmReais(1)).toBe(100);
    expect(paraCimaEmReais(0)).toBe(0);
    expect(paraCimaEmReais(-28_000)).toBe(-28_000);
    expect(paraCimaEmReais(-28_050)).toBe(-28_000);
  });

  it('converte mensal em semanal (× 12 ÷ 52) sem ponto flutuante', () => {
    expect(proporcao(123_333, 12, 52, 'cima')).toBe(28_462);
    expect(proporcao(56_250, 12, 52, 'cima')).toBe(12_981);
    expect(proporcao(32_417, 12, 52, 'baixo')).toBe(7_480);
  });

  it('divide com o arredondamento pedido', () => {
    expect(dividir(2_220_000, 18, 'proximo')).toBe(123_333);
    expect(dividir(5, 2, 'proximo')).toBe(3);
    expect(dividir(-5, 2, 'proximo')).toBe(-3);
    expect(dividir(7, 2, 'baixo')).toBe(3);
    expect(dividir(-7, 2, 'baixo')).toBe(-4);
    expect(dividir(7, 2, 'cima')).toBe(4);
    expect(dividir(-7, 2, 'cima')).toBe(-3);
    expect(dividir(7, -2, 'baixo')).toBe(-4);
    expect(dividir(6, 3, 'cima')).toBe(2);
  });
});

describe('aritmética inteira', () => {
  it('recusa divisão por zero', () => {
    expect(() => dividirInteiros(1n, 0n, 'cima')).toThrow('Divisão por zero');
  });

  it('é exata além da precisão do ponto flutuante', () => {
    const grande = 9_007_199_254_740_993n; // 2^53 + 1
    expect(dividirInteiros(grande * 3n, 3n, 'baixo')).toBe(grande);
    expect(() => paraInteiroSeguro(grande)).toThrow(RangeError);
  });

  it('confere inteiros', () => {
    expect(exigirInteiro(3)).toBe(3);
    expect(() => exigirInteiro(Number.NaN, 'dia')).toThrow('dia precisa ser inteiro');
  });
});
