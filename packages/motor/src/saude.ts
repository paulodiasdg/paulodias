import { dividirInteiros, paraInteiroSeguro } from './aritmetica';
import { CONFIG_SAUDE, type ConfigSaude, type FaixaDeSaude } from './config/saude';
import { contasVencidas } from './contas';
import { competenciaDe, type DataCivil } from './datas';
import { somar, type Centavos } from './dinheiro';
import { saldoEm } from './movimentos';
import { orcamentoDoMes } from './orcamento';
import { ritmoDoMes } from './ritmo';
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
  /** A medida para exibir, em décimos: 442 é 44,2% e 15 é 1,5 mês. Null quando não há medida. */
  exibicao: MedidaParaExibir | null;
  /** Limites da linha da tabela 3.5, nas mesmas unidades da exibição. */
  limites: { notaMaxima: MedidaParaExibir; notaZero: MedidaParaExibir };
}

export interface MedidaParaExibir {
  unidade: 'percentual' | 'meses';
  decimos: number;
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

function unidadeDo(chave: ChaveDoComponente): MedidaParaExibir['unidade'] {
  return chave === 'reservaDeEmergencia' ? 'meses' : 'percentual';
}

/** Pontos-base (10.000 = 100% ou 1 mês) em décimos da unidade de exibição. */
function dePontosBase(chave: ChaveDoComponente, pontosBase: number): MedidaParaExibir {
  const unidade = unidadeDo(chave);
  return {
    unidade,
    decimos: paraInteiroSeguro(
      dividirInteiros(BigInt(pontosBase), unidade === 'meses' ? 1000n : 10n, 'proximo'),
    ),
  };
}

/** A razão a ÷ b (b > 0) em décimos de percentual ou de mês, ao mais próximo. */
function razaoParaExibir(chave: ChaveDoComponente, a: bigint, b: bigint): MedidaParaExibir {
  const unidade = unidadeDo(chave);
  const escala = unidade === 'meses' ? 10n : 1000n;
  return { unidade, decimos: paraInteiroSeguro(dividirInteiros(a * escala, b, 'proximo')) };
}

function componente(
  chave: ChaveDoComponente,
  decimos: number,
  medida: ComponenteDaSaude['medida'],
  exibicao: MedidaParaExibir | null,
): ComponenteDaSaude {
  const config = CONFIG_SAUDE[chave];
  return {
    chave,
    nome: config.nome,
    pontos: decimos / 10,
    pontosEmDecimos: decimos,
    pontosMaximos: config.peso,
    medida,
    exibicao,
    limites: {
      notaMaxima: dePontosBase(chave, config.notaMaxima),
      notaZero: dePontosBase(chave, config.notaZero),
    },
  };
}

/** Regra 3.5: índice de 0 a 100. Sem renda no mês, não há índice (C8). */
export function indiceDeSaude(dados: DadosFinanceiros, hoje: DataCivil): IndiceDeSaude | null {
  const competencia = competenciaDe(hoje);
  const orcamento = orcamentoDoMes(dados, competencia, hoje);
  const renda = orcamento.rendaCentavos;
  if (renda <= 0) return null;

  const config = CONFIG_SAUDE;
  const variaveis = orcamento.estimativaVariaveis.valorCentavos;
  const compromissos = orcamento.fixasCentavos + orcamento.contasAvulsasCentavos;
  const componentes: ComponenteDaSaude[] = [];
  const pontuar = (chave: ChaveDoComponente, a: Centavos, b: Centavos) =>
    componente(
      chave,
      pontuarEmDecimos(BigInt(a), BigInt(b), config[chave]),
      { numeradorCentavos: a, denominadorCentavos: b },
      razaoParaExibir(chave, BigInt(a), BigInt(b)),
    );

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
          null,
        ),
  );

  const vencido = somar(contasVencidas(dados, hoje).map((conta) => conta.valorCentavos));
  componentes.push(
    compromissos > 0
      ? pontuar('contasEmDia', vencido, compromissos)
      : componente('contasEmDia', vencido === 0 ? config.contasEmDia.peso * 10 : 0, null, null),
  );

  // Ritmo = gasto ÷ (limite × fração do mês decorrida), com fração mínima de 7 dias (C8).
  const ritmo = ritmoDoMes(dados, hoje);
  const gasto = ritmo.gastoNoMesCentavos;
  const limite = ritmo.limiteMensalCentavos;
  const numeradorDoRitmo = BigInt(gasto) * BigInt(ritmo.diasDoMes);
  const denominadorDoRitmo = BigInt(limite) * BigInt(ritmo.diasConsiderados);
  componentes.push(
    limite > 0
      ? componente(
          'ritmoDeGastos',
          pontuarEmDecimos(numeradorDoRitmo, denominadorDoRitmo, config.ritmoDeGastos),
          { numeradorCentavos: gasto, denominadorCentavos: limite },
          razaoParaExibir('ritmoDeGastos', numeradorDoRitmo, denominadorDoRitmo),
        )
      : componente('ritmoDeGastos', gasto === 0 ? config.ritmoDeGastos.peso * 10 : 0, null, null),
  );

  const decimos = componentes.reduce((soma, item) => soma + item.pontosEmDecimos, 0);
  const total = paraInteiroSeguro(dividirInteiros(BigInt(decimos), 10n, 'proximo'));
  const faixa = config.faixas.find((item) => total >= item.minimo) ?? config.faixas[3];
  return { total, faixa: faixa.faixa, nomeDaFaixa: faixa.nome, componentes };
}
