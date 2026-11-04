import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { configSupabase } from '@/lib/supabase/config';
import { ROTA_INICIAL, ehRotaDeEntrada, ehRotaProtegida } from '@/lib/rotas';

/** Renova a sessão do Supabase a cada navegação e protege as rotas que exigem login. */
export async function proxy(request: NextRequest) {
  const { url, chavePublica } = configSupabase();
  let resposta = NextResponse.next({ request });

  const supabase = createServerClient(url, chavePublica, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesParaGravar, cabecalhos) {
        for (const { name, value } of cookiesParaGravar) request.cookies.set(name, value);
        resposta = NextResponse.next({ request });
        for (const { name, value, options } of cookiesParaGravar) {
          resposta.cookies.set(name, value, options);
        }
        for (const [nome, valor] of Object.entries(cabecalhos ?? {})) {
          resposta.headers.set(nome, valor);
        }
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const logado = Boolean(data?.claims?.sub);
  const caminho = request.nextUrl.pathname;

  const redirecionar = (destino: URL) => {
    const redirecionamento = NextResponse.redirect(destino);
    for (const cookie of resposta.cookies.getAll()) redirecionamento.cookies.set(cookie);
    return redirecionamento;
  };

  if (!logado && ehRotaProtegida(caminho)) {
    const entrar = new URL('/entrar', request.url);
    entrar.searchParams.set('proximo', `${caminho}${request.nextUrl.search}`);
    return redirecionar(entrar);
  }

  if (logado && ehRotaDeEntrada(caminho)) {
    return redirecionar(new URL(ROTA_INICIAL, request.url));
  }

  return resposta;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
