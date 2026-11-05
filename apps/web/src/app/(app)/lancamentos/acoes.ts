'use server';

import { redirect } from 'next/navigation';
import { competenciaDe } from '@no-azul/motor';
import { executar } from '@/lib/acoes';
import type { EstadoFormulario } from '@/lib/estado-formulario';
import {
  criarLancamento,
  editarLancamento,
  excluirLancamento,
  type DadosDoLancamento,
} from '@/lib/financeiro/operacoes';
import { data, obrigatorio, opcional, texto, valor } from '@/lib/formularios';
import { criarClienteServidor } from '@/lib/supabase/servidor';

const TELAS = ['/lancamentos', '/painel'];
const TIPOS = ['despesa', 'receita', 'transferencia'] as const;

function lerLancamento(f: FormData): DadosDoLancamento {
  const tipo = TIPOS.find((t) => t === texto(f, 'tipo')) ?? 'despesa';
  return {
    tipo,
    descricao: obrigatorio(f, 'descricao', 'a descrição', 255),
    valorCentavos: valor(f, 'valor', 'valor', { positivo: true }),
    data: data(f, 'data', 'a data'),
    categoriaId: opcional(f, 'categoriaId'),
  };
}

export async function salvarLancamentoAcao(
  _: EstadoFormulario,
  f: FormData,
): Promise<EstadoFormulario> {
  const supabase = await criarClienteServidor();
  const id = texto(f, 'id');
  const estado = await executar(
    f,
    () =>
      id
        ? editarLancamento(supabase, id, lerLancamento(f))
        : criarLancamento(supabase, lerLancamento(f)),
    TELAS,
  );
  if (estado.ok) redirect(`/lancamentos?mes=${competenciaDe(texto(f, 'data'))}`);
  return estado;
}

export async function excluirLancamentoAcao(
  _: EstadoFormulario,
  f: FormData,
): Promise<EstadoFormulario> {
  const supabase = await criarClienteServidor();
  const estado = await executar(
    f,
    () => excluirLancamento(supabase, obrigatorio(f, 'id', 'o lançamento')),
    TELAS,
  );
  if (estado.ok) redirect(`/lancamentos?mes=${texto(f, 'mes')}`);
  return estado;
}
