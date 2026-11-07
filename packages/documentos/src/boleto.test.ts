import { describe, expect, it } from 'vitest';
import { boletoBancario, boletoDeArrecadacao } from '../testes/conjunto/apoio.ts';
import {
  codigosNoTexto,
  lerCodigoDeBarras,
  lerLinhaDigitavel,
  semCodigos,
  vencimentoDoFator,
} from './boleto';

const HOJE = '2026-11-07';

describe('boleto bancário', () => {
  const boleto = boletoBancario('997', 48000, '2026-12-05', '3214500000000777888999001');

  it('lê valor e vencimento do código de barras', () => {
    expect(lerCodigoDeBarras(boleto.codigoDeBarras, HOJE)).toEqual({
      tipo: 'bancario',
      valorCentavos: 48000,
      vencimento: '2026-12-05',
    });
  });

  it('lê a linha digitável com pontos e espaços', () => {
    expect(codigosNoTexto(`Linha: ${boleto.linhaDigitavel} fim`, HOJE)).toEqual([
      { tipo: 'bancario', valorCentavos: 48000, vencimento: '2026-12-05' },
    ]);
  });

  it('recusa código com um dígito trocado', () => {
    const codigo = boleto.codigoDeBarras;
    const trocado = `${codigo.slice(0, 20)}${(Number(codigo[20]) + 1) % 10}${codigo.slice(21)}`;
    expect(lerCodigoDeBarras(trocado, HOJE)).toBeNull();
    const linha = boleto.linhaDigitavel.replace(/\D/g, '');
    expect(
      lerLinhaDigitavel(
        `${linha.slice(0, 12)}${(Number(linha[12]) + 1) % 10}${linha.slice(13)}`,
        HOJE,
      ),
    ).toBeNull();
  });
});

describe('fator de vencimento', () => {
  it('usa a contagem nova a partir de 22/02/2025', () => {
    expect(vencimentoDoFator(1000, HOJE)).toBe('2025-02-22');
    expect(vencimentoDoFator(1636, HOJE)).toBe('2026-11-20');
  });

  it('usa a contagem antiga para documentos antigos', () => {
    expect(vencimentoDoFator(9999, '2025-02-01')).toBe('2025-02-21');
    expect(vencimentoDoFator(1000, '2000-07-01')).toBe('2000-07-03');
  });

  it('fator zero quer dizer boleto sem vencimento', () => {
    expect(vencimentoDoFator(0, HOJE)).toBeNull();
  });
});

describe('documento de arrecadação (contas de consumo)', () => {
  const conta = boletoDeArrecadacao('3', 18990, '0123', '2026111800001234567890123');

  it('lê o valor, sem vencimento', () => {
    expect(lerCodigoDeBarras(conta.codigoDeBarras, HOJE)).toEqual({
      tipo: 'arrecadacao',
      valorCentavos: 18990,
      vencimento: null,
    });
    expect(codigosNoTexto(conta.linhaDigitavel, HOJE)).toHaveLength(1);
  });

  it('recusa bloco com dígito verificador errado', () => {
    const digitos = conta.linhaDigitavel.replace(/\D/g, '');
    const errado = `${digitos.slice(0, 11)}${(Number(digitos[11]) + 1) % 10}${digitos.slice(12)}`;
    expect(lerLinhaDigitavel(errado, HOJE)).toBeNull();
  });
});

describe('códigos fora do texto guardado', () => {
  it('troca a linha digitável por um aviso', () => {
    const boleto = boletoBancario('999', 11990, '2026-11-15', '1090001234560001098765400');
    expect(semCodigos(`Pago ${boleto.linhaDigitavel} ok`)).toBe('Pago [código omitido] ok');
    expect(semCodigos('Fone 0800 000 1111')).toBe('Fone 0800 000 1111');
  });
});
