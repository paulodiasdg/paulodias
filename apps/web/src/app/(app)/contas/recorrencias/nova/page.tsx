import type { Metadata } from 'next';
import Link from 'next/link';
import { gruposDeCategorias, listarCategorias } from '@/lib/financeiro/consultas';
import { hojeNoBrasil } from '@/lib/formatacao';
import { criarClienteServidor } from '@/lib/supabase/servidor';
import { FormularioRecorrencia } from '../../formulario-recorrencia';

export const metadata: Metadata = { title: 'Novo cadastro · No Azul' };

export default async function PaginaNovaRecorrencia({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { tipo: tipoPedido } = await searchParams;
  const tipo = tipoPedido === 'renda' ? 'renda' : 'fixa';
  const categorias = await listarCategorias(await criarClienteServidor());
  const grupos = gruposDeCategorias(
    categorias,
    tipo === 'renda' ? ['receita'] : ['essencial', 'livre'],
  );

  return (
    <>
      <Link href="/contas" className="text-sm text-azul-700 underline">
        Voltar para Contas e fixas
      </Link>
      <h1 className="text-2xl font-semibold">
        {tipo === 'renda' ? 'Nova renda recorrente' : 'Nova despesa fixa'}
      </h1>
      <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-5">
        <FormularioRecorrencia
          grupos={grupos}
          valores={{
            tipo,
            nome: '',
            valor: '',
            dia: '',
            inicio: hojeNoBrasil(),
            categoriaId: '',
            rendaVariavel: false,
            pagaNoCartao: false,
          }}
        />
      </div>
    </>
  );
}
