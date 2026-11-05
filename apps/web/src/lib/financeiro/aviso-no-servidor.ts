import 'server-only';
import { calcularReservaContas } from '@no-azul/motor';
import { cookies } from 'next/headers';
import { hojeNoBrasil } from '@/lib/formatacao';
import {
  avisoDaMudanca,
  codificarAviso,
  COOKIE_DO_AVISO,
  decodificarAviso,
  type AvisoDaReserva,
} from './aviso-da-reserva';
import { carregarDadosFinanceiros, type ClienteSupabase } from './carregar';
import type { Resultado } from './operacoes';

/**
 * Executa uma mudança de cadastro e, se ela mudou o valor da semana para contas, guarda o aviso
 * com o motivo (D3) para a próxima tela. O cookie dura pouco e é apagado depois de mostrado.
 */
export async function comAvisoDaReserva(
  supabase: ClienteSupabase,
  operacao: () => Promise<Resultado>,
): Promise<Resultado> {
  const hoje = hojeNoBrasil();
  const antes = calcularReservaContas(await carregarDadosFinanceiros(supabase), hoje);
  const resultado = await operacao();
  if (!resultado.ok) return resultado;

  const depois = calcularReservaContas(await carregarDadosFinanceiros(supabase), hoje);
  const aviso = avisoDaMudanca(antes, depois);
  if (aviso) {
    (await cookies()).set(COOKIE_DO_AVISO, codificarAviso(aviso), {
      path: '/',
      maxAge: 120,
      sameSite: 'lax',
    });
  }
  return resultado;
}

export async function lerAvisoDaReserva(): Promise<AvisoDaReserva | null> {
  return decodificarAviso((await cookies()).get(COOKIE_DO_AVISO)?.value);
}
