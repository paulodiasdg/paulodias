import 'server-only';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { definirCaminhos, lerDocumento } from '@no-azul/documentos/leitura';
import { LEITOR, type TipoDeDocumento } from '@no-azul/documentos';
import type { ClienteSupabase } from '@/lib/financeiro/carregar';
import { hojeNoBrasil } from '@/lib/formatacao';
import type { Json } from '@/lib/supabase/tipos-banco';
import { BUCKET as BUCKET_DOS_DOCUMENTOS } from './aprovacao';

/**
 * Leitura de um documento já enviado ao Storage, no próprio servidor (decisão D8): confere o
 * arquivo, lê, e grava a proposta em documentos.extracao_json com o status "em revisão".
 * Usa a sessão de quem enviou: o RLS de sempre vale também aqui.
 */

export { BUCKET as BUCKET_DOS_DOCUMENTOS } from './aprovacao';

/** Tempo máximo da leitura; depois disso, o documento vai para "erro" e pode ser lido de novo. */
const TEMPO_MAXIMO_MS = 150_000;

let caminhosDefinidos = false;

function prepararCaminhos(): void {
  if (caminhosDefinidos) return;
  // As bibliotecas da leitura rodam fora do empacotador (next.config.ts); os arquivos de idioma
  // do OCR e do leitor de códigos ficam no node_modules do app.
  const modulos = join(process.cwd(), 'node_modules');
  definirCaminhos({
    idioma: join(modulos, '@tesseract.js-data/por/4.0.0_best_int'),
    leitorDeCodigos: join(modulos, 'zxing-wasm/dist/reader/zxing_reader.wasm'),
  });
  caminhosDefinidos = true;
}

function registrar(evento: Record<string, unknown>): void {
  // Sem conteúdo de documento nem valores financeiros (CLAUDE.md).
  console.info(JSON.stringify({ origem: 'leitura-de-documento', ...evento }));
}

async function marcarErro(supabase: ClienteSupabase, documentoId: string, motivo: string) {
  await supabase
    .from('documentos')
    .update({ status: 'erro', erro: motivo.slice(0, 300), processando_desde: null })
    .eq('id', documentoId);
}

async function historicoDeCategorias(supabase: ClienteSupabase) {
  const [lancamentos, categorias] = await Promise.all([
    supabase
      .from('lancamentos')
      .select('descricao, categoria_id, data')
      .not('categoria_id', 'is', null)
      .order('data', { ascending: false })
      .limit(500),
    supabase.from('categorias').select('id, slug'),
  ]);
  const slugs = new Map((categorias.data ?? []).map((c) => [c.id, c.slug]));
  const historico = (lancamentos.data ?? [])
    .map((l) => ({ descricao: l.descricao, categoria: slugs.get(l.categoria_id ?? '') ?? '' }))
    .filter((l) => l.categoria !== '')
    .reverse();
  return { historico, disponiveis: new Set(slugs.values()) };
}

export async function lerDocumentoGuardado(
  supabase: ClienteSupabase,
  documentoId: string,
): Promise<void> {
  const inicio = Date.now();
  prepararCaminhos();
  const { data: documento } = await supabase
    .from('documentos')
    .select('id, nome, hash, arquivo_chave, tipo_informado, status')
    .eq('id', documentoId)
    .single();
  if (!documento || documento.status !== 'processando' || !documento.arquivo_chave) return;

  try {
    const baixado = await supabase.storage
      .from(BUCKET_DOS_DOCUMENTOS)
      .download(documento.arquivo_chave);
    if (baixado.error || !baixado.data) {
      await marcarErro(supabase, documentoId, 'O arquivo não chegou ao servidor. Envie de novo.');
      registrar({ documento: documentoId, status: 'erro', motivo: 'sem_arquivo' });
      return;
    }
    const bytes = new Uint8Array(await baixado.data.arrayBuffer());
    if (createHash('sha256').update(bytes).digest('hex') !== documento.hash) {
      await marcarErro(
        supabase,
        documentoId,
        'O arquivo recebido não confere com o enviado. Envie de novo.',
      );
      registrar({ documento: documentoId, status: 'erro', motivo: 'hash_diferente' });
      return;
    }

    const { historico, disponiveis } = await historicoDeCategorias(supabase);
    let limite: ReturnType<typeof setTimeout> | undefined;
    const tempoEsgotado = new Promise<null>((resolve) => {
      limite = setTimeout(() => resolve(null), TEMPO_MAXIMO_MS);
    });
    const lido = await Promise.race([
      lerDocumento(bytes, {
        nome: documento.nome,
        hoje: hojeNoBrasil(),
        tipoInformado: (documento.tipo_informado as TipoDeDocumento | null) ?? null,
        historico,
        categorias: disponiveis,
      }),
      tempoEsgotado,
    ]);
    clearTimeout(limite);

    if (!lido) {
      await marcarErro(
        supabase,
        documentoId,
        'A leitura demorou demais. Tente de novo ou lance à mão.',
      );
      registrar({
        documento: documentoId,
        status: 'erro',
        motivo: 'tempo',
        ms: Date.now() - inicio,
      });
      return;
    }
    if (!lido.ok) {
      await marcarErro(supabase, documentoId, lido.motivo);
      registrar({
        documento: documentoId,
        status: 'erro',
        motivo: 'leitura',
        ms: Date.now() - inicio,
      });
      return;
    }

    const { extracao } = lido;
    await supabase
      .from('documentos')
      .update({
        status: 'em_revisao',
        tipo: extracao.tipo,
        tipo_mime: lido.tipoMime,
        extracao_json: extracao as unknown as Json,
        modelo_usado: LEITOR,
        processado_em: new Date().toISOString(),
        processando_desde: null,
        erro: null,
      })
      .eq('id', documentoId)
      .eq('status', 'processando');
    registrar({
      documento: documentoId,
      status: 'em_revisao',
      formato: extracao.formato,
      leitura: extracao.origem,
      tipo: extracao.tipo,
      linhas: extracao.lancamentos.length,
      ms: Date.now() - inicio,
    });
  } catch {
    await marcarErro(
      supabase,
      documentoId,
      'Não consegui ler o documento. Tente de novo ou lance à mão.',
    );
    registrar({
      documento: documentoId,
      status: 'erro',
      motivo: 'excecao',
      ms: Date.now() - inicio,
    });
  }
}
