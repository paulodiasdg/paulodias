import { COOKIE_DO_AVISO } from '@/lib/financeiro/aviso-da-reserva';
import { lerAvisoDaReserva } from '@/lib/financeiro/aviso-no-servidor';
import { formatarReais } from '@/lib/formatacao';
import { ApagarCookie } from './apagar-cookie';

/**
 * Mostra, uma vez, por que o valor da semana para contas mudou depois de um cadastro (D3).
 * O aviso é texto que o servidor montou com o motor; não entra no teste de números do painel.
 */
export async function AvisoDaReserva() {
  const aviso = await lerAvisoDaReserva();
  if (!aviso) return null;
  return (
    <div
      role="status"
      className="grid gap-1 rounded-xl border border-azul-100 bg-azul-50 p-4 text-sm text-azul-900"
      data-aviso="reserva"
    >
      <p className="font-semibold">
        O valor a guardar para contas nesta semana mudou de {formatarReais(aviso.deCentavos)} para{' '}
        {formatarReais(aviso.paraCentavos)}.
      </p>
      {aviso.motivos.length > 0 ? (
        <ul className="list-disc pl-5">
          {aviso.motivos.map((motivo) => (
            <li key={motivo}>{motivo}</li>
          ))}
        </ul>
      ) : null}
      <ApagarCookie nome={COOKIE_DO_AVISO} />
    </div>
  );
}
