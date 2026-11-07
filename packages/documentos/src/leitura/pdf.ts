import { getDocumentProxy, renderPageAsImage } from 'unpdf';
import { agruparEmLinhas, montarLinha, type Linha, type Palavra } from '../documento';

/** Abaixo disso, em média por página, o PDF é tratado como digitalizado e vai para o OCR. */
const CARACTERES_MINIMOS_POR_PAGINA = 40;

interface ItemDeTexto {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

function ehItemDeTexto(item: unknown): item is ItemDeTexto {
  return typeof item === 'object' && item !== null && 'str' in item && 'transform' in item;
}

/**
 * Junta os pedaços de texto do PDF de uma mesma linha e os separa em palavras, com a posição de
 * cada uma. O PDF às vezes quebra uma palavra em pedaços (ligaduras como "fi"); pedaços colados
 * viram uma palavra só.
 */
function palavrasDosItens(itens: readonly ItemDeTexto[], alturaDaPagina: number): Palavra[] {
  const caracteres: { c: string; x0: number; x1: number; y0: number; y1: number }[] = [];
  const ordenados = [...itens].sort((a, b) => (a.transform[4] ?? 0) - (b.transform[4] ?? 0));
  let fimAnterior: number | null = null;
  for (const item of ordenados) {
    const x = item.transform[4] ?? 0;
    const base = item.transform[5] ?? 0;
    const altura = Math.max(item.height, 1);
    const y0 = alturaDaPagina - base - altura * 0.8;
    const y1 = alturaDaPagina - base + altura * 0.2;
    if (fimAnterior !== null && x - fimAnterior > altura * 0.2) {
      caracteres.push({ c: ' ', x0: fimAnterior, x1: x, y0, y1 });
    }
    const largura = item.str.length > 0 ? item.width / item.str.length : 0;
    [...item.str].forEach((c, i) => {
      caracteres.push({ c, x0: x + i * largura, x1: x + (i + 1) * largura, y0, y1 });
    });
    fimAnterior = x + item.width;
  }

  // Glifo sem código Unicode (área de uso privado) antes ou entre números costuma ser o hífen ou
  // o sinal de menos de uma fonte com variantes ("-R$ 45,90", "789-09"). Em outro lugar, sai.
  for (let i = 0; i < caracteres.length; i++) {
    const atual = caracteres[i];
    if (!atual || !/[\uE000-\uF8FF]/.test(atual.c)) continue;
    const seguinte = caracteres[i + 1]?.c ?? '';
    atual.c = /[\dR]/.test(seguinte) ? '-' : '';
  }

  const palavras: Palavra[] = [];
  let atual: typeof caracteres = [];
  const fechar = () => {
    const primeira = atual[0];
    const ultima = atual[atual.length - 1];
    if (primeira && ultima) {
      palavras.push({
        texto: atual.map((c) => c.c).join(''),
        x0: primeira.x0,
        x1: ultima.x1,
        y0: Math.min(...atual.map((c) => c.y0)),
        y1: Math.max(...atual.map((c) => c.y1)),
        confianca: 1,
      });
    }
    atual = [];
  };
  for (const caractere of caracteres) {
    if (/\s/.test(caractere.c)) fechar();
    else if (caractere.c !== '') atual.push(caractere);
  }
  fechar();
  return palavras;
}

export interface TextoDoPdf {
  linhas: Linha[];
  paginas: number;
  /** O PDF tem camada de texto (não é só imagem). */
  temTexto: boolean;
}

export async function lerTextoDoPdf(bytes: Uint8Array): Promise<TextoDoPdf> {
  const pdf = await getDocumentProxy(bytes.slice());
  const linhas: Linha[] = [];
  let caracteres = 0;
  for (let numero = 1; numero <= pdf.numPages; numero++) {
    const pagina = await pdf.getPage(numero);
    const altura = pagina.getViewport({ scale: 1 }).height;
    const conteudo = await pagina.getTextContent();
    const itens = (conteudo.items as unknown[])
      .filter(ehItemDeTexto)
      .filter((item) => item.str !== '');
    caracteres += itens.reduce((soma, item) => soma + item.str.trim().length, 0);

    // Primeiro agrupa os pedaços por linha; depois monta as palavras de cada linha.
    const porLinha = agruparEmLinhas(
      numero,
      itens.map((item, indice) => {
        const base = item.transform[5] ?? 0;
        const alturaDoItem = Math.max(item.height, 1);
        return {
          texto: String(indice),
          x0: item.transform[4] ?? 0,
          x1: (item.transform[4] ?? 0) + item.width,
          y0: altura - base - alturaDoItem * 0.8,
          y1: altura - base + alturaDoItem * 0.2,
          confianca: 1,
        };
      }),
    );
    for (const linha of porLinha) {
      const doGrupo = linha.palavras
        .map((p) => itens[Number(p.texto)])
        .filter((i) => i !== undefined);
      const palavras = palavrasDosItens(doGrupo, altura);
      if (palavras.length > 0) linhas.push(montarLinha(numero, palavras));
    }
  }
  const paginas = pdf.numPages;
  await pdf.loadingTask.destroy();
  return {
    linhas,
    paginas,
    temTexto: caracteres >= CARACTERES_MINIMOS_POR_PAGINA * Math.max(1, paginas) * 0.5,
  };
}

/** Desenha cada página como PNG, para o OCR de PDF digitalizado. */
export async function renderizarPaginas(
  bytes: Uint8Array,
  maximoDePaginas = 10,
): Promise<Buffer[]> {
  const pdf = await getDocumentProxy(bytes.slice());
  const total = Math.min(pdf.numPages, maximoDePaginas);
  await pdf.loadingTask.destroy();
  const imagens: Buffer[] = [];
  for (let numero = 1; numero <= total; numero++) {
    const imagem = await renderPageAsImage(bytes.slice(), numero, {
      canvasImport: () => import('@napi-rs/canvas'),
      scale: 2.5,
    });
    imagens.push(Buffer.from(imagem));
  }
  return imagens;
}
