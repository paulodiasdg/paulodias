import type { Metadata } from 'next';
import { FormularioEntrar } from './formulario-entrar';

export const metadata: Metadata = { title: 'Entrar · No Azul' };

export default async function PaginaEntrar({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string | string[] }>;
}) {
  const { proximo } = await searchParams;
  return <FormularioEntrar proximo={typeof proximo === 'string' ? proximo : undefined} />;
}
