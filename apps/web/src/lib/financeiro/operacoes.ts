import {
  listarContas,
  maiorData,
  planoDePagamento,
  primeiroDiaDa,
  saldoEm,
  ultimoDiaDa,
  valorDoAjuste,
  type Centavos,
  type Competencia,
  type Conta,
  type DadosFinanceiros,
  type DataCivil,
} from '@no-azul/motor';
import { carregarDadosFinanceiros, type ClienteSupabase } from './carregar';

/**
 * Operações que mudam os dados financeiros. Elas recebem o cliente do Supabase de quem está
 * logado (o RLS limita tudo às próprias linhas) e nunca calculam valores: o que é cálculo vem do
 * motor (packages/motor). Operações de várias tabelas chamam funções do banco, que gravam tudo em
 * uma única transação (supabase/migrations/20261105090000_operacoes_de_contas.sql).
 */

export type Resultado = { ok: true } | { ok: false; erro: string };

const OK: Resultado = { ok: true };

/** Traduz erros do banco para mensagens em português, sem expor detalhes nem valores. */
export function mensagemDoBanco(erro: { code?: string; message: string }): string {
  switch (erro.code) {
    case 'P0001':
    case 'P0002':
    case '22023':
      return erro.message; // mensagens já escritas em português nas funções do banco
    case '23505':
      return erro.message.includes('metas_uma_emergencia')
        ? 'Você já tem uma reserva de emergência. Só pode haver uma.'
        : 'Já existe um registro igual.';
    case '23514':
      return 'Algum valor está fora do permitido. Confira os campos.';
    case '23503':
      return 'Um item escolhido não foi encontrado.';
    case '42501':
      return 'Você não tem permissão para esta ação.';
    default:
      return 'Não foi possível salvar agora. Tente de novo em instantes.';
  }
}

function resultado(erro: { code?: string; message: string } | null): Resultado {
  return erro ? { ok: false, erro: mensagemDoBanco(erro) } : OK;
}

/** Encontra a conta pela chave do motor: `fixa:<recorrência>:<AAAA-MM>` ou `avulsa:<id>`. */
export function encontrarConta(dados: DadosFinanceiros, chave: string): Conta | null {
  let de: DataCivil;
  let ate: DataCivil;
  if (chave.startsWith('fixa:')) {
    const competencia = chave.split(':')[2] as Competencia | undefined;
    if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) return null;
    de = primeiroDiaDa(competencia);
    ate = ultimoDiaDa(competencia);
  } else if (chave.startsWith('avulsa:')) {
    const avulsa = dados.contasAvulsas.find((c) => `avulsa:${c.id}` === chave);
    if (!avulsa) return null;
    de = ate = avulsa.vencimento;
  } else {
    return null;
  }
  return listarContas(dados, de, ate).find((conta) => conta.chave === chave) ?? null;
}

// ---------------------------------------------------------------------------------------------
// Pagamentos e recebimentos
// ---------------------------------------------------------------------------------------------

export async function pagarConta(
  supabase: ClienteSupabase,
  pedido: { chave: string; pagoEm: DataCivil; valorCentavos?: Centavos },
): Promise<Resultado> {
  const dados = await carregarDadosFinanceiros(supabase);
  const conta = encontrarConta(dados, pedido.chave);
  if (!conta) return { ok: false, erro: 'Conta não encontrada.' };
  if (conta.pagoEm !== null) return { ok: false, erro: 'Esta conta já está paga.' };
  if (
    conta.origem === 'avulsa' &&
    pedido.valorCentavos !== undefined &&
    pedido.valorCentavos !== conta.valorCentavos
  ) {
    return { ok: false, erro: 'Para pagar um valor diferente, edite a conta antes de pagar.' };
  }

  const contaPaga =
    pedido.valorCentavos === undefined ? conta : { ...conta, valorCentavos: pedido.valorCentavos };
  const plano = planoDePagamento(dados, contaPaga, pedido.pagoEm);

  const { error } = await supabase.rpc('registrar_pagamento', {
    p_pago_em: pedido.pagoEm,
    p_valor_centavos: plano.valorCentavos,
    p_saque_centavos: plano.saqueCentavos,
    ...(plano.tipoDoLancamento ? { p_tipo_lancamento: plano.tipoDoLancamento } : {}),
    ...(conta.origem === 'fixa'
      ? { p_recorrencia_id: conta.recorrenciaId!, p_competencia: conta.competencia! }
      : { p_conta_avulsa_id: conta.contaAvulsaId! }),
  });
  return resultado(error);
}

