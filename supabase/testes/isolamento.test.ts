import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { lerAmbiente } from './ambiente.js';
import {
  clienteAdmin,
  clienteVisitante,
  criarUmaLinhaPorTabela,
  criarUsuario,
  excluirUsuario,
  type IdsDasLinhas,
  type UsuarioDeTeste,
} from './apoio.js';
import { TABELAS, type Tabela } from './tabelas.js';

const ambiente = lerAmbiente();
const admin = clienteAdmin(ambiente);

/** Coluna que identifica a linha e uma alteração válida, por tabela. */
const CASOS: Record<Tabela, { chave: string; alteracao: Record<string, unknown> }> = {
  perfis: { chave: 'usuario_id', alteracao: { nome: 'Invasor' } },
  categorias: { chave: 'id', alteracao: { nome: 'Invasor' } },
  documentos: { chave: 'id', alteracao: { nome: 'invasor.pdf' } },
  recorrencias: { chave: 'id', alteracao: { valor_centavos: 1 } },
  lancamentos: { chave: 'id', alteracao: { descricao: 'Invasor' } },
  ocorrencias: { chave: 'id', alteracao: { valor_centavos: 1 } },
  contas_avulsas: { chave: 'id', alteracao: { valor_centavos: 1 } },
  metas: { chave: 'id', alteracao: { alvo_centavos: 1 } },
  movimentos_reserva: { chave: 'id', alteracao: { valor_centavos: 1 } },
};

/** Linha que B tenta gravar em nome de A, sem nenhuma outra violação além do dono. */
function linhaEmNomeDe(
  usuarioId: string,
  ids: IdsDasLinhas,
): Record<Tabela, Record<string, unknown>> {
  return {
    perfis: { usuario_id: usuarioId, nome: 'Invasor' },
    categorias: { usuario_id: usuarioId, slug: 'invasao', nome: 'Invasão', grupo: 'livre' },
    documentos: { usuario_id: usuarioId, nome: 'x.pdf', hash: 'a'.repeat(64) },
    recorrencias: {
      usuario_id: usuarioId,
      tipo: 'fixa',
      nome: 'Invasão',
      valor_centavos: 100,
      dia: 1,
      inicio: '2026-11-01',
    },
    lancamentos: {
      usuario_id: usuarioId,
      data: '2026-11-04',
      descricao: 'Invasão',
      valor_centavos: 100,
      tipo: 'despesa',
    },
    ocorrencias: {
      usuario_id: usuarioId,
      recorrencia_id: ids.recorrencias,
      competencia: '2026-12',
      valor_centavos: 100,
    },
    contas_avulsas: {
      usuario_id: usuarioId,
      nome: 'Invasão',
      valor_centavos: 100,
      vencimento: '2026-11-30',
    },
    metas: {
      usuario_id: usuarioId,
      nome: 'Invasão',
      alvo_centavos: 100,
      prazo: '2027-01-01',
      prioridade: 3,
    },
    movimentos_reserva: {
      usuario_id: usuarioId,
      data: '2026-11-04',
      tipo: 'aporte',
      destino: 'contas',
      valor_centavos: 100,
    },
  };
}

async function linhaPeloAdmin(tabela: Tabela, chave: string, id: string) {
  const { data, error } = await admin.from(tabela).select('*').eq(chave, id).maybeSingle();
  if (error) throw error;
  return data as Record<string, unknown> | null;
}

