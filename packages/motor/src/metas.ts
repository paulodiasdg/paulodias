import { dividirInteiros, paraInteiroSeguro } from './aritmetica';
import {
  competenciaDe,
  diferencaEmDias,
  inicioDaSemana,
  mesesDeCalendario,
  somarMeses,
  type Competencia,
  type DataCivil,
} from './datas';
import { dividir, paraCimaEmReais, proporcao, somar, type Centavos } from './dinheiro';
import { aportesEntre, saldoEm, saldoNoInicioDaSemana } from './movimentos';
import { orcamentoDoMes } from './orcamento';
import type { DadosFinanceiros, Meta } from './tipos';

export type SituacaoDaMeta = 'concluida' | 'completa' | 'parcial' | 'sem_verba';

export interface PlanoDaMeta {
  meta: Meta;
  /** Guardado pela foto de segunda-feira (D3); é o que entra no cálculo da semana. */
  guardadoInicioSemanaCentavos: Centavos;
  guardadoAtualCentavos: Centavos;
  /** Guardado hoje ÷ alvo, em percentual inteiro para baixo, de 0 a 100. */
  progressoPercentual: number;
  faltaCentavos: Centavos;
  /** Meses de calendário da segunda-feira até o prazo (D1). */
  mesesAtePrazo: { inteiros: number; diasRestantes: number; diasDoMes: number };
  necessarioMensalCentavos: Centavos;
  alocadoMensalCentavos: Centavos;
  aporteSemanalCentavos: Centavos;
  aportadoNaSemanaCentavos: Centavos;
  /** Aporte da semana menos o que já foi guardado nela, com mínimo zero. */
  faltaGuardarNaSemanaCentavos: Centavos;
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
  aportadoNaSemanaCentavos: Centavos;
  faltaGuardarNaSemanaCentavos: Centavos;
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

/** Semanas de `segunda` até a semana do prazo, contando as duas, com mínimo de 1. */
function semanasAtePrazo(segunda: DataCivil, prazo: DataCivil): number {
  return Math.max(1, diferencaEmDias(segunda, inicioDaSemana(prazo)) / 7 + 1);
}

/**
 * Aporte semanal da regra 3.3: mensal × 12 ÷ 52, para cima em reais inteiros. Exceção aprovada
 * pelo Paulo em 05/11/2026: a menos de um mês do prazo (ou com ele vencido) e com verba completa,
 * o aporte é o que falta ÷ semanas até o prazo, para a meta terminar no prazo. Com a regra da spec,
 * a semana pediria só 12/52 do que falta e, recalculada toda semana, a meta nunca terminaria.
 */
function aporteSemanal(
  alocado: Centavos,
  situacao: SituacaoDaMeta,
  falta: Centavos,
  ultimoMes: boolean,
  segunda: DataCivil,
  prazo: DataCivil,
): Centavos {
  if (ultimoMes && situacao === 'completa') {
    return paraCimaEmReais(dividir(falta, semanasAtePrazo(segunda, prazo), 'cima'));
  }
  return paraCimaEmReais(proporcao(alocado, 12, 52, 'cima'));
}

function progresso(guardado: Centavos, alvo: Centavos): number {
  if (alvo <= 0) return 100;
  return Math.min(100, Math.max(0, proporcao(guardado, 100, alvo, 'baixo')));
}

/**
 * Regra 3.3: distribui a verba do mês entre as metas, por prioridade e, no empate, pelo prazo
 * mais próximo. A semana usa a segunda-feira como referência (D3): os meses até o prazo e o
 * guardado são contados a partir dela, para o valor não mudar ao longo da semana.
 *
 * `dadosAte` é o dia até onde há dados reais; a simulação do plano o usa para calcular semanas
 * futuras sem tratar o mês de hoje, pela metade, como mês encerrado.
 */
export function planoDasMetas(
  dados: DadosFinanceiros,
  hoje: DataCivil,
  competencia: Competencia = competenciaDe(inicioDaSemana(hoje)),
  dadosAte: DataCivil = hoje,
): PlanoDasMetas {
  const segunda = inicioDaSemana(hoje);
  const orcamento = orcamentoDoMes(dados, competencia, dadosAte);
  const verba = Math.max(0, orcamento.livreCentavos - orcamento.estimativaVariaveis.valorCentavos);

  let restante = verba;
  const metas = [...dados.metas].sort(compararPrioridade).map((meta): PlanoDaMeta => {
    const destino = { destino: 'meta', metaId: meta.id } as const;
    const guardadoInicio = saldoNoInicioDaSemana(dados.movimentos, destino, segunda, hoje);
    const falta = Math.max(0, meta.alvoCentavos - guardadoInicio);
    const meses = mesesDeCalendario(segunda, meta.prazo);
    const guardadoAtual = saldoEm(dados.movimentos, destino, hoje);
    const aportado = aportesEntre(dados.movimentos, destino, segunda, hoje);
    const base = {
      meta,
      guardadoInicioSemanaCentavos: guardadoInicio,
      guardadoAtualCentavos: guardadoAtual,
      progressoPercentual: progresso(guardadoAtual, meta.alvoCentavos),
      faltaCentavos: falta,
      mesesAtePrazo: meses,
      aportadoNaSemanaCentavos: aportado,
      prazoVencido: false,
    };

    if (meta.concluidaEm !== null || falta === 0) {
      return {
        ...base,
        necessarioMensalCentavos: 0,
        alocadoMensalCentavos: 0,
        aporteSemanalCentavos: 0,
        faltaGuardarNaSemanaCentavos: 0,
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

    const ultimoMes = meses.inteiros === 0;
    const aporte = aporteSemanal(alocado, situacao, falta, ultimoMes, segunda, meta.prazo);
    return {
      ...base,
      prazoVencido: meta.prazo < hoje,
      necessarioMensalCentavos: necessario,
      alocadoMensalCentavos: alocado,
      aporteSemanalCentavos: aporte,
      faltaGuardarNaSemanaCentavos: Math.max(0, aporte - aportado),
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
    aportadoNaSemanaCentavos: somar(metas.map((plano) => plano.aportadoNaSemanaCentavos)),
    faltaGuardarNaSemanaCentavos: somar(metas.map((plano) => plano.faltaGuardarNaSemanaCentavos)),
    metas,
  };
}
