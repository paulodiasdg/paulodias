import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { decodificarTexto } from '../formato';

/** Planilha como texto: uma lista de linhas, cada uma com o texto das células. */
export type Tabela = string[][];

/** CSV com ponto e vírgula, vírgula ou tabulação, em UTF-8 ou na acentuação do Windows. */
export function lerCsv(bytes: Uint8Array): Tabela {
  const texto = decodificarTexto(bytes);
  const resultado = Papa.parse<string[]>(texto, {
    delimitersToGuess: [';', ',', '\t', '|'],
    skipEmptyLines: 'greedy',
  });
  return resultado.data.map((linha) => linha.map((celula) => celula.trim()));
}

function dataDaCelula(data: Date): string {
  // O exceljs devolve a data da planilha à meia-noite em UTC.
  return data.toISOString().slice(0, 10);
}

function textoDaCelula(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return dataDaCelula(valor);
  if (typeof valor === 'number') {
    // Valores da planilha chegam como número; viram texto com duas casas e só depois centavos.
    return Number.isInteger(valor) ? String(valor) : valor.toFixed(2);
  }
  if (typeof valor === 'string') return valor.trim();
  if (typeof valor === 'boolean') return valor ? 'sim' : 'não';
  if ('richText' in valor)
    return valor.richText
      .map((parte) => parte.text)
      .join('')
      .trim();
  if ('result' in valor) return textoDaCelula((valor.result ?? null) as ExcelJS.CellValue);
  if ('text' in valor) return String(valor.text).trim();
  return '';
}

/** XLSX: lê a primeira aba que tiver conteúdo. */
export async function lerXlsx(bytes: Uint8Array): Promise<Tabela> {
  const pasta = new ExcelJS.Workbook();
  await pasta.xlsx.load(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  );
  for (const planilha of pasta.worksheets) {
    const tabela: Tabela = [];
    planilha.eachRow({ includeEmpty: false }, (linha) => {
      const celulas: string[] = [];
      for (let coluna = 1; coluna <= planilha.columnCount; coluna++) {
        celulas.push(textoDaCelula(linha.getCell(coluna).value));
      }
      tabela.push(celulas);
    });
    if (tabela.some((linha) => linha.some((celula) => celula !== ''))) return tabela;
  }
  return [];
}
