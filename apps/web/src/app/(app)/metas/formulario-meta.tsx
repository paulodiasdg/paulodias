'use client';

import { useActionState } from 'react';
import { Aviso, BotaoEnviar, Campo, CampoValor, Marcar, Selecao } from '@/components/formulario';
import type { EstadoFormulario } from '@/lib/estado-formulario';
import { salvarMetaAcao } from './acoes';

export interface ValoresDaMeta {
  id?: string;
  nome: string;
  alvo: string;
  prazo: string;
  prioridade: string;
  emergencia: boolean;
}

export function FormularioMeta({ valores }: { valores: ValoresDaMeta }) {
  const [estado, acao, pendente] = useActionState<EstadoFormulario, FormData>(salvarMetaAcao, {});
  const v = (campo: keyof ValoresDaMeta) => estado.campos?.[campo] ?? String(valores[campo] ?? '');

  return (
    <form action={acao} className="grid gap-4" noValidate>
      {valores.id ? <input type="hidden" name="id" value={valores.id} /> : null}
      <Aviso erro={estado.erro} />
      <Campo
        rotulo="Nome"
        name="nome"
        required
        maxLength={120}
        defaultValue={v('nome')}
        placeholder="Viagem"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoValor
          rotulo="Quanto quer juntar (R$)"
          name="alvo"
          required
          defaultValue={v('alvo')}
        />
        <Campo rotulo="Prazo" name="prazo" type="date" required defaultValue={v('prazo')} />
      </div>
      <Selecao
        rotulo="Prioridade"
        name="prioridade"
        defaultValue={v('prioridade')}
        opcoes={[
          { valor: '1', rotulo: '1 · mais importante' },
          { valor: '2', rotulo: '2' },
          { valor: '3', rotulo: '3 · menos importante' },
        ]}
      />
      <Marcar
        rotulo="É a reserva de emergência"
        name="emergencia"
        defaultChecked={estado.campos ? estado.campos.emergencia === 'on' : valores.emergencia}
        ajuda="Só pode haver uma. O índice de saúde dá nota máxima com 6 meses de despesas fixas e variáveis guardados."
      />
      <div>
        <BotaoEnviar
          pendente={pendente}
          texto={valores.id ? 'Salvar alterações' : 'Criar meta'}
          largura="auto"
        />
      </div>
    </form>
  );
}
