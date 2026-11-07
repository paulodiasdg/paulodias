'use client';

import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { Aviso, Selecao } from '@/components/formulario';
import { dataCivilEm, formatarData } from '@/lib/formatacao';
import { sha256 } from '@/lib/sha256';
import { configSupabase } from '@/lib/supabase/config';
import { concluirEnvioAcao, iniciarEnvioAcao } from './acoes';

const ACEITOS =
  '.pdf,.jpg,.jpeg,.png,.webp,.csv,.txt,.ofx,.xlsx,application/pdf,image/jpeg,image/png,image/webp';
const TAMANHO_MAXIMO = 15 * 1024 * 1024;

const TIPOS = [
  { valor: '', rotulo: 'Descobrir pelo conteúdo' },
  { valor: 'comprovante', rotulo: 'Comprovante ou nota fiscal' },
  { valor: 'boleto', rotulo: 'Boleto ou conta de consumo' },
  { valor: 'fatura_cartao', rotulo: 'Fatura de cartão' },
  { valor: 'extrato', rotulo: 'Extrato bancário' },
  { valor: 'contracheque', rotulo: 'Contracheque' },
];

/** Tipo do conteúdo para o Storage, pela extensão quando o navegador não informa. */
function tipoDoArquivo(arquivo: File): string {
  if (arquivo.type) return arquivo.type;
  const extensao = arquivo.name.split('.').pop()?.toLowerCase();
  return extensao === 'ofx'
    ? 'application/x-ofx'
    : extensao === 'csv'
      ? 'text/csv'
      : 'application/octet-stream';
}

type Etapa = 'parado' | 'conferindo' | 'enviando' | 'lendo';

let clienteDoEnvio: ReturnType<typeof createClient> | null = null;

/** O envio usa o endereço assinado pelo servidor; não precisa da sessão do navegador. */
function storageDoEnvio() {
  if (!clienteDoEnvio) {
    const { url, chavePublica } = configSupabase();
    clienteDoEnvio = createClient(url, chavePublica, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'no-azul-envio-de-documentos',
      },
    });
  }
  return clienteDoEnvio.storage;
}

export function FormularioDeEnvio({ guardarOriginal }: { guardarOriginal: boolean }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [etapa, setEtapa] = useState<Etapa>('parado');
  const [erro, setErro] = useState<string | null>(null);
  const [duplicado, setDuplicado] = useState<{ nome: string; criadoEm: string } | null>(null);

  async function enviar(reenviar: boolean) {
    const arquivo = entrada.current?.files?.[0];
    const tipo =
      (document.getElementById('tipo-do-documento') as HTMLSelectElement | null)?.value ?? '';
    setErro(null);
    setDuplicado(null);
    if (!arquivo) return setErro('Escolha um arquivo ou tire uma foto.');
    if (arquivo.size > TAMANHO_MAXIMO) return setErro('O arquivo passa de 15 MB.');
    if (arquivo.size === 0) return setErro('O arquivo está vazio.');

    try {
      setEtapa('conferindo');
      const hash = await sha256(new Uint8Array(await arquivo.arrayBuffer()));
      const inicio = await iniciarEnvioAcao({
        nome: arquivo.name,
        tamanho: arquivo.size,
        hash,
        tipoInformado: (tipo || null) as never,
        reenviar,
      });
      if (!inicio.ok) {
        setEtapa('parado');
        if (inicio.duplicado) return setDuplicado(inicio.duplicado);
        return setErro(inicio.erro);
      }

      setEtapa('enviando');
      const envio = await storageDoEnvio()
        .from('documentos')
        .uploadToSignedUrl(inicio.caminho, inicio.token, arquivo, {
          contentType: tipoDoArquivo(arquivo),
        });
      if (envio.error) {
        setEtapa('parado');
        return setErro('O envio do arquivo falhou. Confira a internet e tente de novo.');
      }

      setEtapa('lendo');
      const concluido = await concluirEnvioAcao(inicio.documentoId);
      if (!concluido.ok) {
        setEtapa('parado');
        return setErro(concluido.erro);
      }
      router.push(`/documentos/${inicio.documentoId}`);
    } catch {
      setEtapa('parado');
      setErro('Não foi possível enviar agora. Tente de novo em instantes.');
    }
  }

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    void enviar(false);
  }

  const ocupado = etapa !== 'parado';
  const textoDoBotao = {
    parado: 'Enviar e ler',
    conferindo: 'Conferindo o arquivo…',
    enviando: 'Enviando…',
    lendo: 'Começando a leitura…',
  }[etapa];

  return (
    <form onSubmit={aoEnviar} className="grid gap-4" aria-busy={ocupado}>
      <label className="block min-w-0">
        <span className="mb-1 block text-sm font-medium text-slate-700">Arquivo ou foto</span>
        <input
          ref={entrada}
          type="file"
          name="arquivo"
          accept={ACEITOS}
          className="block w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-azul-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
          onChange={() => {
            setErro(null);
            setDuplicado(null);
          }}
        />
        <span className="mt-1 block text-xs text-slate-500">
          PDF, foto (JPG ou PNG), CSV, OFX ou XLSX, até 15 MB. No celular, dá para tirar a foto na
          hora.
        </span>
      </label>
      <Selecao
        rotulo="Tipo do documento"
        name="tipo"
        id="tipo-do-documento"
        opcoes={TIPOS}
        defaultValue=""
      />
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        O arquivo é lido aqui no No Azul, sem serviço de IA. Nada entra nas suas contas antes de
        você revisar e aprovar.{' '}
        {guardarOriginal
          ? 'Você escolheu guardar o original depois da aprovação.'
          : 'O original é apagado quando você aprova ou descarta.'}
      </p>
      {erro ? <Aviso erro={erro} /> : null}
      {duplicado ? (
        <div
          role="alert"
          className="grid gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          <p>
            Este arquivo já foi enviado em {formatarData(dataCivilEm(new Date(duplicado.criadoEm)))}{' '}
            ({duplicado.nome}).
          </p>
          <div>
            <button
              type="button"
              onClick={() => void enviar(true)}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-medium hover:bg-amber-100"
            >
              Enviar de novo
            </button>
          </div>
        </div>
      ) : null}
      <button
        type="submit"
        disabled={ocupado}
        className="w-full rounded-lg bg-azul-600 px-4 py-2.5 font-medium text-white transition hover:bg-azul-700 disabled:opacity-60"
      >
        {textoDoBotao}
      </button>
    </form>
  );
}
