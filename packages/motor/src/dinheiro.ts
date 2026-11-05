import {
  dividirInteiros,
  exigirInteiro,
  paraInteiroSeguro,
  type Arredondamento,
} from './aritmetica';

/**
 * Valor monetário em centavos inteiros. Nunca use ponto flutuante para dinheiro.
 */
export type Centavos = number;

/** Garante que o valor é um inteiro seguro de centavos. */
export function centavos(valor: number): Centavos {
  if (!Number.isSafeInteger(valor)) {
    throw new RangeError(`Valor monetário inválido: ${valor}. Use centavos inteiros.`);
  }
  return valor;
}

/** Soma valores em centavos. */
export function somar(valores: readonly Centavos[]): Centavos {
  return valores.reduce((total, valor) => total + centavos(valor), 0);
}

/**
 * Calcula `valor × numerador ÷ denominador` em aritmética inteira, com o arredondamento pedido.
 * Exemplo: `proporcao(123333, 12, 52, 'cima')` converte um valor mensal em semanal.
 */
export function proporcao(
  valor: Centavos,
  numerador: number,
  denominador: number,
  modo: Arredondamento,
): Centavos {
  const produto = BigInt(centavos(valor)) * BigInt(exigirInteiro(numerador, 'numerador'));
  return paraInteiroSeguro(
    dividirInteiros(produto, BigInt(exigirInteiro(denominador, 'denominador')), modo),
  );
}

/** Divide um valor em centavos por um inteiro, com o arredondamento pedido. */
export function dividir(valor: Centavos, divisor: number, modo: Arredondamento): Centavos {
  return proporcao(valor, 1, divisor, modo);
}

/** Arredonda para cima, em reais inteiros (regras 3.1 e 3.3 da spec). */
export function paraCimaEmReais(valor: Centavos): Centavos {
  return dividir(valor, 100, 'cima') * 100;
}
