import { dividirInteiros, paraInteiroSeguro } from './aritmetica';
import { CONFIG_SAUDE, type ConfigSaude, type FaixaDeSaude } from './config/saude';
import { entraNaReservaDeContas, listarContas } from './contas';
import {
  competenciaDe,
  diasDaCompetencia,
  lerData,
  primeiroDiaDa,
  somarDias,
  type DataCivil,
} from './datas';
import { somar, type Centavos } from './dinheiro';
import { gastoVariavelEntre, limiteMensal } from './limite';
import { saldoEm } from './movimentos';
import { orcamentoDoMes } from './orcamento';
import type { DadosFinanceiros } from './tipos';

export type ChaveDoComponente = Exclude<keyof ConfigSaude, 'faixas'>;

export interface ComponenteDaSaude {
  chave: ChaveDoComponente;
  nome: string;
  /** Pontos com uma casa decimal (C7). */
  pontos: number;
  /** Os mesmos pontos em décimos inteiros, usados na soma do total. */
  pontosEmDecimos: number;
  pontosMaximos: number;
  /** Medida usada na nota: numerador ÷ denominador, nas unidades da spec. */
  medida: { numeradorCentavos: Centavos; denominadorCentavos: Centavos } | null;
}

export interface IndiceDeSaude {
  /** De 0 a 100, arredondado ao inteiro mais próximo (C7). */
  total: number;
  faixa: FaixaDeSaude;
  nomeDaFaixa: string;
  componentes: ComponenteDaSaude[];
}

interface Limites {
  peso: number;
  notaMaxima: number;
  notaZero: number;
}

/**
 * Pontua a medida `a ÷ b` (b > 0) entre os limites, em décimos de ponto, com interpolação linear
 * em aritmética inteira. Quando notaMaxima < notaZero, quanto menor a medida, melhor.
 */
function pontuarEmDecimos(a: bigint, b: bigint, limites: Limites): number {
  const total = limites.peso * 10;
  const medida = a * 10_000n;
  const maxima = BigInt(limites.notaMaxima) * b;
  const zero = BigInt(limites.notaZero) * b;
  const menorEhMelhor = limites.notaMaxima < limites.notaZero;

  if (menorEhMelhor ? medida <= maxima : medida >= maxima) return total;
  if (menorEhMelhor ? medida >= zero : medida <= zero) return 0;

  const numerador = BigInt(total) * (menorEhMelhor ? zero - medida : medida - zero);
  const denominador = menorEhMelhor ? zero - maxima : maxima - zero;
  return paraInteiroSeguro(dividirInteiros(numerador, denominador, 'proximo'));
}

function componente(
  chave: ChaveDoComponente,
  decimos: number,
  medida: ComponenteDaSaude['medida'],
): ComponenteDaSaude {
  return {
    chave,
    nome: CONFIG_SAUDE[chave].nome,
    pontos: decimos / 10,
    pontosEmDecimos: decimos,
    pontosMaximos: CONFIG_SAUDE[chave].peso,
    medida,
  };
}

/** Regra 3.5: índice de 0 a 100. Sem renda no mês, não há índice (C8). */
export function indiceDeSaude(dados: DadosFinanceiros, hoje: DataCivil): IndiceDeSaude | null {
  const competencia = competenciaDe(hoje);
  const orcamento = orcamentoDoMes(dados, competencia);
  const renda = orcamento.rendaCentavos;
  if (renda <= 0) return null;

  const config = CONFIG_SAUDE;
  const variaveis = orcamento.estimativaVariaveis.valorCentavos;
  const compromissos = orcamento.fixasCentavos + orcamento.contasAvulsasCentavos;
  const componentes: ComponenteDaSaude[] = [];
  const pontuar = (chave: ChaveDoComponente, a: Centavos, b: Centavos) =>
    componente(chave, pontuarEmDecimos(BigInt(a), BigInt(b), config[chave]), {
      numeradorCentavos: a,
      denominadorCentavos: b,
    });

  componentes.push(pontuar('compromissoDaRenda', compromissos, renda));
  componentes.push(pontuar('capacidadeDePoupar', orcamento.livreCentavos - variaveis, renda));

  const emergencia = dados.metas.find((meta) => meta.tipo === 'emergencia');
  const guardado = emergencia
    ? saldoEm(dados.movimentos, { destino: 'meta', metaId: emergencia.id }, hoje)
    : 0;
  const custoMensal = orcamento.fixasCentavos + variaveis;
  componentes.push(
    custoMensal > 0
      ? pontuar('reservaDeEmergencia', guardado, custoMensal)
      : componente(
          'reservaDeEmergencia',
          guardado > 0 ? config.reservaDeEmergencia.peso * 10 : 0,
          null,
        ),
  );

  const vencido = somar(
    listarContas(dados, null, somarDias(hoje, -1))
      .filter((conta) => entraNaReservaDeContas(conta) && conta.pagoEm === null)
      .map((conta) => conta.valorCentavos),
  );
  componentes.push(
    compromissos > 0
      ? pontuar('contasEmDia', vencido, compromissos)
      : componente('contasEmDia', vencido === 0 ? config.contasEmDia.peso * 10 : 0, null),
  );

  // Ritmo = gasto ÷ (limite × fração do mês decorrida), com fração mínima de 7 dias (C8).
  const limite = limiteMensal(dados, competencia, hoje);
  const gasto = gastoVariavelEntre(dados, primeiroDiaDa(competencia), hoje);
  const diasDoMes = diasDaCompetencia(competencia);
  const diasDecorridos = Math.max(lerData(hoje).dia, config.ritmoDeGastos.diasMinimosDecorridos);
  componentes.push(
    limite > 0
      ? componente(
          'ritmoDeGastos',
          pontuarEmDecimos(
            BigInt(gasto) * BigInt(diasDoMes),
            BigInt(limite) * BigInt(Math.min(diasDecorridos, diasDoMes)),
            config.ritmoDeGastos,
          ),
          { numeradorCentavos: gasto, denominadorCentavos: limite },
        )
      : componente('ritmoDeGastos', gasto === 0 ? config.ritmoDeGastos.peso * 10 : 0, null),
  );

  const decimos = componentes.reduce((soma, item) => soma + item.pontosEmDecimos, 0);
  const total = paraInteiroSeguro(dividirInteiros(BigInt(decimos), 10n, 'proximo'));
  const faixa = config.faixas.find((item) => total >= item.minimo) ?? config.faixas[3];
  return { total, faixa: faixa.faixa, nomeDaFaixa: faixa.nome, componentes };
}
