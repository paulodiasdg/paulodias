import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { competenciaDe } from '@no-azul/motor';
import { AcaoComConfirmacao } from '@/components/acoes-rapidas';
import { listarCategorias } from '@/lib/financeiro/consultas';
import { centavosParaTexto, formatarData, formatarReais } from '@/lib/formatacao';
import { criarClienteServidor } from '@/lib/supabase/servidor';
import { excluirLancamentoAcao } from '../acoes';
import { FormularioLancamento, type ValoresDoLancamento } from '../formulario-lancamento';
import { gruposPorTipo } from '../grupos';

export const metadata: Metadata = { title: 'Editar lançamento · No Azul' };

export default async function PaginaEditarLancamento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await criarClienteServidor();
  const { data: lancamento } = await supabase
    .from('lancamentos')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!lancamento) notFound();
  const mes = competenciaDe(lancamento.data);
  const deConta = lancamento.origem === 'pagamento' || lancamento.origem === 'recebimento';

  return (
    <>
      <Link href={`/lancamentos?mes=${mes}`} className="text-sm text-azul-700 underline">
        Voltar para Lançamentos
      </Link>
      <h1 className="text-2xl font-semibold">{lancamento.descricao}</h1>
      {deConta ? (
        <div className="grid max-w-xl gap-2 rounded-2xl border border-slate-200 bg-white p-5">
          <p>
            {formatarReais(lancamento.valor_centavos)} em {formatarData(lancamento.data)}
          </p>
          <p className="text-sm text-slate-600">
            Este lançamento veio de{' '}
            {lancamento.origem === 'pagamento' ? 'um pagamento' : 'um recebimento'}. Para mudar,
            desfaça a operação em{' '}
            <Link href="/contas" className="text-azul-700 underline">
              Contas e fixas
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-5">
            <FormularioLancamento
              gruposPorTipo={gruposPorTipo(await listarCategorias(supabase))}
              valores={{
                id: lancamento.id,
                tipo: lancamento.tipo as ValoresDoLancamento['tipo'],
                descricao: lancamento.descricao,
                valor: centavosParaTexto(lancamento.valor_centavos),
                data: lancamento.data,
                categoriaId: lancamento.categoria_id ?? '',
              }}
            />
          </div>
          <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-5">
            <AcaoComConfirmacao
              acao={excluirLancamentoAcao}
              ocultos={{ id, mes }}
              texto="Excluir lançamento"
              textoConfirmar="Excluir de vez"
              pergunta="O lançamento some de todos os cálculos."
              perigo
            />
          </div>
        </>
      )}
    </>
  );
}
