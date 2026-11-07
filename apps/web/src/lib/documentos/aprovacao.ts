import { planoDaAprovacao, type Revisao, type TipoDeDocumento } from '@no-azul/documentos';
import { carregarDadosFinanceiros, type ClienteSupabase } from '@/lib/financeiro/carregar';
import { mensagemDoBanco, type Resultado } from '@/lib/financeiro/operacoes';
import type { Json } from '@/lib/supabase/tipos-banco';

/** Bucket privado dos arquivos enviados (migração 20261107090000). */
export const BUCKET = 'documentos';

export async function apagarArquivo(
  supabase: ClienteSupabase,
  caminho: string | null,
): Promise<void> {
  if (!caminho) return;
  const { error } = await supabase.storage.from(BUCKET).remove([caminho]);
  if (error) {
    // Fica para a rotina de limpeza da Etapa 7; o documento já não aponta para o arquivo.
    console.warn(JSON.stringify({ origem: 'documentos', evento: 'arquivo_nao_apagado' }));
  }
}

/**
 * Aprovar: confere as escolhas com os dados de agora, monta com o motor o que cada pagamento
 * tira da reserva e grava tudo numa transação (função aprovar_documento).
 */
export async function aprovarDocumento(
  supabase: ClienteSupabase,
  documentoId: string,
  revisao: Omit<Revisao, 'tipoDoDocumento'>,
): Promise<Resultado> {
  const [{ data: documento }, { data: perfil }, dados] = await Promise.all([
    supabase
      .from('documentos')
      .select('status, tipo, arquivo_chave')
      .eq('id', documentoId)
      .maybeSingle(),
    supabase.from('perfis').select('guardar_original').single(),
    carregarDadosFinanceiros(supabase),
  ]);
  if (!documento) return { ok: false, erro: 'Documento não encontrado.' };
  if (documento.status !== 'em_revisao')
    return { ok: false, erro: 'Este documento não está em revisão.' };

  const resultado = planoDaAprovacao(
    { ...revisao, tipoDoDocumento: (documento.tipo as TipoDeDocumento | null) ?? 'comprovante' },
    dados,
  );
  if (!resultado.ok) return resultado;
  const { plano } = resultado;
  if (
    !plano.conta &&
    plano.lancamentos.length === 0 &&
    plano.pagamentos.length === 0 &&
    plano.recebimentos.length === 0
  ) {
    return {
      ok: false,
      erro: 'Nada marcado para gravar. Marque ao menos uma linha ou descarte o documento.',
    };
  }

  const manter = perfil?.guardar_original ?? false;
  const { error } = await supabase.rpc('aprovar_documento', {
    p_documento_id: documentoId,
    p_conta: plano.conta as unknown as Json,
    p_pagamentos: plano.pagamentos as unknown as Json,
    p_recebimentos: plano.recebimentos as unknown as Json,
    p_lancamentos: plano.lancamentos as unknown as Json,
    p_manter_arquivo: manter,
  });
  if (error) return { ok: false, erro: mensagemDoBanco(error) };
  if (!manter) await apagarArquivo(supabase, documento.arquivo_chave);
  return { ok: true };
}
