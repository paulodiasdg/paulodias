import { ultimoDiaDa, type DataCivil } from '@no-azul/motor';
import { codigosNoTexto, lerCodigoDeBarras, type DadosDoCodigo } from '../boleto';
import { textoCompleto, type DocumentoDeTexto } from '../documento';
import { completarAno, lerCompetenciaEscrita, normalizar, valoresNoTexto } from '../texto';
import type { ContaExtraida, Extracao, LancamentoExtraido } from '../tipos';
import {
  confiancaDoAchado,
  naturezaNaFatura,
  novoLancamento,
  parcelaDaDescricao,
  primeiraData,
  primeiraLinhaComTexto,
  procurar,
  textoComLetras,
  tipoNoExtrato,
  valorNoInicio,
} from './comum';
import { linhasDeLancamento } from './linhas';

/** O que cada leitor devolve; o resto da extração é preenchido por quem chama. */
export type Parcial = Pick<
  Extracao,
  'emissor' | 'competencia' | 'conta' | 'lancamentos' | 'avisos'
>;

function vazio(): Parcial {
  return { emissor: null, competencia: null, conta: null, lancamentos: [], avisos: [] };
}

// ------------------------------------------------------------------------------------------
// Comprovante e nota fiscal: uma despesa
// ------------------------------------------------------------------------------------------

export function lerComprovante(documento: DocumentoDeTexto): Parcial {
  const resultado = vazio();
  const texto = textoCompleto(documento);
  resultado.emissor = primeiraLinhaComTexto(documento);

  let valor = procurar(
    documento,
    [
      'valor pago',
      'valor total',
      'valor da transferencia',
      'valor do pagamento',
      'total a pagar',
      'total r$',
      'valor',
      'total',
    ],
    valorNoInicio,
    ['desconto', 'tributos', 'troco', 'qtd', 'quantidade'],
  );
  let valorPorAproximacao = false;
  if (!valor) {
    // Comprovante de aplicativo: o valor em destaque, com "R$", sem rótulo.
    const linha = documento.linhas.find((l) => valoresNoTexto(l.texto).some((v) => v.comCifrao));
    const achado = linha ? valoresNoTexto(linha.texto).find((v) => v.comCifrao) : undefined;
    if (linha && achado) {
      valor = { valor: Math.abs(achado.centavos), confianca: linha.confianca, distancia: 0 };
      valorPorAproximacao = true;
    }
  }

  let data = procurar(
    documento,
    [
      'data do pagamento',
      'data da transferencia',
      'data da transacao',
      'data e hora',
      'pago em',
      'realizado em',
      'emissao',
      'data',
    ],
    primeiraData,
    ['vencimento', 'nascimento', 'processamento', 'leitura'],
  );
  let dataPorAproximacao = false;
  if (!data) {
    const linha = documento.linhas.find((l) => primeiraData(l.texto) !== null);
    const achada = linha ? primeiraData(linha.texto) : null;
    if (linha && achada) {
      data = { valor: achada, confianca: linha.confianca, distancia: 0 };
      dataPorAproximacao = true;
    }
  }

  const destino = procurar(
    documento,
    ['favorecido', 'destino', 'nome', 'empresa', 'beneficiario'],
    textoComLetras,
    ['chave'],
  );
  const recebido = /\bpix recebido\b|\brecebido de\b/.test(normalizar(texto));
  resultado.lancamentos.push(
    novoLancamento({
      data: data?.valor ?? null,
      valorCentavos: valor?.valor ?? null,
      descricao: destino?.valor ?? resultado.emissor ?? 'Comprovante',
      tipo: recebido ? 'receita' : 'despesa',
      confianca: {
        data: confiancaDoAchado(data, dataPorAproximacao),
        valor: confiancaDoAchado(valor, valorPorAproximacao),
      },
    }),
  );
  if (!valor) resultado.avisos.push('Não achei o valor do comprovante.');
  if (!data) resultado.avisos.push('Não achei a data do comprovante.');
  return resultado;
}

// ------------------------------------------------------------------------------------------
// Boleto e conta de consumo: uma conta a pagar
// ------------------------------------------------------------------------------------------

const NOMES_DE_CONTA: [RegExp, string, string][] = [
  [/\b(energia|kwh|eletrica)\b/, 'Conta de luz', 'contas_da_casa'],
  [/\b(agua|saneamento|esgoto)\b/, 'Conta de água', 'contas_da_casa'],
  [/\bgas\b/, 'Conta de gás', 'contas_da_casa'],
  [/\b(internet|fibra|telecom|banda larga)\b/, 'Internet', 'contas_da_casa'],
  [/\b(telefone|celular|telefonia)\b/, 'Telefone', 'contas_da_casa'],
  [/\bcondominio\b/, 'Condomínio', 'moradia'],
  [/\baluguel\b/, 'Aluguel', 'moradia'],
  [/\b(escola|curso|faculdade|idiomas|mensalidade)\b/, 'Mensalidade', 'educacao'],
];

