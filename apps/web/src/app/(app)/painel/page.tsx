import type { Metadata } from 'next';
import Link from 'next/link';
import { criarClienteServidor } from '@/lib/supabase/servidor';

export const metadata: Metadata = { title: 'Painel · No Azul' };

export default async function PaginaPainel() {
  const supabase = await criarClienteServidor();
  const { data: perfil } = await supabase.from('perfis').select('nome').single();

  return (
    <>
      <h1 className="text-2xl font-semibold">Olá, {perfil?.nome ?? 'tudo certo'}</h1>
      <p className="max-w-prose text-slate-600">
        O painel com a reserva da semana chega na Etapa 4. Por enquanto, cadastre o que você recebe
        e paga: o cálculo já usa esses dados.
      </p>
      <ul className="grid gap-2 sm:grid-cols-3">
        {[
          ['/contas', 'Contas e fixas', 'Rendas, despesas fixas e contas avulsas'],
          ['/lancamentos', 'Lançamentos', 'Gastos e receitas do mês'],
          ['/metas', 'Metas', 'Quanto guardar e quando termina'],
        ].map(([href, titulo, texto]) => (
          <li key={href}>
            <Link
              href={href!}
              className="block rounded-2xl border border-slate-200 bg-white p-4 hover:border-azul-600"
            >
              <span className="block font-semibold">{titulo}</span>
              <span className="text-sm text-slate-600">{texto}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
