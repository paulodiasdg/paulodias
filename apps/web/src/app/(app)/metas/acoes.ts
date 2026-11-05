'use server';

import { redirect } from 'next/navigation';
import { executar } from '@/lib/acoes';
import type { EstadoFormulario } from '@/lib/estado-formulario';
import { hojeNoBrasil } from '@/lib/formatacao';
import {
  concluirMeta,
  corrigirSaldo,
  criarMeta,
  editarMeta,
  excluirMeta,
  registrarAporte,
  type DadosDaMeta,
} from '@/lib/financeiro/operacoes';
import { data, inteiroEntre, marcado, obrigatorio, texto, valor } from '@/lib/formularios';
import { criarClienteServidor } from '@/lib/supabase/servidor';

const TELAS = ['/metas', '/painel', '/planejamento'];

function lerMeta(f: FormData): DadosDaMeta {
  return {
    nome: obrigatorio(f, 'nome', 'o nome'),
    alvoCentavos: valor(f, 'alvo', 'valor do alvo', { positivo: true }),
    prazo: data(f, 'prazo', 'o prazo'),
    prioridade: inteiroEntre(f, 'prioridade', 'A prioridade', 1, 3),
    emergencia: marcado(f, 'emergencia'),
  };
}

export async function salvarMetaAcao(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  const supabase = await criarClienteServidor();
  const id = texto(f, 'id');
  const estado = await executar(
    f,
    () => (id ? editarMeta(supabase, id, lerMeta(f)) : criarMeta(supabase, lerMeta(f))),
    TELAS,
  );
  if (estado.ok) redirect('/metas');
  return estado;
}

export async function aporteNaMetaAcao(
  _: EstadoFormulario,
  f: FormData,
): Promise<EstadoFormulario> {
  const supabase = await criarClienteServidor();
  return executar(
    f,
    () =>
      registrarAporte(supabase, {
        metaId: obrigatorio(f, 'metaId', 'a meta'),
        valorCentavos: valor(f, 'valor', 'valor guardado', { positivo: true }),
        data: data(f, 'data', 'a data'),
      }),
    TELAS,
    'Aporte registrado.',
  );
}

export async function corrigirGuardadoAcao(
  _: EstadoFormulario,
  f: FormData,
): Promise<EstadoFormulario> {
  const supabase = await criarClienteServidor();
  return executar(
    f,
    () =>
      corrigirSaldo(supabase, {
        metaId: obrigatorio(f, 'metaId', 'a meta'),
        saldoCorretoCentavos: valor(f, 'valor', 'valor guardado'),
        data: hojeNoBrasil(),
      }),
    TELAS,
    'Valor guardado corrigido.',
  );
}

export async function concluirMetaAcao(
  _: EstadoFormulario,
  f: FormData,
): Promise<EstadoFormulario> {
  const supabase = await criarClienteServidor();
  return executar(
    f,
    () =>
      concluirMeta(supabase, obrigatorio(f, 'metaId', 'a meta'), texto(f, 'concluir') === 'sim'),
    TELAS,
  );
}

export async function excluirMetaAcao(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  const supabase = await criarClienteServidor();
  const estado = await executar(
    f,
    () => excluirMeta(supabase, obrigatorio(f, 'metaId', 'a meta')),
    TELAS,
  );
  if (estado.ok) redirect('/metas');
  return estado;
}
