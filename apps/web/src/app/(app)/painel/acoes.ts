'use server';

import { executar } from '@/lib/acoes';
import type { EstadoFormulario } from '@/lib/estado-formulario';
import { registrarReservaDaSemana } from '@/lib/financeiro/operacoes';
import { data, valor } from '@/lib/formularios';
import { criarClienteServidor } from '@/lib/supabase/servidor';

const TELAS = ['/painel', '/contas', '/metas', '/planejamento'];

/** Registra a reserva da semana: um aporte para contas e um para cada meta, de uma vez. */
export async function registrarReservaAcao(
  _: EstadoFormulario,
  f: FormData,
): Promise<EstadoFormulario> {
  const supabase = await criarClienteServidor();
  return executar(
    f,
    () => {
      const metas = [...f.keys()]
        .filter((campo) => campo.startsWith('meta:'))
        .map((campo) => ({
          metaId: campo.slice('meta:'.length),
          valorCentavos: valor(f, campo, 'valor da meta'),
        }));
      return registrarReservaDaSemana(supabase, {
        data: data(f, 'data', 'a data'),
        contasCentavos: valor(f, 'contas', 'valor para contas'),
        metas,
      });
    },
    TELAS,
    'Reserva registrada.',
  );
}
