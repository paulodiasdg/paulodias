import type { ReactNode } from 'react';
import { formatarReais } from '@/lib/formatacao';

/**
 * Valor em reais calculado pelo motor. A `chave` identifica o número para o teste de aceite da
 * Etapa 4, que confere cada valor da tela com o motor; todo "R$" do painel passa por aqui.
 */
export function Valor({
  chave,
  centavos,
  className = '',
}: {
  chave: string;
  centavos: number;
  className?: string;
}) {
  return (
    <span data-valor={chave} className={`whitespace-nowrap tabular-nums ${className}`}>
      {formatarReais(centavos)}
    </span>
  );
}

/** Outro número do motor (índice, pontos, percentual, data), já formatado. */
export function Numero({
  chave,
  children,
  className = '',
}: {
  chave: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span data-numero={chave} className={`whitespace-nowrap tabular-nums ${className}`}>
      {children}
    </span>
  );
}
