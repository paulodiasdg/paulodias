import { CONFIG_SAUDE } from './config/saude';
import {
  competenciaDe,
  diasDaCompetencia,
  lerData,
  primeiroDiaDa,
  type Competencia,
  type DataCivil,
} from './datas';
import { proporcao, type Centavos } from './dinheiro';
import { gastoVariavelEntre, limiteMensal } from './limite';
import type { DadosFinanceiros } from './tipos';

export interface RitmoDoMes {
  competencia: Competencia;
  limiteMensalCentavos: Centavos;
  gastoNoMesCentavos: Centavos;
  /** Dias decorridos do mês, contando hoje, com o mínimo de 7 dias (C8). */
  diasConsiderados: number;
  diasDoMes: number;
  /** Quanto o limite permitia gastar até hoje: limite × dias ÷ dias do mês, para baixo. */
  esperadoAteHojeCentavos: Centavos;
  /** Gasto maior que o esperado até hoje; com limite zero, qualquer gasto. */
  acimaDoRitmo: boolean;
}

/**
 * Ritmo de gastos do mês: gasto ÷ (limite × fração do mês decorrida). É a medida do índice de
 * saúde (3.5) e do alerta "gasto acima do ritmo" do painel.
 */
export function ritmoDoMes(dados: DadosFinanceiros, hoje: DataCivil): RitmoDoMes {
  const competencia = competenciaDe(hoje);
  const limite = limiteMensal(dados, competencia, hoje);
  const gasto = gastoVariavelEntre(dados, primeiroDiaDa(competencia), hoje);
  const diasDoMes = diasDaCompetencia(competencia);
  const dias = Math.min(
    diasDoMes,
    Math.max(lerData(hoje).dia, CONFIG_SAUDE.ritmoDeGastos.diasMinimosDecorridos),
  );
  return {
    competencia,
    limiteMensalCentavos: limite,
    gastoNoMesCentavos: gasto,
    diasConsiderados: dias,
    diasDoMes,
    esperadoAteHojeCentavos: proporcao(limite, dias, diasDoMes, 'baixo'),
    // Comparação exata, sem arredondar o esperado: gasto × dias do mês > limite × dias.
    acimaDoRitmo:
      limite > 0 ? BigInt(gasto) * BigInt(diasDoMes) > BigInt(limite) * BigInt(dias) : gasto > 0,
  };
}
