import { describe, expect, it } from 'vitest';
import {
  centavosComPonto,
  centavosComSinal,
  centavosDeTexto,
  completarAno,
  corrigirDigitos,
  dataNoInicio,
  datasNoTexto,
  lerCompetenciaEscrita,
  lerDataCompleta,
  valoresNoTexto,
} from './texto';

describe('valores em reais', () => {
  it('lê o formato brasileiro sem ponto flutuante', () => {
    expect(centavosDeTexto('1.234,56')).toBe(123456);
    expect(centavosDeTexto('1234,56')).toBe(123456);
    expect(centavosDeTexto('0,07')).toBe(7);
    expect(centavosDeTexto('12,3')).toBeNull();
    expect(centavosDeTexto('1.23,45')).toBeNull();
  });

  it('lê o ponto decimal de OFX e planilhas', () => {
    expect(centavosComPonto('-45.9')).toBe(-4590);
    expect(centavosComPonto('1,234.56')).toBe(123456);
    expect(centavosComPonto('45')).toBe(4500);
    expect(centavosComPonto('4.567')).toBeNull();
  });

  it('entende os jeitos de escrever saída', () => {
    expect(centavosComSinal('-R$ 45,90')).toBe(-4590);
    expect(centavosComSinal('R$ -45,90')).toBe(-4590);
    expect(centavosComSinal('45,90 D')).toBe(-4590);
    expect(centavosComSinal('45,90 C')).toBe(4590);
    expect(centavosComSinal('45,90-')).toBe(-4590);
    expect(centavosComSinal('- 1.520,40')).toBe(-152040);
    expect(centavosComSinal('−R$ 10,00')).toBe(-1000);
    expect(centavosComSinal('R$ 1.200,00')).toBe(120000);
    expect(centavosComSinal('-45.90')).toBe(-4590);
    expect(centavosComSinal('MERCADO 45,90')).toBeNull();
  });

  it('acha os valores de um trecho, com a posição e o cifrão', () => {
    const achados = valoresNoTexto('SPOTIFY USD 5,99 R$ 32,50');
    expect(achados.map((v) => [v.centavos, v.comCifrao])).toEqual([
      [599, false],
      [3250, true],
    ]);
    expect(valoresNoTexto('CNPJ 12.345.678/0001-90')).toEqual([]);
  });
});

describe('datas', () => {
  it('lê datas completas e recusa as inexistentes', () => {
    expect(datasNoTexto('Emissão 05/11/2026 18:42 e 2026-10-03').map((d) => d.data)).toEqual([
      '2026-11-05',
      '2026-10-03',
    ]);
    expect(lerDataCompleta('31/02/2026')).toBeNull();
    expect(lerDataCompleta('05/11/26')).toBe('2026-11-05');
  });

  it('lê a data no começo da linha de fatura ou extrato', () => {
    expect(dataNoInicio('12/10 MERCADO')).toMatchObject({
      dia: 12,
      mes: 10,
      ano: null,
      tamanho: 5,
    });
    expect(dataNoInicio('12 OUT POSTO')).toMatchObject({ dia: 12, mes: 10, ano: null });
    expect(dataNoInicio('05/11/2026 PIX')).toMatchObject({ dia: 5, mes: 11, ano: 2026 });
    expect(dataNoInicio('2026-10-03,PIX')).toMatchObject({ dia: 3, mes: 10, ano: 2026 });
    expect(dataNoInicio('13/14 ERRO')).toBeNull();
    expect(dataNoInicio('MERCADO 12/10')).toBeNull();
  });

  it('completa o ano pela data de referência, também na virada do ano', () => {
    expect(completarAno({ dia: 12, mes: 10, ano: null }, '2026-11-20')).toBe('2026-10-12');
    expect(completarAno({ dia: 28, mes: 12, ano: null }, '2027-01-10')).toBe('2026-12-28');
    expect(completarAno({ dia: 10, mes: 1, ano: null }, '2027-01-10')).toBe('2027-01-10');
    expect(completarAno({ dia: 30, mes: 2, ano: null }, '2026-03-10')).toBeNull();
  });

  it('lê o mês de referência escrito de vários jeitos', () => {
    expect(lerCompetenciaEscrita('Referência: Outubro/2026')).toBe('2026-10');
    expect(lerCompetenciaEscrita('Mês/Ano: 09/2026')).toBe('2026-09');
    expect(lerCompetenciaEscrita('OUT/2026')).toBe('2026-10');
    expect(lerCompetenciaEscrita('março de 2027')).toBe('2027-03');
    expect(lerCompetenciaEscrita('13/2026')).toBeNull();
  });
});

describe('correções do OCR', () => {
  it('troca letras parecidas com dígitos só em pedaços numéricos', () => {
    expect(corrigirDigitos('B,49')).toBe('8,49');
    expect(corrigirDigitos('1O/11/2026')).toBe('10/11/2026');
    expect(corrigirDigitos('MERCADO')).toBe('MERCADO');
    expect(corrigirDigitos('SKG')).toBe('SKG');
  });
});
