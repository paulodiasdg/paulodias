import { competenciaDe, lerCompetencia, type Competencia } from '@no-azul/motor';
import type { FiltrosDeLancamentos } from '@/lib/financeiro/consultas';
import { hojeNoBrasil } from '@/lib/formatacao';

export type ParametrosDaBusca = {
  mes?: string | string[];
  busca?: string | string[];
  categoria?: string | string[];
};

function um(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor)?.trim() ?? '';
}

/** Lê os filtros da URL; mês inválido ou ausente vira o mês de hoje. */
export function lerFiltros(
  parametros: ParametrosDaBusca,
): FiltrosDeLancamentos & { competencia: Competencia } {
  let competencia = um(parametros.mes);
  try {
    lerCompetencia(competencia);
  } catch {
    competencia = competenciaDe(hojeNoBrasil());
  }
  const busca = um(parametros.busca).slice(0, 100);
  const categoria = um(parametros.categoria);
  return {
    competencia,
    ...(busca ? { busca } : {}),
    ...(/^[0-9a-f-]{36}$/.test(categoria) ? { categoriaId: categoria } : {}),
  };
}

export function urlDosFiltros(
  caminho: string,
  filtros: FiltrosDeLancamentos,
  mes = filtros.competencia,
): string {
  const busca = new URLSearchParams({ mes });
  if (filtros.busca) busca.set('busca', filtros.busca);
  if (filtros.categoriaId) busca.set('categoria', filtros.categoriaId);
  return `${caminho}?${busca.toString()}`;
}
