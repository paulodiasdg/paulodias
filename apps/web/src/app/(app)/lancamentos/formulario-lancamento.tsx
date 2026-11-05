'use client';

import { useActionState, useState } from 'react';
import {
  Aviso,
  BotaoEnviar,
  Campo,
  CampoValor,
  Selecao,
  type Opcao,
} from '@/components/formulario';
import type { EstadoFormulario } from '@/lib/estado-formulario';
import { salvarLancamentoAcao } from './acoes';

export interface ValoresDoLancamento {
  id?: string;
  tipo: 'despesa' | 'receita' | 'transferencia';
  descricao: string;
  valor: string;
  data: string;
  categoriaId: string;
}

type Grupos = { rotulo: string; opcoes: Opcao[] }[];

const TIPOS = [
  { valor: 'despesa', rotulo: 'Gasto' },
  { valor: 'receita', rotulo: 'Receita' },
  { valor: 'transferencia', rotulo: 'Transferência' },
] as const;

export function FormularioLancamento({
  valores,
  gruposPorTipo,
}: {
  valores: ValoresDoLancamento;
  gruposPorTipo: Record<ValoresDoLancamento['tipo'], Grupos>;
}) {
  const [estado, acao, pendente] = useActionState<EstadoFormulario, FormData>(
    salvarLancamentoAcao,
    {},
  );
  const [tipo, setTipo] = useState<ValoresDoLancamento['tipo']>(
    (estado.campos?.tipo as ValoresDoLancamento['tipo'] | undefined) ?? valores.tipo,
  );
  const v = (campo: keyof ValoresDoLancamento) =>
    estado.campos?.[campo] ?? String(valores[campo] ?? '');

  return (
    <form action={acao} className="grid gap-4" noValidate>
      {valores.id ? <input type="hidden" name="id" value={valores.id} /> : null}
      <Aviso erro={estado.erro} />
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium text-slate-700">Tipo</legend>
        <div className="flex flex-wrap gap-2">
          {TIPOS.map((opcao) => (
            <label
              key={opcao.valor}
              className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${tipo === opcao.valor ? 'border-azul-600 bg-azul-50 text-azul-900' : 'border-slate-300 text-slate-700'}`}
            >
              <input
                type="radio"
                name="tipo"
                value={opcao.valor}
                checked={tipo === opcao.valor}
                onChange={() => setTipo(opcao.valor)}
                className="sr-only"
              />
              {opcao.rotulo}
            </label>
          ))}
        </div>
      </fieldset>
      <Campo
        rotulo="Descrição"
        name="descricao"
        required
        maxLength={255}
        defaultValue={v('descricao')}
        placeholder="Mercado"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoValor rotulo="Valor (R$)" name="valor" required defaultValue={v('valor')} />
        <Campo rotulo="Data" name="data" type="date" required defaultValue={v('data')} />
      </div>
      <Selecao
        key={tipo}
        rotulo="Categoria"
        name="categoriaId"
        grupos={gruposPorTipo[tipo]}
        vazio="Sem categoria"
        defaultValue={tipo === valores.tipo ? v('categoriaId') : ''}
      />
      <div>
        <BotaoEnviar
          pendente={pendente}
          texto={valores.id ? 'Salvar alterações' : 'Lançar'}
          largura="auto"
        />
      </div>
    </form>
  );
}
