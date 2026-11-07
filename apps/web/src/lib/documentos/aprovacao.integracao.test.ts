import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  gastoVariavelNoMes,
  listarContas,
  orcamentoDoMes,
  resumoDaSemana,
  type DadosFinanceiros,
} from '@no-azul/motor';
import { cruzar, type Extracao, type LancamentoExtraido, type Revisao } from '@no-azul/documentos';
import { lerAmbiente } from '../../../../../supabase/testes/ambiente';
import {
  criarUsuario,
  excluirUsuario,
  type UsuarioDeTeste,
} from '../../../../../supabase/testes/apoio';
import { carregarDadosFinanceiros, type ClienteSupabase } from '../financeiro/carregar';
import { pagarConta } from '../financeiro/operacoes';
import type { Json } from '../supabase/tipos-banco';
import { aprovarDocumento } from './aprovacao';

/**
 * Aprovação de documentos gravando no Supabase local: tudo ou nada, nada entra nos cálculos antes
 * de aprovar, e a fatura com itens importados não conta o mesmo gasto duas vezes.
 */
const ambiente = lerAmbiente();
const HOJE = '2026-11-07';

let pessoa: UsuarioDeTeste;
let db: ClienteSupabase;

beforeAll(async () => {
  pessoa = await criarUsuario(ambiente, 'Documentos');
  db = pessoa.cliente as unknown as ClienteSupabase;
});

afterAll(async () => {
  await excluirUsuario(ambiente, pessoa.id);
});

function item(
  data: string,
  descricao: string,
  valor: number,
  extra: Partial<LancamentoExtraido> = {},
): LancamentoExtraido {
  return {
    data,
    descricao,
    valorCentavos: valor,
    tipo: 'despesa',
    categoria: null,
    confianca: { data: 1, valor: 1 },
    natureza: null,
    parcela: null,
    marcado: true,
    avisos: [],
    ...extra,
  };
}

function extracao(
  tipo: Extracao['tipo'],
  lancamentos: LancamentoExtraido[],
  conta: Extracao['conta'] = null,
): Extracao {
  return {
    versao: 1,
    leitor: 'leitura-local@1',
    formato: 'pdf',
    origem: 'texto',
    tipo,
    tipoInformado: false,
    emissor: 'Banco Aurora',
    competencia: null,
    conta,
    lancamentos,
    avisos: [],
  };
}

/**
 * O que os meses gastam no orçamento (3.2): contas avulsas que entram nele e gastos variáveis.
 * A fatura com itens importados sai das avulsas e os itens entram como variáveis: conta uma vez.
 */
function gastoNoOrcamento(dados: DadosFinanceiros, competencias: string[]): number {
  return competencias.reduce((total, competencia) => {
    const mes = orcamentoDoMes(dados, competencia);
    return total + mes.contasAvulsasCentavos + mes.gastoVariavelCentavos;
  }, 0);
}

let contador = 0;

/** Documento já lido, esperando revisão, como a leitura deixa. */
async function documentoEmRevisao(lido: Extracao): Promise<string> {
  contador += 1;
  const { data, error } = await db
    .from('documentos')
    .insert({
      nome: `doc-${contador}.pdf`,
      hash: contador.toString(16).padStart(64, '0'),
      status: 'em_revisao',
      tipo: lido.tipo,
      extracao_json: lido as unknown as Json,
      modelo_usado: lido.leitor,
    })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('documento não criado');
  return data.id;
}

/** A revisão que a tela manda quando a pessoa aceita tudo o que foi proposto. */
async function aceitarTudo(
  documentoId: string,
  lido: Extracao,
): Promise<Omit<Revisao, 'tipoDoDocumento'>> {
  const cruzamento = cruzar(lido, await carregarDadosFinanceiros(db), HOJE);
  return {
    conta:
      lido.conta && cruzamento.conta && cruzamento.conta.acao.tipo !== 'nao_gravar'
        ? {
            acao: cruzamento.conta.acao,
            nome: lido.conta.nome,
            valorCentavos: lido.conta.valorCentavos!,
            vencimento: lido.conta.vencimento!,
            categoriaId: null,
          }
        : null,
    linhas: lido.lancamentos
      .map((l, i) => ({ l, acao: cruzamento.linhas[i]!.acao }))
      .filter(({ acao }) => acao.tipo !== 'ignorar')
      .map(({ l, acao }) => ({
        acao,
        data: l.data!,
        descricao: l.descricao,
        valorCentavos: l.valorCentavos!,
        tipo: l.tipo,
        categoriaId: null,
      })),
  };
  void documentoId;
}

const fatura = (valor: number, vencimento = '2026-11-20') => ({
  nome: 'Fatura Banco Aurora',
  valorCentavos: valor,
  vencimento,
  categoria: null,
  confianca: { valor: 1, vencimento: 1 },
  fechamento: '2026-11-10',
});

