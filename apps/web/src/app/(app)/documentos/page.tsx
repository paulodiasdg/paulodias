import type { Metadata } from 'next';
import Link from 'next/link';
import type { TipoDeDocumento } from '@no-azul/documentos';
import { Aviso, Secao } from '@/components/formulario';
import { lerExtracao, TIPOS_DE_DOCUMENTO } from '@/lib/documentos/operacoes';
import { dataCivilEm, formatarData } from '@/lib/formatacao';
import { criarClienteServidor } from '@/lib/supabase/servidor';
import { FormularioDeEnvio } from './formulario-de-envio';
import { GuardarOriginal } from './guardar-original';

export const metadata: Metadata = { title: 'Documentos · No Azul' };

const SITUACOES: Record<string, { rotulo: string; cor: string }> = {
  recebido: { rotulo: 'Enviando', cor: 'bg-slate-100 text-slate-700' },
  processando: { rotulo: 'Lendo', cor: 'bg-slate-100 text-slate-700' },
  em_revisao: { rotulo: 'Para revisar', cor: 'bg-amber-100 text-amber-900' },
  erro: { rotulo: 'Erro na leitura', cor: 'bg-red-100 text-red-800' },
  aprovado: { rotulo: 'Aprovado', cor: 'bg-emerald-100 text-emerald-800' },
  descartado: { rotulo: 'Descartado', cor: 'bg-slate-100 text-slate-600' },
};

export default async function PaginaDocumentos({
  searchParams,
}: {
  searchParams: Promise<{ aprovado?: string; descartado?: string }>;
}) {
  const parametros = await searchParams;
  const supabase = await criarClienteServidor();
  const [{ data: documentos }, { data: perfil }] = await Promise.all([
    supabase
      .from('documentos')
      .select('id, nome, status, tipo, criado_em, aprovado_em, erro, extracao_json')
      .order('criado_em', { ascending: false })
      .limit(80),
    supabase.from('perfis').select('guardar_original').single(),
  ]);
  const lista = documentos ?? [];
  const andamento = lista.filter((d) =>
    ['recebido', 'processando', 'em_revisao', 'erro'].includes(d.status),
  );
  const historico = lista
    .filter((d) => d.status === 'aprovado' || d.status === 'descartado')
    .slice(0, 30);

  const item = (d: (typeof lista)[number]) => {
    const situacao = SITUACOES[d.status] ?? SITUACOES.recebido!;
    const extracao = lerExtracao(d.extracao_json);
    const linhas = extracao?.lancamentos.length ?? 0;
    const tipo = d.tipo ? TIPOS_DE_DOCUMENTO[d.tipo as TipoDeDocumento] : null;
    return (
      <li key={d.id}>
        <Link
          href={`/documentos/${d.id}`}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2.5 hover:bg-slate-50"
        >
          <span className="min-w-0">
            <span className="block truncate font-medium">{d.nome}</span>
            <span className="block text-xs text-slate-500">
              Enviado em {formatarData(dataCivilEm(new Date(d.criado_em)))}
              {tipo ? ` · ${tipo}` : ''}
              {extracao ? ` · ${linhas} ${linhas === 1 ? 'linha' : 'linhas'}` : ''}
            </span>
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${situacao.cor}`}>
            {situacao.rotulo}
          </span>
        </Link>
      </li>
    );
  };

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Documentos</h1>
        <p className="text-sm text-slate-600">
          Envie comprovantes, boletos, faturas, extratos e contracheques. Você confere os dados
          antes de gravar.
        </p>
      </div>
      {parametros.aprovado ? (
        <Aviso mensagem="Documento aprovado. Os dados já estão nas suas contas." />
      ) : null}
      {parametros.descartado ? <Aviso mensagem="Documento descartado. Nada foi gravado." /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Enviar documento" id="envio">
          <FormularioDeEnvio guardarOriginal={perfil?.guardar_original ?? false} />
          <GuardarOriginal guardar={perfil?.guardar_original ?? false} />
        </Secao>

        <Secao
          titulo="Em andamento"
          id="fila"
          descricao={
            andamento.length
              ? 'Documentos lidos esperando revisão, em leitura ou com erro.'
              : undefined
          }
        >
          {andamento.length ? (
            <ul className="grid gap-2">{andamento.map(item)}</ul>
          ) : (
            <p className="text-sm text-slate-600">Nenhum documento esperando revisão.</p>
          )}
        </Secao>
      </div>

      <Secao
        titulo="Histórico"
        id="historico"
        descricao="Os 30 documentos revisados mais recentes."
      >
        {historico.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">{historico.map(item)}</ul>
        ) : (
          <p className="text-sm text-slate-600">Nenhum documento revisado ainda.</p>
        )}
      </Secao>
    </div>
  );
}
