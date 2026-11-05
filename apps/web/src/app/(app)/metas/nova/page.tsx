import type { Metadata } from 'next';
import Link from 'next/link';
import { somarMeses } from '@no-azul/motor';
import { hojeNoBrasil } from '@/lib/formatacao';
import { FormularioMeta } from '../formulario-meta';

export const metadata: Metadata = { title: 'Nova meta · No Azul' };

export default function PaginaNovaMeta() {
  return (
    <>
      <Link href="/metas" className="text-sm text-azul-700 underline">
        Voltar para Metas
      </Link>
      <h1 className="text-2xl font-semibold">Nova meta</h1>
      <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-5">
        <FormularioMeta
          valores={{
            nome: '',
            alvo: '',
            prazo: somarMeses(hojeNoBrasil(), 12),
            prioridade: '2',
            emergencia: false,
          }}
        />
      </div>
    </>
  );
}