function codigoDoBoleto(documento: DocumentoDeTexto, hoje: DataCivil): DadosDoCodigo | null {
  const lidos = [
    ...documento.codigosDeBarras.map((c) => lerCodigoDeBarras(c, hoje)),
    ...codigosNoTexto(textoCompleto(documento), hoje),
  ].filter((c): c is DadosDoCodigo => c !== null);
  return lidos.find((c) => c.vencimento !== null) ?? lidos[0] ?? null;
}

export function lerConta(documento: DocumentoDeTexto, hoje: DataCivil): Parcial {
  const resultado = vazio();
  const texto = normalizar(textoCompleto(documento));
  resultado.emissor = primeiraLinhaComTexto(documento);
  const codigo = codigoDoBoleto(documento, hoje);

  const valorNoTexto = procurar(
    documento,
    [
      'valor do documento',
      'total a pagar',
      'valor a pagar',
      'valor cobrado',
      'valor total',
      'valor r$',
      'valor',
      'total',
    ],
    valorNoInicio,
    ['desconto', 'mora', 'multa', 'acrescimo', 'abatimento', 'tributos', 'quantidade'],
  );
  const vencimentoNoTexto = procurar(
    documento,
    ['data de vencimento', 'vencimento', 'vence em', 'pagar ate'],
    primeiraData,
    ['proxima', 'apos'],
  );

  const valor = codigo?.valorCentavos ?? valorNoTexto?.valor ?? null;
  const vencimento = codigo?.vencimento ?? vencimentoNoTexto?.valor ?? null;
  if (codigo?.valorCentavos && valorNoTexto && valorNoTexto.valor !== codigo.valorCentavos) {
    resultado.avisos.push(
      'O valor escrito no boleto é diferente do código de barras; vale o do código.',
    );
  }

  const tipoDeConta = NOMES_DE_CONTA.find(([padrao]) => padrao.test(texto));
  const beneficiario = procurar(documento, ['beneficiario', 'cedente', 'empresa'], textoComLetras);
  const conta: ContaExtraida = {
    nome: tipoDeConta?.[1] ?? beneficiario?.valor.split(' - ')[0] ?? resultado.emissor ?? 'Boleto',
    valorCentavos: valor,
    vencimento,
    categoria: tipoDeConta?.[2] ?? null,
    confianca: {
      valor: codigo?.valorCentavos ? 1 : confiancaDoAchado(valorNoTexto),
      vencimento: codigo?.vencimento ? 1 : confiancaDoAchado(vencimentoNoTexto),
    },
    fechamento: null,
  };
  resultado.conta = conta;
  if (valor === null) resultado.avisos.push('Não achei o valor da conta.');
  if (vencimento === null) resultado.avisos.push('Não achei o vencimento da conta.');
  return resultado;
}

// ------------------------------------------------------------------------------------------
// Fatura de cartão: uma conta e os itens
// ------------------------------------------------------------------------------------------

export function lerFatura(documento: DocumentoDeTexto, hoje: DataCivil): Parcial {
  const resultado = vazio();
  resultado.emissor = primeiraLinhaComTexto(documento);

  const vencimento = procurar(
    documento,
    ['data de vencimento', 'vencimento', 'vence em'],
    primeiraData,
    ['proxima'],
  );
  const total = procurar(
    documento,
    [
      'total da fatura',
      'total desta fatura',
      'valor total a pagar',
      'valor total',
      'total a pagar',
      'saldo total',
    ],
    valorNoInicio,
    ['minimo'],
  );
  const fechamento = procurar(
    documento,
    ['data de fechamento', 'fatura fechada em', 'fechamento', 'data de corte'],
    primeiraData,
  );
  const referencia = vencimento?.valor ?? hoje;
  const dataDaParcela = fechamento?.valor ?? vencimento?.valor ?? null;

  for (const linha of linhasDeLancamento(documento)) {
    const { tipo, natureza } = naturezaNaFatura(linha.descricao, linha.valorCentavos);
    const parcela = parcelaDaDescricao(linha.descricao);
    const parcelaAntiga = parcela !== null && parcela.atual > 1 && dataDaParcela !== null;
    const avisos: string[] = [];
    if (natureza === 'pagamento_de_fatura') {
      avisos.push('Pagamento da fatura anterior: já entrou quando aquela fatura foi paga.');
    } else if (natureza === 'estorno') {
      avisos.push(
        'Crédito na fatura: entra como receita, o que na folga do mês equivale a abater a compra.',
      );
    }
    if (parcelaAntiga)
      avisos.push('Parcela de compra antiga: entra na data de fechamento da fatura.');
    resultado.lancamentos.push(
      novoLancamento({
        data: parcelaAntiga ? dataDaParcela : completarAno(linha.data, referencia),
        descricao: linha.descricao,
        valorCentavos: Math.abs(linha.valorCentavos),
        tipo,
        natureza: natureza ?? (parcela ? 'parcela' : null),
        parcela,
        marcado: natureza !== 'pagamento_de_fatura',
        confianca: { data: linha.confianca.data, valor: linha.confianca.valor },
        avisos,
      }),
    );
  }

  resultado.conta = {
    nome: `Fatura ${resultado.emissor ?? 'do cartão'}`.slice(0, 120),
    valorCentavos: total?.valor ?? null,
    vencimento: vencimento?.valor ?? null,
    categoria: 'pagamento_fatura',
    confianca: { valor: confiancaDoAchado(total), vencimento: confiancaDoAchado(vencimento) },
    fechamento: fechamento?.valor ?? null,
  };
  if (!total) resultado.avisos.push('Não achei o total da fatura.');
  if (!vencimento) resultado.avisos.push('Não achei o vencimento da fatura.');
  if (resultado.lancamentos.length === 0) resultado.avisos.push('Não achei os itens da fatura.');
  return resultado;
}

