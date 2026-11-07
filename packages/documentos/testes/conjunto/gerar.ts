// Gera os 30 documentos fictícios do conjunto de teste e o gabarito de cada um.
//
//   pnpm --filter @no-azul/documentos conjunto:gerar
//
// Os arquivos ficam em testes/conjunto/arquivos e entram no repositório: a avaliação usa sempre
// os mesmos documentos. O ruído das fotos muda a cada geração, então só gere de novo quando
// mudar o conjunto.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from '@playwright/test';
import ExcelJS from 'exceljs';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { sorteio } from './apoio.ts';
import { boletos } from './doc-boletos.ts';
import { comprovantes } from './doc-comprovantes.ts';
import { contracheques } from './doc-contracheques.ts';
import { extratos } from './doc-extratos.ts';
import { faturas } from './doc-faturas.ts';
import type { AjustesDaFoto, Gabarito, Saida } from './tipos.ts';

const aqui = dirname(fileURLToPath(import.meta.url));
const pastaDosArquivos = join(aqui, 'arquivos');

async function capturar(navegador: Browser, html: string, largura: number): Promise<Buffer> {
  const pagina = await navegador.newPage({
    viewport: { width: largura, height: 800 },
    deviceScaleFactor: 2,
  });
  await pagina.setContent(html, { waitUntil: 'load' });
  const imagem = await pagina.screenshot({ fullPage: true, type: 'png' });
  await pagina.close();
  return imagem;
}

async function gerarPdf(navegador: Browser, html: string): Promise<Buffer> {
  const pagina = await navegador.newPage();
  await pagina.setContent(html, { waitUntil: 'load' });
  const pdf = await pagina.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  await pagina.close();
  return pdf;
}

