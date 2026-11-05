import type {
  Comparacao503020,
  DivisaoDoMes,
  MedidaParaExibir,
  ResumoDaSemana,
  SemanaDoPlano,
  SemanaPassada,
} from '@no-azul/motor';
import {
  formatarData,
  formatarDecimos,
  formatarMesesDecimos,
  formatarPercentualDecimos,
  formatarReais,
} from '../src/lib/formatacao';

/**
 * Números que cada tela deve mostrar, calculados aqui a partir do motor, com a mesma chave que a
 * tela põe em `data-valor` (reais) ou `data-numero` (os demais). O teste de aceite compara um a um.
 */
export type Esperados = Map<string, string>;

function novo() {
  const esperados: Esperados = new Map();
  return {
    esperados,
    reais: (chave: string, centavos: number) => esperados.set(chave, formatarReais(centavos)),
    numero: (chave: string, texto: string) => esperados.set(chave, texto),
  };
}

function medida(m: MedidaParaExibir): string {
  return m.unidade === 'meses'
    ? formatarMesesDecimos(m.decimos)
    : formatarPercentualDecimos(m.decimos);
}

export function esperadosDoPainel(resumo: ResumoDaSemana): Esperados {
  const { esperados, reais, numero } = novo();
  const { reservaDeContas: contas, metas, gastos, limite } = resumo;

  // 1. Valor a reservar na semana
  reais('reserva.total', resumo.totalAReservarCentavos);
  reais('reserva.contas', contas.valorSemanalCentavos);
  for (const plano of metas.metas) {
    if (plano.aporteSemanalCentavos > 0) {
      reais(`reserva.meta.${plano.meta.id}`, plano.aporteSemanalCentavos);
    }
  }
  reais('reserva.guardado', resumo.guardadoNaSemanaCentavos);
  if (resumo.faltaGuardarNaSemanaCentavos > 0) {
    reais('reserva.falta', resumo.faltaGuardarNaSemanaCentavos);
  }
  if (contas.dataLimite) numero('reserva.data-limite', formatarData(contas.dataLimite));
  const critica = contas.semanaCritica === null ? null : contas.semanas[contas.semanaCritica - 1]!;
  if (critica && critica.numero > 1) {
    reais('reserva.critica.acumulado', critica.acumuladoCentavos);
    reais('reserva.saldo-inicio', contas.saldoInicioSemanaCentavos);
  }

  // 2. Alertas
  for (const alerta of resumo.alertas) {
    if (alerta.tipo === 'conta_vencida') reais('alerta.vencidas.total', alerta.totalCentavos);
    if (alerta.tipo === 'meta_sem_verba') {
      for (const plano of alerta.metas) {
        reais(`alerta.meta.${plano.meta.id}.alocado`, plano.alocadoMensalCentavos);
        reais(`alerta.meta.${plano.meta.id}.necessario`, plano.necessarioMensalCentavos);
      }
    }
    if (alerta.tipo === 'gasto_acima_do_ritmo') {
      reais('alerta.ritmo.gasto', alerta.ritmo.gastoNoMesCentavos);
      reais('alerta.ritmo.esperado', alerta.ritmo.esperadoAteHojeCentavos);
    }
  }

  // 3. Gastos da semana
  reais('gastos.total', gastos.totalCentavos);
  reais('gastos.limite', gastos.limiteSemanalCentavos);
  if (gastos.acimaDoLimiteCentavos > 0) reais('gastos.acima', gastos.acimaDoLimiteCentavos);
  else reais('gastos.disponivel', gastos.disponivelNaSemanaCentavos);
  reais('limite.gasto-mes', limite.gastoNoMesCentavos);
  reais('limite.mensal', limite.limiteMensalCentavos);
  reais('limite.por-dia', limite.disponivelPorDiaCentavos);
  for (const item of gastos.porCategoria) {
    reais(`gastos.categoria.${item.categoriaId ?? 'sem'}`, item.valorCentavos);
  }
  for (const semana of gastos.semanasAnteriores) {
    reais(`gastos.semana.${semana.inicio}`, semana.gastoCentavos);
  }
  if (gastos.semanasAnteriores.length > 0 && gastos.mediaDasAnterioresCentavos !== null) {
    reais('gastos.media', gastos.mediaDasAnterioresCentavos);
  }

  // 4. Contas dos próximos 14 dias
  for (const conta of resumo.proximasContas) reais(`conta.${conta.chave}`, conta.valorCentavos);

  // 5. Metas
  for (const plano of metas.metas) {
    reais(`meta.${plano.meta.id}.guardado`, plano.guardadoAtualCentavos);
    reais(`meta.${plano.meta.id}.alvo`, plano.meta.alvoCentavos);
    numero(`meta.${plano.meta.id}.progresso`, `${plano.progressoPercentual}%`);
  }

  // 6. Saúde financeira
  if (resumo.saude) {
    numero('saude.total', String(resumo.saude.total));
    for (const componente of resumo.saude.componentes) {
      const chave = `saude.${componente.chave}`;
      numero(`${chave}.pontos`, formatarDecimos(componente.pontosEmDecimos));
      numero(`${chave}.maximo`, String(componente.pontosMaximos));
      if (componente.exibicao) numero(`${chave}.medida`, medida(componente.exibicao));
    }
  }

  // 7. Divisão do mês
  adicionarDivisao(resumo.divisaoDoMes, reais, numero);
  return esperados;
}

