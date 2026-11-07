import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cruzar, type TipoDeDocumento } from '@no-azul/documentos';
import { classeBotaoLink, Secao } from '@/components/formulario';
import { BUCKET_DOS_DOCUMENTOS } from '@/lib/documentos/leitura';
import { leituraParada, lerExtracao, TIPOS_DE_DOCUMENTO } from '@/lib/documentos/operacoes';
import { carregarDadosFinanceiros } from '@/lib/financeiro/carregar';
import { listarCategorias } from '@/lib/financeiro/consultas';
import { dataCivilEm, formatarData, formatarReais, hojeNoBrasil } from '@/lib/formatacao';
import { criarClienteServidor } from '@/lib/supabase/servidor';
import { AtualizarEnquantoLe, Descartar, LerDeNovo } from './acompanhar';
import { Revisao } from './revisao';

export const metadata: Metadata = { title: 'Documento · No Azul' };

/** Mostra o arquivo enviado por um link temporário (Storage privado). */
function Previa({ url, tipoMime }: { url: string | null; tipoMime: string | null }) {
  if (!url)
    return <p className="text-sm text-slate-600">O arquivo original não está mais guardado.</p>;
  if (tipoMime === 'application/pdf') {
    return (
      <div className="grid gap-2">
        <iframe
          src={url}
          title="Documento enviado"
          className="h-[70vh] w-full rounded-lg border border-slate-200"
        />
        {/* Alguns navegadores de celular não mostram PDF dentro da página. */}
        <a href={url} target="_blank" rel="noreferrer" className="text-sm text-azul-700 underline">
          Abrir o PDF em outra aba
        </a>
      </div>
    );
  }
  if (tipoMime?.startsWith('image/')) {
    return (
      // A imagem vem de um link temporário do Storage; o componente de imagem do Next não ajuda aqui.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt="Documento enviado"
        className="max-h-[75vh] w-full rounded-lg border border-slate-200 object-contain"
      />
    );
  }
  return (
    <p className="text-sm text-slate-600">
      Planilha ou extrato em arquivo de dados: as linhas lidas estão ao lado.{' '}
      <a href={url} className="text-azul-700 underline">
        Baixar o arquivo
      </a>
    </p>
  );
}