describe('aprovar documento', () => {
  it('nada entra nos cálculos enquanto o documento está em revisão', async () => {
    const antes = await carregarDadosFinanceiros(db);
    const id = await documentoEmRevisao(
      extracao('extrato', [
        item('2026-11-03', 'MERCADO', 12345),
        item('2026-11-04', 'SALARIO', 500000, { tipo: 'receita' }),
      ]),
    );
    const durante = await carregarDadosFinanceiros(db);
    expect(durante).toEqual(antes);
    expect(resumoDaSemana(durante, HOJE)).toEqual(resumoDaSemana(antes, HOJE));
    const { data } = await db.from('documentos').select('status').eq('id', id).single();
    expect(data?.status).toBe('em_revisao');
  });

  it('grava tudo ou nada: um pagamento inválido desfaz os lançamentos do mesmo documento', async () => {
    const lido = extracao('extrato', [item('2026-11-02', 'PADARIA', 1500)]);
    const id = await documentoEmRevisao(lido);
    const antes = await carregarDadosFinanceiros(db);
    const { error } = await db.rpc('aprovar_documento', {
      p_documento_id: id,
      p_conta: null,
      p_pagamentos: [
        {
          pago_em: '2026-11-02',
          valor_centavos: 100,
          saque_centavos: 0,
          tipo_lancamento: 'despesa',
          conta_avulsa_id: '00000000-0000-0000-0000-000000000000',
        },
      ] as unknown as Json,
      p_recebimentos: [],
      p_lancamentos: [
        {
          data: '2026-11-02',
          descricao: 'PADARIA',
          valor_centavos: 1500,
          tipo: 'despesa',
          categoria_id: null,
        },
      ] as unknown as Json,
      p_manter_arquivo: false,
    });
    expect(error?.code).toBe('P0002');
    expect(await carregarDadosFinanceiros(db)).toEqual(antes);
    const { data } = await db.from('documentos').select('status').eq('id', id).single();
    expect(data?.status).toBe('em_revisao');
  });

  it('não aprova duas vezes', async () => {
    const lido = extracao('comprovante', [item('2026-11-05', 'FARMACIA VIDA', 4735)]);
    const id = await documentoEmRevisao(lido);
    expect(await aprovarDocumento(db, id, await aceitarTudo(id, lido))).toEqual({ ok: true });
    expect(await aprovarDocumento(db, id, await aceitarTudo(id, lido))).toEqual({
      ok: false,
      erro: 'Este documento não está em revisão.',
    });
    const { data } = await db
      .from('lancamentos')
      .select('descricao, origem')
      .eq('documento_id', id);
    expect(data).toEqual([{ descricao: 'FARMACIA VIDA', origem: 'documento' }]);
  });

  it('fatura com itens e depois o extrato com o pagamento: o gasto conta uma vez só (aceite)', async () => {
    const gasto = async () =>
      gastoNoOrcamento(await carregarDadosFinanceiros(db), ['2026-10', '2026-11']);
    const antes = await gasto();
    const lidaFatura = extracao(
      'fatura_cartao',
      [
        item('2026-10-20', 'PAGAMENTO RECEBIDO', 90000, {
          tipo: 'transferencia',
          natureza: 'pagamento_de_fatura',
          marcado: false,
        }),
        item('2026-10-11', 'SUPERMERCADO', 20000),
        item('2026-10-15', 'POSTO', 12000),
      ],
      fatura(32000),
    );
    const idFatura = await documentoEmRevisao(lidaFatura);
    expect(await aprovarDocumento(db, idFatura, await aceitarTudo(idFatura, lidaFatura))).toEqual({
      ok: true,
    });
    expect(await gasto()).toBe(antes + 32000);

    const lidoExtrato = extracao('extrato', [item('2026-11-19', 'PAGAMENTO FATURA CARTAO', 32000)]);
    const idExtrato = await documentoEmRevisao(lidoExtrato);
    const revisao = await aceitarTudo(idExtrato, lidoExtrato);
    expect(revisao.linhas[0]?.acao.tipo).toBe('quitar');
    expect(await aprovarDocumento(db, idExtrato, revisao)).toEqual({ ok: true });

    const { data: conta } = await db
      .from('contas_avulsas')
      .select('pago_em, quita_itens, lancamento_id')
      .eq('documento_id', idFatura)
      .single();
    expect(conta).toMatchObject({ pago_em: '2026-11-19', quita_itens: true });
    const { data: pagamento } = await db
      .from('lancamentos')
      .select('tipo')
      .eq('id', conta!.lancamento_id!)
      .single();
    expect(pagamento?.tipo).toBe('transferencia');
    expect(await gasto()).toBe(antes + 32000);
  });

  it('fatura já cadastrada e já paga: o pagamento vira transferência ao importar os itens (aceite)', async () => {
    const { data: criada } = await db
      .from('contas_avulsas')
      .insert({ nome: 'Fatura Banco Aurora', valor_centavos: 25000, vencimento: '2026-12-10' })
      .select('id')
      .single();
    const dados = await carregarDadosFinanceiros(db);
    const contaGravada = listarContas(dados, '2026-12-01', '2026-12-31').find(
      (c) => c.contaAvulsaId === criada!.id,
    )!;
    expect(await pagarConta(db, { chave: contaGravada.chave, pagoEm: '2026-12-09' })).toEqual({
      ok: true,
    });

    const gasto = async () =>
      gastoNoOrcamento(await carregarDadosFinanceiros(db), ['2026-11', '2026-12']);
    const comAFaturaNasAvulsas = await gasto();

    const lida = extracao(
      'fatura_cartao',
      [item('2026-11-12', 'LIVRARIA', 15000), item('2026-11-20', 'RESTAURANTE', 10000)],
      fatura(25000, '2026-12-10'),
    );
    const id = await documentoEmRevisao(lida);
    const revisao = await aceitarTudo(id, lida);
    expect(revisao.conta?.acao.tipo).toBe('atualizar_avulsa');
    expect(await aprovarDocumento(db, id, revisao)).toEqual({ ok: true });

    // A fatura (R$ 250) sai das contas avulsas do orçamento e os itens (R$ 250) entram como
    // gastos variáveis: o total dos meses não dobra.
    expect(await gasto()).toBe(comAFaturaNasAvulsas);
    const { data: conta } = await db
      .from('contas_avulsas')
      .select('quita_itens, lancamento_id')
      .eq('id', criada!.id)
      .single();
    expect(conta?.quita_itens).toBe(true);
    const { data: pagamento } = await db
      .from('lancamentos')
      .select('tipo')
      .eq('id', conta!.lancamento_id!)
      .single();
    expect(pagamento?.tipo).toBe('transferencia');
  });

  it('boleto de fixa muda a previsão só daquele mês', async () => {
    const { data: luz } = await db
      .from('recorrencias')
      .insert({
        tipo: 'fixa',
        nome: 'Conta de luz',
        valor_centavos: 15000,
        dia: 18,
        inicio: '2026-01-01',
      })
      .select('id')
      .single();
    const lido = extracao('boleto', [], {
      ...fatura(18990, '2027-01-18'),
      nome: 'Conta de luz',
      fechamento: null,
    });
    const id = await documentoEmRevisao(lido);
    const revisao = await aceitarTudo(id, lido);
    expect(revisao.conta?.acao.tipo).toBe('prever_fixa');
    expect(await aprovarDocumento(db, id, revisao)).toEqual({ ok: true });

    const contas = listarContas(
      await carregarDadosFinanceiros(db),
      '2026-12-01',
      '2027-02-28',
    ).filter((c) => c.recorrenciaId === luz!.id);
    expect(contas.map((c) => [c.competencia, c.valorCentavos, c.pagoEm])).toEqual([
      ['2026-12', 15000, null],
      ['2027-01', 18990, null],
      ['2027-02', 15000, null],
    ]);
    const { data: avulsas } = await db.from('contas_avulsas').select('id').eq('documento_id', id);
    expect(avulsas).toEqual([]);
  });

  it('item de fixa paga no cartão marca a fixa e não vira gasto variável', async () => {
    const { data: streaming } = await db
      .from('recorrencias')
      .insert({
        tipo: 'fixa',
        nome: 'Streaming',
        valor_centavos: 3990,
        dia: 15,
        inicio: '2026-01-01',
        paga_no_cartao: true,
      })
      .select('id')
      .single();
    const antes = gastoVariavelNoMes(await carregarDadosFinanceiros(db), '2027-03');
    const lida = extracao(
      'fatura_cartao',
      [item('2027-03-14', 'STREAMING VIDEO', 3990)],
      fatura(3990, '2027-04-10'),
    );
    const id = await documentoEmRevisao(lida);
    const revisao = await aceitarTudo(id, lida);
    expect(revisao.linhas[0]?.acao.tipo).toBe('vincular_fixa');
    expect(await aprovarDocumento(db, id, revisao)).toEqual({ ok: true });

    const dados = await carregarDadosFinanceiros(db);
    expect(gastoVariavelNoMes(dados, '2027-03')).toBe(antes);
    const ocorrencia = dados.ocorrencias.find(
      (o) => o.recorrenciaId === streaming!.id && o.competencia === '2027-03',
    );
    expect(ocorrencia).toMatchObject({ status: 'paga', pagoEm: '2027-03-14' });
    const vinculado = dados.lancamentos.find((l) => l.ocorrenciaId === ocorrencia!.id);
    expect(vinculado).toMatchObject({ descricao: 'STREAMING VIDEO', origem: 'documento' });
  });
});
