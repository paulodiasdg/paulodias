import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listarContas, orcamentoDoMes, resumoDaSemana, saldoEm } from '@no-azul/motor';
import { lerAmbiente } from '../../../../../supabase/testes/ambiente';
import {
  criarUsuario,
  excluirUsuario,
  type UsuarioDeTeste,
} from '../../../../../supabase/testes/apoio';
import { carregarDadosFinanceiros, type ClienteSupabase } from './carregar';
import {
  concluirMeta,
  confirmarRecebimento,
  corrigirSaldo,
  criarContaAvulsa,
  criarLancamento,
  criarMeta,
  criarRecorrencia,
  desfazerPagamento,
  desfazerRecebimento,
  editarContaAvulsa,
  editarLancamento,
  encerrarRecorrencia,
  excluirContaAvulsa,
  excluirLancamento,
  excluirMeta,
  excluirRecorrencia,
  pagarConta,
  registrarAporte,
} from './operacoes';

/**
 * Aceite da Etapa 3: pagar e desfazer o pagamento devolve lançamentos e saldos ao estado anterior.
 * Roda contra o Supabase local (pnpm db:start), com um usuário de teste de verdade.
 */
const ambiente = lerAmbiente();
const HOJE = '2026-11-05';

let pessoa: UsuarioDeTeste;
let db: ClienteSupabase;
const ids: Record<string, string> = {};

function esperarOk(resultado: { ok: boolean; erro?: string }) {
  expect(resultado.ok ? 'ok' : resultado.erro).toBe('ok');
}

/** Tudo o que o pagamento toca, mais os números do painel calculados pelo motor. */
async function foto() {
  const dados = await carregarDadosFinanceiros(db);
  const resumo = resumoDaSemana(dados, HOJE);
  return {
    lancamentos: [...dados.lancamentos].sort((a, b) => a.id.localeCompare(b.id)),
    movimentos: [...dados.movimentos].sort((a, b) => a.id.localeCompare(b.id)),
    contasAbertas: listarContas(dados, null, '2026-12-31')
      .filter((c) => c.pagoEm === null)
      .map((c) => [c.chave, c.valorCentavos]),
    saldoDeContas: saldoEm(dados.movimentos, { destino: 'contas' }, HOJE),
    painel: {
      total: resumo.totalAReservarCentavos,
      contas: resumo.reservaDeContas.valorSemanalCentavos,
      limite: resumo.limite.limiteMensalCentavos,
      saude: resumo.saude?.total ?? null,
    },
  };
}

async function contaPorNome(nome: string) {
  const dados = await carregarDadosFinanceiros(db);
  const conta = listarContas(dados, null, '2026-12-31').find((c) => c.nome === nome);
  if (!conta) throw new Error(`Conta ${nome} não encontrada`);
  return conta;
}

beforeAll(async () => {
  pessoa = await criarUsuario(ambiente, 'Integracao');
  db = pessoa.cliente as unknown as ClienteSupabase;

  const salario = await criarRecorrencia(db, {
    tipo: 'renda',
    nome: 'Salário',
    valorCentavos: 770_000,
    dia: 5,
    inicio: '2026-11-01',
    categoriaId: null,
    rendaVariavel: false,
    pagaNoCartao: false,
  });
  ids.salario = salario.id!;
  ids.aluguel = (
    await criarRecorrencia(db, {
      tipo: 'fixa',
      nome: 'Aluguel',
      valorCentavos: 213_000,
      dia: 15,
      inicio: '2026-11-01',
      categoriaId: null,
      rendaVariavel: false,
      pagaNoCartao: false,
    })
  ).id!;
  ids.streaming = (
    await criarRecorrencia(db, {
      tipo: 'fixa',
      nome: 'Streaming',
      valorCentavos: 5_590,
      dia: 10,
      inicio: '2026-11-01',
      categoriaId: null,
      rendaVariavel: false,
      pagaNoCartao: true,
    })
  ).id!;
  ids.ipva = (
    await criarContaAvulsa(db, {
      nome: 'IPVA',
      valorCentavos: 38_000,
      vencimento: '2026-11-20',
      categoriaId: null,
      quitaItens: false,
    })
  ).id!;
  ids.fatura = (
    await criarContaAvulsa(db, {
      nome: 'Fatura do cartão',
      valorCentavos: 184_250,
      vencimento: '2026-11-25',
      categoriaId: null,
      quitaItens: true,
    })
  ).id!;
  esperarOk(await registrarAporte(db, { valorCentavos: 100_000, data: '2026-11-02' }));
});

