import { normalizar } from './texto';
import type { OrigemDoTexto } from './tipos';

/**
 * Texto de um documento com a posição de cada palavra, venha ele do PDF ou do OCR. As regras de
 * leitura usam a posição para achar o valor de um rótulo ao lado ou embaixo dele, como nas
 * caixas de boletos, contas e contracheques.
 *
 * Coordenadas em pontos do PDF ou em pixels da imagem, com y crescendo para baixo.
 */

export interface Palavra {
  texto: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** De 0 a 1 (o PDF com texto é sempre 1). */
  confianca: number;
}

export interface Celula {
  texto: string;
  x0: number;
  x1: number;
  confianca: number;
}

export interface Linha {
  pagina: number;
  palavras: Palavra[];
  celulas: Celula[];
  /** Células separadas por dois espaços. */
  texto: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  confianca: number;
}

export interface DocumentoDeTexto {
  origem: OrigemDoTexto;
  linhas: Linha[];
  /** Códigos de barras lidos das imagens (só dígitos). */
  codigosDeBarras: string[];
}

function larguraDoCaractere(palavras: readonly Palavra[]): number {
  const caracteres = palavras.reduce((soma, p) => soma + Math.max(1, p.texto.length), 0);
  const largura = palavras.reduce((soma, p) => soma + (p.x1 - p.x0), 0);
  return caracteres > 0 ? largura / caracteres : 1;
}

/** Separa a linha em células onde o espaço entre palavras passa de 1,6 caractere. */
export function celulasDaLinha(palavras: readonly Palavra[]): Celula[] {
  const ordenadas = [...palavras].sort((a, b) => a.x0 - b.x0);
  const limiar = larguraDoCaractere(ordenadas) * 1.6;
  const celulas: Celula[] = [];
  let atual: Palavra[] = [];
  const fechar = () => {
    const primeira = atual[0];
    const ultima = atual[atual.length - 1];
    if (!primeira || !ultima) return;
    celulas.push({
      texto: atual.map((p) => p.texto).join(' '),
      x0: primeira.x0,
      x1: ultima.x1,
      confianca: Math.min(...atual.map((p) => p.confianca)),
    });
    atual = [];
  };
  for (const palavra of ordenadas) {
    const anterior = atual[atual.length - 1];
    if (anterior && palavra.x0 - anterior.x1 > limiar) fechar();
    atual.push(palavra);
  }
  fechar();
  return celulas;
}

export function montarLinha(
  pagina: number,
  palavras: readonly Palavra[],
  confianca?: number,
): Linha {
  const ordenadas = [...palavras].sort((a, b) => a.x0 - b.x0);
  const celulas = celulasDaLinha(ordenadas);
  return {
    pagina,
    palavras: ordenadas,
    celulas,
    texto: celulas.map((c) => c.texto).join('  '),
    x0: Math.min(...ordenadas.map((p) => p.x0)),
    y0: Math.min(...ordenadas.map((p) => p.y0)),
    x1: Math.max(...ordenadas.map((p) => p.x1)),
    y1: Math.max(...ordenadas.map((p) => p.y1)),
    confianca: confianca ?? Math.min(...ordenadas.map((p) => p.confianca)),
  };
}

/** Agrupa palavras soltas (do PDF) em linhas, pela altura de cada uma. */
export function agruparEmLinhas(pagina: number, palavras: readonly Palavra[]): Linha[] {
  const ordenadas = [...palavras]
    .filter((p) => p.texto.trim() !== '')
    .sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2 || a.x0 - b.x0);
  const grupos: Palavra[][] = [];
  for (const palavra of ordenadas) {
    const centro = (palavra.y0 + palavra.y1) / 2;
    const grupo = grupos[grupos.length - 1];
    const referencia = grupo?.[0];
    if (grupo && referencia) {
      const centroDoGrupo = (referencia.y0 + referencia.y1) / 2;
      const altura = Math.max(referencia.y1 - referencia.y0, palavra.y1 - palavra.y0, 1);
      if (Math.abs(centro - centroDoGrupo) <= altura * 0.45) {
        grupo.push(palavra);
        continue;
      }
    }
    grupos.push([palavra]);
  }
  return grupos.map((grupo) => montarLinha(pagina, grupo));
}

// ------------------------------------------------------------------------------------------
// Rótulos e valores
// ------------------------------------------------------------------------------------------

export interface Rotulo {
  indiceDaLinha: number;
  x0: number;
  x1: number;
  /** Texto da linha depois do rótulo. */
  depois: string;
  /** Texto da célula do rótulo depois dele. */
  depoisNaCelula: string;
}

function palavrasNormalizadas(linha: Linha): { texto: string; inicios: number[] } {
  const inicios: number[] = [];
  let texto = '';
  for (const palavra of linha.palavras) {
    if (texto) texto += ' ';
    inicios.push(texto.length);
    texto += normalizar(palavra.texto);
  }
  return { texto, inicios };
}