export async function desfazerPagamento(
  supabase: ClienteSupabase,
  chave: string,
): Promise<Resultado> {
  const dados = await carregarDadosFinanceiros(supabase);
  const conta = encontrarConta(dados, chave);
  if (!conta || conta.pagoEm === null) return { ok: false, erro: 'Esta conta não está paga.' };

  const { error } = await supabase.rpc(
    'desfazer_pagamento',
    conta.origem === 'fixa'
      ? { p_ocorrencia_id: conta.ocorrenciaId! }
      : { p_conta_avulsa_id: conta.contaAvulsaId! },
  );
  return resultado(error);
}

export async function confirmarRecebimento(
  supabase: ClienteSupabase,
  pedido: {
    recorrenciaId: string;
    competencia: Competencia;
    valorCentavos: Centavos;
    recebidoEm: DataCivil;
  },
): Promise<Resultado> {
  const { error } = await supabase.rpc('confirmar_recebimento', {
    p_recorrencia_id: pedido.recorrenciaId,
    p_competencia: pedido.competencia,
    p_valor_centavos: pedido.valorCentavos,
    p_recebido_em: pedido.recebidoEm,
  });
  return resultado(error);
}

export async function desfazerRecebimento(
  supabase: ClienteSupabase,
  ocorrenciaId: string,
): Promise<Resultado> {
  const { error } = await supabase.rpc('desfazer_recebimento', { p_ocorrencia_id: ocorrenciaId });
  return resultado(error);
}

// ---------------------------------------------------------------------------------------------
// Reserva de contas e metas: aportes e correções de saldo
// ---------------------------------------------------------------------------------------------

export async function registrarAporte(
  supabase: ClienteSupabase,
  pedido: { valorCentavos: Centavos; data: DataCivil; metaId?: string },
): Promise<Resultado> {
  if (!Number.isSafeInteger(pedido.valorCentavos) || pedido.valorCentavos <= 0) {
    return { ok: false, erro: 'O aporte precisa ser maior que zero.' };
  }
  const { error } = await supabase.from('movimentos_reserva').insert({
    data: pedido.data,
    tipo: 'aporte',
    destino: pedido.metaId ? 'meta' : 'contas',
    meta_id: pedido.metaId ?? null,
    valor_centavos: pedido.valorCentavos,
  });
  return resultado(error);
}

/**
 * Registra a reserva da semana: um aporte para a reserva de contas e um para cada meta, em uma
 * única inserção (o banco grava todos ou nenhum). Valores zerados ficam de fora.
 */
export async function registrarReservaDaSemana(
  supabase: ClienteSupabase,
  pedido: {
    data: DataCivil;
    contasCentavos: Centavos;
    metas: { metaId: string; valorCentavos: Centavos }[];
  },
): Promise<Resultado> {
  const valores = [pedido.contasCentavos, ...pedido.metas.map((m) => m.valorCentavos)];
  if (valores.some((v) => !Number.isSafeInteger(v) || v < 0)) {
    return { ok: false, erro: 'Os valores precisam ser zero ou mais.' };
  }
  const linhas = [
    ...(pedido.contasCentavos > 0
      ? [{ destino: 'contas', meta_id: null, valor_centavos: pedido.contasCentavos }]
      : []),
    ...pedido.metas
      .filter((m) => m.valorCentavos > 0)
      .map((m) => ({ destino: 'meta', meta_id: m.metaId, valor_centavos: m.valorCentavos })),
  ].map((linha) => ({ ...linha, data: pedido.data, tipo: 'aporte' }));
  if (linhas.length === 0) return { ok: false, erro: 'Informe ao menos um valor para guardar.' };

  const { error } = await supabase.from('movimentos_reserva').insert(linhas);
  return resultado(error);
}

