import {
  listarContas,
  pagarConta,
  planoDePagamento,
  projetarOcorrencias,
  somarDias,
  type Centavos,
  type Conta,
  type DadosFinanceiros,
  type DataCivil,
} from '@no-azul/motor';
import type { AcaoDaConta, AcaoDaLinha } from './cruzamento';
import type { TipoDeDocumento, TipoDeLancamento } from './tipos';

/**
 * O que a aprovação grava, a partir das escolhas da revisão. Quanto sai da reserva em cada
 * pagamento vem do motor (planoDePagamento), um pagamento depois do outro, como na função
 * `aprovar_documento` do banco, que grava tudo numa transação.
 */

export interface LinhaRevisada {
  acao: AcaoDaLinha;
  data: DataCivil;
  descricao: string;
  valorCentavos: Centavos;
  tipo: TipoDeLancamento;
  categoriaId: string | null;
}

export interface ContaRevisada {
  acao: AcaoDaConta;
  nome: string;
  valorCentavos: Centavos;
  vencimento: DataCivil;
  categoriaId: string | null;
}

export interface Revisao {
  tipoDoDocumento: TipoDeDocumento;
  conta: ContaRevisada | null;
  linhas: LinhaRevisada[];
}

export type ContaParaGravar =
  | {
      acao: 'criar';
      nome: string;
      valor_centavos: Centavos;
      vencimento: DataCivil;
      categoria_id: string | null;
      quita_itens: boolean;
    }
  | {
      acao: 'atualizar_avulsa';
      conta_avulsa_id: string;
      valor_centavos: Centavos;
      vencimento: DataCivil;
      quita_itens: boolean;
    }
  | { acao: 'prever_fixa'; recorrencia_id: string; competencia: string; valor_centavos: Centavos };

export interface PagamentoParaGravar {
  pago_em: DataCivil;
  valor_centavos: Centavos;
  saque_centavos: Centavos;
  tipo_lancamento: 'despesa' | 'transferencia' | null;
  recorrencia_id: string | null;
  competencia: string | null;
  conta_avulsa_id: string | null;
}

export interface RecebimentoParaGravar {
  recorrencia_id: string;
  competencia: string;
  valor_centavos: Centavos;
  recebido_em: DataCivil;
}

export interface LancamentoParaGravar {
  data: DataCivil;
  descricao: string;
  valor_centavos: Centavos;
  tipo: TipoDeLancamento;
  categoria_id: string | null;
  recorrencia_id: string | null;
  competencia: string | null;
}

export interface PlanoDaAprovacao {
  conta: ContaParaGravar | null;
  pagamentos: PagamentoParaGravar[];
  recebimentos: RecebimentoParaGravar[];
  lancamentos: LancamentoParaGravar[];
}

export type ResultadoDaAprovacao =
  { ok: true; plano: PlanoDaAprovacao } | { ok: false; erro: string };

function valorValido(valor: Centavos): boolean {
  return Number.isSafeInteger(valor) && valor > 0;
}

function contaEmAberto(dados: DadosFinanceiros, chave: string, perto: DataCivil): Conta | null {
  const conta = listarContas(dados, somarDias(perto, -120), somarDias(perto, 120)).find(
    (c) => c.chave === chave,
  );
  return conta && conta.pagoEm === null ? conta : null;
}