afterAll(async () => {
  await excluirUsuario(ambiente, pessoa.id);
});

describe('pagar e desfazer devolve lançamentos e saldos ao estado anterior (aceite da Etapa 3)', () => {
  it.each(['Aluguel', 'IPVA', 'Fatura do cartão', 'Streaming'])('%s', async (nome) => {
    const antes = await foto();
    const conta = await contaPorNome(nome);

    esperarOk(await pagarConta(db, { chave: conta.chave, pagoEm: HOJE }));
    const pago = await foto();
    expect(pago.contasAbertas.map(([chave]) => chave)).not.toContain(conta.chave);

    esperarOk(await desfazerPagamento(db, conta.chave));
    expect(await foto()).toEqual(antes);
  });

  it('grava lançamento e saque conforme o motor', async () => {
    const aluguel = await contaPorNome('Aluguel');
    esperarOk(await pagarConta(db, { chave: aluguel.chave, pagoEm: HOJE }));
    const dados = await carregarDadosFinanceiros(db);
    const ocorrencia = dados.ocorrencias.find((o) => o.recorrenciaId === ids.aluguel)!;
    expect(ocorrencia).toMatchObject({ status: 'paga', pagoEm: HOJE, valorCentavos: 213_000 });
    expect(dados.lancamentos.filter((l) => l.origem === 'pagamento')).toEqual([
      expect.objectContaining({
        tipo: 'despesa',
        valorCentavos: 213_000,
        ocorrenciaId: ocorrencia.id,
      }),
    ]);
    // Só havia R$ 1.000 na reserva: sai R$ 1.000.
    expect(dados.movimentos.filter((m) => m.tipo === 'saque')).toEqual([
      expect.objectContaining({ valorCentavos: 100_000, ocorrenciaId: ocorrencia.id }),
    ]);
    esperarOk(await desfazerPagamento(db, aluguel.chave));
  });

  it('a fatura com itens importados vira transferência; a fixa no cartão não gera lançamento', async () => {
    const fatura = await contaPorNome('Fatura do cartão');
    const streaming = await contaPorNome('Streaming');
    esperarOk(await pagarConta(db, { chave: fatura.chave, pagoEm: HOJE }));
    esperarOk(await pagarConta(db, { chave: streaming.chave, pagoEm: HOJE }));
    const dados = await carregarDadosFinanceiros(db);
    expect(dados.lancamentos.filter((l) => l.origem === 'pagamento').map((l) => l.tipo)).toEqual([
      'transferencia',
    ]);
    expect(dados.ocorrencias.find((o) => o.recorrenciaId === ids.streaming)?.status).toBe('paga');
    esperarOk(await desfazerPagamento(db, fatura.chave));
    esperarOk(await desfazerPagamento(db, streaming.chave));
  });

  it('paga a fixa pelo valor informado e, ao desfazer, volta à previsão', async () => {
    const antes = await foto();
    const aluguel = await contaPorNome('Aluguel');
    esperarOk(await pagarConta(db, { chave: aluguel.chave, pagoEm: HOJE, valorCentavos: 220_000 }));
    const dados = await carregarDadosFinanceiros(db);
    expect(dados.ocorrencias.find((o) => o.recorrenciaId === ids.aluguel)?.valorCentavos).toBe(
      220_000,
    );
    expect(dados.lancamentos.find((l) => l.origem === 'pagamento')?.valorCentavos).toBe(220_000);
    esperarOk(await desfazerPagamento(db, aluguel.chave));
    expect(await foto()).toEqual(antes);
  });

  it('conta avulsa só é paga pelo valor cadastrado', async () => {
    const ipva = await contaPorNome('IPVA');
    expect(
      await pagarConta(db, { chave: ipva.chave, pagoEm: HOJE, valorCentavos: 40_000 }),
    ).toEqual({
      ok: false,
      erro: 'Para pagar um valor diferente, edite a conta antes de pagar.',
    });
    // A função do banco também recusa, mesmo chamada direto.
    const { error } = await db.rpc('registrar_pagamento', {
      p_pago_em: HOJE,
      p_valor_centavos: 40_000,
      p_saque_centavos: 0,
      p_tipo_lancamento: 'despesa',
      p_conta_avulsa_id: ids.ipva!,
    });
    expect(error?.message).toBe('Para pagar um valor diferente, edite a conta antes de pagar.');
  });

  it('recusa pagar duas vezes e desfazer o que não foi pago', async () => {
    const ipva = await contaPorNome('IPVA');
    esperarOk(await pagarConta(db, { chave: ipva.chave, pagoEm: HOJE }));
    expect(await pagarConta(db, { chave: ipva.chave, pagoEm: HOJE })).toEqual({
      ok: false,
      erro: 'Esta conta já está paga.',
    });
    esperarOk(await desfazerPagamento(db, ipva.chave));
    expect(await desfazerPagamento(db, ipva.chave)).toEqual({
      ok: false,
      erro: 'Esta conta não está paga.',
    });
    expect(await pagarConta(db, { chave: 'avulsa:nao-existe', pagoEm: HOJE })).toEqual({
      ok: false,
      erro: 'Conta não encontrada.',
    });
  });
});

