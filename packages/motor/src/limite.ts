import { dividirInteiros, paraInteiroSeguro } from './aritmetica.js';
import {
  competenciaDe,
  diasDaCompetencia,
  fimDaSemana,
  inicioDaSemana,
  lerData,
  primeiroDiaDa,
  somarDias,
  type Competencia,
  type DataCivil,
} from './datas.js';
import { dividir, somar, type Centavos } from './dinheiro.js';
import { planoDasMetas } from './metas.js';
import { ehGastoVariavel, orcamentoDoMes } from './orcamento.js';
import type { DadosFinanceiros } from './tipos.js';

/**
 * Regra 3.4: Limite mensal = min(Teto, Livre − Metas alocadas), com mínimo zero.
 * Sem teto, vale só o segundo termo.
 */
export function limiteMensal(
  dados: DadosFinanceiros,
  competencia: Competencia,
  hoje: DataCivil,
): Centavos {
  const orcamento = orcamentoDoMes(dados, competencia);
  const metas = planoDasMetas(dados, hoje, competencia);
  const semTeto = orcamento.livreCentavos - metas.alocadoMensalCentavos;
  const teto = dados.perfil.tetoVariavelCentavos;
  return Math.max(0, teto === null ? semTeto : Math.min(teto, semTeto));
}

export function gastoVariavelEntre(
  dados: DadosFinanceiros,
  de: DataCivil,
  ate: DataCivil,
): Centavos {
  return somar(
    dados.lancamentos
      .filter((lancamento) => ehGastoVariavel(lancamento))
      .filter((lancamento) => lancamento.data >= de && lancamento.data <= ate)
      .map((lancamento) => lancamento.valorCentavos),
  );
}

export interface LimiteDeGastos {
  competencia: Competencia;
  limiteMensalCentavos: Centavos;
  semana: { inicio: DataCivil; fim: DataCivil };
  /** Limite mensal × 7 ÷ dias do mês, somado dia a dia quando a semana cai em dois meses (C8). */
  limiteSemanalCentavos: Centavos;
  gastoNaSemanaCentavos: Centavos;
  gastoNoMesCentavos: Centavos;
  disponivelNoMesCentavos: Centavos;
  /** Dias de hoje até o fim do mês, contando hoje. */
  diasRestantesNoMes: number;
  /** Quanto ainda pode ser gasto por dia até o fim do mês, para baixo no centavo. */
  disponivelPorDiaCentavos: Centavos;
}

/** Soma o limite diário de cada dia da semana, em fração exata, e arredonda para baixo. */
function limiteDaSemana(dados: DadosFinanceiros, segunda: DataCivil, hoje: DataCivil): Centavos {
  const diasPorMes = new Map<Competencia, number>();
  for (let dia = 0; dia < 7; dia++) {
    const competencia = competenciaDe(somarDias(segunda, dia));
    diasPorMes.set(competencia, (diasPorMes.get(competencia) ?? 0) + 1);
  }

  let numerador = 0n;
  let denominador = 1n;
  for (const [competencia, dias] of diasPorMes) {
    const limite = BigInt(limiteMensal(dados, competencia, hoje));
    const diasDoMes = BigInt(diasDaCompetencia(competencia));
    numerador = numerador * diasDoMes + limite * BigInt(dias) * denominador;
    denominador *= diasDoMes;
  }
  return paraInteiroSeguro(dividirInteiros(numerador, denominador, 'baixo'));
}

export function limiteDeGastos(dados: DadosFinanceiros, hoje: DataCivil): LimiteDeGastos {
  const competencia = competenciaDe(hoje);
  const segunda = inicioDaSemana(hoje);
  const domingo = fimDaSemana(hoje);
  const mensal = limiteMensal(dados, competencia, hoje);

  const { dia } = lerData(hoje);
  const diasRestantes = diasDaCompetencia(competencia) - dia + 1;
  const gastoNoMes = gastoVariavelEntre(dados, primeiroDiaDa(competencia), hoje);
  const disponivel = Math.max(0, mensal - gastoNoMes);

  return {
    competencia,
    limiteMensalCentavos: mensal,
    semana: { inicio: segunda, fim: domingo },
    limiteSemanalCentavos: limiteDaSemana(dados, segunda, hoje),
    gastoNaSemanaCentavos: gastoVariavelEntre(dados, segunda, domingo),
    gastoNoMesCentavos: gastoNoMes,
    disponivelNoMesCentavos: disponivel,
    diasRestantesNoMes: diasRestantes,
    disponivelPorDiaCentavos: dividir(disponivel, diasRestantes, 'baixo'),
  };
}
