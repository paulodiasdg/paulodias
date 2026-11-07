// Peças de HTML comuns aos documentos do conjunto de teste.
import bwipjs from 'bwip-js';

export interface OpcoesDaPagina {
  fonte?: string;
  tamanho?: number;
  /** Largura do conteúdo em pixels (foto e digitalizado); o PDF usa A4. */
  largura?: number;
  fundo?: string;
}

export function pagina(corpo: string, opcoes: OpcoesDaPagina = {}): string {
  const fonte = opcoes.fonte ?? "'DejaVu Sans', sans-serif";
  const tamanho = opcoes.tamanho ?? 12;
  const largura = opcoes.largura ? `width:${opcoes.largura}px;` : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ${fonte}; font-size: ${tamanho}px; color: #111; background: ${opcoes.fundo ?? '#fff'}; }
    .folha { ${largura} padding: ${opcoes.largura ? '28px' : '0'}; background: #fff; }
    table { border-collapse: collapse; width: 100%; }
    td, th { padding: 3px 6px; vertical-align: top; }
    th { text-align: left; }
    .dir { text-align: right; }
    .centro { text-align: center; }
    .caixa { border: 1px solid #333; padding: 6px 8px; }
    .rotulo { font-size: 0.75em; color: #444; display: block; }
    .forte { font-weight: bold; }
    .grande { font-size: 1.5em; font-weight: bold; }
    .linha { border-top: 1px dashed #555; margin: 8px 0; }
    .quebra { page-break-after: always; }
    .listra tr:nth-child(even) td { background: #f2f2f2; }
    .mono { font-family: 'DejaVu Sans Mono', monospace; }
  </style></head><body><div class="folha">${corpo}</div></body></html>`;
}

/** Imagem PNG (data URI) do código de barras de um boleto: intercalado 2 de 5, 44 dígitos. */
export async function imagemDoCodigoDeBarras(codigo: string): Promise<string> {
  const png = await bwipjs.toBuffer({
    bcid: 'interleaved2of5',
    text: codigo,
    scale: 3,
    height: 13,
    includetext: false,
    paddingwidth: 12,
    paddingheight: 4,
    backgroundcolor: 'FFFFFF',
  });
  return `data:image/png;base64,${png.toString('base64')}`;
}
