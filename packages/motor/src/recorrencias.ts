import {
  competenciaDe,
  dataNaCompetencia,
  somarMesesNaCompetencia,
  type Competencia,
  type DataCivil,
} from './datas.js';
import type { Centavos } from './dinheiro.js';
import type { DadosFinanceiros, Ocorrencia, Recorrencia } from './tipos.js';

/** Ocorrência de uma renda ou fixa em um mês: gravada no banco ou apenas prevista. */
export interface OcorrenciaProjetada {
  /** Chave estável: `<recorrenciaId>:<AAAA-MM>`. */
  chave: string;
  recorrencia: Recorrencia;
  competencia: Competencia;
  vencimento: DataCivil;
  valorCentavos: Centavos;
  status: Ocorrencia['status'];
  pagoEm: DataCivil | null;
  /** Id da linha em `ocorrencias`, ou null se ainda não foi gravada. */
  ocorrenciaId: string | null;
}

export function chaveDaOcorrencia(recorrenciaId: string, competencia: Competencia): string {
  return `${recorrenciaId}:${competencia}`;
}

/**
 * Projeta as ocorrências de rendas ou fixas com vencimento entre `de` e `ate` (inclusive).
 * Com `de` nulo, começa no início de cada recorrência. Uma ocorrência gravada prevalece sobre a
 * prevista; recorrência inativa só aparece pelas ocorrências já pagas ou recebidas.
 */
export function projetarOcorrencias(
  dados: DadosFinanceiros,
  tipo: Recorrencia['tipo'],
  de: DataCivil | null,
  ate: DataCivil,
): OcorrenciaProjetada[] {
  const gravadas = new Map<string, Ocorrencia>();
  for (const ocorrencia of dados.ocorrencias) {
    gravadas.set(chaveDaOcorrencia(ocorrencia.recorrenciaId, ocorrencia.competencia), ocorrencia);
  }

  const resultado: OcorrenciaProjetada[] = [];
  for (const recorrencia of dados.recorrencias) {
    if (recorrencia.tipo !== tipo) continue;

    const competenciasGravadas = dados.ocorrencias
      .filter((ocorrencia) => ocorrencia.recorrenciaId === recorrencia.id)
      .map((ocorrencia) => ocorrencia.competencia);
    const primeira = [competenciaDe(de ?? recorrencia.inicio), ...competenciasGravadas].reduce(
      (menor, atual) => (atual < menor ? atual : menor),
    );
    const ultima = competenciaDe(ate);

    for (
      let competencia = de === null ? primeira : competenciaDe(de);
      competencia <= ultima;
      competencia = somarMesesNaCompetencia(competencia, 1)
    ) {
      const vencimento = dataNaCompetencia(competencia, recorrencia.dia);
      if ((de !== null && vencimento < de) || vencimento > ate) continue;

      const chave = chaveDaOcorrencia(recorrencia.id, competencia);
      const gravada = gravadas.get(chave);
      if (gravada) {
        if (!recorrencia.ativa && gravada.status === 'pendente') continue;
        resultado.push({
          chave,
          recorrencia,
          competencia,
          vencimento,
          valorCentavos: gravada.valorCentavos,
          status: gravada.status,
          pagoEm: gravada.pagoEm,
          ocorrenciaId: gravada.id,
        });
        continue;
      }

      const dentroDaVigencia =
        vencimento >= recorrencia.inicio &&
        (recorrencia.fim === null || vencimento <= recorrencia.fim);
      if (!recorrencia.ativa || !dentroDaVigencia) continue;

      resultado.push({
        chave,
        recorrencia,
        competencia,
        vencimento,
        valorCentavos: recorrencia.valorCentavos,
        status: 'pendente',
        pagoEm: null,
        ocorrenciaId: null,
      });
    }
  }

  return resultado.sort(
    (a, b) => a.vencimento.localeCompare(b.vencimento) || a.chave.localeCompare(b.chave),
  );
}
