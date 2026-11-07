import { describe, expect, it } from 'vitest';
import { boletoBancario } from '../../testes/conjunto/apoio.ts';
import { procurarValor } from '../documento';
import { documentoDeTeste } from '../testes/documento-de-teste';
import {
  primeiraData,
  valorNoInicio,
  parcelaDaDescricao,
  naturezaNaFatura,
  tipoNoExtrato,
} from './comum';
import {
  lerComprovante,
  lerConta,
  lerContracheque,
  lerExtratoDeTexto,
  lerFatura,
} from './documentos';
import { linhasDeLancamento } from './linhas';
import { lerTabela, lerTransacoesDoOfx } from './tabela';
import { detectarTipo } from './tipo';

const HOJE = '2026-11-07';

describe('rótulo e valor', () => {
  it('acha o valor ao lado do rótulo, na mesma célula ou na seguinte', () => {
    const doc = documentoDeTeste(['Vencimento: 18/11/2026', 'Total a pagar | R$ 189,90']);
    expect(procurarValor(doc, ['vencimento'], primeiraData)?.valor).toBe('2026-11-18');
    expect(procurarValor(doc, ['total a pagar'], valorNoInicio)?.valor).toBe(18990);
  });

  it('acha o valor embaixo do rótulo, na coluna dele', () => {
    const doc = documentoDeTeste(
      ['Próxima leitura | Vencimento | Total a pagar', '30/11/2026 | 18/11/2026 | R$ 189,90'],
      { colunas: [0, 30, 60] },
    );
    expect(procurarValor(doc, ['vencimento'], primeiraData)?.valor).toBe('2026-11-18');
    expect(procurarValor(doc, ['total a pagar'], valorNoInicio)).toMatchObject({
      valor: 18990,
      distancia: 1,
    });
  });

  it('pula o rótulo com um termo a evitar', () => {
    const doc = documentoDeTeste(['Data do vencimento | 18/11/2026', 'Data | 06/11/2026']);
    expect(procurarValor(doc, ['data'], primeiraData, { evitar: ['vencimento'] })?.valor).toBe(
      '2026-11-06',
    );
  });
});

describe('tipo do documento', () => {
  it('reconhece cada tipo pelas palavras', () => {
    expect(detectarTipo('Banco X\nComprovante de transferência Pix\nValor R$ 10,00')).toBe(
      'comprovante',
    );
    expect(detectarTipo('Local de pagamento\nBeneficiário\nNosso número')).toBe('boleto');
    expect(detectarTipo('Fatura do cartão de crédito\nTotal da fatura\nPagamento mínimo')).toBe(
      'fatura_cartao',
    );
    expect(detectarTipo('Extrato de conta corrente\nSaldo anterior')).toBe('extrato');
    expect(detectarTipo('Holerite\nProventos\nValor líquido')).toBe('contracheque');
  });

  it('título "Comprovante" vence o código de barras citado no corpo', () => {
    expect(
      detectarTipo(
        'Comprovante de pagamento\nEmpresa\nCódigo de barras\nData do vencimento\nValor pago',
      ),
    ).toBe('comprovante');
  });

  it('com várias linhas de lançamento, não é comprovante', () => {
    expect(detectarTipo('Banco\nExtrato de 01/09 a 31/10\nPIX ENVIADO\nTED', 30)).toBe('extrato');
    expect(detectarTipo('Banco\nExtrato de 01/09 a 31/10\nPIX ENVIADO\nTED', 0)).toBe(
      'comprovante',
    );
  });
});

