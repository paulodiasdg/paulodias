import { entraNaReservaDeContas, listarContas, type Conta } from './contas';
import {
  competenciaDe,
  diaDaSemana,
  diferencaEmDias,
  inicioDaSemana,
  maiorData,
  primeiroDiaDa,
  somarDias,
  somarMesesNaCompetencia,
  type Competencia,
  type DataCivil,
} from './datas';
import { proporcao, type Centavos } from './dinheiro';
import { planoDasMetas, type PlanoDasMetas, type SituacaoDaMeta } from './metas';
import { saldoEm } from './movimentos';
import { pagarConta, registrarAporte } from './operacoes';
import { orcamentoDoMes, type EstimativaDeVariaveis, type OrcamentoDoMes } from './orcamento';
import { calcularReservaContas } from './reserva-contas';
import type { DadosFinanceiros } from './tipos';

/** Semanas da agenda de reservas da tela Planejamento. */
export const SEMANAS_DA_AGENDA = 8;

/** Meses da projeção da tela Planejamento, contando o mês atual. */
export const MESES_DA_PROJECAO = 6;

export interface AporteNaMeta {
  metaId: string;
  nome: string;
  valorCentavos: Centavos;
}

export interface SemanaDoPlano {
  /** 1 é a semana atual. */
  numero: number;
  inicio: DataCivil;
  fim: DataCivil;
  /** Contas da reserva que vencem na semana; na semana atual, também as vencidas. */
  contas: Conta[];
  contasCentavos: Centavos;
  /** Valor que o motor pede para a reserva de contas na semana (regra 3.1). */
  paraContasCentavos: Centavos;
  /** Aporte semanal de cada meta com aporte (regra 3.3). */
  paraMetas: AporteNaMeta[];
  paraMetasCentavos: Centavos;
  totalCentavos: Centavos;
  /** Saldo previsto da reserva de contas no domingo, depois das contas da semana. */
  saldoDeContasNoFimCentavos: Centavos;
  /** Plano das metas da semana, com a verba do mês da segunda-feira. */
  planoDasMetas: PlanoDasMetas;
}

/** Paga, com o dinheiro da reserva, as contas em aberto que vencem até `ate` (as vencidas em `de`). */
function pagarContasAte(dados: DadosFinanceiros, de: DataCivil, ate: DataCivil): DadosFinanceiros {
  const abertas = listarContas(dados, null, ate).filter(
    (conta) => entraNaReservaDeContas(conta) && conta.pagoEm === null,
  );
  return abertas.reduce(
    (atual, conta) => pagarConta(atual, conta, maiorData(conta.vencimento, de)),
    dados,
  );
}

/**
 * Simula o plano a partir de hoje, supondo que a pessoa o segue. Na semana atual, completa hoje o
 * que falta guardar (contas e cada meta) e paga as contas em aberto no vencimento (as vencidas,
 * hoje). Nas seguintes, guarda na segunda-feira o que o motor pedir e paga cada conta da reserva
 * no vencimento. A semana atual mostra os mesmos valores do painel.
 */
export function simularPlano(
  dados: DadosFinanceiros,
  hoje: DataCivil,
  quantidade: number = SEMANAS_DA_AGENDA,
): SemanaDoPlano[] {
  const primeiraSegunda = inicioDaSemana(hoje);
  const semanas: SemanaDoPlano[] = [];
  let simulado = dados;

  for (let indice = 0; indice < quantidade; indice++) {
    const segunda = somarDias(primeiraSegunda, indice * 7);
    const domingo = somarDias(segunda, 6);
    // A semana atual é calculada em hoje; as seguintes, na segunda-feira.
    const referencia = indice === 0 ? hoje : segunda;

    const reserva = calcularReservaContas(simulado, referencia);
    const metas = planoDasMetas(simulado, referencia, competenciaDe(segunda), hoje);

    if (reserva.faltaGuardarNaSemanaCentavos > 0) {
      simulado = registrarAporte(simulado, {
        id: `plano:contas:${segunda}`,
        data: referencia,
        valorCentavos: reserva.faltaGuardarNaSemanaCentavos,
      });
    }
    for (const plano of metas.metas) {
      if (plano.faltaGuardarNaSemanaCentavos <= 0) continue;
      simulado = registrarAporte(simulado, {
        id: `plano:meta:${plano.meta.id}:${segunda}`,
        data: referencia,
        valorCentavos: plano.faltaGuardarNaSemanaCentavos,
        metaId: plano.meta.id,
      });
    }
    simulado = pagarContasAte(simulado, referencia, domingo);

    const semanaDaReserva = reserva.semanas[0]!;
    semanas.push({
      numero: indice + 1,
      inicio: segunda,
      fim: domingo,
      contas: semanaDaReserva.contas,
      contasCentavos: semanaDaReserva.totalCentavos,
      paraContasCentavos: reserva.valorSemanalCentavos,
      paraMetas: metas.metas
        .filter((plano) => plano.aporteSemanalCentavos > 0)
        .map((plano) => ({
          metaId: plano.meta.id,
          nome: plano.meta.nome,
          valorCentavos: plano.aporteSemanalCentavos,
        })),
      paraMetasCentavos: metas.aporteSemanalCentavos,
      totalCentavos: reserva.valorSemanalCentavos + metas.aporteSemanalCentavos,
      saldoDeContasNoFimCentavos: saldoEm(simulado.movimentos, { destino: 'contas' }, domingo),
      planoDasMetas: metas,
    });
  }
  return semanas;
}

