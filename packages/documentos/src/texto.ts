import { montarData, type Centavos, type DataCivil } from '@no-azul/motor';

/**
 * Leitura de valores e datas escritos no jeito brasileiro. Valores viram centavos inteiros sem
 * passar por ponto flutuante (regra 2 do CLAUDE.md): os dígitos são lidos como texto.
 */

export function semAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Minúsculas, sem acentos e com um espaço só entre as palavras. */
export function normalizar(texto: string): string {
  return semAcentos(texto).toLowerCase().replace(/\s+/g, ' ').trim();
}

const SINAIS_DE_MENOS = /[−–—]/g;

function centavosDosDigitos(inteiro: string, decimais: string): Centavos | null {
  const digitos = `${inteiro.replace(/\D/g, '')}${decimais.padEnd(2, '0')}`.replace(
    /^0+(?=\d)/,
    '',
  );
  const valor = Number(digitos);
  return Number.isSafeInteger(valor) ? valor : null;
}

/** "1.234,56" → 123456. Aceita sem separador de milhar ("1234,56"). */
export function centavosDeTexto(texto: string): Centavos | null {
  const partes = /^(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})$/.exec(texto.trim());
  if (!partes?.[1] || partes[2] === undefined) return null;
  return centavosDosDigitos(partes[1], partes[2]);
}

/**
 * Valor com ponto decimal, como em OFX e em CSV exportado em inglês: "-45.9", "1,234.56", "45".
 * Devolve centavos com sinal.
 */
export function centavosComPonto(texto: string): Centavos | null {
  const limpo = texto.trim().replace(SINAIS_DE_MENOS, '-').replace(/\s/g, '');
  const partes = /^([-+]?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/.exec(limpo);
  if (!partes?.[2]) return null;
  const valor = centavosDosDigitos(partes[2], partes[3] ?? '');
  if (valor === null) return null;
  return partes[1] === '-' ? -valor : valor;
}

/**
 * Valor em reais do jeito que aparece em documentos e extratos, com sinal: "-R$ 45,90",
 * "R$ -45,90", "45,90 D", "45,90-", "- 1.520,40". Também aceita o ponto decimal das planilhas.
 */
export function centavosComSinal(texto: string): Centavos | null {
  const limpo = texto.replace(SINAIS_DE_MENOS, '-').replace(/\s+/g, ' ').trim();
  const partes =
    /^(-\s?)?(?:R\$\s?)?(-\s?)?(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})(?:\s?([DC])|\s?(-))?$/i.exec(
      limpo,
    );
  if (!partes?.[3] || partes[4] === undefined) {
    const comPonto = /^(-\s?)?(?:R\$\s?)?(.+)$/.exec(limpo);
    if (!comPonto?.[2] || !/^[-+]?\d[\d,]*(?:\.\d{1,2})?$/.test(comPonto[2].replace(/\s/g, ''))) {
      return null;
    }
    const valor = centavosComPonto(comPonto[2]);
    if (valor === null) return null;
    return comPonto[1] ? -Math.abs(valor) : valor;
  }
  const valor = centavosDosDigitos(partes[3], partes[4]);
  if (valor === null) return null;
  const negativo =
    Boolean(partes[1]) ||
    Boolean(partes[2]) ||
    partes[5]?.toUpperCase() === 'D' ||
    Boolean(partes[6]);
  return negativo ? -valor : valor;
}

export interface ValorNoTexto {
  centavos: Centavos;
  inicio: number;
  fim: number;
  /** Havia "R$" junto do número. */
  comCifrao: boolean;
}

const VALOR_NO_TEXTO =
  /(-\s?)?(R\$\s?)?(-\s?)?(?<![\d.,])(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})(?![\d])(?:\s?([DC])(?![a-zA-Z])|(-)(?!\d))?/gi;

/** Todos os valores com vírgula decimal num trecho de texto, em ordem. */
export function valoresNoTexto(texto: string): ValorNoTexto[] {
  const resultado: ValorNoTexto[] = [];
  for (const achado of texto.replace(SINAIS_DE_MENOS, '-').matchAll(VALOR_NO_TEXTO)) {
    const [, menos1, cifrao, menos2, inteiro, decimais, dc, menosNoFim] = achado;
    if (!inteiro || decimais === undefined) continue;
    const valor = centavosDosDigitos(inteiro, decimais);
    if (valor === null) continue;
    const negativo = Boolean(menos1 || menos2 || menosNoFim) || dc?.toUpperCase() === 'D';
    resultado.push({
      centavos: negativo ? -valor : valor,
      inicio: achado.index,
      fim: achado.index + achado[0].length,
      comCifrao: Boolean(cifrao),
    });
  }
  return resultado;
}

// ------------------------------------------------------------------------------------------
// Datas
// ------------------------------------------------------------------------------------------

const MESES: Record<string, number> = {
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
};

const MESES_POR_EXTENSO: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

function dataSegura(ano: number, mes: number, dia: number): DataCivil | null {
  try {
    return montarData(ano, mes, dia);
  } catch {
    return null;
  }
}

function anoComQuatroDigitos(ano: string): number {
  const numero = Number(ano);
  return ano.length === 2 ? 2000 + numero : numero;
}

export interface DataNoTexto {
  data: DataCivil;
  inicio: number;
  fim: number;
}

