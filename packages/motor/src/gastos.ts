import { diferencaEmDias, fimDaSemana, inicioDaSemana, somarDias, type DataCivil } from './datas';
import { dividir, proporcao, somar, type Centavos } from './dinheiro';
import { gastoVariavelEntre, limiteDeGastos } from './limite';
import { ehGastoVariavel } from './orcamento';
import type { Categoria, DadosFinanceiros } from './tipos';

/** Quantas semanas anteriores o painel compara com a semana atual. */
export const SEMANAS_DE_COMPARACAO = 6;

export interface GastoPorCategoria {
  /** Null para gasto sem categoria. */
  categoriaId: string | null;
  nome: string | null;
  grupo: Categoria['grupo'] | null;
  valorCentavos: Centavos;
}

export interface GastoDaSemana {
  inicio: DataCivil;
  fim: DataCivil;
  gastoCentavos: Centavos;
}

export interface GastosDaSemana {
  semana: { inicio: DataCivil; fim: DataCivil };
  /** Gasto variável da semana inteira (regra 3.2). */
  totalCentavos: Centavos;
  /** Limite semanal da regra 3.4, calculado na data pedida. */
  limiteSemanalCentavos: Centavos;
  /** Limite − gasto, com mínimo zero. */
  disponivelNaSemanaCentavos: Centavos;
  /** Gasto acima do limite semanal, ou zero. */
  acimaDoLimiteCentavos: Centavos;
  /** Gasto ÷ limite, em percentual inteiro para baixo; null com limite zero. */
  usoDoLimitePercentual: number | null;
  /** Em ordem de valor, do maior para o menor. */
  porCategoria: GastoPorCategoria[];
  /** Até 6 semanas anteriores, da mais antiga para a mais recente, sem as de antes do início do uso. */
  semanasAnteriores: GastoDaSemana[];
  /** Média das semanas anteriores, ao centavo mais próximo; null se não há nenhuma. */
  mediaDasAnterioresCentavos: Centavos | null;
}

/** Gastos variáveis da semana de `data`, por categoria, contra o limite (painel, item 3). */
export function gastosDaSemana(dados: DadosFinanceiros, data: DataCivil): GastosDaSemana {
  const segunda = inicioDaSemana(data);
  const domingo = fimDaSemana(data);
  const categorias = new Map(
    (dados.categorias ?? []).map((categoria) => [categoria.id, categoria]),
  );

  const porCategoria = new Map<string | null, Centavos>();
  for (const lancamento of dados.lancamentos) {
    if (!ehGastoVariavel(lancamento) || lancamento.data < segunda || lancamento.data > domingo) {
      continue;
    }
    const chave =
      lancamento.categoriaId && categorias.has(lancamento.categoriaId)
        ? lancamento.categoriaId
        : null;
    porCategoria.set(chave, (porCategoria.get(chave) ?? 0) + lancamento.valorCentavos);
  }
  const lista: GastoPorCategoria[] = [...porCategoria].map(([categoriaId, valorCentavos]) => {
    const categoria = categoriaId === null ? undefined : categorias.get(categoriaId);
    return {
      categoriaId,
      nome: categoria?.nome ?? null,
      grupo: categoria?.grupo ?? null,
      valorCentavos,
    };
  });
  lista.sort(
    (a, b) =>
      b.valorCentavos - a.valorCentavos || (a.nome ?? '￿').localeCompare(b.nome ?? '￿', 'pt-BR'),
  );

  const inicioDoUso = dados.perfil.inicioEm ? inicioDaSemana(dados.perfil.inicioEm) : null;
  const semanasAnteriores: GastoDaSemana[] = [];
  for (let passo = SEMANAS_DE_COMPARACAO; passo >= 1; passo--) {
    const inicio = somarDias(segunda, -7 * passo);
    if (inicioDoUso !== null && diferencaEmDias(inicioDoUso, inicio) < 0) continue;
    const fim = somarDias(inicio, 6);
    semanasAnteriores.push({ inicio, fim, gastoCentavos: gastoVariavelEntre(dados, inicio, fim) });
  }

  const total = somar(lista.map((item) => item.valorCentavos));
  const limite = limiteDeGastos(dados, data).limiteSemanalCentavos;
  return {
    semana: { inicio: segunda, fim: domingo },
    totalCentavos: total,
    limiteSemanalCentavos: limite,
    disponivelNaSemanaCentavos: Math.max(0, limite - total),
    acimaDoLimiteCentavos: Math.max(0, total - limite),
    usoDoLimitePercentual: limite > 0 ? proporcao(total, 100, limite, 'baixo') : null,
    porCategoria: lista,
    semanasAnteriores,
    mediaDasAnterioresCentavos:
      semanasAnteriores.length === 0
        ? null
        : dividir(
            somar(semanasAnteriores.map((semana) => semana.gastoCentavos)),
            semanasAnteriores.length,
            'proximo',
          ),
  };
}
