import { fimDaSemana, inicioDaSemana, competenciaDe, type DataCivil } from './datas.js';
import type { Centavos } from './dinheiro.js';
import { limiteDeGastos, type LimiteDeGastos } from './limite.js';
import { planoDasMetas, type PlanoDasMetas } from './metas.js';
import { orcamentoDoMes, type OrcamentoDoMes } from './orcamento.js';
import { calcularReservaContas, type ReservaDeContas } from './reserva-contas.js';
import { indiceDeSaude, type IndiceDeSaude } from './saude.js';
import type { DadosFinanceiros } from './tipos.js';

export interface ResumoDaSemana {
  hoje: DataCivil;
  semana: { inicio: DataCivil; fim: DataCivil };
  /** Valor a reservar na semana: contas + metas (topo do painel). */
  totalAReservarCentavos: Centavos;
  reservaDeContas: ReservaDeContas;
  metas: PlanoDasMetas;
  /** Orçamento do mês de hoje. */
  orcamento: OrcamentoDoMes;
  limite: LimiteDeGastos;
  saude: IndiceDeSaude | null;
}

/** Tudo o que o painel mostra para a semana de `hoje`. */
export function resumoDaSemana(dados: DadosFinanceiros, hoje: DataCivil): ResumoDaSemana {
  const reservaDeContas = calcularReservaContas(dados, hoje);
  const metas = planoDasMetas(dados, hoje);
  return {
    hoje,
    semana: { inicio: inicioDaSemana(hoje), fim: fimDaSemana(hoje) },
    totalAReservarCentavos: reservaDeContas.valorSemanalCentavos + metas.aporteSemanalCentavos,
    reservaDeContas,
    metas,
    orcamento: orcamentoDoMes(dados, competenciaDe(hoje)),
    limite: limiteDeGastos(dados, hoje),
    saude: indiceDeSaude(dados, hoje),
  };
}
