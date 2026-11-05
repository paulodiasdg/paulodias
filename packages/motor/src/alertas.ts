import { contasVencidas, type Conta } from './contas';
import type { DataCivil } from './datas';
import { somar, type Centavos } from './dinheiro';
import { planoDasMetas, type PlanoDaMeta, type PlanoDasMetas } from './metas';
import { ritmoDoMes, type RitmoDoMes } from './ritmo';
import type { DadosFinanceiros } from './tipos';

/** Alertas do painel (seção 2 da spec), na ordem em que aparecem. */
export type Alerta =
  | { tipo: 'conta_vencida'; contas: Conta[]; totalCentavos: Centavos }
  | { tipo: 'meta_prazo_vencido'; metas: PlanoDaMeta[] }
  | { tipo: 'meta_sem_verba'; metas: PlanoDaMeta[] }
  | { tipo: 'gasto_acima_do_ritmo'; ritmo: RitmoDoMes };

/**
 * Alertas da semana de `hoje`:
 * - conta vencida: em aberto, vencimento antes de hoje, sem as fixas pagas no cartão;
 * - meta com prazo vencido e não concluída;
 * - meta sem verba: situação parcial ou sem verba no plano da semana;
 * - gasto acima do ritmo: gasto variável do mês acima de limite × fração do mês (como no índice).
 */
export function alertasDaSemana(
  dados: DadosFinanceiros,
  hoje: DataCivil,
  metas: PlanoDasMetas = planoDasMetas(dados, hoje),
): Alerta[] {
  const alertas: Alerta[] = [];

  const vencidas = contasVencidas(dados, hoje);
  if (vencidas.length > 0) {
    alertas.push({
      tipo: 'conta_vencida',
      contas: vencidas,
      totalCentavos: somar(vencidas.map((conta) => conta.valorCentavos)),
    });
  }

  const comPrazoVencido = metas.metas.filter((plano) => plano.prazoVencido);
  if (comPrazoVencido.length > 0) {
    alertas.push({ tipo: 'meta_prazo_vencido', metas: comPrazoVencido });
  }

  const semVerba = metas.metas.filter(
    (plano) => plano.situacao === 'parcial' || plano.situacao === 'sem_verba',
  );
  if (semVerba.length > 0) alertas.push({ tipo: 'meta_sem_verba', metas: semVerba });

  const ritmo = ritmoDoMes(dados, hoje);
  if (ritmo.acimaDoRitmo) alertas.push({ tipo: 'gasto_acima_do_ritmo', ritmo });

  return alertas;
}