describe('linhas de lançamento', () => {
  it('lê data, descrição e valor, e pula saldo e totais', () => {
    const doc = documentoDeTeste([
      'Data | Descrição | Valor',
      '11/10 | MERCADO BOM PRECO | 287,90',
      '20/10 | PAGAMENTO RECEBIDO | - 1.520,40',
      'Saldo anterior | 1.520,40',
      '30/09/2026 | SALDO ANTERIOR | 3.120,50 C',
      '20/11/2026 | R$ 1.107,70 | R$ 166,16 | 10/11/2026',
      '15 OUT | SPOTIFY USD 5,99 | R$ 32,50',
      '16/10 UBER *TRIP 23,45',
    ]);
    expect(linhasDeLancamento(doc).map((l) => [l.descricao, l.valorCentavos])).toEqual([
      ['MERCADO BOM PRECO', 28790],
      ['PAGAMENTO RECEBIDO', -152040],
      ['SPOTIFY USD 5,99', 3250],
      ['UBER *TRIP', 2345],
    ]);
  });

  it('não lê a coluna de saldo como valor e confere o sinal pela diferença de saldos', () => {
    const doc = documentoDeTeste(
      [
        'Data | Descrição | Valor | Saldo',
        '02/09/2026 | PIX RECEBIDO | R$ 500,00 | R$ 1.500,00',
        '03/09/2026 | PAGTO BOLETO | R$ 119,90 | R$ 1.380,10',
        '04/09/2026 | UBER | R$ 20,00 | R$ 1.360,10',
      ],
      { colunas: [0, 12, 50, 64] },
    );
    expect(linhasDeLancamento(doc).map((l) => [l.valorCentavos, l.saldoCentavos])).toEqual([
      [50000, 150000],
      [-11990, 138010],
      [-2000, 136010],
    ]);
  });
});

describe('comprovante', () => {
  it('lê valor, data e destinatário, preferindo a data do pagamento à do vencimento', () => {
    const doc = documentoDeTeste([
      'Comprovante de pagamento',
      'Empresa | Companhia de Energia',
      'Data do vencimento | 18/11/2026',
      'Data do pagamento | 06/11/2026',
      'Valor pago | R$ 189,90',
    ]);
    const [lancamento] = lerComprovante(doc).lancamentos;
    expect(lancamento).toMatchObject({
      data: '2026-11-06',
      valorCentavos: 18990,
      tipo: 'despesa',
      descricao: 'Companhia de Energia',
    });
    expect(lancamento?.confianca.valor).toBeGreaterThanOrEqual(0.8);
  });

  it('o destinatário é o nome, não o rótulo "Nome" embaixo do título "Favorecido"', () => {
    const doc = documentoDeTeste([
      'Comprovante de Transferência - TED',
      'Data da transferência | 04/11/2026',
      'Valor | R$ 1.200,00',
      'Favorecido',
      'Nome | Imobiliária Lar Doce Ltda',
      'CNPJ | 22.333.444/0001-55',
      'Remetente',
      'Nome | Paulo Exemplo',
    ]);
    expect(lerComprovante(doc).lancamentos[0]?.descricao).toBe('Imobiliária Lar Doce Ltda');
    // O OCR às vezes lê "CNPJ" como "CNP)": isso não é nome.
    const comErroDeOcr = documentoDeTeste([
      'Comprovante',
      'Valor | R$ 10,00',
      'Favorecido',
      'Nome',
      'CNP) 22.333.444/0001-55',
      'Nome | Imobiliária Lar Doce Ltda',
    ]);
    expect(lerComprovante(comErroDeOcr).lancamentos[0]?.descricao).toBe(
      'Imobiliária Lar Doce Ltda',
    );
  });

  it('sem rótulo, usa o valor com R$ e a primeira data, com confiança menor', () => {
    const doc = documentoDeTeste(['Horizonte', 'Pix enviado', 'R$ 89,90', '03/11/2026 - 07:15']);
    const [lancamento] = lerComprovante(doc).lancamentos;
    expect(lancamento).toMatchObject({ data: '2026-11-03', valorCentavos: 8990 });
    expect(lancamento?.confianca.valor).toBeLessThan(0.8);
  });

  it('avisa quando não acha valor nem data', () => {
    expect(lerComprovante(documentoDeTeste(['Recibo'])).avisos).toEqual([
      'Não achei o valor do comprovante.',
      'Não achei a data do comprovante.',
    ]);
  });
});

