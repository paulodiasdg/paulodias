import 'server-only';
import { after } from 'next/server';
import type { Extracao, TipoDeDocumento } from '@no-azul/documentos';
import type { ClienteSupabase } from '@/lib/financeiro/carregar';
import { mensagemDoBanco, type Resultado } from '@/lib/financeiro/operacoes';
import type { Json } from '@/lib/supabase/tipos-banco';
import { apagarArquivo, aprovarDocumento } from './aprovacao';
import { BUCKET_DOS_DOCUMENTOS, lerDocumentoGuardado } from './leitura';

export { aprovarDocumento };

/** Operações da tela Documentos. Cada uma usa a sessão de quem está logado (RLS). */

export const TIPOS_DE_DOCUMENTO: Record<TipoDeDocumento, string> = {
  comprovante: 'Comprovante ou nota fiscal',
  boleto: 'Boleto ou conta de consumo',
  fatura_cartao: 'Fatura de cartão',
  extrato: 'Extrato bancário',
  contracheque: 'Contracheque',
};

export const EXTENSOES_ACEITAS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'csv', 'txt', 'ofx', 'xlsx'];
export const TAMANHO_MAXIMO = 15 * 1024 * 1024;

/** Depois disso, um documento parado em "processando" pode ser lido de novo. */
const MINUTOS_PARA_TENTAR_DE_NOVO = 3;

/** A leitura começou há mais de 3 minutos e não terminou (o servidor pode ter reiniciado). */
export function leituraParada(
  status: string,
  processandoDesde: string | null,
  agora = new Date(),
): boolean {
  if (status !== 'processando') return false;
  if (!processandoDesde) return true;
  return agora.getTime() - Date.parse(processandoDesde) > MINUTOS_PARA_TENTAR_DE_NOVO * 60_000;
}

async function usuarioId(supabase: ClienteSupabase): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  return typeof id === 'string' ? id : null;
}

export interface DadosDoEnvio {
  nome: string;
  tamanho: number;
  hash: string;
  tipoInformado: TipoDeDocumento | null;
  reenviar: boolean;
}

export type ResultadoDoEnvio =
  | { ok: true; documentoId: string; caminho: string; token: string }
  | { ok: false; erro: string; duplicado?: { nome: string; criadoEm: string } };

/**
 * Primeiro passo do envio: confere o arquivo pelo que o navegador informou, avisa se ele já foi
 * enviado e cria o documento com um endereço de envio direto para o Storage.
 */
export async function iniciarEnvio(
  supabase: ClienteSupabase,
  dados: DadosDoEnvio,
): Promise<ResultadoDoEnvio> {
  const nome = dados.nome.trim().slice(0, 255);
  const extensao = nome.split('.').pop()?.toLowerCase() ?? '';
  if (!nome) return { ok: false, erro: 'Escolha um arquivo.' };
  if (!EXTENSOES_ACEITAS.includes(extensao)) {
    return {
      ok: false,
      erro: 'Formato não aceito. Envie PDF, foto (JPG ou PNG), CSV, OFX ou XLSX.',
    };
  }
  if (!Number.isInteger(dados.tamanho) || dados.tamanho <= 0)
    return { ok: false, erro: 'O arquivo está vazio.' };
  if (dados.tamanho > TAMANHO_MAXIMO) return { ok: false, erro: 'O arquivo passa de 15 MB.' };
  if (!/^[0-9a-f]{64}$/.test(dados.hash))
    return { ok: false, erro: 'Não consegui conferir o arquivo. Tente de novo.' };

  const dono = await usuarioId(supabase);
  if (!dono) return { ok: false, erro: 'Sua sessão terminou. Entre de novo.' };

  const { data: anterior } = await supabase
    .from('documentos')
    .select('nome, criado_em')
    .eq('hash', dados.hash)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (anterior && !dados.reenviar) {
    return {
      ok: false,
      erro: 'Este arquivo já foi enviado.',
      duplicado: { nome: anterior.nome, criadoEm: anterior.criado_em },
    };
  }

  const { data: criado, error } = await supabase
    .from('documentos')
    .insert({
      nome,
      hash: dados.hash,
      tamanho_bytes: dados.tamanho,
      tipo_informado: dados.tipoInformado,
      reenvio_confirmado: Boolean(anterior),
    })
    .select('id')
    .single();
  if (error || !criado)
    return {
      ok: false,
      erro: error ? mensagemDoBanco(error) : 'Não foi possível criar o documento.',
    };

  const caminho = `${dono}/${criado.id}`;
  const atualizado = await supabase
    .from('documentos')
    .update({ arquivo_chave: caminho })
    .eq('id', criado.id);
  const envio = await supabase.storage.from(BUCKET_DOS_DOCUMENTOS).createSignedUploadUrl(caminho);
  if (atualizado.error || envio.error || !envio.data) {
    await supabase.from('documentos').delete().eq('id', criado.id);
    return { ok: false, erro: 'Não foi possível preparar o envio. Tente de novo.' };
  }
  return { ok: true, documentoId: criado.id, caminho, token: envio.data.token };
}