export function planoDaAprovacao(revisao: Revisao, dados: DadosFinanceiros): ResultadoDaAprovacao {
  const plano: PlanoDaAprovacao = {
    conta: null,
    pagamentos: [],
    recebimentos: [],
    lancamentos: [],
  };
  let atual = dados;

  const importados = revisao.linhas.filter((l) => l.acao.tipo === 'lancar');
  // Fatura com itens importados: entra na reserva e fica fora do orçamento (D4 e 4.4).
  const quitaItens = revisao.tipoDoDocumento === 'fatura_cartao' && importados.length > 0;

  const conta = revisao.conta;
  if (conta && conta.acao.tipo !== 'nao_gravar') {
    if (!valorValido(conta.valorCentavos)) return { ok: false, erro: 'Informe o valor da conta.' };
    if (!conta.nome.trim()) return { ok: false, erro: 'Informe o nome da conta.' };
    switch (conta.acao.tipo) {
      case 'criar':
        plano.conta = {
          acao: 'criar',
          nome: conta.nome.trim().slice(0, 120),
          valor_centavos: conta.valorCentavos,
          vencimento: conta.vencimento,
          categoria_id: conta.categoriaId,
          quita_itens: quitaItens,
        };
        break;
      case 'atualizar_avulsa': {
        const id = conta.acao.conta.contaAvulsaId;
        if (!id) return { ok: false, erro: 'Conta não encontrada.' };
        plano.conta = {
          acao: 'atualizar_avulsa',
          conta_avulsa_id: id,
          valor_centavos: conta.valorCentavos,
          vencimento: conta.vencimento,
          quita_itens: quitaItens,
        };
        break;
      }
      case 'prever_fixa': {
        const { recorrenciaId, competencia } = conta.acao.conta;
        if (!recorrenciaId || !competencia)
          return { ok: false, erro: 'Despesa fixa não encontrada.' };
        plano.conta = {
          acao: 'prever_fixa',
          recorrencia_id: recorrenciaId,
          competencia,
          valor_centavos: conta.valorCentavos,
        };
        break;
      }
    }
  }

  for (const linha of revisao.linhas) {
    if (linha.acao.tipo === 'ignorar') continue;
    if (!valorValido(linha.valorCentavos))
      return { ok: false, erro: `Informe o valor de "${linha.descricao}".` };
    const descricao = linha.descricao.trim().slice(0, 255);
    if (!descricao) return { ok: false, erro: 'Toda linha marcada precisa de descrição.' };

    switch (linha.acao.tipo) {
      case 'lancar':
        plano.lancamentos.push({
          data: linha.data,
          descricao,
          valor_centavos: linha.valorCentavos,
          tipo: linha.tipo,
          categoria_id: linha.categoriaId,
          recorrencia_id: null,
          competencia: null,
        });
        break;

      case 'quitar':
      case 'vincular_fixa': {
        const aberta = contaEmAberto(atual, linha.acao.conta.chave, linha.data);
        if (!aberta) {
          return {
            ok: false,
            erro: `A conta "${linha.acao.conta.nome}" já foi paga ou mudou. Abra a revisão de novo.`,
          };
        }
        if (aberta.origem === 'avulsa' && aberta.valorCentavos !== linha.valorCentavos) {
          return {
            ok: false,
            erro: `"${aberta.nome}" vale outro valor. Para quitá-la com este, edite a conta antes ou lance a linha como gasto.`,
          };
        }
        const paga = { ...aberta, valorCentavos: linha.valorCentavos };
        const pagamento = planoDePagamento(atual, paga, linha.data);
        plano.pagamentos.push({
          pago_em: linha.data,
          valor_centavos: pagamento.valorCentavos,
          saque_centavos: pagamento.saqueCentavos,
          tipo_lancamento: pagamento.tipoDoLancamento,
          recorrencia_id: aberta.recorrenciaId,
          competencia: aberta.competencia,
          conta_avulsa_id: aberta.contaAvulsaId,
        });
        atual = pagarConta(atual, paga, linha.data);
        if (linha.acao.tipo === 'vincular_fixa') {
          // O item da fatura fica ligado à fixa paga no cartão e não vira gasto variável (D4).
          plano.lancamentos.push({
            data: linha.data,
            descricao,
            valor_centavos: linha.valorCentavos,
            tipo: 'despesa',
            categoria_id: linha.categoriaId,
            recorrencia_id: aberta.recorrenciaId,
            competencia: aberta.competencia,
          });
        }
        break;
      }

      case 'receber': {
        const { recorrenciaId, competencia, nome } = linha.acao.renda;
        const pendente = projetarOcorrencias(
          atual,
          'renda',
          somarDias(linha.data, -60),
          somarDias(linha.data, 60),
        ).find(
          (o) =>
            o.recorrencia.id === recorrenciaId &&
            o.competencia === competencia &&
            o.status === 'pendente',
        );
        const repetido = plano.recebimentos.some(
          (r) => r.recorrencia_id === recorrenciaId && r.competencia === competencia,
        );
        if (!pendente || repetido) {
          return {
            ok: false,
            erro: `O recebimento de "${nome}" já foi confirmado. Abra a revisão de novo.`,
          };
        }
        plano.recebimentos.push({
          recorrencia_id: recorrenciaId,
          competencia,
          valor_centavos: linha.valorCentavos,
          recebido_em: linha.data,
        });
        break;
      }
    }
  }

  return { ok: true, plano };
}
