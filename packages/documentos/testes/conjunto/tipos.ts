// Tipos do conjunto de teste: o gabarito de cada documento e a forma de gerá-lo.

export type Formato = 'pdf_texto' | 'pdf_digitalizado' | 'foto' | 'csv' | 'ofx' | 'xlsx';
export type TipoDeDocumento =
  'comprovante' | 'boleto' | 'fatura_cartao' | 'extrato' | 'contracheque';

export interface LancamentoEsperado {
  data: string;
  valorCentavos: number;
  tipo: 'despesa' | 'receita' | 'transferencia';
  /** Só para quem lê o gabarito; a avaliação não confere a descrição. */
  descricao: string;
}

/** O que a leitura precisa achar no documento. A avaliação confere valores e datas. */
export interface Gabarito {
  arquivo: string;
  formato: Formato;
  tipo: TipoDeDocumento;
  conta: { valorCentavos: number; vencimento: string } | null;
  lancamentos: LancamentoEsperado[];
}

export interface AjustesDaFoto {
  /** Giro em graus. */
  angulo: number;
  /** Desfoque (sigma). */
  desfoque: number;
  /** Brilho: 1 é o original. */
  brilho: number;
  /** Qualidade do JPEG, de 1 a 100. */
  qualidade: number;
  /** Intensidade do ruído, de 0 a 1. */
  ruido: number;
  /** Cor da mesa em volta do papel. */
  fundo: string;
  semente: number;
}

export type Saida =
  | { como: 'pdf'; html: string }
  | { como: 'digitalizado'; html: string; largura: number; semente: number }
  | { como: 'foto'; html: string; largura: number; ajustes: AjustesDaFoto }
  | { como: 'arquivo'; conteudo: Buffer }
  | { como: 'xlsx'; linhas: (string | number | Date | null)[][]; larguras: number[] };

export interface DefinicaoDeDocumento {
  gabarito: Gabarito;
  saida: () => Promise<Saida>;
}
