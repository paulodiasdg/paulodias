'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

const ITENS = [
  { href: '/painel', rotulo: 'Painel' },
  { href: '/lancamentos', rotulo: 'Lançamentos' },
  { href: '/contas', rotulo: 'Contas e fixas' },
  { href: '/metas', rotulo: 'Metas' },
  { href: '/documentos', rotulo: 'Documentos' },
  { href: '/planejamento', rotulo: 'Planejamento' },
];

export function Navegacao() {
  const caminho = usePathname();
  const lista = useRef<HTMLUListElement>(null);
  // No celular, a barra rola de lado: mostra a seção atual mesmo quando ela fica no fim.
  useEffect(() => {
    lista.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [caminho]);
  return (
    <nav aria-label="Seções" className="-mx-4 overflow-x-auto px-4">
      <ul ref={lista} className="flex gap-1 whitespace-nowrap">
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
