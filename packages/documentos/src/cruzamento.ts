import {
  competenciaDe,
  diferencaEmDias,
  listarContas,
  projetarOcorrencias,
  somarDias,
  type Centavos,
  type Conta,
  type DadosFinanceiros,
  type DataCivil,
} from '@no-azul/motor';
import { descricoesParecidas } from './categorias';
import { normalizar as normalizarNome } from './texto';
import type { Extracao, LancamentoExtraido } from './tipos';

/**
 * Cruzamento da leitura com o que já está gravado (4.2, passo 5, e seção 4d do PLANO). Feito na
 * hora da revisão, com os dados daquele momento. Só sugere: a pessoa escolhe o que gravar.
 */

/** Conta a pagar já cadastrada, como a revisão mostra. */
export interface ContaSugerida {
  chave: string;
  origem: 'fixa' | 'avulsa';
  nome: string;
  valorCentavos: Centavos;
  vencimento: DataCivil;
  pagoEm: DataCivil | null;
  recorrenciaId: string | null;
  competencia: string | null;
  contaAvulsaId: string | null;
}

export interface RendaSugerida {
  recorrenciaId: string;
  competencia: string;
  nome: string;
  valorPrevistoCentavos: Centavos;
  dataPrevista: DataCivil;
}

export type AcaoDaLinha =
  | { tipo: 'lancar' }
  | { tipo: 'ignorar'; motivo: string }
  | { tipo: 'quitar'; conta: ContaSugerida }
  | { tipo: 'receber'; renda: RendaSugerida }
  | { tipo: 'vincular_fixa'; conta: ContaSugerida };

export interface SugestaoDaLinha {
  indice: number;
  /** O que a revisão propõe. */
  acao: AcaoDaLinha;
  /** Outras escolhas para a pessoa (sempre inclui lançar e ignorar). */
  alternativas: AcaoDaLinha[];
  aviso: string | null;
}

export type AcaoDaConta =
  | { tipo: 'criar' }
  | { tipo: 'prever_fixa'; conta: ContaSugerida }
  | { tipo: 'atualizar_avulsa'; conta: ContaSugerida }
  | { tipo: 'nao_gravar'; motivo: string };

export interface SugestaoDaConta {
  acao: AcaoDaConta;
  alternativas: AcaoDaConta[];
  aviso: string | null;
}

export interface Cruzamento {
  conta: SugestaoDaConta | null;
  linhas: SugestaoDaLinha[];
  avisos: string[];
}

/** Dias de folga entre o extrato e o vencimento ou o pagamento (4.4 da spec). */
export const DIAS_DO_PAGAMENTO = 5;
/** Dias de folga entre a duplicata e o lançamento gravado (4.4 da spec). */
export const DIAS_DA_DUPLICATA = 1;

function distancia(a: DataCivil, b: DataCivil): number {
  return Math.abs(diferencaEmDias(a, b));
}

function sugerida(conta: Conta): ContaSugerida {
  return {
    chave: conta.chave,
    origem: conta.origem,
    nome: conta.nome,
    valorCentavos: conta.valorCentavos,
    vencimento: conta.vencimento,
    pagoEm: conta.pagoEm,
    recorrenciaId: conta.recorrenciaId,
    competencia: conta.competencia,
    contaAvulsaId: conta.contaAvulsaId,
  };
}

function maisProxima<T>(
  itens: readonly T[],
  data: (item: T) => DataCivil,
  referencia: DataCivil,
): T | null {
  return (
    [...itens].sort((a, b) => distancia(data(a), referencia) - distancia(data(b), referencia))[0] ??
    null
  );
}

