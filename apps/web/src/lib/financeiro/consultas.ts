import { primeiroDiaDa, ultimoDiaDa, type Competencia } from '@no-azul/motor';
import type { Opcao } from '@/components/formulario';
import type { Tables } from '@/lib/supabase/tipos-banco';
import { lerTodas, type ClienteSupabase } from './carregar';

export type Categoria = Pick<Tables<'categorias'>, 'id' | 'nome' | 'grupo' | 'slug'>;

export async function listarCategorias(supabase: ClienteSupabase): Promise<Categoria[]> {
  const { data, error } = await supabase
    .from('categorias')
    .select('id, nome, grupo, slug')
    .order('nome');
  if (error) throw new Error(`Falha ao ler as categorias: ${error.code}`);
  return data;
}

const NOMES_DOS_GRUPOS: Record<string, string> = {
  essencial: 'Essenciais',
  livre: 'Livres',
  receita: 'Receitas',
  transferencia: 'Transferências',
};

/** Categorias em grupos para um campo de seleção; `grupos` limita quais aparecem. */
export function gruposDeCategorias(
  categorias: Categoria[],
  grupos: string[] = ['essencial', 'livre', 'receita', 'transferencia'],
): { rotulo: string; opcoes: Opcao[] }[] {
  return grupos.map((grupo) => ({
    rotulo: NOMES_DOS_GRUPOS[grupo] ?? grupo,
    opcoes: categorias
      .filter((categoria) => categoria.grupo === grupo)
      .map((categoria) => ({ valor: categoria.id, rotulo: categoria.nome })),
  }));
}

export type LinhaDeLancamento = Tables<'lancamentos'>;

export interface FiltrosDeLancamentos {
  competencia: Competencia;
  busca?: string;
  categoriaId?: string;
}

/** Escapa os curingas do ILIKE para buscar o texto como foi digitado. */
function textoLiteral(busca: string): string {
  return busca.replace(/[\\%_]/g, (caractere) => `\\${caractere}`);
}

export async function listarLancamentos(
  supabase: ClienteSupabase,
  filtros: FiltrosDeLancamentos,
): Promise<LinhaDeLancamento[]> {
  return lerTodas((de, ate) => {
    let consulta = supabase
      .from('lancamentos')
      .select('*')
      .gte('data', primeiroDiaDa(filtros.competencia))
      .lte('data', ultimoDiaDa(filtros.competencia));
    if (filtros.busca) consulta = consulta.ilike('descricao', `%${textoLiteral(filtros.busca)}%`);
    if (filtros.categoriaId) consulta = consulta.eq('categoria_id', filtros.categoriaId);
    return consulta
      .order('data', { ascending: false })
      .order('criado_em', { ascending: false })
      .order('id')
      .range(de, ate);
  });
}
