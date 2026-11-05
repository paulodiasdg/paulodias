import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AcaoComConfirmacao } from '@/components/acoes-rapidas';
import { centavosParaTexto } from '@/lib/formatacao';
import { criarClienteServidor } from '@/lib/supabase/servidor';
import { excluirMetaAcao } from '../acoes';
import { FormularioMeta } from '../formulario-meta';

export const metadata: Metadata = { title: 'Editar meta · No Azul' };

export default async function PaginaEditarMeta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await criarClienteServidor();
  const { data: meta } = await supabase.from('metas').select('*').eq('id', id).maybeSingle();
  if (!meta) notFound();

  return (
    <>
      <Link href="/metas" className="text-sm text-azul-700 underline">
        Voltar para Metas
      </Link>
      <h1 className="text-2xl font-semibold">{meta.nome}</h1>
      <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-5">
        <FormularioMeta
          valores={{
            id: meta.id,
            nome: meta.nome,
            alvo: centavosParaTexto(meta.alvo_centavos),
            prazo: meta.prazo,
            prioridade: String(meta.prioridade),
            emergencia: meta.tipo === 'emergencia',
          }}
        />
      </div>
      <div className="grid max-w-xl gap-2 rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-600">
          Excluir apaga a meta e os aportes registrados nela. O dinheiro guardado continua onde
          estiver; o sistema só deixa de acompanhá-lo.
        </p>
        <AcaoComConfirmacao
          acao={excluirMetaAcao}
          ocultos={{ metaId: id }}
          texto="Excluir meta"
          textoConfirmar="Excluir de vez"
          pergunta="A meta e os aportes dela somem dos cálculos."
          perigo
        />
      </div>
    </>
  );
}
