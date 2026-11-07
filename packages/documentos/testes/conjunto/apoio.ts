// Apoio do gerador do conjunto de teste: sorteio reproduzível, formatos brasileiros e os códigos
// de boleto (FEBRABAN). Este código é independente do leitor em src/, de propósito: o gabarito
// não pode depender das regras que ele avalia.

/** Sorteio reproduzível (mulberry32): o mesmo número inicial gera sempre os mesmos documentos. */
export function sorteio(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function inteiroEntre(aleatorio: () => number, minimo: number, maximo: number): number {
  return minimo + Math.floor(aleatorio() * (maximo - minimo + 1));
}

export function escolher<T>(aleatorio: () => number, opcoes: readonly T[]): T {
  const escolhida = opcoes[Math.floor(aleatorio() * opcoes.length)];
  if (escolhida === undefined) throw new Error('Lista vazia.');
  return escolhida;
}

/** 123456 → "1.234,56" */
export function reais(centavos: number): string {
  const negativo = centavos < 0;
  const absoluto = Math.abs(centavos);
  const inteiro = Math.floor(absoluto / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const resto = (absoluto % 100).toString().padStart(2, '0');
  return `${negativo ? '-' : ''}${inteiro},${resto}`;
}

/** 123456 → "1234.56" (formato de CSV em inglês e de OFX). */
export function reaisComPonto(centavos: number): string {
  const negativo = centavos < 0;
  const absoluto = Math.abs(centavos);
  return `${negativo ? '-' : ''}${Math.floor(absoluto / 100)}.${(absoluto % 100).toString().padStart(2, '0')}`;
}

/** "2026-11-05" → "05/11/2026" */
export function dataBr(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** "2026-11-05" → "05/11" */
export function diaMes(data: string): string {
  const [, mes, dia] = data.split('-');
  return `${dia}/${mes}`;
}

const MESES_CURTOS = [
  'JAN',
  'FEV',
  'MAR',
  'ABR',
  'MAI',
  'JUN',
  'JUL',
  'AGO',
  'SET',
  'OUT',
  'NOV',
  'DEZ',
];
const MESES_LONGOS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/** "2026-10-12" → "12 OUT" */
export function diaMesCurto(data: string): string {
  const [, mes, dia] = data.split('-');
  return `${dia} ${MESES_CURTOS[Number(mes) - 1]}`;
}

/** "2026-10" → "Outubro/2026" */
export function mesPorExtenso(competencia: string): string {
  const [ano, mes] = competencia.split('-');
  return `${MESES_LONGOS[Number(mes) - 1]}/${ano}`;
}

/** "2026-10" → "OUT/2026" */
export function mesCurto(competencia: string): string {
  const [ano, mes] = competencia.split('-');
  return `${MESES_CURTOS[Number(mes) - 1]}/${ano}`;
}

export function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
}

// ------------------------------------------------------------------------------------------
// Boleto bancário (44 dígitos no código de barras, 47 na linha digitável)
// ------------------------------------------------------------------------------------------

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

function modulo11Boleto(numero: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = numero.length - 1; i >= 0; i--) {
    soma += Number(numero[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = 11 - (soma % 11);
  return resto === 0 || resto === 10 || resto === 11 ? 1 : resto;
}

/** Fator de vencimento: a contagem recomeçou em 1000 no dia 22/02/2025. */
function fatorDeVencimento(vencimento: string): string {
  const fator = 1000 + diasEntre('2025-02-22', vencimento);
  if (fator < 1000 || fator > 9999) throw new Error('Vencimento fora do ciclo atual.');
  return fator.toString();
}

export interface CodigoDeBoleto {
  codigoDeBarras: string;
  linhaDigitavel: string;
}

export function boletoBancario(
  banco: string,
  valorCentavos: number,
  vencimento: string,
  campoLivre: string,
): CodigoDeBoleto {
  if (banco.length !== 3 || campoLivre.length !== 25) throw new Error('Boleto mal formado.');
  const semDv = `${banco}9${fatorDeVencimento(vencimento)}${valorCentavos.toString().padStart(10, '0')}${campoLivre}`;
  const dv = modulo11Boleto(semDv);
  const codigoDeBarras = `${semDv.slice(0, 4)}${dv}${semDv.slice(4)}`;

  const campo1 = `${banco}9${campoLivre.slice(0, 5)}`;
  const campo2 = campoLivre.slice(5, 15);
  const campo3 = campoLivre.slice(15, 25);
  const c1 = `${campo1}${modulo10(campo1)}`;
  const c2 = `${campo2}${modulo10(campo2)}`;
  const c3 = `${campo3}${modulo10(campo3)}`;
  const c5 = codigoDeBarras.slice(5, 19);
  const linhaDigitavel = `${c1.slice(0, 5)}.${c1.slice(5)} ${c2.slice(0, 5)}.${c2.slice(5)} ${c3.slice(0, 5)}.${c3.slice(5)} ${dv} ${c5}`;
  return { codigoDeBarras, linhaDigitavel };
}

/**
 * Documento de arrecadação (contas de consumo): começa com 8, o terceiro dígito 6 indica valor
 * em reais com módulo 10. O vencimento não faz parte do código.
 */
export function boletoDeArrecadacao(
  segmento: string,
  valorCentavos: number,
  empresa: string,
  campoLivre: string,
): CodigoDeBoleto {
  if (empresa.length !== 4 || campoLivre.length !== 25) throw new Error('Código mal formado.');
  const semDv = `8${segmento}6${valorCentavos.toString().padStart(11, '0')}${empresa}${campoLivre}`;
  const dv = modulo10(semDv);
  const codigoDeBarras = `${semDv.slice(0, 3)}${dv}${semDv.slice(3)}`;
  const blocos = [0, 11, 22, 33].map((inicio) => {
    const bloco = codigoDeBarras.slice(inicio, inicio + 11);
    return `${bloco}-${modulo10(bloco)}`;
  });
  return { codigoDeBarras, linhaDigitavel: blocos.join(' ') };
}