function formatar(centavos: Centavos): string {
  const reais = Math.floor(centavos / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${reais},${(centavos % 100).toString().padStart(2, '0')}`;
}

function dataBr(data: DataCivil): string {
  return `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`;
}

const LANCAR: AcaoDaLinha = { tipo: 'lancar' };

function linhaComum(
  indice: number,
  acao: AcaoDaLinha,
  aviso: string | null,
  extras: AcaoDaLinha[] = [],
): SugestaoDaLinha {
  const ignorar: AcaoDaLinha = { tipo: 'ignorar', motivo: 'Desmarcado na revisão.' };
  const alternativas = [acao, ...extras, LANCAR, ignorar].filter(
    (a, i, todas) => todas.findIndex((b) => JSON.stringify(b) === JSON.stringify(a)) === i,
  );
  return { indice, acao, alternativas, aviso };
}

function cruzarLinha(
  extracao: Extracao,
  lancamento: LancamentoExtraido,
  indice: number,
  dados: DadosFinanceiros,
  contas: readonly Conta[],
  faturaComoFixa: ContaSugerida | null,
): SugestaoDaLinha {
  const { data, valorCentavos: valor } = lancamento;
  if (!lancamento.marcado) {
    const motivo = lancamento.avisos[0] ?? 'Desmarcado pela leitura.';
    return linhaComum(indice, { tipo: 'ignorar', motivo }, null);
  }
  if (faturaComoFixa) {
    return linhaComum(
      indice,
      {
        tipo: 'ignorar',
        motivo: 'A fatura está cadastrada como despesa fixa; os itens ficam de fora.',
      },
      null,
    );
  }
  if (data === null || valor === null) return linhaComum(indice, LANCAR, null);

  // Duplicata: valor igual, data a até 1 dia e descrição parecida (4.4).
  const duplicata = dados.lancamentos.find(
    (l) =>
      l.valorCentavos === valor &&
      distancia(l.data, data) <= DIAS_DA_DUPLICATA &&
      descricoesParecidas(l.descricao ?? '', lancamento.descricao),
  );
  if (duplicata) {
    const aviso = `Parece repetido: "${duplicata.descricao ?? 'lançamento'}" de ${dataBr(duplicata.data)}, ${formatar(valor)}.`;
    return linhaComum(indice, { tipo: 'ignorar', motivo: aviso }, aviso);
  }

  if (lancamento.tipo === 'despesa') {
    // Conta já paga com o mesmo valor, perto da data do pagamento.
    const paga = contas.find(
      (c) =>
        c.pagoEm !== null &&
        c.valorCentavos === valor &&
        distancia(c.pagoEm, data) <= DIAS_DO_PAGAMENTO,
    );
    if (paga) {
      const aviso = `Parece o pagamento de ${paga.nome}, já registrado em ${dataBr(paga.pagoEm ?? data)}.`;
      return linhaComum(indice, { tipo: 'ignorar', motivo: aviso }, aviso);
    }

    if (extracao.tipo === 'fatura_cartao') {
      // Item de fixa paga no cartão: marca a fixa como paga e fica vinculado a ela (D4).
      const fixa = contas.find(
        (c) =>
          c.pagoEm === null &&
          c.pagaNoCartao &&
          competenciaDe(c.vencimento) === competenciaDe(data) &&
          (c.valorCentavos === valor || descricoesParecidas(c.nome, lancamento.descricao)),
      );
      if (fixa) {
        const conta = sugerida(fixa);
        return linhaComum(
          indice,
          { tipo: 'vincular_fixa', conta },
          `É a fixa "${fixa.nome}", paga no cartão: o item marca a fixa como paga e não vira gasto variável.`,
        );
      }
      return linhaComum(indice, LANCAR, null);
    }

    // Pagamento de conta em aberto: valor igual e data a até 5 dias do vencimento (4.4).
    const abertas = contas.filter(
      (c) =>
        c.pagoEm === null &&
        !c.pagaNoCartao &&
        c.valorCentavos === valor &&
        distancia(c.vencimento, data) <= DIAS_DO_PAGAMENTO,
    );
    const aberta = maisProxima(abertas, (c) => c.vencimento, data);
    if (aberta) {
      const conta = sugerida(aberta);
      return linhaComum(
        indice,
        { tipo: 'quitar', conta },
        `Parece o pagamento de ${aberta.nome} (vence ${dataBr(aberta.vencimento)}): quitar a conta em vez de lançar outro gasto.`,
      );
    }
    return linhaComum(indice, LANCAR, null);
  }

  if (lancamento.tipo === 'receita') {
    const rendas = projetarOcorrencias(dados, 'renda', somarDias(data, -40), somarDias(data, 40));
    const recebida = rendas.find(
      (r) =>
        r.status === 'recebida' &&
        r.valorCentavos === valor &&
        r.pagoEm !== null &&
        distancia(r.pagoEm, data) <= DIAS_DO_PAGAMENTO,
    );
    if (recebida) {
      const aviso = `Parece o recebimento de ${recebida.recorrencia.nome}, já confirmado em ${dataBr(recebida.pagoEm ?? data)}.`;
      return linhaComum(indice, { tipo: 'ignorar', motivo: aviso }, aviso);
    }
    const contracheque = extracao.tipo === 'contracheque';
    const folga = contracheque ? 10 : DIAS_DO_PAGAMENTO;
    const abertas = rendas.filter(
      (r) =>
        r.status === 'pendente' &&
        distancia(r.vencimento, data) <= folga &&
        (contracheque || r.recorrencia.rendaVariavel === true || r.valorCentavos === valor),
    );
    const aberta = maisProxima(abertas, (r) => r.vencimento, data);
    if (aberta) {
      const renda: RendaSugerida = {
        recorrenciaId: aberta.recorrencia.id,
        competencia: aberta.competencia,
        nome: aberta.recorrencia.nome,
        valorPrevistoCentavos: aberta.valorCentavos,
        dataPrevista: aberta.vencimento,
      };
      const diferente =
        aberta.valorCentavos !== valor
          ? ` com ${formatar(valor)} (previsto ${formatar(aberta.valorCentavos)})`
          : '';
      return linhaComum(
        indice,
        { tipo: 'receber', renda },
        `Parece a renda ${aberta.recorrencia.nome}: confirmar o recebimento${diferente} em vez de lançar outra receita.`,
      );
    }
  }
  return linhaComum(indice, LANCAR, null);
}

function cruzarConta(extracao: Extracao, contas: readonly Conta[]): SugestaoDaConta | null {
  const conta = extracao.conta;
  if (!conta || conta.vencimento === null) {
    return conta
      ? { acao: { tipo: 'criar' }, alternativas: [{ tipo: 'criar' }], aviso: null }
      : null;
  }
  const vencimento = conta.vencimento;
  const valor = conta.valorCentavos;
  const nomeDoDocumento = `${conta.nome} ${extracao.emissor ?? ''}`;
  const criar: AcaoDaConta = { tipo: 'criar' };
  const naoGravar: AcaoDaConta = { tipo: 'nao_gravar', motivo: 'A conta não será gravada.' };

  // Conta avulsa já cadastrada (fatura ou boleto lançado à mão antes): mesmo valor, ou nome
  // parecido com valor perto (até 20% de diferença), a até 5 dias do vencimento.
  const avulsa = maisProxima(
    contas.filter(
      (c) =>
        c.origem === 'avulsa' &&
        valor !== null &&
        distancia(c.vencimento, vencimento) <= DIAS_DO_PAGAMENTO &&
        (c.valorCentavos === valor ||
          (descricoesParecidas(c.nome, nomeDoDocumento) &&
            Math.abs(c.valorCentavos - valor) <= Math.max(c.valorCentavos, valor) * 0.2)),
    ),
    (c) => c.vencimento,
    vencimento,
  );
  if (avulsa) {
    const sugestao = sugerida(avulsa);
    const paga = avulsa.pagoEm !== null;
    const aviso =
      extracao.tipo === 'fatura_cartao' && paga
        ? `A fatura já está cadastrada como "${avulsa.nome}" e foi paga: o pagamento passa a ser transferência, para os itens não contarem duas vezes.`
        : `Já existe a conta "${avulsa.nome}" com vencimento em ${dataBr(avulsa.vencimento)}: ela será atualizada em vez de criar outra.`;
    return {
      acao: { tipo: 'atualizar_avulsa', conta: sugestao },
      alternativas: [{ tipo: 'atualizar_avulsa', conta: sugestao }, criar, naoGravar],
      aviso,
    };
  }

  // Fixa do mesmo mês: o boleto traz o valor real (resolve a lacuna da Etapa 3).
  const fixas = contas.filter((c) => c.origem === 'fixa' && c.pagoEm === null && !c.pagaNoCartao);
  if (extracao.tipo === 'fatura_cartao') {
    // Fixa com cara de fatura (nome com fatura ou cartão, ou o nome do banco) perto do vencimento.
    const fixa = maisProxima(
      fixas.filter(
        (c) =>
          distancia(c.vencimento, vencimento) <= DIAS_DO_PAGAMENTO &&
          (/\b(fatura|cartao|credito)\b/.test(normalizarNome(c.nome)) ||
            descricoesParecidas(c.nome, nomeDoDocumento)),
      ),
      (c) => c.vencimento,
      vencimento,
    );
    if (fixa) {
      const sugestao = sugerida(fixa);
      return {
        acao: { tipo: 'prever_fixa', conta: sugestao },
        alternativas: [{ tipo: 'prever_fixa', conta: sugestao }, criar, naoGravar],
        aviso: `A fatura parece a despesa fixa "${fixa.nome}": o valor da fatura vira a previsão desse mês, sem os itens. Para importar os itens, a fatura precisa ser conta avulsa.`,
      };
    }
    return { acao: criar, alternativas: [criar, naoGravar], aviso: null };
  }

  const fixa = maisProxima(
    fixas.filter(
      (c) =>
        competenciaDe(c.vencimento) === competenciaDe(vencimento) &&
        descricoesParecidas(c.nome, nomeDoDocumento),
    ),
    (c) => c.vencimento,
    vencimento,
  );
  if (fixa) {
    const sugestao = sugerida(fixa);
    return {
      acao: { tipo: 'prever_fixa', conta: sugestao },
      alternativas: [{ tipo: 'prever_fixa', conta: sugestao }, criar, naoGravar],
      aviso: `Parece a conta de "${fixa.nome}" deste mês: usar ${valor !== null ? formatar(valor) : 'o valor do boleto'} como valor de ${dataBr(fixa.vencimento).slice(3)} em vez de criar outra conta.`,
    };
  }
  return { acao: criar, alternativas: [criar, naoGravar], aviso: null };
}

export function cruzar(extracao: Extracao, dados: DadosFinanceiros, hoje: DataCivil): Cruzamento {
  const datas = [
    hoje,
    ...extracao.lancamentos.map((l) => l.data).filter((d): d is DataCivil => d !== null),
    ...(extracao.conta?.vencimento ? [extracao.conta.vencimento] : []),
  ].sort();
  const contas = listarContas(
    dados,
    somarDias(datas[0] ?? hoje, -45),
    somarDias(datas[datas.length - 1] ?? hoje, 45),
  );
  const conta = cruzarConta(extracao, contas);
  const faturaComoFixa =
    conta?.acao.tipo === 'prever_fixa' && extracao.tipo === 'fatura_cartao'
      ? conta.acao.conta
      : null;
  const linhas = extracao.lancamentos.map((l, i) =>
    cruzarLinha(extracao, l, i, dados, contas, faturaComoFixa),
  );

  // Duas linhas não quitam a mesma conta nem confirmam a mesma renda.
  const usadas = new Set<string>();
  for (const linha of linhas) {
    const chave =
      linha.acao.tipo === 'quitar' || linha.acao.tipo === 'vincular_fixa'
        ? linha.acao.conta.chave
        : linha.acao.tipo === 'receber'
          ? `renda:${linha.acao.renda.recorrenciaId}:${linha.acao.renda.competencia}`
          : null;
    if (!chave) continue;
    if (usadas.has(chave)) {
      linha.acao = LANCAR;
      linha.aviso = null;
    }
    usadas.add(chave);
  }
  return { conta, linhas, avisos: [] };
}
