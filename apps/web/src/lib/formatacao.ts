import type { Centavos, Competencia, DataCivil } from '@no-azul/motor';

/** Fuso das datas do sistema na primeira versão: o usuário está no Brasil (horário de Brasília). */
export const FUSO = 'America/Sao_Paulo';

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Centavos para exibição: R$ 1.234,56. Só para a tela; nunca volte deste texto para o cálculo. */
export function formatarReais(valor: Centavos): string {
  return moeda.format(valor / 100).replace(/\u00a0/g, ' ');
}

/** Centavos sem símbolo nem separador de milhar (1234,56), para planilhas e campos de formulário. */
export function centavosParaTexto(valor: Centavos): string {
  const sinal = valor < 0 ? '-' : '';
  const absoluto = Math.abs(valor);
  return `${sinal}${Math.trunc(absoluto / 100)},${String(absoluto % 100).padStart(2, '0')}`;
}

export class ErroDeValidacao extends Error {}

/**
 * Lê um valor em reais digitado pela pessoa (1.234,56, 1234,56, 1234.56 ou 1234) e devolve
 * centavos inteiros, sem passar por ponto flutuante.
 */
export function lerReais(texto: string, campo = 'valor'): Centavos {
  const limpo = texto.replace(/R\$|\s/g, '');
  const negativo = limpo.startsWith('-');
  const semSinal = negativo ? limpo.slice(1) : limpo;
  if (semSinal === '') throw new ErroDeValidacao(`Informe o ${campo}.`);

  let inteiro: string;
  let fracao: string;
  if (semSinal.includes(',')) {
    const partes = semSinal.split(',');
    if (partes.length > 2)
      throw new ErroDeValidacao(`O ${campo} está em um formato inválido. Use 1.234,56.`);
    inteiro = partes[0]!.replace(/\./g, '');
    fracao = partes[1]!;
  } else if (/\.\d{1,2}$/.test(semSinal)) {
    const ponto = semSinal.lastIndexOf('.');
    inteiro = semSinal.slice(0, ponto).replace(/\./g, '');
    fracao = semSinal.slice(ponto + 1);
  } else {
    inteiro = semSinal.replace(/\./g, '');
    fracao = '';
  }
  if (inteiro === '') inteiro = '0';
  if (!/^\d{1,13}$/.test(inteiro) || !/^\d{0,2}$/.test(fracao)) {
    throw new ErroDeValidacao(`O ${campo} está em um formato inválido. Use 1.234,56.`);
  }
  const centavos = Number(inteiro) * 100 + Number(fracao.padEnd(2, '0'));
  return negativo ? -centavos : centavos;
}

/** AAAA-MM-DD para dd/mm/aaaa. */
export function formatarData(data: DataCivil): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** AAAA-MM para "novembro de 2026". */
export function formatarCompetencia(competencia: Competencia): string {
  const [ano, mes] = competencia.split('-');
  return `${MESES[Number(mes) - 1]} de ${ano}`;
}

/** Primeira letra maiúscula, para títulos ("Novembro de 2026"). */
export function comMaiuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1);
}

/** Data civil (AAAA-MM-DD) de um instante no fuso informado. */
export function dataCivilEm(instante: Date, fuso: string = FUSO): DataCivil {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instante);
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}

/** Hoje no horário de Brasília. É o "hoje" que o app passa para o motor. */
export function hojeNoBrasil(agora: Date = new Date()): DataCivil {
  return dataCivilEm(agora);
}
