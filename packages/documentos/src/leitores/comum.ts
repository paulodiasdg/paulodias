import type { Centavos, DataCivil } from '@no-azul/motor';
import { procurarValor, type Achado, type DocumentoDeTexto } from '../documento';
import { datasNoTexto, normalizar, valoresNoTexto } from '../texto';
import type { LancamentoExtraido, NaturezaDaLinha, TipoDeLancamento } from '../tipos';

/** Valor positivo no começo do texto ("R$ 150,00", "150,00", "R$ 1.200,00 à vista"). */
export function valorNoInicio(texto: string): Centavos | null {
  const [primeiro] = valoresNoTexto(texto);
  if (!primeiro) return null;
  const antes = texto.slice(0, primeiro.inicio).replace(/R\$|[:=()\-\s]/g, '');
  return antes === '' ? Math.abs(primeiro.centavos) : null;
}

/** Primeira data completa do texto. */
export function primeiraData(texto: string): DataCivil | null {
  return datasNoTexto(texto)[0]?.data ?? null;
}

/** Texto com letras (para nomes e descrições). */
export function textoComLetras(texto: string): string | null {
  const limpo = texto.replace(/^[:\s-]+/, '').trim();
  return /[a-zA-ZÀ-ú]{2,}/.test(limpo) ? limpo : null;
}

/** Confiança de um campo achado por rótulo: perto do rótulo vale mais. */
export function confiancaDoAchado(achado: Achado<unknown> | null, porAproximacao = false): number {
  if (!achado) return 0;
  const base = achado.confianca;
  return (
    Math.round(base * (porAproximacao ? 0.7 : achado.distancia <= 2 ? 0.95 : 0.85) * 100) / 100
  );
}

export function procurar<T>(
  documento: DocumentoDeTexto,
  rotulos: readonly string[],
  ler: (texto: string) => T | null,
  evitar: readonly string[] = [],
): Achado<T> | null {
  return procurarValor(documento, rotulos, ler, { evitar });
}

/** Primeira linha com letras: costuma ser o nome da empresa ou do banco. */
export function primeiraLinhaComTexto(documento: DocumentoDeTexto): string | null {
  for (const linha of documento.linhas.slice(0, 6)) {
    const texto = linha.celulas[0]?.texto ?? linha.texto;
    if (/[a-zA-ZÀ-ú]{3,}/.test(texto)) return texto.trim();
  }
  return null;
}

export function novoLancamento(
  campos: Pick<LancamentoExtraido, 'data' | 'descricao' | 'valorCentavos' | 'tipo'> &
    Partial<Pick<LancamentoExtraido, 'confianca' | 'natureza' | 'parcela' | 'marcado' | 'avisos'>>,
): LancamentoExtraido {
  return {
    categoria: null,
    confianca: { data: 1, valor: 1 },
    natureza: null,
    parcela: null,
    marcado: true,
    avisos: [],
    ...campos,
  };
}

const TRANSFERENCIA =
  /\b(aplicacao|resgate|transf(erencia)? entre contas|mesma titularidade|investimento|poupanca automatica)\b/;

/** Tipo de uma linha de extrato pela descrição e pelo sinal. */
export function tipoNoExtrato(descricao: string, valorCentavos: Centavos): TipoDeLancamento {
  if (TRANSFERENCIA.test(normalizar(descricao))) return 'transferencia';
  return valorCentavos < 0 ? 'despesa' : 'receita';
}

/** O que uma linha de fatura é: pagamento da fatura anterior, estorno, encargo ou compra. */
export function naturezaNaFatura(
  descricao: string,
  valorCentavos: Centavos,
): { tipo: TipoDeLancamento; natureza: NaturezaDaLinha | null } {
  const texto = normalizar(descricao);
  if (
    /\b(pagamento|pagto|pgto)\b.*\b(recebido|efetuado|fatura|obrigado)\b|^pagamento$|^pagamento\b/.test(
      texto,
    )
  ) {
    return { tipo: 'transferencia', natureza: 'pagamento_de_fatura' };
  }
  if (/\b(estorno|devolucao|reembolso|cashback|credito)\b/.test(texto) || valorCentavos < 0) {
    return { tipo: 'receita', natureza: 'estorno' };
  }
  if (/\b(iof|juros|multa|anuidade|tarifa|encargos?)\b/.test(texto)) {
    return { tipo: 'despesa', natureza: 'encargo' };
  }
  return { tipo: 'despesa', natureza: null };
}

/** Parcela escrita na descrição: "PARC 03/10", "PARCELA 4 DE 6", "02/05" no fim. */
export function parcelaDaDescricao(descricao: string): { atual: number; total: number } | null {
  const texto = normalizar(descricao);
  const achado =
    /\bparc(?:ela)?\.?\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b/.exec(texto) ??
    /(?:^|\s)(\d{1,2})\/(\d{1,2})$/.exec(texto);
  if (!achado?.[1] || !achado[2]) return null;
  const atual = Number(achado[1]);
  const total = Number(achado[2]);
  return atual >= 1 && total >= 2 && atual <= total && total <= 48 ? { atual, total } : null;
}
