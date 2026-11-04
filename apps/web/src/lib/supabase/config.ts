/** Endereço e chave pública do Supabase. A chave pública pode ir para o navegador. */
export function configSupabase(): { url: string; chavePublica: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chavePublica = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !chavePublica) {
    throw new Error(
      'Faltam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. ' +
        'Rode `pnpm env:local` na raiz para gerar apps/web/.env.local.',
    );
  }
  return { url, chavePublica };
}