/** Define o teto de gastos variáveis do perfil, ou o remove com null. */
export async function definirTeto(
  supabase: ClienteSupabase,
  tetoCentavos: Centavos | null,
): Promise<Resultado> {
  if (tetoCentavos !== null && (!Number.isSafeInteger(tetoCentavos) || tetoCentavos < 0)) {
    return { ok: false, erro: 'O teto precisa ser zero ou mais.' };
  }
  const { data: sessao } = await supabase.auth.getClaims();
  const usuarioId = sessao?.claims?.sub;
  if (typeof usuarioId !== 'string') return { ok: false, erro: 'Entre de novo para continuar.' };

  const { error } = await supabase
    .from('perfis')
    .update({ teto_variavel_centavos: tetoCentavos })
    .eq('usuario_id', usuarioId);
  return resultado(error);
}

/** Corrige o saldo com um movimento de ajuste: saldos nunca são editados direto. */
export async function corrigirSaldo(
  supabase: ClienteSupabase,
  pedido: { saldoCorretoCentavos: Centavos; data: DataCivil; metaId?: string },
): Promise<Resultado> {
  const dados = await carregarDadosFinanceiros(supabase);
  const destino = pedido.metaId
    ? ({ destino: 'meta', metaId: pedido.metaId } as const)
    : ({ destino: 'contas' } as const);
  const ajuste = valorDoAjuste(
    saldoEm(dados.movimentos, destino, pedido.data),
    pedido.saldoCorretoCentavos,
  );
  if (ajuste === 0) return OK;

  const { error } = await supabase.from('movimentos_reserva').insert({
    data: pedido.data,
    tipo: 'ajuste',
    destino: destino.destino,
    meta_id: pedido.metaId ?? null,
    valor_centavos: ajuste,
  });
  return resultado(error);
}

// ---------------------------------------------------------------------------------------------
// Rendas e despesas fixas
// ---------------------------------------------------------------------------------------------

export interface DadosDaRecorrencia {
  tipo: 'renda' | 'fixa';
  nome: string;
  valorCentavos: Centavos;
  dia: number;
  inicio: DataCivil;
  categoriaId: string | null;
  rendaVariavel: boolean;
  pagaNoCartao: boolean;
}

function linhaDaRecorrencia(r: DadosDaRecorrencia) {
  return {
    tipo: r.tipo,
    nome: r.nome,
    valor_centavos: r.valorCentavos,
    dia: r.dia,
    inicio: r.inicio,
    categoria_id: r.categoriaId,
    renda_variavel: r.tipo === 'renda' && r.rendaVariavel,
    paga_no_cartao: r.tipo === 'fixa' && r.pagaNoCartao,
  };
}

export async function criarRecorrencia(
  supabase: ClienteSupabase,
  recorrencia: DadosDaRecorrencia,
): Promise<Resultado & { id?: string }> {
  const { data, error } = await supabase
    .from('recorrencias')
    .insert(linhaDaRecorrencia(recorrencia))
    .select('id')
    .single();
  return error ? resultado(error) : { ok: true, id: data.id };
}

export async function editarRecorrencia(
  supabase: ClienteSupabase,
  id: string,
  recorrencia: DadosDaRecorrencia,
): Promise<Resultado> {
  const { tipo: _tipo, ...semTipo } = linhaDaRecorrencia(recorrencia);
  const { data, error } = await supabase
    .from('recorrencias')
    .update(semTipo)
    .eq('id', id)
    .select('id');
  if (error) return resultado(error);
  return data.length === 1 ? OK : { ok: false, erro: 'Cadastro não encontrado.' };
}