// ------------------------------------------------------------------------------------------
// Extrato em PDF ou foto
// ------------------------------------------------------------------------------------------

export function lerExtratoDeTexto(documento: DocumentoDeTexto, hoje: DataCivil): Parcial {
  const resultado = vazio();
  resultado.emissor = primeiraLinhaComTexto(documento);
  const lancamentos: LancamentoExtraido[] = [];
  for (const linha of linhasDeLancamento(documento)) {
    lancamentos.push(
      novoLancamento({
        data: completarAno(linha.data, hoje),
        descricao: linha.descricao,
        valorCentavos: Math.abs(linha.valorCentavos),
        tipo: tipoNoExtrato(linha.descricao, linha.valorCentavos),
        confianca: { data: linha.confianca.data, valor: linha.confianca.valor },
      }),
    );
  }
  resultado.lancamentos = lancamentos;
  if (lancamentos.length === 0) resultado.avisos.push('Não achei lançamentos no extrato.');
  return resultado;
}

// ------------------------------------------------------------------------------------------
// Contracheque e recibo de autônomo: uma receita pelo líquido
// ------------------------------------------------------------------------------------------

export function lerContracheque(documento: DocumentoDeTexto): Parcial {
  const resultado = vazio();
  const texto = normalizar(textoCompleto(documento));
  const autonomo = /recibo de pagamento a autonomo|\brpa\b/.test(texto);

  const liquido = procurar(
    documento,
    ['liquido a receber', 'valor liquido', 'total liquido', 'liquido'],
    valorNoInicio,
    ['base'],
  );
  const competencia = procurar(
    documento,
    ['mes de referencia', 'referencia', 'competencia', 'mes/ano', 'periodo'],
    lerCompetenciaEscrita,
  );
  const pagamento = procurar(
    documento,
    [
      'data de credito',
      'data do credito',
      'data do pagamento',
      'data de pagamento',
      'pago em',
      'credito em',
    ],
    primeiraData,
  );
  const contratante = autonomo ? procurar(documento, ['contratante'], textoComLetras) : null;
  const empresa =
    contratante?.valor ??
    documento.linhas
      .slice(0, 8)
      .map(
        (l) => l.celulas.find((c) => /\b(ltda|s\.?a\.?|s\/a|eireli|epp)\b/i.test(c.texto))?.texto,
      )
      .find((t) => t !== undefined) ??
    primeiraLinhaComTexto(documento);

  resultado.emissor = empresa?.replace(/\s*[·|-]\s*CNPJ.*$/i, '').trim() ?? null;
  resultado.competencia = competencia?.valor ?? null;
  const data = pagamento?.valor ?? (competencia ? ultimoDiaDa(competencia.valor) : null);
  const avisos = pagamento
    ? []
    : ['O documento não mostra a data do crédito: usei o último dia do mês de referência.'];
  resultado.lancamentos.push(
    novoLancamento({
      data,
      descricao: `${autonomo ? 'Serviço' : 'Salário'} ${resultado.emissor ?? ''}`.trim(),
      valorCentavos: liquido?.valor ?? null,
      tipo: 'receita',
      confianca: {
        data: pagamento ? confiancaDoAchado(pagamento) : competencia ? 0.6 : 0,
        valor: confiancaDoAchado(liquido),
      },
      avisos,
    }),
  );
  if (!liquido) resultado.avisos.push('Não achei o valor líquido.');
  return resultado;
}
