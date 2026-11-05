'use server';

import { redirect } from 'next/navigation';
import { executar } from '@/lib/acoes';
import type { EstadoFormulario } from '@/lib/estado-formulario';
import { comAvisoDaReserva } from '@/lib/financeiro/aviso-no-servidor';
import { hojeNoBrasil } from '@/lib/formatacao';
import {
  confirmarRecebimento,
  corrigirSaldo,
  criarContaAvulsa,
  criarRecorrencia,
  desfazerPagamento,
  desfazerRecebimento,
  editarContaAvulsa,
  editarRecorrencia,
  encerrarRecorrencia,
  excluirContaAvulsa,
  excluirRecorrencia,
  pagarConta,
  reativarRecorrencia,
  registrarAporte,
  type DadosDaContaAvulsa,
  type DadosDaRecorrencia,
} from '@/lib/financeiro/operacoes';
import {
  data,
  inteiroEntre,
  marcado,
  obrigatorio,
  opcional,
  texto,
  valor,
} from '@/lib/formularios';
import { criarClienteServidor } from '@/lib/supabase/servidor';

const TELAS = ['/contas', '/lancamentos', '/painel', '/planejamento'];

export async function pagarContaAcao(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  const supabase = await criarClienteServidor();
  return executar(
    f,
    () =>
      pagarConta(supabase, {
        chave: obrigatorio(f, 'chave', 'a conta'),
        pagoEm: data(f, 'pagoEm', 'a data do pagamento'),
        ...(texto(f, 'valor') ? { valorCentavos: valor(f, 'valor', 'valor pago') } : {}),
      }),
    TELAS,
    'Pagamento registrado.',
  );
}

export async function desfazerPagamentoAcao(
  _: EstadoFormulario,
  f: FormData,
): Promise<EstadoFormulario> {
  const supabase = await criarClienteServidor();
  return executar(f, () => desfazerPagamento(supabase, obrigatorio(f, 'chave', 'a conta')), TELAS);
}

export async function confirmarRecebimentoAcao(
  _: EstadoFormulario,
  f: FormData,
): Promise<EstadoFormulario> {
  const supabase = await criarClienteServidor();
  return executar(
    f,
    () =>
      confirmarRecebimento(supabase, {
        recorrenciaId: obrigatorio(f, 'recorrenciaId', 'a renda'),
        competencia: obrigatorio(f, 'competencia', 'o mês'),
        valorCentavos: valor(f, 'valor', 'valor recebido'),
        recebidoEm: data(f, 'recebidoEm', 'a data do recebimento'),
      }),
    TELAS,
    'Recebimento confirmado.',
  );
}

export async function desfazerRecebimentoAcao(
  _: EstadoFormulario,
  f: FormData,
): Promise<EstadoFormulario> {
  const supabase = await criarClienteServidor();
  return executar(
    f,
    () => desfazerRecebimento(supabase, obrigatorio(f, 'ocorrenciaId', 'o recebimento')),
    TELAS,
  );
}

export async function aporteNaReservaAcao(
  _: EstadoFormulario,
  f: FormData,
): Promise<EstadoFormulario> {
  const supabase = await criarClienteServidor();
  return executar(
    f,
    () =>
      registrarAporte(supabase, {
        valorCentavos: valor(f, 'valor', 'valor guardado', { positivo: true }),
        data: data(f, 'data', 'a data'),
      }),
    TELAS,
    'Reserva registrada.',
  );
}

export async function corrigirReservaAcao(
  _: EstadoFormulario,
  f: FormData,
): Promise<EstadoFormulario> {
  const supabase = await criarClienteServidor();
  return executar(
    f,
    () =>
      comAvisoDaReserva(supabase, () =>
        corrigirSaldo(supabase, {
          saldoCorretoCentavos: valor(f, 'valor', 'saldo correto'),
          data: hojeNoBrasil(),
        }),
      ),
    TELAS,
    'Saldo corrigido.',
  );
}

// ---------------------------------------------------------------------------------------------
// Cadastros de rendas e despesas fixas
// ---------------------------------------------------------------------------------------------

