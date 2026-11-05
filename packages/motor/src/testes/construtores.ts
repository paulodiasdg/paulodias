import type {
  ContaAvulsa,
  DadosFinanceiros,
  Lancamento,
  Meta,
  MovimentoReserva,
  Recorrencia,
} from '../tipos';

/** Construtores de dados para os testes, com padrões neutros. */

export function dadosVazios(parcial: Partial<DadosFinanceiros> = {}): DadosFinanceiros {
  return {
    perfil: { tetoVariavelCentavos: null, inicioEm: null },
    recorrencias: [],
    ocorrencias: [],
    contasAvulsas: [],
    lancamentos: [],
    metas: [],
    movimentos: [],
    ...parcial,
  };
}

export function fixa(
  id: string,
  valorCentavos: number,
  dia: number,
  extra: Partial<Recorrencia> = {},
): Recorrencia {
  return {
    id,
    tipo: 'fixa',
    nome: id,
    valorCentavos,
    dia,
    inicio: '2026-01-01',
    fim: null,
    ativa: true,
    ...extra,
  };
}

export function renda(
  id: string,
  valorCentavos: number,
  dia: number,
  extra: Partial<Recorrencia> = {},
): Recorrencia {
  return { ...fixa(id, valorCentavos, dia, extra), tipo: 'renda', ...extra };
}

export function avulsa(
  id: string,
  valorCentavos: number,
  vencimento: string,
  extra: Partial<ContaAvulsa> = {},
): ContaAvulsa {
  return { id, nome: id, valorCentavos, vencimento, quitaItens: false, pagoEm: null, ...extra };
}

export function despesa(
  id: string,
  valorCentavos: number,
  data: string,
  extra: Partial<Lancamento> = {},
): Lancamento {
  return {
    id,
    data,
    valorCentavos,
    tipo: 'despesa',
    ocorrenciaId: null,
    contaAvulsaId: null,
    origem: 'manual',
    ...extra,
  };
}

export function receita(
  id: string,
  valorCentavos: number,
  data: string,
  extra: Partial<Lancamento> = {},
): Lancamento {
  return { ...despesa(id, valorCentavos, data), tipo: 'receita', ...extra };
}

export function meta(
  id: string,
  alvoCentavos: number,
  prazo: string,
  prioridade: number,
  extra: Partial<Meta> = {},
): Meta {
  return {
    id,
    nome: id,
    alvoCentavos,
    prazo,
    prioridade,
    tipo: 'comum',
    concluidaEm: null,
    ...extra,
  };
}

export function movimento(
  id: string,
  tipo: MovimentoReserva['tipo'],
  valorCentavos: number,
  data: string,
  extra: Partial<MovimentoReserva> = {},
): MovimentoReserva {
  return {
    id,
    data,
    tipo,
    destino: 'contas',
    metaId: null,
    valorCentavos,
    ocorrenciaId: null,
    contaAvulsaId: null,
    ...extra,
  };
}