/** Encerra a recorrência a partir de hoje, mantendo o histórico de pagamentos. */
export async function encerrarRecorrencia(
  supabase: ClienteSupabase,
  id: string,
  hoje: DataCivil,
): Promise<Resultado> {
  const atual = await supabase.from('recorrencias').select('inicio').eq('id', id).single();
  if (atual.error) return { ok: false, erro: 'Cadastro não encontrado.' };
  const { error } = await supabase
    .from('recorrencias')
    .update({ ativa: false, fim: maiorData(hoje, atual.data.inicio) })
    .eq('id', id);
  return resultado(error);
}

export async function reativarRecorrencia(
  supabase: ClienteSupabase,
  id: string,
): Promise<Resultado> {
  const { error } = await supabase
    .from('recorrencias')
    .update({ ativa: true, fim: null })
    .eq('id', id);
  return resultado(error);
}

/** Exclui só a recorrência sem pagamentos nem recebimentos; com histórico, ela é encerrada. */
export async function excluirRecorrencia(
  supabase: ClienteSupabase,
  id: string,
): Promise<Resultado> {
  const historico = await supabase
    .from('ocorrencias')
    .select('id', { count: 'exact', head: true })
    .eq('recorrencia_id', id)
    .neq('status', 'pendente');
  if (historico.error) return resultado(historico.error);
  if ((historico.count ?? 0) > 0) {
    return {
      ok: false,
      erro: 'Este cadastro já tem pagamentos ou recebimentos. Encerre-o para manter o histórico.',
    };
  }
  const { data, error } = await supabase.from('recorrencias').delete().eq('id', id).select('id');
  if (error) return resultado(error);
  return data.length === 1 ? OK : { ok: false, erro: 'Cadastro não encontrado.' };
}

// ---------------------------------------------------------------------------------------------
// Contas avulsas
// ---------------------------------------------------------------------------------------------

export interface DadosDaContaAvulsa {
  nome: string;
  valorCentavos: Centavos;
  vencimento: DataCivil;
  categoriaId: string | null;
  quitaItens: boolean;
}

function linhaDaContaAvulsa(c: DadosDaContaAvulsa) {
  return {
    nome: c.nome,
    valor_centavos: c.valorCentavos,
    vencimento: c.vencimento,
    categoria_id: c.categoriaId,
    quita_itens: c.quitaItens,
  };
}

export async function criarContaAvulsa(
  supabase: ClienteSupabase,
  conta: DadosDaContaAvulsa,
): Promise<Resultado & { id?: string }> {
  const { data, error } = await supabase
    .from('contas_avulsas')
    .insert(linhaDaContaAvulsa(conta))
    .select('id')
    .single();
  return error ? resultado(error) : { ok: true, id: data.id };
}

const CONTA_PAGA = 'Esta conta já está paga. Desfaça o pagamento para alterá-la ou excluí-la.';

export async function editarContaAvulsa(
  supabase: ClienteSupabase,
  id: string,
  conta: DadosDaContaAvulsa,
): Promise<Resultado> {
  const { data, error } = await supabase
    .from('contas_avulsas')
    .update(linhaDaContaAvulsa(conta))
    .eq('id', id)
    .is('pago_em', null)
    .select('id');
  if (error) return resultado(error);
  return data.length === 1 ? OK : { ok: false, erro: CONTA_PAGA };
}

export async function excluirContaAvulsa(
  supabase: ClienteSupabase,
  id: string,
): Promise<Resultado> {
  const { data, error } = await supabase
    .from('contas_avulsas')
    .delete()
    .eq('id', id)
    .is('pago_em', null)
    .select('id');
  if (error) return resultado(error);
  return data.length === 1 ? OK : { ok: false, erro: CONTA_PAGA };
}

// ---------------------------------------------------------------------------------------------
// Lançamentos manuais
// ---------------------------------------------------------------------------------------------

