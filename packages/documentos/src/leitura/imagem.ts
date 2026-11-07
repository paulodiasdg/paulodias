import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { createWorker, type Worker } from 'tesseract.js';
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';
import { montarLinha, type Linha, type Palavra } from '../documento';
import { corrigirDigitos } from '../texto';

/**
 * Leitura de fotos e páginas digitalizadas no próprio servidor: tratamento da imagem (sharp),
 * OCR em português (Tesseract) e código de barras de boleto (ZXing). Nada sai para fora.
 */

export interface CaminhosDaLeitura {
  /** Pasta com o `por.traineddata.gz`. */
  idioma: string;
  /** Arquivo `zxing_reader.wasm`. */
  leitorDeCodigos: string;
}

let caminhos: CaminhosDaLeitura | null = null;

/** O app pode informar onde estão os arquivos de idioma e do leitor de códigos. */
export function definirCaminhos(novos: CaminhosDaLeitura): void {
  caminhos = novos;
}

function caminhosPadrao(): CaminhosDaLeitura {
  if (caminhos) return caminhos;
  const exigir = createRequire(import.meta.url);
  return {
    idioma: join(dirname(exigir.resolve('@tesseract.js-data/por')), '4.0.0_best_int'),
    leitorDeCodigos: join(
      dirname(exigir.resolve('zxing-wasm/reader')),
      '../../reader/zxing_reader.wasm',
    ),
  };
}

let trabalhador: Promise<Worker> | null = null;

function ocr(): Promise<Worker> {
  trabalhador ??= createWorker('por', 1, {
    langPath: caminhosPadrao().idioma,
    gzip: true,
    cacheMethod: 'none',
  }).then(async (w) => {
    await w.setParameters({ preserve_interword_spaces: '1' });
    return w;
  });
  return trabalhador;
}

/** Libera o OCR (usado ao fim dos testes). */
export async function encerrarOcr(): Promise<void> {
  const atual = trabalhador;
  trabalhador = null;
  if (atual) await (await atual).terminate();
}

let leitorPronto: Promise<void> | null = null;

function prepararLeitorDeCodigos(): Promise<void> {
  // O caminho vem do app (definirCaminhos); o empacotador não precisa rastreá-lo.
  leitorPronto ??= readFile(/*turbopackIgnore: true*/ caminhosPadrao().leitorDeCodigos).then(
    (wasm) => {
      prepareZXingModule({
        overrides: {
          wasmBinary: wasm.buffer.slice(
            wasm.byteOffset,
            wasm.byteOffset + wasm.byteLength,
          ) as ArrayBuffer,
        },
        fireImmediately: true,
      });
    },
  );
  return leitorPronto;
}

/**
 * Endireita pela orientação da câmera, tira os metadados (inclusive a localização), passa para
 * tons de cinza, deixa a largura entre 1.600 e 2.400 pixels e realça o contraste.
 */
export async function prepararImagem(bytes: Uint8Array): Promise<Buffer> {
  const imagem = sharp(bytes, { failOn: 'error' }).rotate();
  const { width = 1600 } = await imagem.metadata();
  const largura = width < 1600 ? 1800 : width > 2400 ? 2400 : width;
  return imagem
    .flatten({ background: '#ffffff' })
    .grayscale()
    .resize({ width: largura, kernel: 'lanczos3' })
    .normalize()
    .sharpen()
    .png()
    .toBuffer();
}

interface PalavraDoOcr {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

interface LinhaDoOcr {
  confidence: number;
  words: PalavraDoOcr[];
  baseline: { x0: number; y0: number; x1: number; y1: number };
}

function linhasDoResultado(resultado: unknown): LinhaDoOcr[] {
  const blocos =
    (resultado as { blocks?: { paragraphs: { lines: LinhaDoOcr[] }[] }[] | null }).blocks ?? [];
  return blocos.flatMap((b) => b.paragraphs.flatMap((p) => p.lines));
}

/** Inclinação do texto em graus, pela linha de base das linhas mais largas. */
function inclinacao(linhas: readonly LinhaDoOcr[], largura: number): number {
  const angulos = linhas
    .filter((l) => l.baseline.x1 - l.baseline.x0 > largura * 0.25)
    .map(
      (l) =>
        (Math.atan2(l.baseline.y1 - l.baseline.y0, l.baseline.x1 - l.baseline.x0) * 180) / Math.PI,
    )
    .sort((a, b) => a - b);
  return angulos.length === 0 ? 0 : (angulos[Math.floor(angulos.length / 2)] ?? 0);
}

async function reconhecer(png: Buffer): Promise<LinhaDoOcr[]> {
  const { data } = await (await ocr()).recognize(png, {}, { blocks: true, text: false });
  return linhasDoResultado(data);
}

/** OCR de uma imagem já preparada. Se o texto estiver torto, endireita e lê de novo. */
export async function lerTextoDaImagem(png: Buffer, pagina = 1): Promise<Linha[]> {
  const { width = 1800 } = await sharp(png).metadata();
  let linhas = await reconhecer(png);
  const angulo = inclinacao(linhas, width);
  if (Math.abs(angulo) > 0.4) {
    const endireitada = await sharp(png)
      .rotate(-angulo, { background: '#ffffff' })
      .png()
      .toBuffer();
    linhas = await reconhecer(endireitada);
  }
  return linhas
    .map((linha) => {
      const palavras: Palavra[] = linha.words
        .filter((p) => p.text.trim() !== '')
        .map((p) => ({
          texto: corrigirDigitos(p.text.trim()),
          x0: p.bbox.x0,
          y0: p.bbox.y0,
          x1: p.bbox.x1,
          y1: p.bbox.y1,
          confianca: Math.max(0, Math.min(1, p.confidence / 100)),
        }));
      return palavras.length > 0 ? montarLinha(pagina, palavras, linha.confidence / 100) : null;
    })
    .filter((linha): linha is Linha => linha !== null)
    .sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
}

/** Códigos de barras de boleto (intercalado 2 de 5, 44 dígitos) na imagem. */
export async function lerCodigosDeBarras(png: Buffer): Promise<string[]> {
  await prepararLeitorDeCodigos();
  const resultados = await readBarcodes(new Uint8Array(png), {
    formats: ['ITF'],
    tryHarder: true,
    maxNumberOfSymbols: 3,
  });
  return resultados.map((r) => r.text).filter((texto) => /^\d{44}$/.test(texto));
}
