import type { Metadata } from 'next';
import Link from 'next/link';
import { somarDias } from '@no-azul/motor';
import { gruposDeCategorias, listarCategorias } from '@/lib/financeiro/consultas';
import { hojeNoBrasil } from '@/lib/formatacao';
import { criarClienteServidor } from '@/lib/supabase/servidor';
import { FormularioContaAvulsa } from '../../formulario-conta-avulsa';

export const metadata: Metadata = { title: 'Nova conta avulsa · No Azul' };

export default async function PaginaNovaContaAvulsa() {
  const grupos = gruposDeCategorias(await listarCategorias(await criarClienteServidor()), [
    'essencial',
    'livre',
  ]);
  return (
    <>
      <Link href="/contas" className="text-sm text-azul-700 underline">
        Voltar para Contas e fixas
      </Link>
      <h1 className="text-2xl font-semibold">Nova conta avulsa</h1>
      <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-5">
        <FormularioContaAvulsa
          grupos={grupos}
          valores={{
            nome: '',
            valor: '',
            vencimento: somarDias(hojeNoBrasil(), 7),
            categoriaId: '',
            quitaItens: false,
          }}
        />
      </div>
    </>
  );
}