function lerRecorrencia(f: FormData): DadosDaRecorrencia {
  const tipo = texto(f, 'tipo') === 'renda' ? 'renda' : 'fixa';
  return {
    tipo,
    nome: obrigatorio(f, 'nome', 'o nome'),
    valorCentavos: valor(f, 'valor', tipo === 'renda' ? 'valor previsto' : 'valor'),
    dia: inteiroEntre(f, 'dia', 'O dia', 1, 31),
    inicio: data(f, 'inicio', 'a data de início'),
    categoriaId: opcional(f, 'categoriaId'),
    rendaVariavel: marcado(f, 'rendaVariavel'),
    pagaNoCartao: marcado(f, 'pagaNoCartao'),
  };
}

export async function salvarRecorrenciaAcao(
  _: EstadoFormulario,
  f: FormData,
): Promise<EstadoFormulario> {
  const supabase = await criarClienteServidor();
  const id = texto(f, 'id');
  const estado = await executar(
    f,
    () => {
      const dados = lerRecorrencia(f);
      return comAvisoDaReserva(supabase, () =>
        id ? editarRecorrencia(supabase, id, dados) : criarRecorrencia(supabase, dados),
      );
    },
    TELAS,
  );
  if (estado.ok) redirect('/contas');
  return estado;
}

export async function encerrarRecorrenciaAcao(
  _: EstadoFormulario,
  f: FormData,
): Promise<EstadoFormulario> {
  const supabase = await criarClienteServidor();
  const estado = await executar(
    f,
    () => {
      const id = obrigatorio(f, 'id', 'o cadastro');
      return comAvisoDaReserva(supabase, () => encerrarRecorrencia(supabase, id, hojeNoBrasil()));
    },
    TELAS,
  );
  if (estado.ok) redirect('/contas');
  return estado;
}

export async function reativarRecorrenciaAcao(
  _: EstadoFormulario,
  f: FormData,
): Promise<EstadoFormulario> {
  const supabase = await criarClienteServidor();
  const estado = await executar(
    f,
    () => {
      const id = obrigatorio(f, 'id', 'o cadastro');
      return comAvisoDaReserva(supabase, () => reativarRecorrencia(supabase, id));
    },
    TELAS,
  );
  if (estado.ok) redirect('/contas');
  return estado;
}

export async function excluirRecorrenciaAcao(
  _: EstadoFormulario,
  f: FormData,
): Promise<EstadoFormulario> {
  const supabase = await criarClienteServidor();
  const estado = await executar(
    f,
    () => {
      const id = obrigatorio(f, 'id', 'o cadastro');
      return comAvisoDaReserva(supabase, () => excluirRecorrencia(supabase, id));
    },
    TELAS,
  );
  if (estado.ok) redirect('/contas');
  return estado;
}

// ---------------------------------------------------------------------------------------------
// Contas avulsas
// ---------------------------------------------------------------------------------------------

function lerContaAvulsa(f: FormData): DadosDaContaAvulsa {
  return {
    nome: obrigatorio(f, 'nome', 'o nome'),
    valorCentavos: valor(f, 'valor', 'valor'),
    vencimento: data(f, 'vencimento', 'o vencimento'),
    categoriaId: opcional(f, 'categoriaId'),
    quitaItens: marcado(f, 'quitaItens'),
  };
}

export async function salvarContaAvulsaAcao(
  _: EstadoFormulario,
  f: FormData,
): Promise<EstadoFormulario> {
  const supabase = await criarClienteServidor();
  const id = texto(f, 'id');
  const estado = await executar(
    f,
    () => {
      const dados = lerContaAvulsa(f);
      return comAvisoDaReserva(supabase, () =>
        id ? editarContaAvulsa(supabase, id, dados) : criarContaAvulsa(supabase, dados),
      );
    },
    TELAS,
  );
  if (estado.ok) redirect('/contas');
  return estado;
}

export async function excluirContaAvulsaAcao(
  _: EstadoFormulario,
  f: FormData,
): Promise<EstadoFormulario> {
  const supabase = await criarClienteServidor();
  const estado = await executar(
    f,
    () => {
      const id = obrigatorio(f, 'id', 'a conta');
      return comAvisoDaReserva(supabase, () => excluirContaAvulsa(supabase, id));
    },
    TELAS,
  );
  if (estado.ok) redirect('/contas');
  return estado;
}