describe('boleto e conta', () => {
  it('usa valor e vencimento do código, com confiança 1, e avisa se o texto diverge', () => {
    const codigo = boletoBancario('997', 48000, '2026-12-05', '3214500000000777888999001');
    const doc = documentoDeTeste(['Escola de Idiomas Mundo', 'Valor do documento | 450,00'], {
      origem: 'ocr',
      codigos: [codigo.codigoDeBarras],
    });
    const lido = lerConta(doc, HOJE);
    expect(lido.conta).toMatchObject({
      nome: 'Mensalidade',
      valorCentavos: 48000,
      vencimento: '2026-12-05',
      categoria: 'educacao',
      confianca: { valor: 1, vencimento: 1 },
    });
    expect(lido.avisos).toContain(
      'O valor escrito no boleto é diferente do código de barras; vale o do código.',
    );
  });

  it('sem código, lê os rótulos e dá nome pelo tipo de conta', () => {
    const doc = documentoDeTeste([
      'Águas do Vale Saneamento',
      'Vencimento | 22/11/2026',
      'Valor a pagar | R$ 96,40',
    ]);
    expect(lerConta(doc, HOJE).conta).toMatchObject({
      nome: 'Conta de água',
      valorCentavos: 9640,
      vencimento: '2026-11-22',
      categoria: 'contas_da_casa',
    });
  });
});

describe('fatura', () => {
  const doc = documentoDeTeste([
    'Banco Aurora',
    'Vencimento | 10/01/2027',
    'Fechamento | 31/12/2026',
    'Total da fatura | R$ 300,00',
    'Data | Descrição | Valor',
    '01/12 | PAGAMENTO RECEBIDO - OBRIGADO | - 500,00',
    '05/12 | MERCADO | 200,00',
    '20/08 | LOJA MODA PARC 03/10 | 120,00',
    '08/12 | ESTORNO LOJA | - 45,00',
    '09/12 | IOF COMPRA INTERNACIONAL | 25,00',
  ]);
  const lido = lerFatura(doc, HOJE);

  it('lê total, vencimento e fechamento', () => {
    expect(lido.conta).toMatchObject({
      valorCentavos: 30000,
      vencimento: '2027-01-10',
      fechamento: '2026-12-31',
    });
  });

  it('reconhece pagamento anterior, estorno, encargo e parcela antiga', () => {
    expect(
      lido.lancamentos.map((l) => [l.data, l.valorCentavos, l.tipo, l.natureza, l.marcado]),
    ).toEqual([
      ['2026-12-01', 50000, 'transferencia', 'pagamento_de_fatura', false],
      ['2026-12-05', 20000, 'despesa', null, true],
      ['2026-12-31', 12000, 'despesa', 'parcela', true],
      ['2026-12-08', 4500, 'receita', 'estorno', true],
      ['2026-12-09', 2500, 'despesa', 'encargo', true],
    ]);
  });

  it('entende os jeitos de escrever a parcela', () => {
    expect(parcelaDaDescricao('LOJA PARC 03/10')).toEqual({ atual: 3, total: 10 });
    expect(parcelaDaDescricao('NOTEBOOK - PARCELA 4 DE 6')).toEqual({ atual: 4, total: 6 });
    expect(parcelaDaDescricao('MOVEIS LAR 02/05')).toEqual({ atual: 2, total: 5 });
    expect(parcelaDaDescricao('MOVEIS LAR 07/05')).toBeNull();
    expect(naturezaNaFatura('PAGAMENTO EFETUADO', -100).tipo).toBe('transferencia');
  });
});

