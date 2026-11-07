'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { Revisao, TipoDeDocumento } from '@no-azul/documentos';
import {
  aprovarDocumento,
  concluirEnvio,
  definirGuardarOriginal,
  descartarDocumento,
  iniciarEnvio,
  lerDeNovo,
  type DadosDoEnvio,
  type ResultadoDoEnvio,
} from '@/lib/documentos/operacoes';
import type { EstadoFormulario } from '@/lib/estado-formulario';
import { comAvisoDaReserva } from '@/lib/financeiro/aviso-no-servidor';
import type { Resultado } from '@/lib/financeiro/operacoes';
import { ErroDeValidacao, lerReais } from '@/lib/formatacao';
import { marcado, texto } from '@/lib/formularios';
import { criarClienteServidor } from '@/lib/supabase/servidor';

const TELAS = ['/documentos', '/lancamentos', '/contas', '/painel', '/planejamento'];
const TIPOS = ['comprovante', 'boleto', 'fatura_cartao', 'extrato', 'contracheque'] as const;

function atualizarTelas() {
  for (const tela of TELAS) revalidatePath(tela);
}

export async function iniciarEnvioAcao(dados: DadosDoEnvio): Promise<ResultadoDoEnvio> {
  const supabase = await criarClienteServidor();
  const tipo = TIPOS.includes(dados.tipoInformado as TipoDeDocumento) ? dados.tipoInformado : null;
  return iniciarEnvio(supabase, {
    nome: String(dados.nome ?? ''),
    tamanho: Number(dados.tamanho),
    hash: String(dados.hash ?? ''),
    tipoInformado: tipo,
    reenviar: dados.reenviar === true,
  });
}

export async function concluirEnvioAcao(documentoId: string): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const resultado = await concluirEnvio(supabase, String(documentoId));
  if (resultado.ok) revalidatePath('/documentos');
  return resultado;
}

export async function lerDeNovoAcao(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  const supabase = await criarClienteServidor();
  const id = texto(f, 'documentoId');
  const tipo = texto(f, 'tipo');
  if (tipo && TIPOS.includes(tipo as TipoDeDocumento)) {
    await supabase.from('documentos').update({ tipo_informado: tipo }).eq('id', id);
  }
  const resultado = await lerDeNovo(supabase, id);
  if (!resultado.ok) return { erro: resultado.erro };
  revalidatePath(`/documentos/${id}`);
  revalidatePath('/documentos');
  return { ok: true, mensagem: 'Lendo o documento de novo.' };
}

export async function descartarAcao(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  const supabase = await criarClienteServidor();
  const resultado = await descartarDocumento(supabase, texto(f, 'documentoId'));
  if (!resultado.ok) return { erro: resultado.erro };
  revalidatePath('/documentos');
  redirect('/documentos?descartado=1');
}

export async function guardarOriginalAcao(
  _: EstadoFormulario,
  f: FormData,
): Promise<EstadoFormulario> {
  const supabase = await criarClienteServidor();
  const resultado = await definirGuardarOriginal(supabase, marcado(f, 'guardar'));
  if (!resultado.ok) return { erro: resultado.erro };
  revalidatePath('/documentos');
  return { ok: true, mensagem: 'Preferência salva.' };
}

// ------------------------------------------------------------------------------------------
// Aprovação: a tela manda as escolhas em JSON; o servidor confere tudo de novo
// ------------------------------------------------------------------------------------------

const dataCivil = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe as datas.');
const id = z.string().uuid();

const contaSugerida = z.object({
  chave: z.string().max(200),
  origem: z.enum(['fixa', 'avulsa']),
  nome: z.string().max(200),
  valorCentavos: z.number().int(),
  vencimento: dataCivil,
  pagoEm: dataCivil.nullable(),
  recorrenciaId: id.nullable(),
  competencia: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .nullable(),
  contaAvulsaId: id.nullable(),
});

const acaoDaLinha = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('lancar') }),
  z.object({ tipo: z.literal('ignorar'), motivo: z.string().max(500) }),
  z.object({ tipo: z.literal('quitar'), conta: contaSugerida }),
  z.object({ tipo: z.literal('vincular_fixa'), conta: contaSugerida }),
  z.object({
    tipo: z.literal('receber'),
    renda: z.object({
      recorrenciaId: id,
      competencia: z.string().regex(/^\d{4}-\d{2}$/),
      nome: z.string().max(200),
      valorPrevistoCentavos: z.number().int(),
      dataPrevista: dataCivil,
    }),
  }),
]);

const acaoDaConta = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('criar') }),
  z.object({ tipo: z.literal('prever_fixa'), conta: contaSugerida }),
  z.object({ tipo: z.literal('atualizar_avulsa'), conta: contaSugerida }),
  z.object({ tipo: z.literal('nao_gravar'), motivo: z.string().max(500) }),
]);

const esquemaDaRevisao = z.object({
  conta: z
    .object({
      acao: acaoDaConta,
      nome: z.string().max(120),
      valor: z.string().max(30),
      vencimento: z.string().max(10),
      categoriaId: id.nullable(),
    })
    .nullable(),
  linhas: z
    .array(
      z.object({
        acao: acaoDaLinha,
        data: z.string().max(10),
        descricao: z.string().max(255),
        valor: z.string().max(30),
        tipo: z.enum(['despesa', 'receita', 'transferencia']),
        categoriaId: id.nullable(),
      }),
    )
    .max(2000),
});

export type RevisaoEnviada = z.infer<typeof esquemaDaRevisao>;

function lerRevisao(json: string): Omit<Revisao, 'tipoDoDocumento'> {
  let bruto: unknown;
  try {
    bruto = JSON.parse(json);
  } catch {
    throw new ErroDeValidacao('Não consegui ler a revisão. Recarregue a página.');
  }
  const lida = esquemaDaRevisao.safeParse(bruto);
  if (!lida.success)
    throw new ErroDeValidacao(
      'Algum campo da revisão está inválido. Confira as datas e os valores.',
    );
  const { conta, linhas } = lida.data;
  const data = (valor: string, rotulo: string) => {
    if (!dataCivil.safeParse(valor).success) throw new ErroDeValidacao(`Informe ${rotulo}.`);
    return valor;
  };
  return {
    conta:
      conta && conta.acao.tipo !== 'nao_gravar'
        ? {
            acao: conta.acao,
            nome: conta.nome,
            valorCentavos: lerReais(conta.valor, 'valor da conta'),
            vencimento: data(conta.vencimento, 'o vencimento da conta'),
            categoriaId: conta.categoriaId,
          }
        : null,
    linhas: linhas
      .filter((l) => l.acao.tipo !== 'ignorar')
      .map((l) => ({
        acao: l.acao,
        data: data(l.data, `a data de "${l.descricao}"`),
        descricao: l.descricao,
        valorCentavos: lerReais(l.valor, `valor de "${l.descricao}"`),
        tipo: l.tipo,
        categoriaId: l.categoriaId,
      })),
  };
}

export async function aprovarAcao(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  const supabase = await criarClienteServidor();
  const documentoId = texto(f, 'documentoId');
  let resultado: Resultado;
  try {
    const revisao = lerRevisao(texto(f, 'revisao'));
    resultado = await comAvisoDaReserva(supabase, () =>
      aprovarDocumento(supabase, documentoId, revisao),
    );
  } catch (erro) {
    if (erro instanceof ErroDeValidacao) return { erro: erro.message };
    throw erro;
  }
  if (!resultado.ok) return { erro: resultado.erro };
  atualizarTelas();
  redirect('/documentos?aprovado=1');
}
