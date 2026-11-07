import type { Extracao } from './tipos';

/**
 * Avaliação da leitura contra um gabarito (aceite da Etapa 5): cada valor e cada data esperados
 * contam um ponto se vierem exatamente iguais. Linha esperada que não veio e linha a mais contam
 * como erro.
 */

export interface Esperado {
  conta: { valorCentavos: number; vencimento: string } | null;
  lancamentos: { data: string; valorCentavos: number }[];
}

export interface ResultadoDaAvaliacao {
  acertos: number;
  esperados: number;
  /** Campos de linhas que a leitura trouxe a mais. */
  aMais: number;
  /** acertos ÷ (esperados + a mais), de 0 a 1. */
  taxa: number;
  erros: string[];
}

export function avaliar(extracao: Extracao, esperado: Esperado): ResultadoDaAvaliacao {
  let acertos = 0;
  let esperados = 0;
  const erros: string[] = [];

  if (esperado.conta) {
    esperados += 2;
    if (extracao.conta?.valorCentavos === esperado.conta.valorCentavos) acertos++;
    else
      erros.push(
        `conta: valor ${extracao.conta?.valorCentavos ?? 'vazio'}, esperado ${esperado.conta.valorCentavos}`,
      );
    if (extracao.conta?.vencimento === esperado.conta.vencimento) acertos++;
    else
      erros.push(
        `conta: vencimento ${extracao.conta?.vencimento ?? 'vazio'}, esperado ${esperado.conta.vencimento}`,
      );
  }

  // Pareia as linhas: primeiro as que batem em valor e data, depois só no valor, depois só na data.
  const sobrando = [...extracao.lancamentos];
  const faltando: Esperado['lancamentos'] = [];
  const pares: [Esperado['lancamentos'][number], (typeof sobrando)[number]][] = [];
  const passos: ((e: Esperado['lancamentos'][number], l: (typeof sobrando)[number]) => boolean)[] =
    [
      (e, l) => l.valorCentavos === e.valorCentavos && l.data === e.data,
      (e, l) => l.valorCentavos === e.valorCentavos,
      (e, l) => l.data === e.data,
    ];
  let pendentes = [...esperado.lancamentos];
  for (const casa of passos) {
    const restantes: typeof pendentes = [];
    for (const e of pendentes) {
      const indice = sobrando.findIndex((l) => casa(e, l));
      const achado = indice >= 0 ? sobrando.splice(indice, 1)[0] : undefined;
      if (achado) pares.push([e, achado]);
      else restantes.push(e);
    }
    pendentes = restantes;
  }
  faltando.push(...pendentes);

  for (const [e, l] of pares) {
    esperados += 2;
    if (l.valorCentavos === e.valorCentavos) acertos++;
    else erros.push(`${e.data} ${e.valorCentavos}: valor lido ${l.valorCentavos ?? 'vazio'}`);
    if (l.data === e.data) acertos++;
    else erros.push(`${e.data} ${e.valorCentavos}: data lida ${l.data ?? 'vazia'}`);
  }
  for (const e of faltando) {
    esperados += 2;
    erros.push(`${e.data} ${e.valorCentavos}: linha não lida`);
  }
  const aMais = sobrando.length * 2;
  for (const l of sobrando)
    erros.push(`linha a mais: ${l.data ?? 'sem data'} ${l.valorCentavos ?? 'sem valor'}`);

  const base = esperados + aMais;
  return { acertos, esperados, aMais, taxa: base === 0 ? 1 : acertos / base, erros };
}
