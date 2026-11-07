import { diferencaEmDias, somarDias, type Centavos, type DataCivil } from '@no-azul/motor';

/**
 * Código de barras e linha digitável de boletos (padrão FEBRABAN). Valor e vencimento saem do
 * código, conferidos pelos dígitos verificadores. O código não é guardado (seção 4.5 da spec).
 */

export interface DadosDoCodigo {
  tipo: 'bancario' | 'arrecadacao';
  valorCentavos: Centavos | null;
  vencimento: DataCivil | null;
}

function modulo10(numero: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = numero.length - 1; i >= 0; i--) {
    let produto = Number(numero[i]) * peso;
    if (produto > 9) produto = Math.floor(produto / 10) + (produto % 10);
    soma += produto;
    peso = peso === 2 ? 1 : 2;
  }
  return (10 - (soma % 10)) % 10;
}

function somaModulo11(numero: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = numero.length - 1; i >= 0; i--) {
    soma += Number(numero[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  return soma;
}

function modulo11Bancario(numero: string): number {
  const resultado = 11 - (somaModulo11(numero) % 11);
  return resultado === 0 || resultado === 10 || resultado === 11 ? 1 : resultado;
}

function modulo11Arrecadacao(numero: string): number {
  const resto = somaModulo11(numero) % 11;
  if (resto === 0 || resto === 1) return 0;
  if (resto === 10) return 1;
  return 11 - resto;
}

/**
 * O fator conta dias desde 07/10/1997 e recomeçou em 1000 no dia 22/02/2025. Vale a data mais
 * próxima da referência (a data do envio).
 */
export function vencimentoDoFator(fator: number, referencia: DataCivil): DataCivil | null {
  if (fator === 0) return null;
  const candidatas = [somarDias('1997-10-07', fator)];
  if (fator >= 1000) candidatas.push(somarDias('2025-02-22', fator - 1000));
  return candidatas.reduce((melhor, data) =>
    Math.abs(diferencaEmDias(referencia, data)) < Math.abs(diferencaEmDias(referencia, melhor))
      ? data
      : melhor,
  );
}

function lerBancario(codigo: string, referencia: DataCivil): DadosDoCodigo | null {
  const semDv = codigo.slice(0, 4) + codigo.slice(5);
  if (Number(codigo[4]) !== modulo11Bancario(semDv)) return null;
  const valor = Number(codigo.slice(9, 19));
  return {
    tipo: 'bancario',
    valorCentavos: valor > 0 ? valor : null,
    vencimento: vencimentoDoFator(Number(codigo.slice(5, 9)), referencia),
  };
}

function lerArrecadacao(codigo: string): DadosDoCodigo | null {
  const identificador = codigo[2];
  const semDv = codigo.slice(0, 3) + codigo.slice(4);
  const dv =
    identificador === '6' || identificador === '7' ? modulo10(semDv) : modulo11Arrecadacao(semDv);
  if (Number(codigo[3]) !== dv) return null;
  // 6 e 8 indicam valor efetivo em reais; 7 e 9, valor de referência (pode ser quantidade).
  const valorEfetivo = identificador === '6' || identificador === '8';
  const valor = Number(codigo.slice(4, 15));
  return {
    tipo: 'arrecadacao',
    valorCentavos: valorEfetivo && valor > 0 ? valor : null,
    vencimento: null,
  };
}

/** Código de barras de 44 dígitos (bancário ou de arrecadação). */
export function lerCodigoDeBarras(digitos: string, referencia: DataCivil): DadosDoCodigo | null {
  if (!/^\d{44}$/.test(digitos)) return null;
  return digitos[0] === '8' ? lerArrecadacao(digitos) : lerBancario(digitos, referencia);
}

/** Linha digitável: 47 dígitos (bancário) ou 48 (arrecadação), já sem pontos e espaços. */
export function lerLinhaDigitavel(digitos: string, referencia: DataCivil): DadosDoCodigo | null {
  if (/^\d{47}$/.test(digitos)) {
    const campos = [digitos.slice(0, 10), digitos.slice(10, 21), digitos.slice(21, 32)];
    for (const campo of campos) {
      if (Number(campo[campo.length - 1]) !== modulo10(campo.slice(0, -1))) return null;
    }
    const codigo =
      digitos.slice(0, 4) +
      digitos.slice(32, 47) +
      digitos.slice(4, 9) +
      digitos.slice(10, 20) +
      digitos.slice(21, 31);
    return lerBancario(codigo, referencia);
  }
  if (/^8\d{47}$/.test(digitos)) {
    const blocos = [0, 12, 24, 36].map((inicio) => digitos.slice(inicio, inicio + 12));
    const identificador = digitos[2];
    for (const bloco of blocos) {
      const corpo = bloco.slice(0, 11);
      const dv =
        identificador === '6' || identificador === '7'
          ? modulo10(corpo)
          : modulo11Arrecadacao(corpo);
      if (Number(bloco[11]) !== dv) return null;
    }
    return lerArrecadacao(blocos.map((b) => b.slice(0, 11)).join(''));
  }
  return null;
}

/** Procura linhas digitáveis e códigos de barras escritos num texto. */
export function codigosNoTexto(texto: string, referencia: DataCivil): DadosDoCodigo[] {
  const achados: DadosDoCodigo[] = [];
  for (const trecho of texto.matchAll(/\d[\d.\- ]{38,75}\d/g)) {
    const digitos = trecho[0].replace(/\D/g, '');
    const lido =
      digitos.length === 44
        ? lerCodigoDeBarras(digitos, referencia)
        : lerLinhaDigitavel(digitos, referencia);
    if (lido) achados.push(lido);
  }
  return achados;
}

/** Remove de um texto qualquer sequência longa de dígitos (linha digitável, código de barras). */
export function semCodigos(texto: string): string {
  return texto.replace(/\d[\d.\- ]{38,75}\d/g, (trecho) =>
    trecho.replace(/\D/g, '').length >= 40 ? '[código omitido]' : trecho,
  );
}