function adicionarDivisao(
  divisao: DivisaoDoMes,
  reais: (chave: string, centavos: number) => void,
  numero: (chave: string, texto: string) => void,
) {
  reais('divisao.renda', divisao.rendaCentavos);
  for (const parte of divisao.partes) {
    reais(`divisao.${parte.chave}`, parte.valorCentavos);
    numero(`divisao.${parte.chave}.percentual`, `${parte.percentual}%`);
  }
  if (divisao.folgaCentavos < 0) reais('divisao.falta', -divisao.folgaCentavos);
}

export function esperadosDaSemanaPassada(semana: SemanaPassada): Esperados {
  const { esperados, reais } = novo();
  reais('passada.guardado.total', semana.guardadoTotalCentavos);
  reais('passada.guardado.contas', semana.guardadoContasCentavos);
  for (const aporte of semana.guardadoMetas) {
    reais(`passada.guardado.meta.${aporte.metaId}`, aporte.valorCentavos);
  }
  for (const { conta, saiuDaReservaCentavos } of semana.contasPagas) {
    reais(`passada.conta.${conta.chave}`, conta.valorCentavos);
    if (!conta.pagaNoCartao) reais(`passada.conta.${conta.chave}.reserva`, saiuDaReservaCentavos);
  }
  reais('passada.gastos.total', semana.gastos.totalCentavos);
  reais('passada.gastos.limite', semana.gastos.limiteSemanalCentavos);
  for (const item of semana.gastos.porCategoria) {
    reais(`passada.gastos.categoria.${item.categoriaId ?? 'sem'}`, item.valorCentavos);
  }
  return esperados;
}

export function esperadosDaSemanaFutura(semana: SemanaDoPlano): Esperados {
  const { esperados, reais } = novo();
  reais('futura.total', semana.totalCentavos);
  reais('futura.contas', semana.paraContasCentavos);
  for (const aporte of semana.paraMetas)
    reais(`futura.meta.${aporte.metaId}`, aporte.valorCentavos);
  reais('futura.saldo', semana.saldoDeContasNoFimCentavos);
  for (const conta of semana.contas) reais(`futura.conta.${conta.chave}`, conta.valorCentavos);
  return esperados;
}

export function esperadosDoPlanejamento(
  teto: number | null,
  agenda: SemanaDoPlano[],
  projecao: DivisaoDoMes[],
  comparacao: Comparacao503020 | null,
): Esperados {
  const { esperados, reais, numero } = novo();
  if (teto !== null) reais('teto', teto);
  for (const semana of agenda) {
    const chave = `agenda.${semana.inicio}`;
    reais(`${chave}.contas-que-vencem`, semana.contasCentavos);
    reais(`${chave}.contas`, semana.paraContasCentavos);
    reais(`${chave}.metas`, semana.paraMetasCentavos);
    reais(`${chave}.total`, semana.totalCentavos);
    reais(`${chave}.saldo`, semana.saldoDeContasNoFimCentavos);
  }
  for (const mes of projecao) {
    const chave = `projecao.${mes.competencia}`;
    reais(`${chave}.renda`, mes.rendaCentavos);
    reais(`${chave}.fixas`, mes.fixasCentavos);
    reais(`${chave}.contas-avulsas`, mes.contasAvulsasCentavos);
    reais(`${chave}.metas`, mes.metasCentavos);
    reais(`${chave}.variaveis`, mes.variaveisCentavos);
    reais(`${chave}.${mes.folgaCentavos < 0 ? 'falta' : 'folga'}`, Math.abs(mes.folgaCentavos));
  }
  if (comparacao) {
    reais('regra.renda', comparacao.rendaCentavos);
    for (const grupo of comparacao.grupos) {
      reais(`regra.${grupo.chave}`, grupo.valorCentavos);
      numero(`regra.${grupo.chave}.percentual`, `${grupo.percentual}%`);
      reais(`regra.${grupo.chave}.referencia`, grupo.referenciaCentavos);
    }
    if (comparacao.semCategoriaCentavos > 0) {
      reais('regra.sem-categoria', comparacao.semCategoriaCentavos);
      numero('regra.sem-categoria.percentual', `${comparacao.semCategoriaPercentual}%`);
    }
  }
  return esperados;
}
