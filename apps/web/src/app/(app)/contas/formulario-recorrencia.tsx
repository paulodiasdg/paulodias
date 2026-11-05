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
import { salvarRecorrenciaAcao } from './acoes';

export interface ValoresDaRecorrencia {
  id?: string;
  tipo: 'renda' | 'fixa';
  nome: string;
  valor: string;
  dia: string;
  inicio: string;
  categoriaId: string;
  rendaVariavel: boolean;
  pagaNoCartao: boolean;
}

export function FormularioRecorrencia({
  valores,
  grupos,
}: {
  valores: ValoresDaRecorrencia;
  grupos: { rotulo: string; opcoes: Opcao[] }[];
}) {
  const [estado, acao, pendente] = useActionState<EstadoFormulario, FormData>(
    salvarRecorrenciaAcao,
    {},
  );
  const v = (campo: keyof ValoresDaRecorrencia) =>
    estado.campos?.[campo] ?? String(valores[campo] ?? '');
  const renda = valores.tipo === 'renda';

  return (
    <form action={acao} className="grid gap-4" noValidate>
      <input type="hidden" name="tipo" value={valores.tipo} />
      {valores.id ? <input type="hidden" name="id" value={valores.id} /> : null}
      <Aviso erro={estado.erro} />
      <Campo
        rotulo="Nome"
        name="nome"
        required
        maxLength={120}
        defaultValue={v('nome')}
        placeholder={renda ? 'Salário' : 'Aluguel'}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoValor
          rotulo={renda ? 'Valor previsto (R$)' : 'Valor (R$)'}
          name="valor"
          required
          defaultValue={v('valor')}
        />
        <Campo
          rotulo={renda ? 'Dia do recebimento' : 'Dia do vencimento'}
          name="dia"
          type="number"
          min={1}
          max={31}
          required
          defaultValue={v('dia')}
          ajuda="Dia 31 vira o último dia nos meses menores."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          rotulo="Começa em"
          name="inicio"
          type="date"
          required
          defaultValue={v('inicio')}
          ajuda={
            renda
              ? 'Recebimentos antes desta data não entram.'
              : 'Vencimentos antes desta data não são cobrados.'
          }
        />
        <Selecao
          rotulo="Categoria"
          name="categoriaId"
          grupos={grupos}
          vazio="Sem categoria"
          defaultValue={v('categoriaId')}
        />
      </div>
      {renda ? (
        <Marcar
          rotulo="Renda variável"
          name="rendaVariavel"
          defaultChecked={
            estado.campos ? estado.campos.rendaVariavel === 'on' : valores.rendaVariavel
          }
          ajuda="O valor previsto é uma estimativa; confirme o valor real ao receber."
        />
      ) : (
        <Marcar
          rotulo="Paga no cartão de crédito"
          name="pagaNoCartao"
          defaultChecked={
            estado.campos ? estado.campos.pagaNoCartao === 'on' : valores.pagaNoCartao
          }
          ajuda="Conta no orçamento, mas o dinheiro sai pela fatura, não pela reserva de contas."
        />
      )}
      <div>
        <BotaoEnviar
          pendente={pendente}
          texto={valores.id ? 'Salvar alterações' : 'Cadastrar'}
          largura="auto"
        />
      </div>
    </form>
  );
}
