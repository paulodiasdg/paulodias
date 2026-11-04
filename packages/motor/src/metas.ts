import { dividirInteiros, paraInteiroSeguro } from './aritmetica.js';
import {
  competenciaDe,
  inicioDaSemana,
  mesesDeCalendario,
  somarMeses,
  type Competencia,
  type DataCivil,
} from './datas.js';
import { paraCimaEmReais, proporcao, somar, type Centavos } from './dinheiro.js';
import { aportesEntre, saldoEm, saldoNoInicioDaSemana } from './movimentos.js';
import { orcamentoDoMes } from './orcamento.js';
import type { DadosFinanceiros, Meta } from './tipos.js';

export type SituacaoDaMeta = 'concluida' | 'completa' | 'parcial' | 'sem_verba';

export interface PlanoDaMeta {
  meta: Meta;
  /** Guardado pela foto de segunda-feira (D3); é o que entra no cálculo da semana. */
  guardadoInicioSemanaCentavos: Centavos;
  guardadoAtualCentavos: Centavos;
  faltaCentavos: Centavos;
  /** Meses de calendário da segunda-feira até o prazo (D1). */
  mesesAtePrazo: { inteiros: number; diasRestantes: number; diasDoMes: number };
  necessarioMensalCentavos: Centavos;
  alocadoMensalCentavos: Centavos;
  aporteSemanalCentavos: Centavos;
  aportadoNaSemanaCentavos: Centavos;
  situacao: SituacaoDaMeta;
  prazoVencido: boolean;
  /** Quanto falta por mês para cumprir o prazo (necessário − alocado). */
  faltaPorMesCentavos: Centavos;
  /** Quando a meta termina no ritmo alocado; null se não há verba ou já terminou. */
  previsaoTermino: DataCivil | null;
}

export interface PlanoDasMetas {
  competencia: Competencia;
  /** Verba das metas = Livre − estimativa de gastos variáveis, com mínimo zero. */
  verbaCentavos: Centavos;
  alocadoMensalCentavos: Centavos;
  sobraDaVerbaCentavos: Centavos;
  aporteSemanalCentavos: Centavos;
  metas: PlanoDaMeta[];
}

function compararPrioridade(a: Meta, b: Meta): number {
  return (
    a.prioridade - b.prioridade ||
    a.prazo.localeCompare(b.prazo) ||
    a.nome.localeCompare(b.nome, 'pt-BR') ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Aporte mensal necessário = falta ÷ max(1, meses até o prazo), ao centavo mais próximo (C7).
 * Os meses são de calendário (D1), em fração exata: inteiros + dias restantes ÷ dias do mês.
 */
function necessarioMensal(
  falta: Centavos,
  meses: { inteiros: number; diasRestantes: number; diasDoMes: number },
): Centavos {
  const numeradorDosMeses = meses.inteiros * meses.diasDoMes + meses.diasRestantes;
  if (numeradorDosMeses < meses.diasDoMes) return falta; // menos de um mês: max(1, …)
  return proporcao(falta, meses.diasDoMes, numeradorDosMeses, 'proximo');
}

/**
 * Regra 3.3: distribui a verba do mês entre as metas, por prioridade e, no empate, pelo prazo
 * mais próximo. A semana usa a segunda-feira como referência (D3): os meses até o prazo e o
 * guardado são contados a partir dela, para o valor não mudar ao longo da semana.
 */
export function planoDasMetas(
  dados: DadosFinanceiros,
  hoje: DataCivil,
  competencia: Competencia = competenciaDe(inicioDaSemana(hoje)),
): PlanoDasMetas {
  const segunda = inicioDaSemana(hoje);
  const orcamento = orcamentoDoMes(dados, competencia);
  const verba = Math.max(0, orcamento.livreCentavos - orcamento.estimativaVariaveis.valorCentavos);

  let restante = verba;
  const metas = [...dados.metas].sort(compararPrioridade).map((meta): PlanoDaMeta => {
    const destino = { destino: 'meta', metaId: meta.id } as const;
    const guardadoInicio = saldoNoInicioDaSemana(dados.movimentos, destino, segunda, hoje);
    const falta = Math.max(0, meta.alvoCentavos - guardadoInicio);
    const meses = mesesDeCalendario(segunda, meta.prazo);
    const base = {
      meta,
      guardadoInicioSemanaCentavos: guardadoInicio,
      guardadoAtualCentavos: saldoEm(dados.movimentos, destino, hoje),
      faltaCentavos: falta,
      mesesAtePrazo: meses,
      aportadoNaSemanaCentavos: aportesEntre(dados.movimentos, destino, segunda, hoje),
      prazoVencido: false,
    };

    if (meta.concluidaEm !== null || falta === 0) {
      return {
        ...base,
        necessarioMensalCentavos: 0,
        alocadoMensalCentavos: 0,
        aporteSemanalCentavos: 0,
        situacao: 'concluida',
        faltaPorMesCentavos: 0,
        previsaoTermino: null,
      };
    }

    const necessario = necessarioMensal(falta, meses);
    const alocado = Math.min(necessario, restante);
    restante -= alocado;

    let situacao: SituacaoDaMeta = 'completa';
    if (alocado === 0) situacao = 'sem_verba';
    else if (alocado < necessario) situacao = 'parcial';

    let previsaoTermino: DataCivil | null = null;
    if (situacao === 'completa') previsaoTermino = meta.prazo;
    if (situacao === 'parcial') {
      const mesesNoRitmo = paraInteiroSeguro(
        dividirInteiros(BigInt(falta), BigInt(alocado), 'cima'),
      );
      previsaoTermino = somarMeses(segunda, mesesNoRitmo);
    }

    return {
      ...base,
      prazoVencido: meta.prazo < hoje,
      necessarioMensalCentavos: necessario,
      alocadoMensalCentavos: alocado,
      // Aporte semanal = mensal × 12 ÷ 52, para cima em reais inteiros.
      aporteSemanalCentavos: paraCimaEmReais(proporcao(alocado, 12, 52, 'cima')),
      situacao,
      faltaPorMesCentavos: necessario - alocado,
      previsaoTermino,
    };
  });

  const alocadoTotal = somar(metas.map((plano) => plano.alocadoMensalCentavos));
  return {
    competencia,
    verbaCentavos: verba,
    alocadoMensalCentavos: alocadoTotal,
    sobraDaVerbaCentavos: verba - alocadoTotal,
    aporteSemanalCentavos: somar(metas.map((plano) => plano.aporteSemanalCentavos)),
    metas,
  };
}
