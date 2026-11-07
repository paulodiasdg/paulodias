import type { DataCivil } from '@no-azul/motor';
import { sugerirCategoria, type CategoriaDoHistorico } from '../categorias';
import { textoCompleto, type DocumentoDeTexto, type Linha } from '../documento';
import { decodificarTexto, detectarFormato } from '../formato';
import {
  lerComprovante,
  lerConta,
  lerContracheque,
  lerExtratoDeTexto,
  lerFatura,
  type Parcial,
} from '../leitores/documentos';
import { linhasDeLancamento } from '../leitores/linhas';
import { lerTabela, lerTransacoesDoOfx } from '../leitores/tabela';
import { detectarTipo } from '../leitores/tipo';
import { lerOfx } from '../ofx';
import {
  LEITOR,
  type Extracao,
  type FormatoDoArquivo,
  type OrigemDoTexto,
  type TipoDeDocumento,
} from '../tipos';
import { validarExtracao } from '../validacao';
import { lerCodigosDeBarras, lerTextoDaImagem, prepararImagem } from './imagem';
import { lerTextoDoPdf, renderizarPaginas } from './pdf';
import { lerCsv, lerXlsx } from './planilhas';

export { definirCaminhos, encerrarOcr, type CaminhosDaLeitura } from './imagem';

export interface OpcoesDaLeitura {
  nome: string;
  /** Data do envio (horário de Brasília): resolve o ano das datas sem ano e o fator do boleto. */
  hoje: DataCivil;
  tipoInformado?: TipoDeDocumento | null;
  /** Lançamentos já categorizados pela pessoa, do mais antigo ao mais recente. */
  historico?: readonly CategoriaDoHistorico[];
  /** Slugs das categorias da pessoa; a sugestão fica entre eles. */
  categorias?: ReadonlySet<string>;
}

export type ResultadoDaLeitura =
  { ok: true; extracao: Extracao; tipoMime: string } | { ok: false; motivo: string };

async function lerImagem(
  png: Buffer,
  pagina: number,
): Promise<{ linhas: Linha[]; codigos: string[] }> {
  const [linhas, codigos] = await Promise.all([
    lerTextoDaImagem(png, pagina),
    lerCodigosDeBarras(png),
  ]);
  return { linhas, codigos };
}

async function documentoDeTexto(
  formato: 'pdf' | 'imagem',
  bytes: Uint8Array,
): Promise<DocumentoDeTexto> {
  if (formato === 'pdf') {
    const texto = await lerTextoDoPdf(bytes);
    if (texto.temTexto) return { origem: 'texto', linhas: texto.linhas, codigosDeBarras: [] };
    const paginas = await renderizarPaginas(bytes);
    const linhas: Linha[] = [];
    const codigos: string[] = [];
    for (const [indice, pagina] of paginas.entries()) {
      const lido = await lerImagem(await prepararImagem(pagina), indice + 1);
      linhas.push(...lido.linhas);
      codigos.push(...lido.codigos);
    }
    return { origem: 'ocr', linhas, codigosDeBarras: codigos };
  }
  const lido = await lerImagem(await prepararImagem(bytes), 1);
  return { origem: 'ocr', linhas: lido.linhas, codigosDeBarras: lido.codigos };
}

function lerPorTipo(tipo: TipoDeDocumento, documento: DocumentoDeTexto, hoje: DataCivil): Parcial {
  switch (tipo) {
    case 'comprovante':
      return lerComprovante(documento);
    case 'boleto':
      return lerConta(documento, hoje);
    case 'fatura_cartao':
      return lerFatura(documento, hoje);
    case 'extrato':
      return lerExtratoDeTexto(documento, hoje);
    case 'contracheque':
      return lerContracheque(documento);
  }
}

/**
 * Lê um documento inteiro, sem serviço externo: formato pelo conteúdo, texto do PDF ou OCR,
 * regras do tipo, categorias e validação. O resultado é só uma proposta para a revisão.
 */
export async function lerDocumento(
  bytes: Uint8Array,
  opcoes: OpcoesDaLeitura,
): Promise<ResultadoDaLeitura> {
  const deteccao = detectarFormato(bytes, opcoes.nome);
  if (!deteccao.ok) return { ok: false, motivo: deteccao.motivo };
  const formato: FormatoDoArquivo = deteccao.formato;

  let parcial: Parcial;
  let origem: OrigemDoTexto;
  let tipo: TipoDeDocumento;
  try {
    if (formato === 'ofx' || formato === 'csv' || formato === 'xlsx') {
      origem = 'tabela';
      tipo = opcoes.tipoInformado ?? 'extrato';
      parcial =
        formato === 'ofx'
          ? lerTransacoesDoOfx(lerOfx(decodificarTexto(bytes)))
          : lerTabela(formato === 'csv' ? lerCsv(bytes) : await lerXlsx(bytes), tipo);
    } else {
      const documento = await documentoDeTexto(formato, bytes);
      origem = documento.origem;
      tipo =
        opcoes.tipoInformado ??
        detectarTipo(textoCompleto(documento), linhasDeLancamento(documento).length);
      parcial = lerPorTipo(tipo, documento, opcoes.hoje);
    }
  } catch {
    return {
      ok: false,
      motivo: 'Não consegui abrir o arquivo. Ele pode estar corrompido ou protegido por senha.',
    };
  }

  const historico = opcoes.historico ?? [];
  const extracao: Extracao = {
    versao: 1,
    leitor: LEITOR,
    formato,
    origem,
    tipo,
    tipoInformado: Boolean(opcoes.tipoInformado),
    ...parcial,
    lancamentos: parcial.lancamentos.map((l) => ({
      ...l,
      categoria: l.categoria ?? sugerirCategoria(l.descricao, l.tipo, historico, opcoes.categorias),
    })),
    conta: parcial.conta && {
      ...parcial.conta,
      categoria:
        parcial.conta.categoria ??
        sugerirCategoria(parcial.conta.nome, 'despesa', historico, opcoes.categorias),
    },
  };
  return {
    ok: true,
    extracao: validarExtracao(extracao, opcoes.hoje),
    tipoMime: deteccao.tipoMime,
  };
}