/** Agenda de reservas das próximas 8 semanas, começando pela atual. */
export function agendaDeReservas(dados: DadosFinanceiros, hoje: DataCivil): SemanaDoPlano[] {
  return simularPlano(dados, hoje, SEMANAS_DA_AGENDA);
}

export type ChaveDaParte = 'fixas' | 'contasAvulsas' | 'metas' | 'variaveis' | 'folga';

export interface ParteDaDivisao {
  chave: ChaveDaParte;
  valorCentavos: Centavos;
  /**
   * Percentual da renda, ao inteiro mais próximo. Quando os compromissos passam da renda, o
   * percentual é sobre o total comprometido.
   */
  percentual: number;
}

export interface DivisaoDoMes {
  competencia: Competencia;
  rendaCentavos: Centavos;
  fixasCentavos: Centavos;
  contasAvulsasCentavos: Centavos;
  livreCentavos: Centavos;
  /** Verba das metas alocada no mês (regra 3.3). */
  metasCentavos: Centavos;
  /** Estimativa de gastos variáveis do mês (regra 3.2). */
  variaveisCentavos: Centavos;
  fonteDosVariaveis: EstimativaDeVariaveis['fonte'];
  /** Livre − variáveis − metas. Negativa, é o que falta no mês. */
  folgaCentavos: Centavos;
  partes: ParteDaDivisao[];
  metas: {
    metaId: string;
    nome: string;
    alocadoMensalCentavos: Centavos;
    situacao: SituacaoDaMeta;
  }[];
}

function montarDivisao(orcamento: OrcamentoDoMes, metas: PlanoDasMetas): DivisaoDoMes {
  const variaveis = orcamento.estimativaVariaveis.valorCentavos;
  const metasCentavos = metas.alocadoMensalCentavos;
  const folga = orcamento.livreCentavos - variaveis - metasCentavos;
  const comprometido =
    orcamento.fixasCentavos + orcamento.contasAvulsasCentavos + metasCentavos + variaveis;
  const base = Math.max(orcamento.rendaCentavos, comprometido);
  const parte = (chave: ChaveDaParte, valorCentavos: Centavos): ParteDaDivisao => ({
    chave,
    valorCentavos,
    percentual: base > 0 ? proporcao(valorCentavos, 100, base, 'proximo') : 0,
  });

  return {
    competencia: orcamento.competencia,
    rendaCentavos: orcamento.rendaCentavos,
    fixasCentavos: orcamento.fixasCentavos,
    contasAvulsasCentavos: orcamento.contasAvulsasCentavos,
    livreCentavos: orcamento.livreCentavos,
    metasCentavos,
    variaveisCentavos: variaveis,
    fonteDosVariaveis: orcamento.estimativaVariaveis.fonte,
    folgaCentavos: folga,
    partes: [
      parte('fixas', orcamento.fixasCentavos),
      parte('contasAvulsas', orcamento.contasAvulsasCentavos),
      parte('metas', metasCentavos),
      parte('variaveis', variaveis),
      parte('folga', Math.max(0, folga)),
    ],
    metas: metas.metas.map((plano) => ({
      metaId: plano.meta.id,
      nome: plano.meta.nome,
      alocadoMensalCentavos: plano.alocadoMensalCentavos,
      situacao: plano.situacao,
    })),
  };
}

/** Divisão do mês de hoje: fixas, contas avulsas, metas, gastos variáveis e folga (painel, item 7). */
export function divisaoDoMes(dados: DadosFinanceiros, hoje: DataCivil): DivisaoDoMes {
  const competencia = competenciaDe(hoje);
  return montarDivisao(
    orcamentoDoMes(dados, competencia, hoje),
    planoDasMetas(dados, hoje, competencia),
  );
}

function primeiraSegundaDe(competencia: Competencia): DataCivil {
  const primeiroDia = primeiroDiaDa(competencia);
  const dia = diaDaSemana(primeiroDia);
  return dia === 1 ? primeiroDia : somarDias(primeiroDia, 8 - dia);
}

/**
 * Projeção do mês atual e dos seguintes, com a divisão de cada mês. As metas de um mês futuro
 * usam o plano da primeira segunda-feira dele na simulação, com o guardado que a pessoa terá se
 * seguir o plano até lá; meta que termina libera verba para as seguintes.
 */
export function projecaoDeMeses(
  dados: DadosFinanceiros,
  hoje: DataCivil,
  meses: number = MESES_DA_PROJECAO,
): DivisaoDoMes[] {
  const mesAtual = competenciaDe(hoje);
  const projecao = [divisaoDoMes(dados, hoje)];
  if (meses <= 1) return projecao;

  const ultimaSegunda = primeiraSegundaDe(somarMesesNaCompetencia(mesAtual, meses - 1));
  const semanas = simularPlano(
    dados,
    hoje,
    diferencaEmDias(inicioDaSemana(hoje), ultimaSegunda) / 7 + 1,
  );
  for (let passo = 1; passo < meses; passo++) {
    const competencia = somarMesesNaCompetencia(mesAtual, passo);
    const semana = semanas.find((item) => competenciaDe(item.inicio) === competencia)!;
    projecao.push(montarDivisao(orcamentoDoMes(dados, competencia, hoje), semana.planoDasMetas));
  }
  return projecao;
}
