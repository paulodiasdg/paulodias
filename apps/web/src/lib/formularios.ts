import { lerData, type Centavos, type DataCivil } from '@no-azul/motor';
import { ErroDeValidacao, lerReais } from './formatacao';

/** Leitura dos campos enviados pelos formulários, com mensagens de validação em português. */

export function texto(formulario: FormData, campo: string): string {
  const valor = formulario.get(campo);
  return typeof valor === 'string' ? valor.trim() : '';
}

export function obrigatorio(
  formulario: FormData,
  campo: string,
  rotulo: string,
  maximo = 120,
): string {
  const valor = texto(formulario, campo);
  if (valor === '') throw new ErroDeValidacao(`Informe ${rotulo}.`);
  if (valor.length > maximo)
    throw new ErroDeValidacao(`${rotulo} pode ter até ${maximo} caracteres.`);
  return valor;
}

export function valor(
  formulario: FormData,
  campo: string,
  rotulo: string,
  opcoes: { positivo?: boolean } = {},
): Centavos {
  const centavos = lerReais(texto(formulario, campo), rotulo);
  if (opcoes.positivo ? centavos <= 0 : centavos < 0) {
    throw new ErroDeValidacao(
      `O ${rotulo} precisa ser ${opcoes.positivo ? 'maior que zero' : 'zero ou mais'}.`,
    );
  }
  return centavos;
}

export function data(formulario: FormData, campo: string, rotulo: string): DataCivil {
  const valorDoCampo = texto(formulario, campo);
  try {
    lerData(valorDoCampo);
  } catch {
    throw new ErroDeValidacao(`Informe ${rotulo}.`);
  }
  return valorDoCampo;
}

export function inteiroEntre(
  formulario: FormData,
  campo: string,
  rotulo: string,
  minimo: number,
  maximo: number,
): number {
  const numero = Number(texto(formulario, campo));
  if (!Number.isInteger(numero) || numero < minimo || numero > maximo) {
    throw new ErroDeValidacao(`${rotulo} precisa ser um número de ${minimo} a ${maximo}.`);
  }
  return numero;
}

export function marcado(formulario: FormData, campo: string): boolean {
  return formulario.get(campo) === 'on';
}

export function opcional(formulario: FormData, campo: string): string | null {
  const valorDoCampo = texto(formulario, campo);
  return valorDoCampo === '' ? null : valorDoCampo;
}

/** Guarda o que foi digitado para devolver ao formulário quando há erro. */
export function camposDigitados(formulario: FormData): Record<string, string> {
  const campos: Record<string, string> = {};
  formulario.forEach((valorDoCampo, chave) => {
    if (typeof valorDoCampo === 'string' && !chave.startsWith('$')) campos[chave] = valorDoCampo;
  });
  return campos;
}
