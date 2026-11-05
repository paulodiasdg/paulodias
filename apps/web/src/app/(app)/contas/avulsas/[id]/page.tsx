import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AcaoComConfirmacao } from '@/components/acoes-rapidas';
import { gruposDeCategorias, listarCategorias } from '@/lib/financeiro/consultas';
import { centavosParaTexto, formatarData } from '@/lib/formatacao';
import { criarClienteServidor } from '@/lib/supabase/servidor';
import { excluirContaAvulsaAcao } from '../../acoes';
import { FormularioContaAvulsa } from '../../formulario-conta-avulsa';

export const metadata: Metadata = { title: 'Editar conta avulsa · No Azul' };

export default async function PaginaEditarContaAvulsa({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await criarClienteServidor();
  const { data: conta } = await supabase
    .from('contas_avulsas')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!conta) notFound();
  const grupos = gruposDeCategorias(await listarCategorias(supabase), ['essencial', 'livre']);
  const paga = conta.pago_em !== null;

  return (
    <>
      <Link href="/contas" className="text-sm text-azul-700 underline">
        Voltar para Contas e fixas
      </Link>
      <h1 className="text-2xl font-semibold">{conta.nome}</h1>
      {paga ? (
        <p className="max-w-xl rounded-lg bg-azul-50 px-3 py-2 text-sm text-azul-900">
          Paga em {formatarData(conta.pago_em!)}. Para alterar ou excluir, desfaça o pagamento em
          Contas e fixas.
        </p>
      ) : null}
      <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-5">
        <FormularioContaAvulsa
          grupos={grupos}
          bloqueada={paga}
          valores={{
            id: conta.id,
            nome: conta.nome,
            valor: centavosParaTexto(conta.valor_centavos),
            vencimento: conta.vencimento,
            categoriaId: conta.categoria_id ?? '',
            quitaItens: conta.quita_itens,
          }}
        />
      </div>
      {paga ? null : (
        <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-5">
          <AcaoComConfirmacao
            acao={excluirContaAvulsaAcao}
            ocultos={{ id }}
            texto="Excluir conta"
            textoConfirmar="Excluir de vez"
            pergunta="A conta some de todos os cálculos."
            perigo
          />
        </div>
      )}
    </>
  );
}
