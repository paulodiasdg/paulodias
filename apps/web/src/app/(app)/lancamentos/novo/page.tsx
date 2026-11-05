import type { Metadata } from 'next';
import Link from 'next/link';
import { listarCategorias } from '@/lib/financeiro/consultas';
import { hojeNoBrasil } from '@/lib/formatacao';
import { criarClienteServidor } from '@/lib/supabase/servidor';
import { FormularioLancamento } from '../formulario-lancamento';
import { gruposPorTipo } from '../grupos';

export const metadata: Metadata = { title: 'Novo lançamento · No Azul' };

export default async function PaginaNovoLancamento() {
  const categorias = await listarCategorias(await criarClienteServidor());
  return (
    <>
      <Link href="/lancamentos" className="text-sm text-azul-700 underline">
        Voltar para Lançamentos
      </Link>
      <h1 className="text-2xl font-semibold">Novo lançamento</h1>
      <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-5">
        <FormularioLancamento
          gruposPorTipo={gruposPorTipo(categorias)}
          valores={{
            tipo: 'despesa',
            descricao: '',
            valor: '',
            data: hojeNoBrasil(),
            categoriaId: '',
          }}
        />
      </div>
    </>
  );
}
