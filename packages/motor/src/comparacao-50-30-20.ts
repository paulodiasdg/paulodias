import { entraNoOrcamento, listarContas } from './contas';
import {
  competenciaDe,
  primeiroDiaDa,
  somarMesesNaCompetencia,
  ultimoDiaDa,
  type Competencia,
  type DataCivil,
} from './datas';
import { proporcao, type Centavos } from './dinheiro';
import { ehGastoVariavel, orcamentoDoMes } from './orcamento';
import type { Categoria, DadosFinanceiros } from './tipos';

export type ChaveDoGrupo = 'necessidades' | 'desejos' | 'metas';

/** Referência da regra 50/30/20, em percentual da renda. */
export const REFERENCIA_50_30_20: Record<ChaveDoGrupo, number> = {
  necessidades: 50,
  desejos: 30,
  metas: 20,
};

export interface GrupoDaComparacao {
  chave: ChaveDoGrupo;
  valorCentavos: Centavos;
  /** Percentual da renda do mês, ao inteiro mais próximo. */
  percentual: number;
  referenciaPercentual: number;
  /** Renda × referência, ao centavo mais próximo. */
  referenciaCentavos: Centavos;
  /** Necessidades e desejos: até a referência. Metas: a referência ou mais. */
  dentroDaReferencia: boolean;
}

export interface Comparacao503020 {
  competencia: Competencia;
  /** Sem mês completo, compara o mês atual até hoje. */
  parcial: boolean;
  /** Último dia considerado nos gastos e aportes. */
  ate: DataCivil;
  rendaCentavos: Centavos;
  grupos: GrupoDaComparacao[];
  /** Fixas, contas e gastos sem categoria, ou com categoria fora de essencial e livre. */
  semCategoriaCentavos: Centavos;
  semCategoriaPercentual: number;
}

/**
 * Mês da comparação 50/30/20: o último mês completo (a pessoa usava o sistema desde o dia 1) ou,
 * sem ele, o mês atual até hoje.
 */
export function mesDaComparacao503020(
  dados: DadosFinanceiros,
  hoje: DataCivil,
): { competencia: Competencia; parcial: boolean; ate: DataCivil } {
  const mesPassado = somarMesesNaCompetencia(competenciaDe(hoje), -1);
  const inicioEm = dados.perfil.inicioEm;
  const temMesCompleto = !inicioEm || inicioEm <= primeiroDiaDa(mesPassado);
  return temMesCompleto
    ? { competencia: mesPassado, parcial: false, ate: ultimoDiaDa(mesPassado) }
    : { competencia: competenciaDe(hoje), parcial: true, ate: hoje };
}

/**
 * Compara o uso da renda com a regra 50/30/20 (decisão de 05/11/2026). Usa o último mês completo,
 * com o que aconteceu: necessidades são fixas, contas avulsas (sem faturas com itens importados)
 * e gastos variáveis em categorias essenciais; desejos, o mesmo em categorias livres; metas, os
 * aportes feitos nelas no mês. Sem mês completo, usa o mês atual: renda e contas do mês inteiro,
 * gastos e aportes até hoje. Sem renda, não há comparação.
 */
export function comparacao503020(
  dados: DadosFinanceiros,
  hoje: DataCivil,
): Comparacao503020 | null {
  const { competencia, parcial, ate } = mesDaComparacao503020(dados, hoje);
  const primeiroDia = primeiroDiaDa(competencia);
  const ultimoDia = ultimoDiaDa(competencia);

  const renda = orcamentoDoMes(dados, competencia, hoje).rendaCentavos;
  if (renda <= 0) return null;

  const grupos = new Map<string, Categoria['grupo']>(
    (dados.categorias ?? []).map((categoria) => [categoria.id, categoria.grupo]),
  );
  const totais = { necessidades: 0, desejos: 0, semCategoria: 0 };
  const somarNoGrupo = (categoriaId: string | null | undefined, valor: Centavos) => {
    const grupo = categoriaId ? grupos.get(categoriaId) : undefined;
    if (grupo === 'essencial') totais.necessidades += valor;
    else if (grupo === 'livre') totais.desejos += valor;
    else totais.semCategoria += valor;
  };

  for (const conta of listarContas(dados, primeiroDia, ultimoDia).filter(entraNoOrcamento)) {
    somarNoGrupo(conta.categoriaId, conta.valorCentavos);
  }
  for (const lancamento of dados.lancamentos) {
    if (!ehGastoVariavel(lancamento)) continue;
    if (lancamento.data < primeiroDia || lancamento.data > ate) continue;
    somarNoGrupo(lancamento.categoriaId, lancamento.valorCentavos);
  }
  const metas = dados.movimentos
    .filter(
      (movimento) =>
        movimento.destino === 'meta' &&
        movimento.tipo === 'aporte' &&
        movimento.data >= primeiroDia &&
        movimento.data <= ate,
    )
    .reduce((soma, movimento) => soma + movimento.valorCentavos, 0);

  const percentual = (valor: Centavos) => proporcao(valor, 100, renda, 'proximo');
  const grupo = (chave: ChaveDoGrupo, valor: Centavos): GrupoDaComparacao => {
    const referencia = REFERENCIA_50_30_20[chave];
    // Comparação exata: valor ÷ renda contra a referência, sem arredondar o percentual.
    const limite = BigInt(renda) * BigInt(referencia);
    const medida = BigInt(valor) * 100n;
    return {
      chave,
      valorCentavos: valor,
      percentual: percentual(valor),
      referenciaPercentual: referencia,
      referenciaCentavos: proporcao(renda, referencia, 100, 'proximo'),
      dentroDaReferencia: chave === 'metas' ? medida >= limite : medida <= limite,
    };
  };

  return {
    competencia,
    parcial,
    ate,
    rendaCentavos: renda,
    grupos: [
      grupo('necessidades', totais.necessidades),
      grupo('desejos', totais.desejos),
      grupo('metas', metas),
    ],
    semCategoriaCentavos: totais.semCategoria,
    semCategoriaPercentual: percentual(totais.semCategoria),
  };
}
