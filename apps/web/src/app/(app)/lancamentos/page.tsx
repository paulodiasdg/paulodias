import type { Metadata } from 'next';
import Link from 'next/link';
import { somar, somarMesesNaCompetencia } from '@no-azul/motor';
import { classeBotaoLink, classeBotaoPrincipalLink } from '@/components/formulario';
import {
  gruposDeCategorias,
  listarCategorias,
  listarLancamentos,
} from '@/lib/financeiro/consultas';
import { comMaiuscula, formatarCompetencia, formatarData, formatarReais } from '@/lib/formatacao';
import { criarClienteServidor } from '@/lib/supabase/servidor';
import { lerFiltros, urlDosFiltros, type ParametrosDaBusca } from './filtros';

export const metadata: Metadata = { title: 'Lançamentos · No Azul' };

const SINAIS = { despesa: '−', receita: '+', transferencia: '⇄' } as const;
const NOMES_DAS_ORIGENS: Record<string, string> = {
  pagamento: 'Pagamento de conta',
  recebimento: 'Recebimento de renda',
  documento: 'De documento',
};

export default async function PaginaLancamentos({
  searchParams,
}: {
  searchParams: Promise<ParametrosDaBusca>;
}) {
  const filtros = lerFiltros(await searchParams);
  const supabase = await criarClienteServidor();
  const [lancamentos, categorias] = await Promise.all([
    listarLancamentos(supabase, filtros),
    listarCategorias(supabase),
  ]);
  const nomeDaCategoria = new Map(categorias.map((c) => [c.id, c.nome]));
  const total = (tipo: string) =>
    somar(lancamentos.filter((l) => l.tipo === tipo).map((l) => l.valor_centavos));
  const anterior = somarMesesNaCompetencia(filtros.competencia, -1);
  const seguinte = somarMesesNaCompetencia(filtros.competencia, 1);
  const filtrando = Boolean(filtros.busca || filtros.categoriaId);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Lançamentos</h1>
          <nav aria-label="Mês" className="mt-1 flex items-center gap-2 text-slate-700">
            <Link
              href={urlDosFiltros('/lancamentos', filtros, anterior)}
              className="rounded px-2 py-1 hover:bg-slate-100"
              aria-label="Mês anterior"
            >
              ‹
            </Link>
            <span className="font-medium" data-testid="mes">
              {comMaiuscula(formatarCompetencia(filtros.competencia))}
            </span>
            <Link
              href={urlDosFiltros('/lancamentos', filtros, seguinte)}
              className="rounded px-2 py-1 hover:bg-slate-100"
              aria-label="Mês seguinte"
            >
              ›
            </Link>
          </nav>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={urlDosFiltros('/lancamentos/exportar', filtros)} className={classeBotaoLink}>
            Exportar CSV
          </a>
          <Link href="/lancamentos/novo" className={classeBotaoPrincipalLink}>
            Novo lançamento
          </Link>
        </div>
      </div>

      {/* A chave recria o formulário quando os filtros mudam, para os campos mostrarem os filtros da URL. */}
      <form
        key={`${filtros.competencia}|${filtros.busca ?? ''}|${filtros.categoriaId ?? ''}`}
        method="get"
        action="/lancamentos"
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"
      >
        <input type="hidden" name="mes" value={filtros.competencia} />
        <label className="grid w-full min-w-0 gap-1 text-sm sm:w-auto sm:flex-1">
          <span className="font-medium text-slate-700">Buscar</span>
          <input
            type="search"
            name="busca"
            defaultValue={filtros.busca ?? ''}
            placeholder="Descrição"
            className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
        </label>
        <label className="grid w-full min-w-0 gap-1 text-sm sm:w-56">
          <span className="font-medium text-slate-700">Categoria</span>
          <select
            name="categoria"
            defaultValue={filtros.categoriaId ?? ''}
            className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
          >
            <option value="">Todas</option>
            {gruposDeCategorias(categorias).map((grupo) => (
              <optgroup key={grupo.rotulo} label={grupo.rotulo}>
                {grupo.opcoes.map((opcao) => (
                  <option key={opcao.valor} value={opcao.valor}>
                    {opcao.rotulo}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-azul-600 px-4 py-2 font-medium text-white hover:bg-azul-700"
          >
            Filtrar
          </button>
          {filtrando ? (
            <Link
              href={`/lancamentos?mes=${filtros.competencia}`}
              className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100"
            >
              Limpar
            </Link>
          ) : null}
        </div>
      </form>

      <dl className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          ['Gastos', total('despesa'), 'despesas'],
          ['Receitas', total('receita'), 'receitas'],
          ['Transferências', total('transferencia'), 'transferencias'],
        ].map(([rotulo, valor, id]) => (
          <div
            key={id as string}
            className="min-w-0 rounded-2xl border border-slate-200 bg-white p-2.5 sm:p-3"
          >
            <dt className="text-xs text-slate-600">{rotulo}</dt>
            <dd
              className="text-sm font-semibold whitespace-nowrap tabular-nums sm:text-base"
              data-testid={`total-${id as string}`}
            >
              {formatarReais(valor as number)}
            </dd>
          </div>
        ))}
      </dl>

      <section
        aria-label="Lista de lançamentos"
        className="rounded-2xl border border-slate-200 bg-white"
      >
        {lancamentos.length === 0 ? (
          <p className="p-4 text-sm text-slate-600">
            {filtrando ? 'Nenhum lançamento com esses filtros.' : 'Nenhum lançamento neste mês.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {lancamentos.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/lancamentos/${l.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{l.descricao}</span>
                    <span className="text-xs text-slate-600">
                      {formatarData(l.data)} ·{' '}
                      {(l.categoria_id && nomeDaCategoria.get(l.categoria_id)) || 'Sem categoria'}
                      {NOMES_DAS_ORIGENS[l.origem] ? ` · ${NOMES_DAS_ORIGENS[l.origem]}` : ''}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 font-semibold tabular-nums ${l.tipo === 'receita' ? 'text-emerald-700' : 'text-slate-900'}`}
                  >
                    {SINAIS[l.tipo as keyof typeof SINAIS]} {formatarReais(l.valor_centavos)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