/** Todas as ocorrências de um rótulo (sem acentos e sem diferença de maiúsculas). */
export function acharRotulos(documento: DocumentoDeTexto, rotulo: string): Rotulo[] {
  const procurado = normalizar(rotulo);
  const achados: Rotulo[] = [];
  documento.linhas.forEach((linha, indiceDaLinha) => {
    const { texto, inicios } = palavrasNormalizadas(linha);
    let posicao = texto.indexOf(procurado);
    while (posicao >= 0) {
      const antes = posicao === 0 || /[^a-z0-9]/.test(texto[posicao - 1] ?? ' ');
      const fim = posicao + procurado.length;
      const depoisOk = fim >= texto.length || /[^a-z0-9]/.test(texto[fim] ?? ' ');
      if (antes && depoisOk) {
        const primeira = Math.max(
          0,
          inicios.findLastIndex((inicio) => inicio <= posicao),
        );
        const ultima = Math.max(
          primeira,
          inicios.findLastIndex((inicio) => inicio < fim),
        );
        const palavraFinal = linha.palavras[ultima];
        const palavraInicial = linha.palavras[primeira];
        if (palavraFinal && palavraInicial) {
          const restoDaPalavra = palavraFinal.texto.slice(
            Math.max(0, fim - (inicios[ultima] ?? 0)),
          );
          const seguintes = linha.palavras.slice(ultima + 1);
          const celulaDoRotulo = linha.celulas.find(
            (c) => c.x0 <= palavraFinal.x0 && c.x1 >= palavraFinal.x1,
          );
          const naCelula = seguintes.filter((p) => !celulaDoRotulo || p.x1 <= celulaDoRotulo.x1);
          achados.push({
            indiceDaLinha,
            x0: palavraInicial.x0,
            x1: palavraFinal.x1,
            depois: [restoDaPalavra, ...seguintes.map((p) => p.texto)].join(' ').trim(),
            depoisNaCelula: [restoDaPalavra, ...naCelula.map((p) => p.texto)].join(' ').trim(),
          });
        }
      }
      posicao = texto.indexOf(procurado, posicao + 1);
    }
  });
  return achados;
}

export interface Achado<T> {
  valor: T;
  confianca: number;
  /** 0 quando o valor está na mesma linha do rótulo; senão, quantas linhas abaixo. */
  distancia: number;
}

/**
 * Valor de um rótulo: primeiro na mesma célula ou na célula seguinte da linha; depois, nas três
 * linhas de baixo, na célula que fica sob o rótulo.
 */
export function valorDoRotulo<T>(
  documento: DocumentoDeTexto,
  rotulo: Rotulo,
  ler: (texto: string) => T | null,
): Achado<T> | null {
  const linha = documento.linhas[rotulo.indiceDaLinha];
  if (!linha) return null;

  const naCelula = ler(rotulo.depoisNaCelula);
  if (naCelula !== null) return { valor: naCelula, confianca: linha.confianca, distancia: 0 };
  const proximaCelula = linha.celulas.find((c) => c.x0 > rotulo.x1);
  if (proximaCelula) {
    const valor = ler(proximaCelula.texto);
    if (valor !== null) return { valor, confianca: proximaCelula.confianca, distancia: 0 };
  }

  const altura = Math.max(1, linha.y1 - linha.y0);
  const larguraDoRotulo = rotulo.x1 - rotulo.x0;
  for (let i = rotulo.indiceDaLinha + 1; i <= rotulo.indiceDaLinha + 3; i++) {
    const abaixo = documento.linhas[i];
    if (!abaixo || abaixo.pagina !== linha.pagina) break;
    if (abaixo.y0 - linha.y1 > altura * 4) break;
    const candidatas = abaixo.celulas
      .filter((c) => c.x0 <= rotulo.x1 + larguraDoRotulo * 0.5 && c.x1 >= rotulo.x0 - altura)
      .sort((a, b) => Math.abs(a.x0 - rotulo.x0) - Math.abs(b.x0 - rotulo.x0));
    for (const celula of candidatas) {
      const valor = ler(celula.texto);
      if (valor !== null) {
        return { valor, confianca: celula.confianca, distancia: i - rotulo.indiceDaLinha };
      }
    }
  }
  return null;
}

/**
 * Procura os rótulos na ordem de preferência e devolve o primeiro valor achado. `evitar` descarta
 * rótulos que contêm outro termo (ex.: "data do vencimento" quando se procura "data").
 */
export function procurarValor<T>(
  documento: DocumentoDeTexto,
  rotulos: readonly string[],
  ler: (texto: string) => T | null,
  opcoes: { evitar?: readonly string[] } = {},
): Achado<T> | null {
  for (const rotulo of rotulos) {
    for (const achado of acharRotulos(documento, rotulo)) {
      const linha = documento.linhas[achado.indiceDaLinha];
      if (!linha) continue;
      const textoDoRotulo = normalizar(
        linha.palavras
          .filter((p) => p.x0 >= achado.x0 - 1 && p.x1 <= achado.x1 + 1)
          .map((p) => p.texto)
          .join(' '),
      );
      const celula = normalizar(
        linha.celulas.find((c) => c.x0 <= achado.x0 && c.x1 >= achado.x0)?.texto ?? textoDoRotulo,
      );
      if (opcoes.evitar?.some((termo) => celula.includes(normalizar(termo)))) continue;
      const valor = valorDoRotulo(documento, achado, ler);
      if (valor) return valor;
    }
  }
  return null;
}

export function textoCompleto(documento: DocumentoDeTexto): string {
  return documento.linhas.map((l) => l.texto).join('\n');
}