export default async function PaginaDoDocumento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await criarClienteServidor();
  const { data: documento } = await supabase
    .from('documentos')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!documento) notFound();

  const tipo = documento.tipo ? TIPOS_DE_DOCUMENTO[documento.tipo as TipoDeDocumento] : null;
  const enviadoEm = formatarData(dataCivilEm(new Date(documento.criado_em)));
  const cabecalho = (
    <div className="grid gap-1">
      <Link href="/documentos" className="text-sm text-azul-700 hover:underline">
        ← Documentos
      </Link>
      <h1 className="break-words text-xl font-semibold">{documento.nome}</h1>
      <p className="text-sm text-slate-600">
        Enviado em {enviadoEm}
        {tipo ? ` · ${tipo}` : ''}
      </p>
    </div>
  );

  if (documento.status === 'recebido' || documento.status === 'processando') {
    const parado = leituraParada(documento.status, documento.processando_desde);
    return (
      <div className="grid gap-4">
        {cabecalho}
        <Secao
          titulo={documento.status === 'recebido' ? 'Esperando o arquivo' : 'Lendo o documento…'}
        >
          <p className="text-sm text-slate-600" role="status">
            {documento.status === 'recebido'
              ? 'O envio do arquivo não terminou. Se a página foi fechada no meio, envie de novo.'
              : 'Isso costuma levar alguns segundos; fotos e PDFs digitalizados demoram um pouco mais.'}
          </p>
          {parado ? (
            <LerDeNovo documentoId={documento.id} tipoAtual={documento.tipo_informado} />
          ) : (
            <AtualizarEnquantoLe />
          )}
          <Descartar documentoId={documento.id} />
        </Secao>
      </div>
    );
  }

  if (documento.status === 'erro') {
    return (
      <div className="grid gap-4">
        {cabecalho}
        <Secao titulo="Não consegui ler este documento">
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {documento.erro ?? 'A leitura falhou.'}
          </p>
          <LerDeNovo documentoId={documento.id} tipoAtual={documento.tipo_informado} />
          <div className="flex flex-wrap gap-2">
            <Link href="/lancamentos/novo" className={classeBotaoLink}>
              Lançar à mão
            </Link>
          </div>
          <Descartar documentoId={documento.id} />
        </Secao>
      </div>
    );
  }

  if (documento.status === 'aprovado' || documento.status === 'descartado') {
    const { data: gravados } = await supabase
      .from('lancamentos')
      .select('id, data, descricao, valor_centavos, tipo')
      .eq('documento_id', documento.id)
      .order('data');
    const { data: contas } = await supabase
      .from('contas_avulsas')
      .select('id, nome, valor_centavos, vencimento')
      .eq('documento_id', documento.id);
    return (
      <div className="grid gap-4">
        {cabecalho}
        <Secao
          titulo={documento.status === 'aprovado' ? 'Aprovado' : 'Descartado'}
          descricao={
            documento.status === 'aprovado'
              ? `Gravado em ${formatarData(dataCivilEm(new Date(documento.aprovado_em ?? documento.criado_em)))}.`
              : 'Nada deste documento foi gravado.'
          }
        >
          {contas?.length ? (
            <ul className="grid gap-1 text-sm">
              {contas.map((c) => (
                <li key={c.id}>
                  Conta a pagar: {c.nome}, {formatarReais(c.valor_centavos)}, vence{' '}
                  {formatarData(c.vencimento)}
                </li>
              ))}
            </ul>
          ) : null}
          {gravados?.length ? (
            <ul className="grid gap-1 text-sm">
              {gravados.map((l) => (
                <li key={l.id} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {formatarData(l.data)} · {l.descricao}
                  </span>
                  <span className="whitespace-nowrap">{formatarReais(l.valor_centavos)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {documento.status === 'aprovado' ? (
            <p className="text-xs text-slate-500">
              Pagamentos e recebimentos confirmados por este documento aparecem em Contas e fixas.
            </p>
          ) : null}
        </Secao>
      </div>
    );
  }

  // Em revisão
  const extracao = lerExtracao(documento.extracao_json);
  if (!extracao) notFound();
  const [dados, categorias, previa] = await Promise.all([
    carregarDadosFinanceiros(supabase),
    listarCategorias(supabase),
    documento.arquivo_chave
      ? supabase.storage.from(BUCKET_DOS_DOCUMENTOS).createSignedUrl(documento.arquivo_chave, 600)
      : Promise.resolve(null),
  ]);
  const cruzamento = cruzar(extracao, dados, hojeNoBrasil());

  return (
    <div className="grid gap-4">
      {cabecalho}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="lg:sticky lg:top-4 lg:self-start">
          <details className="rounded-2xl border border-slate-200 bg-white p-4 lg:hidden">
            <summary className="cursor-pointer text-sm font-medium">Ver o documento</summary>
            <div className="mt-3">
              <Previa url={previa?.data?.signedUrl ?? null} tipoMime={documento.tipo_mime} />
            </div>
          </details>
          <div className="hidden rounded-2xl border border-slate-200 bg-white p-4 lg:block">
            <Previa url={previa?.data?.signedUrl ?? null} tipoMime={documento.tipo_mime} />
          </div>
        </div>
        <Secao
          titulo="Confira e aprove"
          id="revisao"
          descricao="Campos em amarelo foram lidos com pouca certeza. Nada é gravado antes de você aprovar."
        >
          <Revisao
            documentoId={documento.id}
            extracao={extracao}
            cruzamento={cruzamento}
            categorias={categorias.map((c) => ({
              id: c.id,
              nome: c.nome,
              slug: c.slug,
              grupo: c.grupo,
            }))}
          />
          <div className="grid gap-3 border-t border-slate-100 pt-3">
            <LerDeNovo documentoId={documento.id} tipoAtual={documento.tipo} />
            <Descartar documentoId={documento.id} />
          </div>
        </Secao>
      </div>
    </div>
  );
}
