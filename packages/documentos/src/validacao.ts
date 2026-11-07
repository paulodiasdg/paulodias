import { diferencaEmDias, type DataCivil } from '@no-azul/motor';
import { semCodigos } from './boleto';
import { CONFIANCA_MINIMA, type Extracao, type LancamentoExtraido } from './tipos';

/**
 * Validação da leitura antes de gravar `extracao_json`: dados sensíveis mascarados, datas e
 * valores conferidos, soma dos itens contra o total. Nada aqui grava ou calcula saldo.
 */

const CPF = /(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g;
const CNPJ = /(?<!\d)\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}(?!\d)/g;
const CARTAO = /(?<!\d)(?:\d{4}[ -]?){3}(\d{4})(?!\d)/g;
const CPF_PARCIAL = /\*{3}\.?\d{3}\.?\d{3}-?\*{2}/g;

/** Tira CPF, CNPJ, número de cartão e códigos de boleto de um texto (seção 4.5 da spec). */
export function mascarar(texto: string): string {
  return semCodigos(texto)
    .replace(CARTAO, '**** **** **** $1')
    .replace(CNPJ, '**.***.***/****-**')
    .replace(CPF, '***.***.***-**')
    .replace(CPF_PARCIAL, '***.***.***-**');
}

function formatarCentavos(centavos: number): string {
  const absoluto = Math.abs(centavos);
  const reais = Math.floor(absoluto / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${reais},${(absoluto % 100).toString().padStart(2, '0')}`;
}

function validarLancamento(lancamento: LancamentoExtraido, hoje: DataCivil): LancamentoExtraido {
  const avisos = [...lancamento.avisos];
  const confianca = { ...lancamento.confianca };
  const { data } = lancamento;
  let { valorCentavos } = lancamento;

  if (valorCentavos !== null && (!Number.isSafeInteger(valorCentavos) || valorCentavos <= 0)) {
    valorCentavos = null;
  }
  if (valorCentavos === null) {
    confianca.valor = 0;
    avisos.push('Informe o valor.');
  }
  if (data === null) {
    confianca.data = 0;
    avisos.push('Informe a data.');
  } else if (diferencaEmDias(hoje, data) > 0) {
    confianca.data = Math.min(confianca.data, 0.5);
    avisos.push('A data é depois de hoje; confira.');
  } else if (diferencaEmDias(data, hoje) > 400) {
    confianca.data = Math.min(confianca.data, 0.7);
    avisos.push('A data é de mais de um ano atrás; confira.');
  }

  return {
    ...lancamento,
    descricao: mascarar(lancamento.descricao).slice(0, 255) || 'Lançamento',
    valorCentavos,
    data,
    confianca,
    avisos: [...new Set(avisos)],
  };
}

export function validarExtracao(extracao: Extracao, hoje: DataCivil): Extracao {
  const avisos = [...extracao.avisos];
  const lancamentos = extracao.lancamentos.map((l) => validarLancamento(l, hoje));

  let conta = extracao.conta;
  if (conta) {
    conta = {
      ...conta,
      nome: mascarar(conta.nome).slice(0, 120) || 'Conta',
      confianca: { ...conta.confianca },
    };
    if (
      conta.valorCentavos !== null &&
      (!Number.isSafeInteger(conta.valorCentavos) || conta.valorCentavos <= 0)
    ) {
      conta.valorCentavos = null;
      conta.confianca.valor = 0;
    }
    if (conta.vencimento !== null && diferencaEmDias(conta.vencimento, hoje) > 400) {
      conta.confianca.vencimento = Math.min(conta.confianca.vencimento, 0.7);
      avisos.push('O vencimento é de mais de um ano atrás; confira.');
    }
  }

  // Soma dos itens contra o total da fatura (4.2, passo 4).
  if (extracao.tipo === 'fatura_cartao' && conta?.valorCentavos != null && lancamentos.length > 0) {
    const soma = lancamentos.reduce((total, l) => {
      if (l.valorCentavos === null) return total;
      if (l.tipo === 'despesa') return total + l.valorCentavos;
      if (l.tipo === 'receita') return total - l.valorCentavos;
      return total;
    }, 0);
    const diferenca = conta.valorCentavos - soma;
    if (diferenca !== 0) {
      avisos.push(`O total da fatura difere em ${formatarCentavos(diferenca)} da soma dos itens.`);
      for (const l of lancamentos) {
        l.confianca = {
          data: l.confianca.data,
          valor: Math.min(l.confianca.valor, CONFIANCA_MINIMA - 0.01),
        };
      }
    }
  }

  return {
    ...extracao,
    emissor: extracao.emissor ? mascarar(extracao.emissor).slice(0, 120) : null,
    conta,
    lancamentos,
    avisos: [...new Set(avisos)],
  };
}