const DATA_COMPLETA =
  /(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)|(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g;

/** Datas completas num trecho: 05/11/2026, 05/11/26, 05.11.2026, 2026-11-05. */
export function datasNoTexto(texto: string): DataNoTexto[] {
  const resultado: DataNoTexto[] = [];
  for (const achado of texto.matchAll(DATA_COMPLETA)) {
    const [, dia, mes, ano, anoIso, mesIso, diaIso] = achado;
    const data =
      anoIso && mesIso && diaIso
        ? dataSegura(Number(anoIso), Number(mesIso), Number(diaIso))
        : dia && mes && ano
          ? dataSegura(anoComQuatroDigitos(ano), Number(mes), Number(dia))
          : null;
    if (data) resultado.push({ data, inicio: achado.index, fim: achado.index + achado[0].length });
  }
  return resultado;
}

export function lerDataCompleta(texto: string): DataCivil | null {
  const [primeira] = datasNoTexto(texto);
  return primeira && primeira.inicio === 0 && primeira.fim === texto.trim().length
    ? primeira.data
    : null;
}

export interface DiaEMes {
  dia: number;
  mes: number;
  /** Ano, quando o texto traz. */
  ano: number | null;
}

/**
 * Data no começo de uma linha de fatura ou extrato: "05/11", "05/11/2026", "12 OUT", "12/out".
 * Devolve também quantos caracteres a data ocupa.
 */
export function dataNoInicio(texto: string): (DiaEMes & { tamanho: number }) | null {
  const completa = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/.exec(texto);
  if (completa?.[1] && completa[2] && completa[3]) {
    const ano = anoComQuatroDigitos(completa[3]);
    if (!dataSegura(ano, Number(completa[2]), Number(completa[1]))) return null;
    return { dia: Number(completa[1]), mes: Number(completa[2]), ano, tamanho: completa[0].length };
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?!\d)/.exec(texto);
  if (iso?.[1] && iso[2] && iso[3]) {
    if (!dataSegura(Number(iso[1]), Number(iso[2]), Number(iso[3]))) return null;
    return {
      dia: Number(iso[3]),
      mes: Number(iso[2]),
      ano: Number(iso[1]),
      tamanho: iso[0].length,
    };
  }
  const curta = /^(\d{1,2})[/.-](\d{1,2})(?![\d/.-])/.exec(texto);
  if (curta?.[1] && curta[2]) {
    const dia = Number(curta[1]);
    const mes = Number(curta[2]);
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
    return { dia, mes, ano: null, tamanho: curta[0].length };
  }
  const porNome = /^(\d{1,2})[\s/.-]?([a-zA-Z]{3})(?![a-zA-Z])/.exec(texto);
  const mes = porNome?.[2] ? MESES[normalizar(porNome[2])] : undefined;
  if (porNome?.[1] && mes) {
    const dia = Number(porNome[1]);
    if (dia < 1 || dia > 31) return null;
    return { dia, mes, ano: null, tamanho: porNome[0].length };
  }
  return null;
}

/**
 * Ano de uma data sem ano ("12/10") numa fatura: o do vencimento, ou o anterior quando o mês da
 * linha vem depois do mês do vencimento (fatura de janeiro com compras de dezembro).
 */
export function completarAno(diaEMes: DiaEMes, referencia: DataCivil): DataCivil | null {
  if (diaEMes.ano !== null) return dataSegura(diaEMes.ano, diaEMes.mes, diaEMes.dia);
  const anoDaReferencia = Number(referencia.slice(0, 4));
  const mesDaReferencia = Number(referencia.slice(5, 7));
  const ano = diaEMes.mes > mesDaReferencia ? anoDaReferencia - 1 : anoDaReferencia;
  return dataSegura(ano, diaEMes.mes, diaEMes.dia);
}

/** Mês de referência: "Outubro/2026", "10/2026", "OUT/2026", "out/26". Devolve AAAA-MM. */
export function lerCompetenciaEscrita(texto: string): string | null {
  const normal = normalizar(texto);
  const porExtenso =
    /(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*(?:\/|de)?\s*(\d{4})/.exec(
      normal,
    );
  if (porExtenso?.[1] && porExtenso[2]) {
    return `${porExtenso[2]}-${String(MESES_POR_EXTENSO[porExtenso[1]]).padStart(2, '0')}`;
  }
  const curto = /\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s*\/\s*(\d{4}|\d{2})\b/.exec(
    normal,
  );
  if (curto?.[1] && curto[2]) {
    return `${anoComQuatroDigitos(curto[2])}-${String(MESES[curto[1]]).padStart(2, '0')}`;
  }
  const numerico = /(?<![\d/])(\d{1,2})\s*\/\s*(\d{4})(?![\d/])/.exec(normal);
  if (numerico?.[1] && numerico[2]) {
    const mes = Number(numerico[1]);
    if (mes >= 1 && mes <= 12) return `${numerico[2]}-${String(mes).padStart(2, '0')}`;
  }
  return null;
}

// ------------------------------------------------------------------------------------------
// Correções do OCR
// ------------------------------------------------------------------------------------------

const TROCAS_DO_OCR: Record<string, string> = {
  O: '0',
  o: '0',
  D: '0',
  Q: '0',
  B: '8',
  l: '1',
  I: '1',
  i: '1',
  '|': '1',
  S: '5',
  s: '5',
  Z: '2',
  z: '2',
  g: '9',
};

/**
 * O OCR troca dígitos por letras parecidas ("B,49" no lugar de "8,49"). Num pedaço que parece
 * número (dígitos, vírgula, ponto, barra e no máximo duas letras trocáveis), troca as letras.
 */
export function corrigirDigitos(pedaco: string): string {
  if (!/[\d]/.test(pedaco) || !/^[\dOoDQBlIi|SsZzg.,/:-]+$/.test(pedaco)) return pedaco;
  const letras = pedaco.replace(/[\d.,/:-]/g, '');
  if (letras.length === 0 || letras.length > 2) return pedaco;
  return [...pedaco].map((c) => TROCAS_DO_OCR[c] ?? c).join('');
}
