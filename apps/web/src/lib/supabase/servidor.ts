import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { configSupabase } from './config';
import type { Database } from './tipos-banco';

/** Cliente do Supabase para Server Components e Server Actions, com a sessão do cookie. */
export async function criarClienteServidor() {
  const { url, chavePublica } = configSupabase();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, chavePublica, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesParaGravar) {
        try {
          for (const { name, value, options } of cookiesParaGravar) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components não gravam cookies; o proxy renova a sessão a cada navegação.
        }
      },
    },
  });
}

/** Devolve o id do usuário com sessão válida, ou null. */
export async function usuarioAtual(): Promise<string | null> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  return typeof id === 'string' ? id : null;
}
