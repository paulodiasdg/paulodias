import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { Navegacao } from '@/components/navegacao';
import { usuarioAtual } from '@/lib/supabase/servidor';
import { sair } from '../(autenticacao)/acoes';

export default async function LayoutDoApp({ children }: { children: ReactNode }) {
  // O proxy já protege as rotas; o layout confere de novo antes de qualquer leitura de dados.
  if (!(await usuarioAtual())) redirect('/entrar');

  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-5xl gap-1 px-4 pt-3 pb-1">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold text-azul-700">No Azul</span>
            <form action={sair}>
              <button
                type="submit"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Sair
              </button>
            </form>
          </div>
          <Navegacao />
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-5 px-4 py-6">{children}</main>
    </div>
  );
}
