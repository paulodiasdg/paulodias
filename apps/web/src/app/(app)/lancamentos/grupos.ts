import { gruposDeCategorias, type Categoria } from '@/lib/financeiro/consultas';

/** Categorias oferecidas para cada tipo de lançamento. */
export function gruposPorTipo(categorias: Categoria[]) {
  return {
    despesa: gruposDeCategorias(categorias, ['essencial', 'livre']),
    receita: gruposDeCategorias(categorias, ['receita']),
    transferencia: gruposDeCategorias(categorias, ['transferencia']),
  };
}
