'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { AcaoComConfirmacao } from '@/components/acoes-rapidas';
import { Aviso } from '@/components/formulario';
import type { EstadoFormulario } from '@/lib/estado-formulario';
import { descartarAcao, lerDeNovoAcao } from '../acoes';

/** Atualiza a página a cada 2 segundos enquanto o documento está sendo lido (até 4 minutos). */
export function AtualizarEnquantoLe() {
  const router = useRouter();
  useEffect(() => {
    const inicio = Date.now();
    const intervalo = setInterval(() => {
      if (Date.now() - inicio > 4 * 60_000) clearInterval(intervalo);
      else router.refresh();
    }, 2000);
    return () => clearInterval(intervalo);
  }, [router]);
  return null;
}

const TIPOS = [
  { valor: '', rotulo: 'Descobrir pelo conteúdo' },
  { valor: 'comprovante', rotulo: 'Comprovante ou nota fiscal' },
  { valor: 'boleto', rotulo: 'Boleto ou conta de consumo' },
  { valor: 'fatura_cartao', rotulo: 'Fatura de cartão' },
  { valor: 'extrato', rotulo: 'Extrato bancário' },
  { valor: 'contracheque', rotulo: 'Contracheque' },
];

/** Ler o documento de novo, opcionalmente como outro tipo. */
export function LerDeNovo({
  documentoId,
  tipoAtual,
}: {
  documentoId: string;
  tipoAtual: string | null;
}) {
  const [estado, executar, pendente] = useActionState<EstadoFormulario, FormData>(
    lerDeNovoAcao,
    {},
  );
  return (
    <form action={executar} className="grid gap-2 sm:flex sm:items-end">
      <input type="hidden" name="documentoId" value={documentoId} />
      <label className="grid min-w-0 gap-1 text-sm">
        <span className="font-medium text-slate-700">Ler de novo como</span>
        <select
          name="tipo"
          defaultValue={tipoAtual ?? ''}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {TIPOS.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.rotulo}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pendente}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
      >
        {pendente ? 'Aguarde…' : 'Ler de novo'}
      </button>
      <Aviso erro={estado.erro} mensagem={estado.mensagem} />
    </form>
  );
}

export function Descartar({ documentoId }: { documentoId: string }) {
  return (
    <AcaoComConfirmacao
      acao={descartarAcao}
      ocultos={{ documentoId }}
      texto="Descartar documento"
      textoConfirmar="Descartar"
      pergunta="Nada será gravado e o arquivo será apagado."
      perigo
    />
  );
}
