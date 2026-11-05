import { entraNoOrcamento, listarContas } from './contas';
import {
  competenciaDe,
  primeiroDiaDa,
  somarMesesNaCompetencia,
  ultimoDiaDa,
  type Competencia,
  type DataCivil,
} from './datas';
import { dividir, proporcao, somar, type Centavos } from './dinheiro';
import { projetarOcorrencias } from './recorrencias';
import type { DadosFinanceiros, Lancamento } from './tipos';

/** Sem teto e sem histórico, a estimativa de gastos variáveis é 30% da renda (regra 3.2). */
export const PERCENTUAL_VARIAVEIS_SEM_HISTORICO = 30;

/** Quantos meses completos entram na média de gastos variáveis (regra 3.2). */
export const MESES_DA_MEDIA = 3;

/** Até onde a média procura meses com dados quando não se sabe o início do uso. */
const MESES_MAXIMOS_DE_BUSCA = 24;

export interface EstimativaDeVariaveis {
  valorCentavos: Centavos;
  fonte: 'teto' | 'media' | 'percentual_renda';
  /** Meses usados na média, do mais recente para o mais antigo. */
  mesesUsados: Competencia[];
}

export interface OrcamentoDoMes {
  competencia: Competencia;
  rendaRecorrenteCentavos: Centavos;
  receitasAvulsasCentavos: Centavos;
  rendaCentavos: Centavos;
  fixasCentavos: Centavos;
  contasAvulsasCentavos: Centavos;
  /** Livre = Renda − Fixas − Contas avulsas (pode ser negativo). */
  livreCentavos: Centavos;
  estimativaVariaveis: EstimativaDeVariaveis;
  gastoVariavelCentavos: Centavos;
}

/** Gasto variável é toda despesa sem vínculo com conta ou despesa fixa (regra 3.2). */
export function ehGastoVariavel(lancamento: Lancamento): boolean {
  return (
    lancamento.tipo === 'despesa' &&
    lancamento.ocorrenciaId === null &&
    lancamento.contaAvulsaId === null
  );
}

function noMes(lancamento: Lancamento, competencia: Competencia): boolean {
  return competenciaDe(lancamento.data) === competencia;
}

export function gastoVariavelNoMes(dados: DadosFinanceiros, competencia: Competencia): Centavos {
  return somar(
    dados.lancamentos
      .filter((lancamento) => ehGastoVariavel(lancamento) && noMes(lancamento, competencia))
      .map((lancamento) => lancamento.valorCentavos),
  );
}

/** Mês completo: a pessoa já usava o sistema no primeiro dia dele. */
function mesCompleto(dados: DadosFinanceiros, competencia: Competencia): boolean {
  const inicioEm = dados.perfil.inicioEm;
  return !inicioEm || inicioEm <= primeiroDiaDa(competencia);
}

function estimarVariaveis(
  dados: DadosFinanceiros,
  competencia: Competencia,
  rendaCentavos: Centavos,
  dadosAte: DataCivil | undefined,
): EstimativaDeVariaveis {
  const teto = dados.perfil.tetoVariavelCentavos;
  if (teto !== null) return { valorCentavos: teto, fonte: 'teto', mesesUsados: [] };

  // Só meses encerrados entram na média. Num mês futuro, o mês de hoje (pela metade) e os
  // seguintes ainda não aconteceram, e a estimativa fica igual à do mês de hoje.
  const mesDeHoje = dadosAte === undefined ? null : competenciaDe(dadosAte);
  const referencia = mesDeHoje !== null && mesDeHoje < competencia ? mesDeHoje : competencia;

  const mesesUsados: Competencia[] = [];
  const valores: Centavos[] = [];
  for (
    let passo = 1;
    passo <= MESES_MAXIMOS_DE_BUSCA && mesesUsados.length < MESES_DA_MEDIA;
    passo++
  ) {
    const mes = somarMesesNaCompetencia(referencia, -passo);
    if (!mesCompleto(dados, mes)) break;
    const temDados = dados.lancamentos.some(
      (lancamento) => ehGastoVariavel(lancamento) && noMes(lancamento, mes),
    );
    if (!temDados) continue;
    mesesUsados.push(mes);
    valores.push(gastoVariavelNoMes(dados, mes));
  }

  if (mesesUsados.length > 0) {
    return {
      valorCentavos: dividir(somar(valores), mesesUsados.length, 'proximo'),
      fonte: 'media',
      mesesUsados,
    };
  }
  return {
    valorCentavos: Math.max(
      0,
      proporcao(rendaCentavos, PERCENTUAL_VARIAVEIS_SEM_HISTORICO, 100, 'proximo'),
    ),
    fonte: 'percentual_renda',
    mesesUsados: [],
  };
}

/**
 * Regra 3.2: orçamento de um mês. `dadosAte` é o dia até onde há dados reais (hoje): com ele, a
 * média de gastos variáveis de um mês futuro não usa meses que ainda não terminaram.
 */
export function orcamentoDoMes(
  dados: DadosFinanceiros,
  competencia: Competencia,
  dadosAte?: DataCivil,
): OrcamentoDoMes {
  const primeiroDia = primeiroDiaDa(competencia);
  const ultimoDia = ultimoDiaDa(competencia);

  // Cada renda recorrente entra pelo valor recebido (ocorrência gravada) ou pelo previsto.
  const rendaRecorrente = somar(
    projetarOcorrencias(dados, 'renda', primeiroDia, ultimoDia).map((o) => o.valorCentavos),
  );
  // Receita avulsa é a receita sem vínculo; a ligada a uma renda já está na recorrente.
  const receitasAvulsas = somar(
    dados.lancamentos
      .filter(
        (lancamento) =>
          lancamento.tipo === 'receita' &&
          lancamento.ocorrenciaId === null &&
          lancamento.contaAvulsaId === null &&
          noMes(lancamento, competencia),
      )
      .map((lancamento) => lancamento.valorCentavos),
  );
  const renda = rendaRecorrente + receitasAvulsas;

  const contasDoMes = listarContas(dados, primeiroDia, ultimoDia).filter(entraNoOrcamento);
  const fixas = somar(
    contasDoMes.filter((conta) => conta.origem === 'fixa').map((conta) => conta.valorCentavos),
  );
  const avulsas = somar(
    contasDoMes.filter((conta) => conta.origem === 'avulsa').map((conta) => conta.valorCentavos),
  );

  return {
    competencia,
    rendaRecorrenteCentavos: rendaRecorrente,
    receitasAvulsasCentavos: receitasAvulsas,
    rendaCentavos: renda,
    fixasCentavos: fixas,
    contasAvulsasCentavos: avulsas,
    livreCentavos: renda - fixas - avulsas,
    estimativaVariaveis: estimarVariaveis(dados, competencia, renda, dadosAte),
    gastoVariavelCentavos: gastoVariavelNoMes(dados, competencia),
  };
}
