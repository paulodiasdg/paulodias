/**
 * Modo de arredondamento de uma divisão inteira. Toda divisão do motor diz qual usa
 * (docs/PLANO.md, C7):
 * - `cima`: em direção a +∞ (reserva e aportes semanais);
 * - `baixo`: em direção a −∞ (limites de gasto, para não prometer mais do que há);
 * - `proximo`: ao inteiro mais próximo, empate para longe do zero (valores mensais das metas).
 */
export type Arredondamento = 'cima' | 'baixo' | 'proximo';

/** Divide inteiros grandes com o arredondamento pedido, sem passar por ponto flutuante. */
export function dividirInteiros(
  numerador: bigint,
  denominador: bigint,
  modo: Arredondamento,
): bigint {
  if (denominador === 0n) throw new RangeError('Divisão por zero.');
  let n = numerador;
  let d = denominador;
  if (d < 0n) {
    n = -n;
    d = -d;
  }

  let quociente = n / d; // trunca em direção a zero
  const resto = n % d; // mesmo sinal de n
  if (resto === 0n) return quociente;

  switch (modo) {
    case 'baixo':
      if (resto < 0n) quociente -= 1n;
      break;
    case 'cima':
      if (resto > 0n) quociente += 1n;
      break;
    case 'proximo': {
      const dobroDoResto = resto < 0n ? -2n * resto : 2n * resto;
      if (dobroDoResto >= d) quociente += n < 0n ? -1n : 1n;
      break;
    }
  }
  return quociente;
}

/** Converte de volta para number, garantindo que o resultado é um inteiro seguro. */
export function paraInteiroSeguro(valor: bigint): number {
  const resultado = Number(valor);
  if (!Number.isSafeInteger(resultado)) {
    throw new RangeError(`Valor fora do intervalo seguro: ${valor.toString()}.`);
  }
  return resultado;
}

/** Garante que o número é inteiro seguro antes de qualquer conta. */
export function exigirInteiro(valor: number, nome = 'valor'): number {
  if (!Number.isSafeInteger(valor)) {
    throw new RangeError(`${nome} precisa ser inteiro: ${valor}.`);
  }
  return valor;
}