describe('extrato', () => {
  it('lê o tipo de cada linha pela descrição e pelo sinal', () => {
    expect(tipoNoExtrato('APLICACAO AUTOMATICA', -100)).toBe('transferencia');
    expect(tipoNoExtrato('RESGATE AUTOMATICO', 100)).toBe('transferencia');
    expect(tipoNoExtrato('PIX ENVIADO', -100)).toBe('despesa');
    expect(tipoNoExtrato('PIX RECEBIDO', 100)).toBe('receita');
  });

  it('em PDF, lê as linhas e completa o ano pela data do envio', () => {
    const doc = documentoDeTeste([
      'Data | Histórico | Valor',
      '03/10 | PIX ENVIADO MARIA | 45,90 D',
      '05/10 | TED RECEBIDA | 4.876,32 C',
    ]);
    expect(
      lerExtratoDeTexto(doc, HOJE).lancamentos.map((l) => [l.data, l.valorCentavos, l.tipo]),
    ).toEqual([
      ['2026-10-03', 4590, 'despesa'],
      ['2026-10-05', 487632, 'receita'],
    ]);
  });

  it('em planilha, acha o cabeçalho abaixo do título e lê débito e crédito', () => {
    const lido = lerTabela(
      [
        ['Banco Ponte Digital - Extrato', '', ''],
        ['', '', ''],
        ['Data', 'Descrição', 'Débito', 'Crédito', 'Saldo'],
        ['2026-10-03', 'MERCADO, LOJA 2', '45.90', '', '100.00'],
        ['2026-10-05', 'PIX RECEBIDO', '', '1200.00', '1300.00'],
        ['2026-10-06', 'SALDO DO DIA', '', '', '1300.00'],
        ['', 'linha sem data', '1.00', '', ''],
      ],
      'extrato',
    );
    expect(lido.emissor).toBe('Banco Ponte Digital');
    expect(lido.lancamentos.map((l) => [l.data, l.valorCentavos, l.tipo])).toEqual([
      ['2026-10-03', 4590, 'despesa'],
      ['2026-10-05', 120000, 'receita'],
    ]);
  });

  it('avisa quando a planilha não tem as colunas', () => {
    expect(lerTabela([['a', 'b']], 'extrato').avisos).toEqual([
      'Não achei as colunas de data, descrição e valor na planilha.',
    ]);
  });

  it('em OFX, usa o sinal do arquivo', () => {
    expect(
      lerTransacoesDoOfx([
        { data: '2026-10-03', descricao: ' PIX  ENVIADO ', valorCentavos: -4590 },
      ]).lancamentos[0],
    ).toMatchObject({
      descricao: 'PIX ENVIADO',
      valorCentavos: 4590,
      tipo: 'despesa',
      confianca: { data: 1, valor: 1 },
    });
  });
});

describe('contracheque', () => {
  it('lê líquido, mês de referência e data do crédito', () => {
    const doc = documentoDeTeste([
      'Estúdio Traço Fino Design Ltda',
      'Demonstrativo de Pagamento | Referência: Outubro/2026',
      'Data de crédito | 05/11/2026',
      'Total de vencimentos | 5.958,16',
      'Líquido a receber | R$ 4.878,32',
    ]);
    const lido = lerContracheque(doc);
    expect(lido.competencia).toBe('2026-10');
    expect(lido.emissor).toBe('Estúdio Traço Fino Design Ltda');
    expect(lido.lancamentos[0]).toMatchObject({
      data: '2026-11-05',
      valorCentavos: 487832,
      tipo: 'receita',
    });
  });

  it('sem data do crédito, usa o último dia do mês de referência, com aviso e confiança baixa', () => {
    const doc = documentoDeTeste([
      'Mercado Ltda | Folha de pagamento',
      'Competência: 10/2026',
      'Total líquido: R$ 1.977,45',
    ]);
    const [lancamento] = lerContracheque(doc).lancamentos;
    expect(lancamento).toMatchObject({ data: '2026-10-31', valorCentavos: 197745 });
    expect(lancamento?.confianca.data).toBeLessThan(0.8);
    expect(lancamento?.avisos[0]).toContain('último dia do mês de referência');
  });
});
