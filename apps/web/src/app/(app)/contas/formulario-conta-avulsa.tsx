'use client';

import { useActionState } from 'react';
import {
  Aviso,
  BotaoEnviar,
  Campo,
  CampoValor,
  Marcar,
  Selecao,
  type Opcao,
} from '@/components/formulario';
import type { EstadoFormulario } from '@/lib/estado-formulario';
import { salvarContaAvulsaAcao } from './acoes';

export interface ValoresDaContaAvulsa {
  id?: string;
  nome: string;
  valor: string;
  vencimento: string;
  categoriaId: string;
  quitaItens: boolean;
}

export function FormularioContaAvulsa({
  valores,
  grupos,
  bloqueada = false,
}: {
  valores: ValoresDaContaAvulsa;
  grupos: { rotulo: string; opcoes: Opcao[] }[];
  bloqueada?: boolean;
}) {
  const [estado, acao, pendente] = useActionState<EstadoFormulario, FormData>(
    salvarContaAvulsaAcao,
    {},
  );
  const v = (campo: keyof ValoresDaContaAvulsa) =>
    estado.campos?.[campo] ?? String(valores[campo] ?? '');

  return (
    <form action={acao} className="grid gap-4" noValidate>
      {valores.id ? <input type="hidden" name="id" value={valores.id} /> : null}
      <Aviso erro={estado.erro} />
      <fieldset disabled={bloqueada} className="grid gap-4 disabled:opacity-70">
        <Campo
          rotulo="Nome"
          name="nome"
          required
          maxLength={120}
          defaultValue={v('nome')}
          placeholder="IPVA"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoValor rotulo="Valor (R$)" name="valor" required defaultValue={v('valor')} />
          <Campo
            rotulo="Vencimento"
            name="vencimento"
            type="date"
            required
            defaultValue={v('vencimento')}
          />
        </div>
        <Selecao
          rotulo="Categoria"
          name="categoriaId"
          grupos={grupos}
          vazio="Sem categoria"
          defaultValue={v('categoriaId')}
        />
        <Marcar
          rotulo="Fatura de cartão com os itens já lançados"
          name="quitaItens"
          defaultChecked={estado.campos ? estado.campos.quitaItens === 'on' : valores.quitaItens}
          ajuda="Os itens já contam como gastos; o pagamento da fatura vira transferência e não conta de novo."
        />
        {bloqueada ? null : (
          <div>
            <BotaoEnviar
              pendente={pendente}
              texto={valores.id ? 'Salvar alterações' : 'Cadastrar'}
              largura="auto"
            />
          </div>
        )}
      </fieldset>
    </form>
  );
}
