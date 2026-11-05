import type { ReactNode } from 'react';
import { diferencaEmDias, type Conta, type DataCivil } from '@no-azul/motor';
import { pagarContaAcao } from '@/app/(app)/contas/acoes';
import { FormularioRapido } from '@/components/acoes-rapidas';
import { Valor } from '@/components/numeros';
import { centavosParaTexto, formatarData } from '@/lib/formatacao';

export function situacaoDoVencimento(
  conta: Conta,
  hoje: DataCivil,
): { texto: string; classe: string } {
  const dias = diferencaEmDias(hoje, conta.vencimento);
  if (dias < 0) {
    return {
      texto: `Vencida há ${-dias} ${dias === -1 ? 'dia' : 'dias'}`,
      classe: 'bg-red-50 text-red-800',
    };
  }
  if (dias === 0) return { texto: 'Vence hoje', classe: 'bg-amber-50 text-amber-900' };
  return {
    texto: `Vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}`,
    classe: 'bg-slate-100 text-slate-700',
  };
}

export function Chip({ children, classe }: { children: ReactNode; classe: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${classe}`}>{children}</span>
  );
}

/** Conta em aberto com o botão de pagar (Contas e fixas e painel). */
export function ItemContaAPagar({ conta, hoje }: { conta: Conta; hoje: DataCivil }) {
  const situacao = situacaoDoVencimento(conta, hoje);
  return (
    <li className="grid gap-2 rounded-xl border border-slate-200 p-3" data-conta={conta.nome}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{conta.nome}</p>
          <p className="text-sm text-slate-600">
            {formatarData(conta.vencimento)} ·{' '}
            {conta.origem === 'fixa' ? 'Despesa fixa' : 'Conta avulsa'}
          </p>
        </div>
        <Valor
          chave={`conta.${conta.chave}`}
          centavos={conta.valorCentavos}
          className="font-semibold"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip classe={situacao.classe}>{situacao.texto}</Chip>
        {conta.pagaNoCartao ? (
          <Chip classe="bg-slate-100 text-slate-700">Paga no cartão</Chip>
        ) : null}
        {conta.quitaItens ? (
          <Chip classe="bg-slate-100 text-slate-700">Fatura com itens importados</Chip>
        ) : null}
      </div>
      <FormularioRapido
        acao={pagarContaAcao}
        ocultos={{ chave: conta.chave }}
        abrir="Pagar"
        enviar="Confirmar pagamento"
        campos={[
          ...(conta.origem === 'fixa'
            ? [
                {
                  nome: 'valor',
                  rotulo: 'Valor pago (R$)',
                  tipo: 'valor' as const,
                  valorInicial: centavosParaTexto(conta.valorCentavos),
                },
              ]
            : []),
          { nome: 'pagoEm', rotulo: 'Data do pagamento', tipo: 'data', valorInicial: hoje },
        ]}
      />
    </li>
  );
}
