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
