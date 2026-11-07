// API pura do pacote: tipos da extração, validação, categorias, cruzamento e avaliação. Pode ser
// usada em qualquer lugar. A leitura dos arquivos (PDF, OCR, planilhas) fica em
// `@no-azul/documentos/leitura` e só roda no servidor.
export { avaliar, type Esperado, type ResultadoDaAvaliacao } from './avaliacao';
export { descricoesParecidas, sugerirCategoria, type CategoriaDoHistorico } from './categorias';
export {
  cruzar,
  DIAS_DA_DUPLICATA,
  DIAS_DO_PAGAMENTO,
  type AcaoDaConta,
  type AcaoDaLinha,
  type ContaSugerida,
  type Cruzamento,
  type RendaSugerida,
  type SugestaoDaConta,
  type SugestaoDaLinha,
} from './cruzamento';
export { detectarFormato, TAMANHO_MAXIMO_BYTES, type ResultadoDoFormato } from './formato';
export {
  CONFIANCA_MINIMA,
  LEITOR,
  type ContaExtraida,
  type Extracao,
  type FormatoDoArquivo,
  type LancamentoExtraido,
  type NaturezaDaLinha,
  type OrigemDoTexto,
  type TipoDeDocumento,
  type TipoDeLancamento,
} from './tipos';
export { mascarar, validarExtracao } from './validacao';
