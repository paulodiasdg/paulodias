import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resumoDaSemana } from '@no-azul/motor';
import { lerAmbiente } from '../../../../../supabase/testes/ambiente';
import {
  criarUsuario,
  excluirUsuario,
  type UsuarioDeTeste,
} from '../../../../../supabase/testes/apoio';
import { carregarDadosFinanceiros, type ClienteSupabase } from './carregar';
import { criarMeta, criarRecorrencia, definirTeto, registrarReservaDaSemana } from './operacoes';

/**
 * Etapa 4: registrar a reserva da semana pelo painel (todos os aportes ou nenhum) e o teto de
 * gastos da tela Planejamento. Roda contra o Supabase local, com usuários de teste de verdade.
 */
const ambiente = lerAmbiente();
const HOJE = '2026-11-04';

let pessoa: UsuarioDeTeste;
let outra: UsuarioDeTeste;
let db: ClienteSupabase;
let dbDaOutra: ClienteSupabase;
const metas: Record<string, string> = {};

function esperarOk(resultado: { ok: boolean; erro?: string }) {
  expect(resultado.ok ? 'ok' : resultado.erro).toBe('ok');
}

async function movimentos(cliente: ClienteSupabase) {
  return (await carregarDadosFinanceiros(cliente)).movimentos;
}

beforeAll(async () => {
  pessoa = await criarUsuario(ambiente, 'Painel');
  outra = await criarUsuario(ambiente, 'Outra');
  db = pessoa.cliente as unknown as ClienteSupabase;
  dbDaOutra = outra.cliente as unknown as ClienteSupabase;

  esperarOk(
    await criarRecorrencia(db, {
      tipo: 'renda',
      nome: 'Salário',
      valorCentavos: 770_000,
      dia: 5,
      inicio: '2026-11-01',
      categoriaId: null,
      rendaVariavel: false,
      pagaNoCartao: false,
    }),
  );
  esperarOk(
    await criarRecorrencia(db, {
      tipo: 'fixa',
      nome: 'Aluguel',
      valorCentavos: 213_000,
      dia: 15,
      inicio: '2026-11-01',
      categoriaId: null,
      rendaVariavel: false,
      pagaNoCartao: false,
    }),
  );
  for (const [chave, nome, prioridade] of [
    ['viagem', 'Viagem', 1],
    ['notebook', 'Notebook', 2],
  ] as const) {
    const meta = await criarMeta(db, {
      nome,
      alvoCentavos: 450_000,
      prazo: '2027-07-02',
      prioridade,
      emergencia: false,
    });
    esperarOk(meta);
    metas[chave] = meta.id!;
  }
  const daOutra = await criarMeta(dbDaOutra, {
    nome: 'Meta da outra pessoa',
    alvoCentavos: 100_000,
    prazo: '2027-07-02',
    prioridade: 1,
    emergencia: false,
  });
  esperarOk(daOutra);
  metas.daOutra = daOutra.id!;
});

afterAll(async () => {
  await excluirUsuario(ambiente, pessoa.id);
  await excluirUsuario(ambiente, outra.id);
});

describe('registrar a reserva da semana', () => {
  it('grava um aporte para contas e um para cada meta, sem mudar o valor pedido (D3)', async () => {
    const antes = resumoDaSemana(await carregarDadosFinanceiros(db), HOJE);
    const metaDe = (id: string) => antes.metas.metas.find((p) => p.meta.id === id)!;

    esperarOk(
      await registrarReservaDaSemana(db, {
        data: HOJE,
        contasCentavos: antes.reservaDeContas.faltaGuardarNaSemanaCentavos,
        metas: [
          {
            metaId: metas.viagem!,
            valorCentavos: metaDe(metas.viagem!).faltaGuardarNaSemanaCentavos,
          },
          {
            metaId: metas.notebook!,
            valorCentavos: metaDe(metas.notebook!).faltaGuardarNaSemanaCentavos,
          },
        ],
      }),
    );

    const lista = await movimentos(db);
    expect(lista.filter((m) => m.tipo === 'aporte')).toHaveLength(3);
    const depois = resumoDaSemana(await carregarDadosFinanceiros(db), HOJE);
    expect(depois.totalAReservarCentavos).toBe(antes.totalAReservarCentavos);
    expect(depois.faltaGuardarNaSemanaCentavos).toBe(0);
    expect(depois.guardadoNaSemanaCentavos).toBe(antes.totalAReservarCentavos);
  });

  it('grava todos os aportes ou nenhum', async () => {
    const antes = await movimentos(db);
    const resultado = await registrarReservaDaSemana(db, {
      data: HOJE,
      contasCentavos: 10_000,
      metas: [
        { metaId: metas.viagem!, valorCentavos: 5_000 },
        // A chave estrangeira composta recusa a meta de outra pessoa, e a inserção inteira falha.
        { metaId: metas.daOutra!, valorCentavos: 5_000 },
      ],
    });
    expect(resultado).toEqual({ ok: false, erro: 'Um item escolhido não foi encontrado.' });
    expect(await movimentos(db)).toEqual(antes);
    expect((await movimentos(dbDaOutra)).filter((m) => m.tipo === 'aporte')).toEqual([]);
  });

  it('deixa de fora os valores zerados e recusa quando todos são zero ou negativos', async () => {
    const antes = await movimentos(db);
    esperarOk(
      await registrarReservaDaSemana(db, {
        data: HOJE,
        contasCentavos: 0,
        metas: [
          { metaId: metas.viagem!, valorCentavos: 0 },
          { metaId: metas.notebook!, valorCentavos: 2_500 },
        ],
      }),
    );
    const novos = (await movimentos(db)).filter((m) => !antes.some((a) => a.id === m.id));
    expect(novos.map((m) => [m.destino, m.metaId, m.valorCentavos])).toEqual([
      ['meta', metas.notebook, 2_500],
    ]);

    expect(
      await registrarReservaDaSemana(db, { data: HOJE, contasCentavos: 0, metas: [] }),
    ).toEqual({ ok: false, erro: 'Informe ao menos um valor para guardar.' });
    expect(
      await registrarReservaDaSemana(db, { data: HOJE, contasCentavos: -100, metas: [] }),
    ).toEqual({ ok: false, erro: 'Os valores precisam ser zero ou mais.' });
  });
});

describe('teto de gastos', () => {
  it('salva e remove o teto, só no perfil de quem está logado', async () => {
    esperarOk(await definirTeto(db, 220_000));
    let dados = await carregarDadosFinanceiros(db);
    expect(dados.perfil.tetoVariavelCentavos).toBe(220_000);
    expect(resumoDaSemana(dados, HOJE).orcamento.estimativaVariaveis.fonte).toBe('teto');
    expect((await carregarDadosFinanceiros(dbDaOutra)).perfil.tetoVariavelCentavos).toBeNull();

    esperarOk(await definirTeto(db, null));
    dados = await carregarDadosFinanceiros(db);
    expect(dados.perfil.tetoVariavelCentavos).toBeNull();
    expect(resumoDaSemana(dados, HOJE).orcamento.estimativaVariaveis.fonte).toBe(
      'percentual_renda',
    );
  });

  it('recusa teto negativo', async () => {
    expect(await definirTeto(db, -1)).toEqual({
      ok: false,
      erro: 'O teto precisa ser zero ou mais.',
    });
  });

  it('carrega as categorias da pessoa para o motor', async () => {
    const dados = await carregarDadosFinanceiros(db);
    expect(dados.categorias).toHaveLength(20);
    expect(dados.categorias?.filter((c) => c.grupo === 'essencial')).toHaveLength(7);
  });
});
