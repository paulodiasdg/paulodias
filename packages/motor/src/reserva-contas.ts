import { entraNaReservaDeContas, estavaEmAberto, listarContas, type Conta } from './contas';
import { diferencaEmDias, fimDaSemana, inicioDaSemana, somarDias, type DataCivil } from './datas';
import { dividir, paraCimaEmReais, somar, type Centavos } from './dinheiro';
import { aportesEntre, saldoEm, saldoNoInicioDaSemana } from './movimentos';
import type { DadosFinanceiros } from './tipos';

/** Horizonte da regra 3.1: o valor semanal cobre as próximas 8 semanas. */
export const SEMANAS_DO_HORIZONTE = 8;

export interface SemanaDaReserva {
  numero: number;
  inicio: DataCivil;
  fim: DataCivil;
  contas: Conta[];
  totalCentavos: Centavos;
  acumuladoCentavos: Centavos;
  /** (acumulado − saldo do início) ÷ k, arredondado para cima no centavo. */
  necessarioPorSemanaCentavos: Centavos;
}

export interface ReservaDeContas {
  semana: { inicio: DataCivil; fim: DataCivil };
  /** B da regra 3.1, pela foto de segunda-feira (D3). */
  saldoInicioSemanaCentavos: Centavos;
  saldoAtualCentavos: Centavos;
  /** r da regra 3.1: valor a guardar nesta semana, em reais inteiros. */
  valorSemanalCentavos: Centavos;
  aportadoNaSemanaCentavos: Centavos;
  faltaGuardarNaSemanaCentavos: Centavos;
  /** Semana k que define o valor, ou null quando o saldo já cobre as 8 semanas. */
  semanaCritica: number | null;
  /** Domingo da semana crítica: "assim nada vence descoberto até <dataLimite>". */
  dataLimite: DataCivil | null;
  semanas: SemanaDaReserva[];
}

/**
 * Regra 3.1: menor valor semanal constante que evita saldo negativo na reserva de contas nas
 * próximas 8 semanas, supondo que o valor de cada semana é guardado antes das contas dela.
 *
 * Foto de segunda-feira (D3): contas pagas nesta semana continuam na semana original, e o saldo
 * é o de segunda às 00h mais os ajustes feitos até hoje. Assim, registrar a reserva ou pagar uma
 * conta não muda o valor pedido; cadastrar ou alterar uma conta muda.
 */
export function calcularReservaContas(dados: DadosFinanceiros, hoje: DataCivil): ReservaDeContas {
  const segunda = inicioDaSemana(hoje);
  const fimDoHorizonte = somarDias(segunda, SEMANAS_DO_HORIZONTE * 7 - 1);

  const contas = listarContas(dados, null, fimDoHorizonte)
    .filter(entraNaReservaDeContas)
    .filter((conta) => estavaEmAberto(conta, segunda));

  const porSemana: Conta[][] = Array.from({ length: SEMANAS_DO_HORIZONTE }, () => []);
  for (const conta of contas) {
    // Contas vencidas entram na semana 1.
    const indice = Math.max(0, Math.floor(diferencaEmDias(segunda, conta.vencimento) / 7));
    porSemana[indice]!.push(conta);
  }

  const destino = { destino: 'contas' } as const;
  const saldoInicio = saldoNoInicioDaSemana(dados.movimentos, destino, segunda, hoje);

  let acumulado = 0;
  let maiorNecessario = 0;
  let semanaCritica: number | null = null;
  const semanas: SemanaDaReserva[] = porSemana.map((contasDaSemana, indice) => {
    const numero = indice + 1;
    const total = somar(contasDaSemana.map((conta) => conta.valorCentavos));
    acumulado += total;
    const necessario = dividir(acumulado - saldoInicio, numero, 'cima');
    if (necessario > maiorNecessario) {
      maiorNecessario = necessario;
      semanaCritica = numero;
    }
    const inicio = somarDias(segunda, indice * 7);
    return {
      numero,
      inicio,
      fim: somarDias(inicio, 6),
      contas: contasDaSemana,
      totalCentavos: total,
      acumuladoCentavos: acumulado,
      necessarioPorSemanaCentavos: necessario,
    };
  });

  const valorSemanal = paraCimaEmReais(maiorNecessario);
  const aportado = aportesEntre(dados.movimentos, destino, segunda, hoje);
  const critica: number | null = semanaCritica;

  return {
    semana: { inicio: segunda, fim: fimDaSemana(hoje) },
    saldoInicioSemanaCentavos: saldoInicio,
    saldoAtualCentavos: saldoEm(dados.movimentos, destino, hoje),
    valorSemanalCentavos: valorSemanal,
    aportadoNaSemanaCentavos: aportado,
    faltaGuardarNaSemanaCentavos: Math.max(0, valorSemanal - aportado),
    semanaCritica: critica,
    dataLimite: critica === null ? null : semanas[critica - 1]!.fim,
    semanas,
  };
}

export type MotivoDeMudanca =
  | { tipo: 'nova_semana' }
  | { tipo: 'conta_incluida'; conta: Conta }
  | { tipo: 'conta_removida'; conta: Conta }
  | { tipo: 'valor_alterado'; conta: Conta; deCentavos: Centavos; paraCentavos: Centavos }
  | { tipo: 'vencimento_alterado'; conta: Conta; de: DataCivil; para: DataCivil }
  | { tipo: 'saldo_ajustado'; deCentavos: Centavos; paraCentavos: Centavos };

/** Explica por que o valor pedido mudou entre dois cálculos (para o aviso do painel). */
export function motivosDaMudanca(
  antes: ReservaDeContas,
  depois: ReservaDeContas,
): MotivoDeMudanca[] {
  if (antes.semana.inicio !== depois.semana.inicio) return [{ tipo: 'nova_semana' }];

  const motivos: MotivoDeMudanca[] = [];
  const contasAntes = new Map(antes.semanas.flatMap((s) => s.contas).map((c) => [c.chave, c]));
  const contasDepois = new Map(depois.semanas.flatMap((s) => s.contas).map((c) => [c.chave, c]));

  for (const [chave, conta] of contasDepois) {
    const anterior = contasAntes.get(chave);
    if (!anterior) {
      motivos.push({ tipo: 'conta_incluida', conta });
      continue;
    }
    if (anterior.valorCentavos !== conta.valorCentavos) {
      motivos.push({
        tipo: 'valor_alterado',
        conta,
        deCentavos: anterior.valorCentavos,
        paraCentavos: conta.valorCentavos,
      });
    }
    if (anterior.vencimento !== conta.vencimento) {
      motivos.push({
        tipo: 'vencimento_alterado',
        conta,
        de: anterior.vencimento,
        para: conta.vencimento,
      });
    }
  }
  for (const [chave, conta] of contasAntes) {
    if (!contasDepois.has(chave)) motivos.push({ tipo: 'conta_removida', conta });
  }
  if (antes.saldoInicioSemanaCentavos !== depois.saldoInicioSemanaCentavos) {
    motivos.push({
      tipo: 'saldo_ajustado',
      deCentavos: antes.saldoInicioSemanaCentavos,
      paraCentavos: depois.saldoInicioSemanaCentavos,
    });
  }
  return motivos;
}
