import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AcaoComConfirmacao } from '@/components/acoes-rapidas';
import { gruposDeCategorias, listarCategorias } from '@/lib/financeiro/consultas';
import { centavosParaTexto, formatarData } from '@/lib/formatacao';
import { criarClienteServidor } from '@/lib/supabase/servidor';
import {
  encerrarRecorrenciaAcao,
  excluirRecorrenciaAcao,
  reativarRecorrenciaAcao,
} from '../../acoes';
import { FormularioRecorrencia } from '../../formulario-recorrencia';

export const metadata: Metadata = { title: 'Editar cadastro · No Azul' };

export default async function PaginaEditarRecorrencia({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await criarClienteServidor();
  const { data: recorrencia } = await supabase
    .from('recorrencias')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!recorrencia) notFound();

  const tipo = recorrencia.tipo === 'renda' ? 'renda' : 'fixa';
  const grupos = gruposDeCategorias(
    await listarCategorias(supabase),
    tipo === 'renda' ? ['receita'] : ['essencial', 'livre'],
  );

  return (
    <>
      <Link href="/contas" className="text-sm text-azul-700 underline">
        Voltar para Contas e fixas
      </Link>
      <h1 className="text-2xl font-semibold">{recorrencia.nome}</h1>
      <p className="text-slate-600">
        {tipo === 'renda' ? 'Renda recorrente' : 'Despesa fixa'}
        {recorrencia.ativa
          ? ''
          : ` · encerrada em ${formatarData(recorrencia.fim ?? recorrencia.inicio)}`}
      </p>
      <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-5">
        <FormularioRecorrencia
          grupos={grupos}
          valores={{
            id: recorrencia.id,
            tipo,
            nome: recorrencia.nome,
            valor: centavosParaTexto(recorrencia.valor_centavos),
            dia: String(recorrencia.dia),
            inicio: recorrencia.inicio,
            categoriaId: recorrencia.categoria_id ?? '',
            rendaVariavel: recorrencia.renda_variavel,
            pagaNoCartao: recorrencia.paga_no_cartao,
          }}
        />
      </div>
      <div className="grid max-w-xl gap-3 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Encerrar ou excluir</h2>
        <p className="text-sm text-slate-600">
          Encerrar mantém os pagamentos já feitos e para de prever os próximos meses. Só dá para
          excluir um cadastro sem pagamentos nem recebimentos.
        </p>
        {recorrencia.ativa ? (
          <AcaoComConfirmacao
            acao={encerrarRecorrenciaAcao}
            ocultos={{ id }}
            texto="Encerrar"
            textoConfirmar="Encerrar"
            pergunta="Os próximos meses deixam de ser previstos."
          />
        ) : (
          <AcaoComConfirmacao
            acao={reativarRecorrenciaAcao}
            ocultos={{ id }}
            texto="Reativar"
            textoConfirmar="Reativar"
            pergunta="Os próximos meses voltam a ser previstos."
          />
        )}
        <AcaoComConfirmacao
          acao={excluirRecorrenciaAcao}
          ocultos={{ id }}
          texto="Excluir"
          textoConfirmar="Excluir de vez"
          pergunta="O cadastro some de todos os cálculos."
          perigo
        />
      </div>
    </>
  );
}