describe('recebimento de renda', () => {
  it('confirmar e desfazer o recebimento devolve o estado anterior', async () => {
    const antes = await foto();
    esperarOk(
      await confirmarRecebimento(db, {
        recorrenciaId: ids.salario!,
        competencia: '2026-11',
        valorCentavos: 800_000,
        recebidoEm: HOJE,
      }),
    );
    const dados = await carregarDadosFinanceiros(db);
    const ocorrencia = dados.ocorrencias.find((o) => o.recorrenciaId === ids.salario)!;
    expect(ocorrencia).toMatchObject({ status: 'recebida', valorCentavos: 800_000 });
    expect(dados.lancamentos.filter((l) => l.origem === 'recebimento')).toEqual([
      expect.objectContaining({
        tipo: 'receita',
        valorCentavos: 800_000,
        ocorrenciaId: ocorrencia.id,
      }),
    ]);
    // A renda do mês passa a ser o valor recebido, sem contar o lançamento duas vezes.
    expect(orcamentoDoMes(dados, '2026-11').rendaCentavos).toBe(800_000);

    expect(
      await confirmarRecebimento(db, {
        recorrenciaId: ids.salario!,
        competencia: '2026-11',
        valorCentavos: 800_000,
        recebidoEm: HOJE,
      }),
    ).toEqual({ ok: false, erro: 'Este recebimento já foi confirmado.' });

    esperarOk(await desfazerRecebimento(db, ocorrencia.id));
    expect(await foto()).toEqual(antes);
    expect(orcamentoDoMes(await carregarDadosFinanceiros(db), '2026-11').rendaCentavos).toBe(
      770_000,
    );
  });
});

describe('reserva de contas', () => {
  it('corrige o saldo com um ajuste, sem editar saldo direto', async () => {
    esperarOk(await corrigirSaldo(db, { saldoCorretoCentavos: 150_000, data: HOJE }));
    const dados = await carregarDadosFinanceiros(db);
    expect(saldoEm(dados.movimentos, { destino: 'contas' }, HOJE)).toBe(150_000);
    expect(dados.movimentos.filter((m) => m.tipo === 'ajuste')).toEqual([
      expect.objectContaining({ valorCentavos: 50_000, destino: 'contas' }),
    ]);
    // Saldo já correto: nenhum movimento novo.
    esperarOk(await corrigirSaldo(db, { saldoCorretoCentavos: 150_000, data: HOJE }));
    expect((await carregarDadosFinanceiros(db)).movimentos).toHaveLength(dados.movimentos.length);
  });

  it('recusa aporte zero', async () => {
    expect(await registrarAporte(db, { valorCentavos: 0, data: HOJE })).toEqual({
      ok: false,
      erro: 'O aporte precisa ser maior que zero.',
    });
  });
});

