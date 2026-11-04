/**
 * Todas as tabelas do schema public. O meta-teste falha se o banco tiver uma tabela fora desta
 * lista, e o teste de isolamento cobre cada uma delas.
 */
export const TABELAS = [
  'perfis',
  'categorias',
  'documentos',
  'recorrencias',
  'lancamentos',
  'ocorrencias',
  'contas_avulsas',
  'metas',
  'movimentos_reserva',
] as const;

export type Tabela = (typeof TABELAS)[number];
