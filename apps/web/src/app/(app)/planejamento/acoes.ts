'use server';

import { executar } from '@/lib/acoes';
import type { EstadoFormulario } from '@/lib/estado-formulario';
import { definirTeto } from '@/lib/financeiro/operacoes';
import { valor } from '@/lib/formularios';
import { criarClienteServidor } from '@/lib/supabase/servidor';

const TELAS = ['/planejamento', '/painel', '/metas'];

export async function definirTetoAcao(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  const supabase = await criarClienteServidor();
  return executar(f, () => definirTeto(supabase, valor(f, 'valor', 'teto')), TELAS, 'Teto salvo.');
}

export async function removerTetoAcao(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  const supabase = await criarClienteServidor();
  return executar(f, () => definirTeto(supabase, null), TELAS, 'Teto removido.');
}
