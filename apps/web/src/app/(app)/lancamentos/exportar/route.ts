import { listarCategorias, listarLancamentos } from '@/lib/financeiro/consultas';
import { lancamentosEmCsv } from '@/lib/financeiro/csv';
import { criarClienteServidor, usuarioAtual } from '@/lib/supabase/servidor';
import { lerFiltros } from '../filtros';

/** Exporta em CSV os lançamentos do mês, com os mesmos filtros da tela. */
export async function GET(request: Request) {
  if (!(await usuarioAtual())) {
    return new Response('Entre no sistema para exportar.', { status: 401 });
  }
  const parametros = Object.fromEntries(new URL(request.url).searchParams);
  const filtros = lerFiltros(parametros);
  const supabase = await criarClienteServidor();
  const [lancamentos, categorias] = await Promise.all([
    listarLancamentos(supabase, filtros),
    listarCategorias(supabase),
  ]);
  const csv = lancamentosEmCsv(lancamentos, new Map(categorias.map((c) => [c.id, c.nome])));
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="lancamentos-${filtros.competencia}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
