import { montarLinha, type DocumentoDeTexto, type Palavra } from '../documento';
import type { OrigemDoTexto } from '../tipos';

/**
 * Monta um documento de texto para os testes: cada linha é uma string com as células separadas
 * por " | ". Cada caractere ocupa 6 unidades; células começam na coluna dada por `colunas` ou
 * uma depois da outra, com folga de 6 caracteres.
 */
export function documentoDeTeste(
  linhas: readonly string[],
  opcoes: {
    origem?: OrigemDoTexto;
    colunas?: readonly number[];
    confianca?: number;
    codigos?: string[];
  } = {},
): DocumentoDeTexto {
  const largura = 6;
  return {
    origem: opcoes.origem ?? 'texto',
    codigosDeBarras: opcoes.codigos ?? [],
    linhas: linhas.map((linha, indice) => {
      const palavras: Palavra[] = [];
      let x = 0;
      linha.split(' | ').forEach((celula, coluna) => {
        x = opcoes.colunas?.[coluna] !== undefined ? (opcoes.colunas[coluna] ?? 0) * largura : x;
        for (const parte of celula.split(' ').filter(Boolean)) {
          palavras.push({
            texto: parte,
            x0: x,
            x1: x + parte.length * largura,
            y0: indice * 12,
            y1: indice * 12 + 9,
            confianca: opcoes.confianca ?? 1,
          });
          x += (parte.length + 1) * largura;
        }
        x += 6 * largura;
      });
      return montarLinha(1, palavras);
    }),
  };
}
