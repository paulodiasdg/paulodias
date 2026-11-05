import { alertasDaSemana, type Alerta } from './alertas';
import { listarContas, proximasContas, type Conta } from './contas';
import { competenciaDe, fimDaSemana, inicioDaSemana, somarDias, type DataCivil } from './datas';
import { somar, type Centavos } from './dinheiro';
import { gastosDaSemana, type GastosDaSemana } from './gastos';
import { limiteDeGastos, type LimiteDeGastos } from './limite';
import { planoDasMetas, type PlanoDasMetas } from './metas';
import { aportesEntre } from './movimentos';
import { orcamentoDoMes, type OrcamentoDoMes } from './orcamento';
import { divisaoDoMes, SEMANAS_DA_AGENDA, type AporteNaMeta, type DivisaoDoMes } from './plano';
import { calcularReservaContas, type ReservaDeContas } from './reserva-contas';
import { indiceDeSaude, type IndiceDeSaude } from './saude';
import type { DadosFinanceiros } from './tipos';

export interface ResumoDaSemana {
  hoje: DataCivil;
  semana: { inicio: DataCivil; fim: DataCivil };
  /** Valor a reservar na semana: contas + metas (topo do painel). */
  totalAReservarCentavos: Centavos;
  /** Já guardado na semana, em contas e metas. */
  guardadoNaSemanaCentavos: Centavos;
  /** Soma do que falta guardar na semana em contas e em cada meta. */
  faltaGuardarNaSemanaCentavos: Centavos;
  reservaDeContas: ReservaDeContas;
  metas: PlanoDasMetas;
  /** Orçamento do mês de hoje. */
  orcamento: OrcamentoDoMes;
  limite: LimiteDeGastos;
  saude: IndiceDeSaude | null;
  alertas: Alerta[];
  gastos: GastosDaSemana;
  /** Contas em aberto dos próximos 14 dias, com as vencidas. */
  proximasContas: Conta[];
  divisaoDoMes: DivisaoDoMes;
}

/** Tudo o que o painel mostra para a semana de `hoje`. */
export function resumoDaSemana(dados: DadosFinanceiros, hoje: DataCivil): ResumoDaSemana {
  const reservaDeContas = calcularReservaContas(dados, hoje);
  const metas = planoDasMetas(dados, hoje);
  return {
    hoje,
    semana: { inicio: inicioDaSemana(hoje), fim: fimDaSemana(hoje) },
    totalAReservarCentavos: reservaDeContas.valorSemanalCentavos + metas.aporteSemanalCentavos,
    guardadoNaSemanaCentavos:
      reservaDeContas.aportadoNaSemanaCentavos + metas.aportadoNaSemanaCentavos,
    faltaGuardarNaSemanaCentavos:
      reservaDeContas.faltaGuardarNaSemanaCentavos + metas.faltaGuardarNaSemanaCentavos,
    reservaDeContas,
    metas,
    orcamento: orcamentoDoMes(dados, competenciaDe(hoje), hoje),
    limite: limiteDeGastos(dados, hoje),
    saude: indiceDeSaude(dados, hoje),
    alertas: alertasDaSemana(dados, hoje, metas),
    gastos: gastosDaSemana(dados, hoje),
    proximasContas: proximasContas(dados, hoje),
    divisaoDoMes: divisaoDoMes(dados, hoje),
  };
}

export interface ContaPagaNaSemana {
  conta: Conta;
  /** Quanto saiu da reserva de contas para pagá-la. */
  saiuDaReservaCentavos: Centavos;
}

export interface SemanaPassada {
  semana: { inicio: DataCivil; fim: DataCivil };
  guardadoContasCentavos: Centavos;
  /** Metas que receberam aporte na semana. */
  guardadoMetas: AporteNaMeta[];
  guardadoTotalCentavos: Centavos;
  contasPagas: ContaPagaNaSemana[];
  /** Gastos contra o limite semanal daquela semana, recalculado com os cadastros de hoje. */
  gastos: GastosDaSemana;
}

/** Até quantos dias depois do vencimento se procura uma conta paga antes do prazo. */
const ANTECIPACAO_MAXIMA_EM_DIAS = 400;

/** O que aconteceu em uma semana que já terminou: aportes, contas pagas e gastos. */
export function semanaPassada(dados: DadosFinanceiros, data: DataCivil): SemanaPassada {
  const segunda = inicioDaSemana(data);
  const domingo = fimDaSemana(data);

  const guardadoContas = aportesEntre(dados.movimentos, { destino: 'contas' }, segunda, domingo);
  const guardadoMetas = dados.metas
    .map((meta) => ({
      metaId: meta.id,
      nome: meta.nome,
      valorCentavos: aportesEntre(
        dados.movimentos,
        { destino: 'meta', metaId: meta.id },
        segunda,
        domingo,
      ),
    }))
    .filter((aporte) => aporte.valorCentavos > 0);

  // Uma conta paga na semana pode vencer depois dela, quando foi paga antes do prazo.
  const contasPagas = listarContas(dados, null, somarDias(domingo, ANTECIPACAO_MAXIMA_EM_DIAS))
    .filter((conta) => conta.pagoEm !== null && conta.pagoEm >= segunda && conta.pagoEm <= domingo)
    .map((conta) => ({
      conta,
      saiuDaReservaCentavos: somar(
        dados.movimentos
          .filter(
            (movimento) =>
              movimento.tipo === 'saque' &&
              ((conta.ocorrenciaId !== null && movimento.ocorrenciaId === conta.ocorrenciaId) ||
                (conta.contaAvulsaId !== null && movimento.contaAvulsaId === conta.contaAvulsaId)),
          )
          .map((movimento) => movimento.valorCentavos),
      ),
    }));

  return {
    semana: { inicio: segunda, fim: domingo },
    guardadoContasCentavos: guardadoContas,
    guardadoMetas,
    guardadoTotalCentavos: guardadoContas + somar(guardadoMetas.map((a) => a.valorCentavos)),
    contasPagas,
    gastos: gastosDaSemana(dados, domingo),
  };
}

/** Semanas que o painel deixa visitar: da semana do início do uso até a última da agenda. */
export function semanasNavegaveis(
  dados: DadosFinanceiros,
  hoje: DataCivil,
): { primeira: DataCivil; atual: DataCivil; ultima: DataCivil } {
  const atual = inicioDaSemana(hoje);
  const inicioEm = dados.perfil.inicioEm;
  const primeira = inicioEm && inicioEm < atual ? inicioDaSemana(inicioEm) : atual;
  return { primeira, atual, ultima: somarDias(atual, (SEMANAS_DA_AGENDA - 1) * 7) };
}