describe('isolamento entre usuários', () => {
  let ana: UsuarioDeTeste;
  let bruno: UsuarioDeTeste;
  let idsDaAna: IdsDasLinhas;

  beforeAll(async () => {
    ana = await criarUsuario(ambiente, 'Ana');
    bruno = await criarUsuario(ambiente, 'Bruno');
    idsDaAna = await criarUmaLinhaPorTabela(ana);
  });

  afterAll(async () => {
    await excluirUsuario(ambiente, ana.id);
    await excluirUsuario(ambiente, bruno.id);
  });

  it('o cadastro cria o perfil e as categorias padrão', async () => {
    const perfil = await ana.cliente.from('perfis').select('nome').single();
    expect(perfil.error).toBeNull();
    expect(perfil.data).toEqual({ nome: 'Ana' });

    const categorias = await ana.cliente
      .from('categorias')
      .select('slug, grupo')
      .eq('padrao', true);
    expect(categorias.error).toBeNull();
    expect(categorias.data).toHaveLength(20);
    expect(categorias.data).toContainEqual({ slug: 'alimentacao', grupo: 'essencial' });
  });

  describe.each(TABELAS)('%s', (tabela) => {
    const { chave, alteracao } = CASOS[tabela];

    it('a dona lê a própria linha', async () => {
      const { data, error } = await ana.cliente
        .from(tabela)
        .select(chave)
        .eq(chave, idsDaAna[tabela]);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it('outro usuário não lê a linha', async () => {
      const pelaChave = await bruno.cliente.from(tabela).select('*').eq(chave, idsDaAna[tabela]);
      expect(pelaChave.error).toBeNull();
      expect(pelaChave.data).toEqual([]);

      const tudo = await bruno.cliente.from(tabela).select('usuario_id');
      expect(tudo.error).toBeNull();
      expect((tudo.data ?? []).filter((linha) => linha.usuario_id === ana.id)).toEqual([]);
    });

    it('outro usuário não altera a linha', async () => {
      const antes = await linhaPeloAdmin(tabela, chave, idsDaAna[tabela]);
      const { data, error } = await bruno.cliente
        .from(tabela)
        .update(alteracao)
        .eq(chave, idsDaAna[tabela])
        .select();
      expect(error === null ? data : []).toEqual([]);
      expect(await linhaPeloAdmin(tabela, chave, idsDaAna[tabela])).toEqual(antes);
    });

    it('outro usuário não exclui a linha', async () => {
      const { data, error } = await bruno.cliente
        .from(tabela)
        .delete()
        .eq(chave, idsDaAna[tabela])
        .select();
      expect(error === null ? data : []).toEqual([]);
      expect(await linhaPeloAdmin(tabela, chave, idsDaAna[tabela])).not.toBeNull();
    });

    it('outro usuário não grava em nome da dona', async () => {
      const linha = linhaEmNomeDe(ana.id, idsDaAna)[tabela];
      const { data, error } = await bruno.cliente.from(tabela).insert(linha).select();
      expect(data).toBeNull();
      expect(error?.code).toBe('42501');
    });

    it('quem não entrou não lê nada', async () => {
      const { data } = await clienteVisitante(ambiente).from(tabela).select('*');
      expect(data ?? []).toEqual([]);
    });

    it('a dona altera a própria linha', async () => {
      const { data, error } = await ana.cliente
        .from(tabela)
        .update(alteracao)
        .eq(chave, idsDaAna[tabela])
        .select();
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });
  });

  it('um usuário não passa a linha para outro dono', async () => {
    const propria = await bruno.cliente
      .from('categorias')
      .insert({ slug: 'mudanca_de_dono', nome: 'Mudança de dono', grupo: 'livre' })
      .select('id')
      .single();
    expect(propria.error).toBeNull();

    const { error } = await bruno.cliente
      .from('categorias')
      .update({ usuario_id: ana.id })
      .eq('id', propria.data!.id);
    expect(error?.code).toBe('42501');
  });

  it.each([
    ['lancamentos', 'categoria_id', 'categorias'],
    ['recorrencias', 'categoria_id', 'categorias'],
    ['contas_avulsas', 'documento_id', 'documentos'],
    ['ocorrencias', 'recorrencia_id', 'recorrencias'],
    ['movimentos_reserva', 'meta_id', 'metas'],
  ] as const)(
    'um usuário não aponta %s.%s para linha de outro usuário',
    async (tabela, coluna, referenciada) => {
      const linha = {
        ...linhaEmNomeDe(bruno.id, idsDaAna)[tabela],
        [coluna]: idsDaAna[referenciada],
      };
      if (tabela === 'movimentos_reserva') linha.destino = 'meta';
      const { data, error } = await bruno.cliente.from(tabela).insert(linha).select();
      expect(data).toBeNull();
      expect(error?.code).toBe('23503');
    },
  );

  describe('funções do banco', () => {
    async function estadoDaAna() {
      const ler = async (tabela: Tabela) =>
        (await admin.from(tabela).select('*').eq('usuario_id', ana.id).order('id')).data;
      return {
        ocorrencias: await ler('ocorrencias'),
        contas: await ler('contas_avulsas'),
        lancamentos: await ler('lancamentos'),
        movimentos: await ler('movimentos_reserva'),
        metas: await ler('metas'),
      };
    }

    it('outro usuário não paga, não desfaz, não recebe e não exclui nada da dona', async () => {
      const rendaDaAna = await ana.cliente
        .from('recorrencias')
        .insert({
          tipo: 'renda',
          nome: 'Salário',
          valor_centavos: 500000,
          dia: 5,
          inicio: '2026-11-01',
        })
        .select('id')
        .single();
      expect(rendaDaAna.error).toBeNull();
      const antes = await estadoDaAna();
      const tentativas = [
        bruno.cliente.rpc('registrar_pagamento', {
          p_pago_em: '2026-11-05',
          p_valor_centavos: 213000,
          p_saque_centavos: 0,
          p_tipo_lancamento: 'despesa',
          p_recorrencia_id: idsDaAna.recorrencias,
          p_competencia: '2026-12',
        }),
        bruno.cliente.rpc('registrar_pagamento', {
          p_pago_em: '2026-11-05',
          p_valor_centavos: 184250,
          p_saque_centavos: 0,
          p_tipo_lancamento: 'transferencia',
          p_conta_avulsa_id: idsDaAna.contas_avulsas,
        }),
        bruno.cliente.rpc('desfazer_pagamento', { p_ocorrencia_id: idsDaAna.ocorrencias }),
        bruno.cliente.rpc('confirmar_recebimento', {
          p_recorrencia_id: rendaDaAna.data!.id,
          p_competencia: '2026-12',
          p_valor_centavos: 1,
          p_recebido_em: '2026-11-05',
        }),
        bruno.cliente.rpc('desfazer_recebimento', { p_ocorrencia_id: idsDaAna.ocorrencias }),
        bruno.cliente.rpc('excluir_meta', { p_meta_id: idsDaAna.metas }),
      ];
      for (const tentativa of tentativas) {
        const { error } = await tentativa;
        expect(error?.code).toBe('P0002');
      }
      expect(await estadoDaAna()).toEqual(antes);
    });

    it('quem não entrou não chama nenhuma função', async () => {
      const visitante = clienteVisitante(ambiente);
      const { error } = await visitante.rpc('excluir_meta', { p_meta_id: idsDaAna.metas });
      expect(error?.code).toBe('42501');
    });
  });
});

describe('a dona exclui as próprias linhas', () => {
  let carla: UsuarioDeTeste;
  let ids: IdsDasLinhas;

  beforeAll(async () => {
    carla = await criarUsuario(ambiente, 'Carla');
    ids = await criarUmaLinhaPorTabela(carla);
  });

  afterAll(async () => {
    await excluirUsuario(ambiente, carla.id);
  });

  it('em todas as tabelas, menos perfis, que só sai com o cadastro', async () => {
    const ordemDeExclusao = [...TABELAS].reverse().filter((tabela) => tabela !== 'perfis');
    for (const tabela of ordemDeExclusao) {
      const { data, error } = await carla.cliente
        .from(tabela)
        .delete()
        .eq('id', ids[tabela])
        .select('id');
      expect(error, tabela).toBeNull();
      expect(data, tabela).toHaveLength(1);
    }

    const perfil = await carla.cliente.from('perfis').delete().eq('usuario_id', carla.id).select();
    expect(perfil.error?.code).toBe('42501');
  });
});

describe('excluir o cadastro', () => {
  it('apaga em cascata as linhas do usuário em todas as tabelas', async () => {
    const davi = await criarUsuario(ambiente, 'Davi');
    await criarUmaLinhaPorTabela(davi);

    const banco = new pg.Client({ connectionString: ambiente.bancoUrl });
    await banco.connect();
    try {
      const contar = async () => {
        const contagens: Record<string, number> = {};
        for (const tabela of TABELAS) {
          const { rows } = await banco.query<{ total: string }>(
            `select count(*) as total from public.${tabela} where usuario_id = $1`,
            [davi.id],
          );
          contagens[tabela] = Number(rows[0]!.total);
        }
        return contagens;
      };

      const antes = await contar();
      for (const tabela of TABELAS) expect(antes[tabela], tabela).toBeGreaterThan(0);

      await excluirUsuario(ambiente, davi.id);

      const depois = await contar();
      for (const tabela of TABELAS) expect(depois[tabela], tabela).toBe(0);
    } finally {
      await banco.end();
    }
  });
});
