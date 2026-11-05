import { centavosParaTexto, formatarData } from '@/lib/formatacao';
import type { LinhaDeLancamento } from './consultas';

const NOMES_DOS_TIPOS: Record<string, string> = {
  despesa: 'Gasto',
  receita: 'Receita',
  transferencia: 'Transferência',
};

/**
 * Célula de CSV: entre aspas quando precisa e protegida contra fórmulas (uma descrição que
 * começa com =, +, - ou @ viraria fórmula ao abrir na planilha).
 */
function celula(texto: string): string {
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
  return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** CSV no padrão das planilhas em português: ponto e vírgula, vírgula decimal e BOM UTF-8. */
export function lancamentosEmCsv(
  lancamentos: LinhaDeLancamento[],
  nomesDasCategorias: Map<string, string>,
): string {
  const linhas = [
    ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor (R$)'],
    ...lancamentos.map((l) => [
      formatarData(l.data),
      l.descricao,
      (l.categoria_id && nomesDasCategorias.get(l.categoria_id)) || 'Sem categoria',
      NOMES_DOS_TIPOS[l.tipo] ?? l.tipo,
      centavosParaTexto(l.valor_centavos),
    ]),
  ];
  return `\uFEFF${linhas.map((linha) => linha.map(celula).join(';')).join('\r\n')}\r\n`;
}
