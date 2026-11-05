import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type {
  Categoria,
  DadosFinanceiros,
  Meta,
  MovimentoReserva,
  Ocorrencia,
} from '@no-azul/motor';
import { dataCivilEm } from '@/lib/formatacao';
import type { Database, Tables } from '@/lib/supabase/tipos-banco';

export type ClienteSupabase = SupabaseClient<Database>;

/** O PostgREST devolve no máximo 1.000 linhas por consulta (supabase/config.toml, max_rows). */
const TAMANHO_DA_PAGINA = 1000;

/** Lê todas as linhas de uma consulta, página por página, em ordem estável. */
export async function lerTodas<T>(
  consulta: (
    de: number,
    ate: number,
  ) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += TAMANHO_DA_PAGINA) {
    const { data, error } = await consulta(de, de + TAMANHO_DA_PAGINA - 1);
    if (error) throw new Error(`Falha ao ler os dados: ${error.code ?? 'erro desconhecido'}`);
    linhas.push(...(data ?? []));
    if (!data || data.length < TAMANHO_DA_PAGINA) return linhas;
  }
}

export interface LinhasDoBanco {
  perfil: Pick<Tables<'perfis'>, 'teto_variavel_centavos' | 'criado_em'>;
  recorrencias: Tables<'recorrencias'>[];
  ocorrencias: Tables<'ocorrencias'>[];
  contasAvulsas: Tables<'contas_avulsas'>[];
  lancamentos: Tables<'lancamentos'>[];
  metas: Tables<'metas'>[];
  movimentos: Tables<'movimentos_reserva'>[];
  categorias: Pick<Tables<'categorias'>, 'id' | 'nome' | 'grupo'>[];
}

/**
 * Converte as linhas do banco nos dados de entrada do motor. Só entram dados gravados: extração
 * de documento em revisão fica em documentos.extracao_json e não passa por aqui (regra 6).
 */
export function paraDadosFinanceiros(linhas: LinhasDoBanco): DadosFinanceiros {
  return {
    perfil: {
      tetoVariavelCentavos: linhas.perfil.teto_variavel_centavos,
      inicioEm: dataCivilEm(new Date(linhas.perfil.criado_em)),
    },
    recorrencias: linhas.recorrencias.map((r) => ({
      id: r.id,
      tipo: r.tipo as 'renda' | 'fixa',
      nome: r.nome,
      valorCentavos: r.valor_centavos,
      dia: r.dia,
      inicio: r.inicio,
      fim: r.fim,
      ativa: r.ativa,
      rendaVariavel: r.renda_variavel,
      pagaNoCartao: r.paga_no_cartao,
      categoriaId: r.categoria_id,
    })),
    ocorrencias: linhas.ocorrencias.map((o): Ocorrencia => ({
      id: o.id,
      recorrenciaId: o.recorrencia_id,
      competencia: o.competencia,
      valorCentavos: o.valor_centavos,
      status: o.status as Ocorrencia['status'],
      pagoEm: o.pago_em,
    })),
    contasAvulsas: linhas.contasAvulsas.map((c) => ({
      id: c.id,
      nome: c.nome,
      valorCentavos: c.valor_centavos,
      vencimento: c.vencimento,
      quitaItens: c.quita_itens,
      pagoEm: c.pago_em,
      categoriaId: c.categoria_id,
    })),
    lancamentos: linhas.lancamentos.map((l) => ({
      id: l.id,
      data: l.data,
      descricao: l.descricao,
      valorCentavos: l.valor_centavos,
      tipo: l.tipo as 'despesa' | 'receita' | 'transferencia',
      categoriaId: l.categoria_id,
      ocorrenciaId: l.ocorrencia_id,
      contaAvulsaId: l.conta_avulsa_id,
      origem: l.origem as 'manual' | 'documento' | 'pagamento' | 'recebimento',
    })),
    metas: linhas.metas.map((m): Meta => ({
      id: m.id,
      nome: m.nome,
      alvoCentavos: m.alvo_centavos,
      prazo: m.prazo,
      prioridade: m.prioridade,
      tipo: m.tipo as Meta['tipo'],
      concluidaEm: m.concluida_em ? dataCivilEm(new Date(m.concluida_em)) : null,
    })),
    movimentos: linhas.movimentos.map((m): MovimentoReserva => ({
      id: m.id,
      data: m.data,
      tipo: m.tipo as MovimentoReserva['tipo'],
      destino: m.destino as MovimentoReserva['destino'],
      metaId: m.meta_id,
      valorCentavos: m.valor_centavos,
      ocorrenciaId: m.ocorrencia_id,
      contaAvulsaId: m.conta_avulsa_id,
    })),
    categorias: linhas.categorias.map((c): Categoria => ({
      id: c.id,
      nome: c.nome,
      grupo: c.grupo as Categoria['grupo'],
    })),
  };
}

/** Lê todos os dados financeiros de quem está logado (o RLS limita às próprias linhas). */
export async function carregarDadosFinanceiros(
  supabase: ClienteSupabase,
): Promise<DadosFinanceiros> {
  const [
    perfil,
    recorrencias,
    ocorrencias,
    contasAvulsas,
    lancamentos,
    metas,
    movimentos,
    categorias,
  ] = await Promise.all([
    supabase.from('perfis').select('teto_variavel_centavos, criado_em').single(),
    lerTodas((de, ate) => supabase.from('recorrencias').select('*').order('id').range(de, ate)),
    lerTodas((de, ate) => supabase.from('ocorrencias').select('*').order('id').range(de, ate)),
    lerTodas((de, ate) => supabase.from('contas_avulsas').select('*').order('id').range(de, ate)),
    lerTodas((de, ate) => supabase.from('lancamentos').select('*').order('id').range(de, ate)),
    lerTodas((de, ate) => supabase.from('metas').select('*').order('id').range(de, ate)),
    lerTodas((de, ate) =>
      supabase.from('movimentos_reserva').select('*').order('id').range(de, ate),
    ),
    lerTodas((de, ate) =>
      supabase.from('categorias').select('id, nome, grupo').order('id').range(de, ate),
    ),
  ]);
  if (perfil.error || !perfil.data) throw new Error('Perfil não encontrado.');

  return paraDadosFinanceiros({
    perfil: perfil.data,
    recorrencias,
    ocorrencias,
    contasAvulsas,
    lancamentos,
    metas,
    movimentos,
    categorias,
  });
}
