'use client';

import { useActionState } from 'react';
import { Aviso } from '@/components/formulario';
import type { EstadoFormulario } from '@/lib/estado-formulario';
import { guardarOriginalAcao } from './acoes';

/** Escolha da seção 4.5 da spec: guardar o arquivo original depois da aprovação (padrão: não). */
export function GuardarOriginal({ guardar }: { guardar: boolean }) {
  const [estado, executar, pendente] = useActionState<EstadoFormulario, FormData>(
    guardarOriginalAcao,
    {},
  );
  return (
    <form action={executar} className="grid gap-2 border-t border-slate-100 pt-3">
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="guardar"
          defaultChecked={guardar}
          disabled={pendente}
          onChange={(evento) => evento.currentTarget.form?.requestSubmit()}
          className="mt-0.5 size-4 accent-azul-600"
        />
        <span>
          Guardar o arquivo original depois de aprovar
          <span className="block text-xs text-slate-500">
            Sem marcar, o arquivo é apagado e ficam só os dados que você confirmou.
          </span>
        </span>
      </label>
      <Aviso erro={estado.erro} mensagem={estado.mensagem} />
    </form>
  );
}