export interface DadosDoLancamento {
  data: DataCivil;
  descricao: string;
  valorCentavos: Centavos;
  tipo: 'despesa' | 'receita' | 'transferencia';
  categoriaId: string | null;
}

/** Lançamentos gerados por pagamento ou recebimento só mudam desfazendo a operação na conta. */
const ORIGENS_EDITAVEIS = ['manual', 'documento'];
const LANCAMENTO_DE_CONTA =
  'Este lançamento veio de um pagamento ou recebimento. Desfaça-o na tela de Contas.';

function linhaDoLancamento(l: DadosDoLancamento) {
  return {
    data: l.data,
    descricao: l.descricao,
    valor_centavos: l.valorCentavos,
    tipo: l.tipo,
    categoria_id: l.categoriaId,
  };
}

export async function criarLancamento(
  supabase: ClienteSupabase,
  lancamento: DadosDoLancamento,
): Promise<Resultado & { id?: string }> {
  const { data, error } = await supabase
    .from('lancamentos')
    .insert({ ...linhaDoLancamento(lancamento), origem: 'manual' })
    .select('id')
    .single();
  return error ? resultado(error) : { ok: true, id: data.id };
}

export async function editarLancamento(
  supabase: ClienteSupabase,
  id: string,
  lancamento: DadosDoLancamento,
): Promise<Resultado> {
  const { data, error } = await supabase
    .from('lancamentos')
    .update(linhaDoLancamento(lancamento))
    .eq('id', id)
    .in('origem', ORIGENS_EDITAVEIS)
    .select('id');
  if (error) return resultado(error);
  return data.length === 1 ? OK : { ok: false, erro: LANCAMENTO_DE_CONTA };
}

export async function excluirLancamento(supabase: ClienteSupabase, id: string): Promise<Resultado> {
  const { data, error } = await supabase
    .from('lancamentos')
    .delete()
    .eq('id', id)
    .in('origem', ORIGENS_EDITAVEIS)
    .select('id');
  if (error) return resultado(error);
  return data.length === 1 ? OK : { ok: false, erro: LANCAMENTO_DE_CONTA };
}

// ---------------------------------------------------------------------------------------------
// Metas
// ---------------------------------------------------------------------------------------------

export interface DadosDaMeta {
  nome: string;
  alvoCentavos: Centavos;
  prazo: DataCivil;
  prioridade: number;
  emergencia: boolean;
}

function linhaDaMeta(m: DadosDaMeta) {
  return {
    nome: m.nome,
    alvo_centavos: m.alvoCentavos,
    prazo: m.prazo,
    prioridade: m.prioridade,
    tipo: m.emergencia ? 'emergencia' : 'comum',
  };
}

export async function criarMeta(
  supabase: ClienteSupabase,
  meta: DadosDaMeta,
): Promise<Resultado & { id?: string }> {
  const { data, error } = await supabase
    .from('metas')
    .insert(linhaDaMeta(meta))
    .select('id')
    .single();
  return error ? resultado(error) : { ok: true, id: data.id };
}

export async function editarMeta(
  supabase: ClienteSupabase,
  id: string,
  meta: DadosDaMeta,
): Promise<Resultado> {
  const { data, error } = await supabase
    .from('metas')
    .update(linhaDaMeta(meta))
    .eq('id', id)
    .select('id');
  if (error) return resultado(error);
  return data.length === 1 ? OK : { ok: false, erro: 'Meta não encontrada.' };
}

export async function concluirMeta(
  supabase: ClienteSupabase,
  id: string,
  concluida: boolean,
): Promise<Resultado> {
  const { error } = await supabase
    .from('metas')
    .update({ concluida_em: concluida ? new Date().toISOString() : null })
    .eq('id', id);
  return resultado(error);
}

/** Exclui a meta e os aportes registrados nela, na mesma transação. */
export async function excluirMeta(supabase: ClienteSupabase, id: string): Promise<Resultado> {
  const { error } = await supabase.rpc('excluir_meta', { p_meta_id: id });
  return resultado(error);
}
