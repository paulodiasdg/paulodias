'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITENS = [
  { href: '/painel', rotulo: 'Painel' },
  { href: '/lancamentos', rotulo: 'Lançamentos' },
  { href: '/contas', rotulo: 'Contas e fixas' },
  { href: '/metas', rotulo: 'Metas' },
];

export function Navegacao() {
  const caminho = usePathname();
  return (
    <nav aria-label="Seções" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-1 whitespace-nowrap">
        {ITENS.map((item) => {
          const ativo = caminho === item.href || caminho.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={ativo ? 'page' : undefined}
                className={`inline-block rounded-lg px-3 py-2 text-sm font-medium ${ativo ? 'bg-azul-50 text-azul-700' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {item.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