describe('proteções do histórico', () => {
  it('recorrência com pagamento não é excluída, só encerrada', async () => {
    const aluguel = await contaPorNome('Aluguel');
    esperarOk(await pagarConta(db, { chave: aluguel.chave, pagoEm: HOJE }));
    const recusa = await excluirRecorrencia(db, ids.aluguel!);
    expect(recusa.ok).toBe(false);
    esperarOk(await encerrarRecorrencia(db, ids.aluguel!, HOJE));
    const dados = await carregarDadosFinanceiros(db);
    expect(dados.recorrencias.find((r) => r.id === ids.aluguel)).toMatchObject({
      ativa: false,
      fim: HOJE,
    });
    // O pagamento continua contando como despesa vinculada, não como gasto variável.
    expect(orcamentoDoMes(dados, '2026-11').gastoVariavelCentavos).toBe(0);
  });

  it('recorrência sem histórico é excluída', async () => {
    const nova = await criarRecorrencia(db, {
      tipo: 'fixa',
      nome: 'Academia',
      valorCentavos: 12_000,
      dia: 8,
      inicio: HOJE,
      categoriaId: null,
      rendaVariavel: false,
      pagaNoCartao: false,
    });
    esperarOk(await excluirRecorrencia(db, nova.id!));
  });

  it('conta avulsa paga não é editada nem excluída', async () => {
    const ipva = await contaPorNome('IPVA');
    esperarOk(await pagarConta(db, { chave: ipva.chave, pagoEm: HOJE }));
    const dadosDaConta = {
      nome: 'IPVA',
      valorCentavos: 1,
      vencimento: '2026-11-20',
      categoriaId: null,
      quitaItens: false,
    };
    expect((await editarContaAvulsa(db, ids.ipva!, dadosDaConta)).ok).toBe(false);
    expect((await excluirContaAvulsa(db, ids.ipva!)).ok).toBe(false);
    esperarOk(await desfazerPagamento(db, ipva.chave));
    esperarOk(await editarContaAvulsa(db, ids.ipva!, { ...dadosDaConta, valorCentavos: 39_000 }));
  });

  it('lançamento de pagamento só muda desfazendo o pagamento', async () => {
    const dados = await carregarDadosFinanceiros(db);
    const doPagamento = dados.lancamentos.find((l) => l.origem === 'pagamento')!;
    const alteracao = {
      data: HOJE,
      descricao: 'x',
      valorCentavos: 1,
      tipo: 'despesa' as const,
      categoriaId: null,
    };
    expect((await editarLancamento(db, doPagamento.id, alteracao)).ok).toBe(false);
    expect((await excluirLancamento(db, doPagamento.id)).ok).toBe(false);

    const manual = await criarLancamento(db, {
      ...alteracao,
      descricao: 'Mercado',
      valorCentavos: 28_790,
    });
    esperarOk(
      await editarLancamento(db, manual.id!, {
        ...alteracao,
        descricao: 'Mercado',
        valorCentavos: 30_000,
      }),
    );
    esperarOk(await excluirLancamento(db, manual.id!));
  });
});

describe('metas', () => {
  it('cria, recebe aporte, conclui e exclui com os aportes', async () => {
    const meta = await criarMeta(db, {
      nome: 'Reserva de emergência',
      alvoCentavos: 3_000_000,
      prazo: '2028-05-02',
      prioridade: 1,
      emergencia: true,
    });
    esperarOk(meta);
    expect(
      await criarMeta(db, {
        nome: 'Outra',
        alvoCentavos: 100,
        prazo: '2027-01-01',
        prioridade: 1,
        emergencia: true,
      }),
    ).toEqual({ ok: false, erro: 'Você já tem uma reserva de emergência. Só pode haver uma.' });

    esperarOk(await registrarAporte(db, { valorCentavos: 28_500, data: HOJE, metaId: meta.id! }));
    esperarOk(
      await corrigirSaldo(db, { saldoCorretoCentavos: 780_000, data: HOJE, metaId: meta.id! }),
    );
    let dados = await carregarDadosFinanceiros(db);
    expect(saldoEm(dados.movimentos, { destino: 'meta', metaId: meta.id! }, HOJE)).toBe(780_000);

    esperarOk(await concluirMeta(db, meta.id!, true));
    dados = await carregarDadosFinanceiros(db);
    expect(dados.metas.find((m) => m.id === meta.id)?.concluidaEm).not.toBeNull();

    esperarOk(await excluirMeta(db, meta.id!));
    dados = await carregarDadosFinanceiros(db);
    expect(dados.metas).toEqual([]);
    expect(dados.movimentos.filter((m) => m.metaId === meta.id)).toEqual([]);
  });
});
