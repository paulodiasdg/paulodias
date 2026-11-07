import type { Centavos, DataCivil } from '@no-azul/motor';

/**
 * Resultado da leitura de um documento (formato da seção 4.3 da spec, com os nomes em camelCase).
 * É só uma proposta: fica em `documentos.extracao_json` até a pessoa revisar e aprovar, e nenhum
 * cálculo do motor a lê (regra 6 do CLAUDE.md).
 */

export type TipoDeDocumento =
  'comprovante' | 'boleto' | 'fatura_cartao' | 'extrato' | 'contracheque';

export type FormatoDoArquivo = 'pdf' | 'imagem' | 'csv' | 'ofx' | 'xlsx';

/** Como o texto foi obtido: define o teto da confiança dos campos. */
export type OrigemDoTexto = 'tabela' | 'texto' | 'ocr';

export type TipoDeLancamento = 'despesa' | 'receita' | 'transferencia';

/** O que a linha é dentro do documento, quando a leitura reconhece. */
export type NaturezaDaLinha = 'pagamento_de_fatura' | 'estorno' | 'encargo' | 'parcela';

export interface LancamentoExtraido {
  data: DataCivil | null;
  descricao: string;
  valorCentavos: Centavos | null;
  tipo: TipoDeLancamento;
  /** Slug da categoria sugerida (`categorias.slug`), ou null. */
  categoria: string | null;
  /** Confiança de cada campo, de 0 a 1; abaixo de 0,8 a revisão destaca o campo. */
  confianca: { data: number; valor: number };
  natureza: NaturezaDaLinha | null;
  parcela: { atual: number; total: number } | null;
  /** Se a linha vem marcada para gravar. A revisão pode mudar. */
  marcado: boolean;
  avisos: string[];
}

export interface ContaExtraida {
  nome: string;
  valorCentavos: Centavos | null;
  vencimento: DataCivil | null;
  categoria: string | null;
  confianca: { valor: number; vencimento: number };
  /** Data de fechamento da fatura, quando aparece. */
  fechamento: DataCivil | null;
}

export interface Extracao {
  versao: 1;
  /** Identifica as regras que leram o documento (`documentos.modelo_usado`). */
  leitor: string;
  formato: FormatoDoArquivo;
  origem: OrigemDoTexto;
  tipo: TipoDeDocumento;
  /** O tipo veio da escolha da pessoa no envio. */
  tipoInformado: boolean;
  emissor: string | null;
  /** Mês de referência do contracheque (AAAA-MM). */
  competencia: string | null;
  conta: ContaExtraida | null;
  lancamentos: LancamentoExtraido[];
  avisos: string[];
}

export const LEITOR = 'leitura-local@1';

/** Abaixo disso, o campo fica destacado na revisão (seção 4.4 da spec). */
export const CONFIANCA_MINIMA = 0.8;
