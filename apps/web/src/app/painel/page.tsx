import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { sair } from '../(autenticacao)/acoes';
import { criarClienteServidor, usuarioAtual } from '@/lib/supabase/servidor';

export const metadata: Metadata = { title: 'Painel · No Azul' };

export default async function PaginaPainel() {
  // O proxy já protege a rota; a página confere de novo antes de ler dados.
  const usuarioId = await usuarioAtual();
  if (!usuarioId) redirect('/entrar?proximo=/painel');

  const supabase = await criarClienteServidor();
  const { data: perfil } = await supabase.from('perfis').select('nome').single();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
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
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Olá, {perfil?.nome ?? 'tudo certo'}</h1>
        <p className="mt-2 text-slate-600">
          Seu cadastro está pronto. A reserva da semana, as contas e as metas aparecem aqui nas
          próximas etapas.
        </p>
      </main>
    </div>
  );
}