/** Folha passada no scanner: tons de cinza, levemente torta, com ruído e sem camada de texto. */
async function digitalizar(
  navegador: Browser,
  html: string,
  largura: number,
  semente: number,
): Promise<Buffer> {
  const aleatorio = sorteio(semente);
  const captura = await capturar(navegador, html, largura);
  const { width = 1588, height = 2245 } = await sharp(captura).metadata();
  const alturaDaFolha = Math.round(width * 1.414);
  const pdf = await PDFDocument.create();
  for (let topo = 0; topo < height; topo += alturaDaFolha) {
    const altura = Math.min(alturaDaFolha, height - topo);
    const pedaco = await sharp(captura)
      .extract({ left: 0, top: topo, width, height: altura })
      .extend({ bottom: alturaDaFolha - altura, background: '#ffffff' })
      .flatten({ background: '#ffffff' })
      .grayscale()
      .rotate((aleatorio() - 0.5) * 1.6, { background: '#f4f4f4' })
      .resize({ width })
      .linear(1.2, -22)
      .blur(0.55)
      .composite([{ input: await ruido(width, alturaDaFolha, 0.32), blend: 'overlay' }])
      .jpeg({ quality: 60 })
      .toBuffer();
    const imagem = await pdf.embedJpg(pedaco);
    const folha = pdf.addPage([595.28, 841.89]);
    folha.drawImage(imagem, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }
  pdf.setProducer('Scanner Exemplo 2000');
  pdf.setCreationDate(new Date('2026-11-01T10:00:00Z'));
  pdf.setModificationDate(new Date('2026-11-01T10:00:00Z'));
  return Buffer.from(await pdf.save());
}

async function ruido(largura: number, altura: number, intensidade: number): Promise<Buffer> {
  return sharp({
    create: {
      width: largura,
      height: altura,
      channels: 4,
      background: { r: 128, g: 128, b: 128, alpha: intensidade },
      noise: { type: 'gaussian', mean: 128, sigma: 60 },
    },
  })
    .ensureAlpha(intensidade)
    .png()
    .toBuffer();
}

/** Foto do papel sobre a mesa: margem, giro, luz desigual, desfoque, ruído e JPEG. */
async function fotografar(
  navegador: Browser,
  html: string,
  largura: number,
  a: AjustesDaFoto,
): Promise<Buffer> {
  const captura = await capturar(navegador, html, largura);
  const margem = 70;
  const comMesa = await sharp(captura)
    .flatten({ background: '#ffffff' })
    .extend({ top: margem, bottom: margem, left: margem, right: margem, background: a.fundo })
    .rotate(a.angulo, { background: a.fundo })
    .toBuffer();
  const { width = 1000, height = 1000 } = await sharp(comMesa).metadata();
  const luz = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs><radialGradient id="l" cx="40%" cy="35%" r="80%">
        <stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#b8b0a4"/>
      </radialGradient></defs>
      <rect width="100%" height="100%" fill="url(#l)"/></svg>`,
  );
  const foto = await sharp(comMesa)
    .composite([
      { input: luz, blend: 'multiply' },
      { input: await ruido(width, height, a.ruido * 0.35), blend: 'overlay' },
    ])
    .modulate({ brightness: a.brilho })
    .blur(a.desfoque)
    .toBuffer();
  return sharp(foto)
    .resize({ width: Math.min(width, 1800), withoutEnlargement: true })
    .jpeg({ quality: a.qualidade, mozjpeg: true })
    .toBuffer();
}

async function gerarXlsx(
  linhas: (string | number | Date | null)[][],
  larguras: number[],
): Promise<Buffer> {
  const pasta = new ExcelJS.Workbook();
  pasta.creator = 'Banco Ponte Digital';
  pasta.created = new Date('2026-11-01T10:00:00Z');
  pasta.modified = new Date('2026-11-01T10:00:00Z');
  const planilha = pasta.addWorksheet('Extrato');
  planilha.columns = larguras.map((width) => ({ width }));
  for (const linha of linhas) {
    const adicionada = planilha.addRow(linha);
    adicionada.eachCell((celula) => {
      if (celula.value instanceof Date) celula.numFmt = 'dd/mm/yyyy';
      else if (typeof celula.value === 'number') celula.numFmt = '#,##0.00;-#,##0.00';
    });
  }
  return Buffer.from(await pasta.xlsx.writeBuffer());
}

async function produzir(navegador: Browser, saida: Saida): Promise<Buffer> {
  switch (saida.como) {
    case 'pdf':
      return gerarPdf(navegador, saida.html);
    case 'digitalizado':
      return digitalizar(navegador, saida.html, saida.largura, saida.semente);
    case 'foto':
      return fotografar(navegador, saida.html, saida.largura, saida.ajustes);
    case 'arquivo':
      return saida.conteudo;
    case 'xlsx':
      return gerarXlsx(saida.linhas, saida.larguras);
  }
}

async function principal() {
  const definicoes = [...comprovantes, ...boletos, ...faturas, ...extratos, ...contracheques];
  if (definicoes.length !== 30)
    throw new Error(`O conjunto precisa de 30 documentos, tem ${definicoes.length}.`);

  await rm(pastaDosArquivos, { recursive: true, force: true });
  await mkdir(pastaDosArquivos, { recursive: true });
  const navegador = await chromium.launch();
  const gabaritos: Gabarito[] = [];
  try {
    for (const definicao of definicoes) {
      const conteudo = await produzir(navegador, await definicao.saida());
      await writeFile(join(pastaDosArquivos, definicao.gabarito.arquivo), conteudo);
      gabaritos.push(definicao.gabarito);
      console.log(`${definicao.gabarito.arquivo} (${Math.round(conteudo.length / 1024)} KB)`);
    }
  } finally {
    await navegador.close();
  }
  await writeFile(join(aqui, 'gabaritos.json'), `${JSON.stringify(gabaritos, null, 2)}\n`);
  const campos = gabaritos.reduce(
    (soma, g) => soma + (g.conta ? 2 : 0) + g.lancamentos.length * 2,
    0,
  );
  console.log(`\n30 documentos e ${campos} valores e datas no gabarito.`);
}

await principal();