/** Lê o documento logo depois da resposta (sem fila externa, decisão D8). */
function lerDepois(supabase: ClienteSupabase, documentoId: string): void {
  after(() => lerDocumentoGuardado(supabase, documentoId));
}

/** Segundo passo: o arquivo chegou ao Storage; a leitura começa. */
export async function concluirEnvio(
  supabase: ClienteSupabase,
  documentoId: string,
): Promise<Resultado> {
  const { data, error } = await supabase
    .from('documentos')
    .update({ status: 'processando', processando_desde: new Date().toISOString() })
    .eq('id', documentoId)
    .eq('status', 'recebido')
    .select('id');
  if (error) return { ok: false, erro: mensagemDoBanco(error) };
  if (!data?.length) return { ok: false, erro: 'Documento não encontrado.' };
  lerDepois(supabase, documentoId);
  return { ok: true };
}

/** Ler de novo um documento com erro ou parado em "processando". */
export async function lerDeNovo(
  supabase: ClienteSupabase,
  documentoId: string,
): Promise<Resultado> {
  const { data: documento } = await supabase
    .from('documentos')
    .select('status, processando_desde, arquivo_chave')
    .eq('id', documentoId)
    .maybeSingle();
  if (!documento) return { ok: false, erro: 'Documento não encontrado.' };
  if (!documento.arquivo_chave)
    return { ok: false, erro: 'O arquivo deste documento já foi apagado.' };
  const parado = leituraParada(documento.status, documento.processando_desde);
  if (documento.status !== 'erro' && documento.status !== 'em_revisao' && !parado) {
    return { ok: false, erro: 'O documento ainda está sendo lido. Aguarde um pouco.' };
  }
  const { error } = await supabase
    .from('documentos')
    .update({
      status: 'processando',
      processando_desde: new Date().toISOString(),
      erro: null,
      extracao_json: null,
    })
    .eq('id', documentoId);
  if (error) return { ok: false, erro: mensagemDoBanco(error) };
  lerDepois(supabase, documentoId);
  return { ok: true };
}

/** Descartar: nada é gravado e o arquivo é apagado. */
export async function descartarDocumento(
  supabase: ClienteSupabase,
  documentoId: string,
): Promise<Resultado> {
  const { data: documento } = await supabase
    .from('documentos')
    .select('status, arquivo_chave')
    .eq('id', documentoId)
    .maybeSingle();
  if (!documento) return { ok: false, erro: 'Documento não encontrado.' };
  if (documento.status === 'aprovado' || documento.status === 'descartado') {
    return { ok: false, erro: 'Este documento já foi revisado.' };
  }
  const { error } = await supabase
    .from('documentos')
    .update({
      status: 'descartado',
      descartado_em: new Date().toISOString(),
      arquivo_chave: null,
      erro: null,
      processando_desde: null,
    })
    .eq('id', documentoId);
  if (error) return { ok: false, erro: mensagemDoBanco(error) };
  await apagarArquivo(supabase, documento.arquivo_chave);
  return { ok: true };
}

export async function definirGuardarOriginal(
  supabase: ClienteSupabase,
  guardar: boolean,
): Promise<Resultado> {
  const dono = await usuarioId(supabase);
  if (!dono) return { ok: false, erro: 'Sua sessão terminou. Entre de novo.' };
  const { error } = await supabase
    .from('perfis')
    .update({ guardar_original: guardar })
    .eq('usuario_id', dono);
  return error ? { ok: false, erro: mensagemDoBanco(error) } : { ok: true };
}

/** A extração gravada, ou null se o documento ainda não foi lido. */
export function lerExtracao(json: Json | null): Extracao | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  return (json as { versao?: number }).versao === 1 ? (json as unknown as Extracao) : null;
}
