import type { DadosFinanceiros } from '@no-azul/motor';
import { describe, expect, it } from 'vitest';
import { cruzar } from './cruzamento';
import { novoLancamento } from './leitores/comum';
import { LEITOR, type ContaExtraida, type Extracao, type LancamentoExtraido } from './tipos';

const HOJE = '2026-11-07';

function dados(parcial: Partial<DadosFinanceiros> = {}): DadosFinanceiros {
  return {
    perfil: { tetoVariavelCentavos: null, inicioEm: '2026-01-01' },
    recorrencias: [],
    ocorrencias: [],
    contasAvulsas: [],
    lancamentos: [],
    metas: [],
    movimentos: [],
    ...parcial,
  };
}

function leitura(
  tipo: Extracao['tipo'],
  lancamentos: LancamentoExtraido[],
  conta: ContaExtraida | null = null,
): Extracao {
  return {
    versao: 1,
    leitor: LEITOR,
    formato: 'pdf',
    origem: 'texto',
    tipo,
    tipoInformado: false,
    emissor: null,
    competencia: null,
    conta,
    lancamentos,
    avisos: [],
  };
}

const saida = (data: string, valor: number, descricao = 'PIX ENVIADO') =>
  novoLancamento({ data, descricao, valorCentavos: valor, tipo: 'despesa' });
const entrada = (data: string, valor: number, descricao = 'TED RECEBIDA') =>
  novoLancamento({ data, descricao, valorCentavos: valor, tipo: 'receita' });

const aluguel = {
  id: 'r-aluguel',
  tipo: 'fixa' as const,
  nome: 'Aluguel',
  valorCentavos: 120000,
  dia: 5,
  inicio: '2026-01-01',
  fim: null,
  ativa: true,
};
const salario = {
  id: 'r-salario',
  tipo: 'renda' as const,
  nome: 'Salário',
  valorCentavos: 487632,
  dia: 5,
  inicio: '2026-01-01',
  fim: null,
  ativa: true,
};

describe('duplicata (4.4)', () => {
  const gravado = {
    id: 'l1',
    data: '2026-11-03',
    descricao: 'Mercado Bom Preço',
    valorCentavos: 6217,
    tipo: 'despesa' as const,
    ocorrenciaId: null,
    contaAvulsaId: null,
  };

  it('valor igual, data a até 1 dia e descrição parecida vem desmarcado', () => {
    const [linha] = cruzar(
      leitura('extrato', [saida('2026-11-04', 6217, 'COMPRA CARTAO DEB MERCADO BOM PRECO')]),
      dados({ lancamentos: [gravado] }),
      HOJE,
    ).linhas;
    expect(linha?.acao.tipo).toBe('ignorar');
    expect(linha?.aviso).toContain('Parece repetido');
  });

  it('com data a 2 dias, outro valor ou outra descrição, não é duplicata', () => {
    const resultado = cruzar(
      leitura('extrato', [
        saida('2026-11-05', 6217, 'MERCADO BOM PRECO'),
        saida('2026-11-03', 6218, 'MERCADO BOM PRECO'),
        saida('2026-11-03', 6217, 'POSTO ESTRELA'),
      ]),
      dados({ lancamentos: [gravado] }),
      HOJE,
    );
    expect(resultado.linhas.map((l) => l.acao.tipo)).toEqual(['lancar', 'lancar', 'lancar']);
  });
});

describe('pagamento de conta (4.4)', () => {
  it('saída com o valor de uma conta em aberto, a até 5 dias do vencimento, quita a conta', () => {
    const [linha] = cruzar(
      leitura('extrato', [saida('2026-11-09', 120000, 'TED IMOBILIARIA')]),
      dados({ recorrencias: [aluguel] }),
      HOJE,
    ).linhas;
    expect(linha?.acao).toMatchObject({
      tipo: 'quitar',
      conta: { nome: 'Aluguel', competencia: '2026-11', recorrenciaId: 'r-aluguel' },
    });
    expect(linha?.alternativas.map((a) => a.tipo)).toEqual(['quitar', 'lancar', 'ignorar']);
  });

  it('a 6 dias do vencimento, ou com outro valor, só lança', () => {
    const resultado = cruzar(
      leitura('extrato', [saida('2026-11-11', 120000), saida('2026-11-05', 119999)]),
      dados({ recorrencias: [aluguel] }),
      HOJE,
    );
    expect(resultado.linhas.map((l) => l.acao.tipo)).toEqual(['lancar', 'lancar']);
  });

  it('duas linhas iguais não quitam a mesma conta', () => {
    const resultado = cruzar(
      leitura('extrato', [saida('2026-11-05', 120000), saida('2026-11-06', 120000)]),
      dados({ recorrencias: [aluguel] }),
      HOJE,
    );
    expect(resultado.linhas.map((l) => l.acao.tipo)).toEqual(['quitar', 'lancar']);
  });

  it('conta já paga com o mesmo valor perto da data vem desmarcada', () => {
    const resultado = cruzar(
      leitura('extrato', [saida('2026-11-06', 120000)]),
      dados({
        recorrencias: [aluguel],
        ocorrencias: [
          {
            id: 'o1',
            recorrenciaId: 'r-aluguel',
            competencia: '2026-11',
            valorCentavos: 120000,
            status: 'paga',
            pagoEm: '2026-11-05',
          },
        ],
      }),
      HOJE,
    );
    expect(resultado.linhas[0]?.acao).toMatchObject({ tipo: 'ignorar' });
    expect(resultado.linhas[0]?.aviso).toContain('já registrado');
  });
});

describe('renda prevista (lacuna da seção 2)', () => {
  it('entrada com o valor da renda, a até 5 dias, confirma o recebimento', () => {
    const [linha] = cruzar(
      leitura('extrato', [entrada('2026-11-06', 487632)]),
      dados({ recorrencias: [salario] }),
      HOJE,
    ).linhas;
    expect(linha?.acao).toMatchObject({
      tipo: 'receber',
      renda: { recorrenciaId: 'r-salario', competencia: '2026-11' },
    });
  });

  it('no extrato, outro valor só confirma renda variável', () => {
    const fixa = cruzar(
      leitura('extrato', [entrada('2026-11-06', 400000)]),
      dados({ recorrencias: [salario] }),
      HOJE,
    );
    expect(fixa.linhas[0]?.acao.tipo).toBe('lancar');
    const variavel = cruzar(
      leitura('extrato', [entrada('2026-11-06', 400000)]),
      dados({ recorrencias: [{ ...salario, rendaVariavel: true }] }),
      HOJE,
    );
    expect(variavel.linhas[0]?.acao.tipo).toBe('receber');
  });

  it('no contracheque, qualquer valor perto da data confirma, com o líquido', () => {
    const [linha] = cruzar(
      leitura('contracheque', [entrada('2026-11-05', 487832)]),
      dados({ recorrencias: [salario] }),
      HOJE,
    ).linhas;
    expect(linha?.acao.tipo).toBe('receber');
    expect(linha?.aviso).toContain('R$ 4.878,32');
  });

  it('renda já recebida com o mesmo valor vem desmarcada', () => {
    const [linha] = cruzar(
      leitura('extrato', [entrada('2026-11-06', 487632)]),
      dados({
        recorrencias: [salario],
        ocorrencias: [
          {
            id: 'o2',
            recorrenciaId: 'r-salario',
            competencia: '2026-11',
            valorCentavos: 487632,
            status: 'recebida',
            pagoEm: '2026-11-05',
          },
        ],
      }),
      HOJE,
    ).linhas;
    expect(linha?.acao.tipo).toBe('ignorar');
  });
});

describe('boleto e fatura', () => {
  const contaLida = (valor: number, vencimento: string, nome: string): ContaExtraida => ({
    nome,
    valorCentavos: valor,
    vencimento,
    categoria: null,
    confianca: { valor: 1, vencimento: 1 },
    fechamento: null,
  });
  const luz = { ...aluguel, id: 'r-luz', nome: 'Conta de luz', valorCentavos: 15000, dia: 18 };

  it('boleto da fixa do mês vira a previsão daquele mês', () => {
    const resultado = cruzar(
      leitura('boleto', [], contaLida(18990, '2026-11-18', 'Conta de luz')),
      dados({ recorrencias: [luz] }),
      HOJE,
    );
    expect(resultado.conta?.acao).toMatchObject({
      tipo: 'prever_fixa',
      conta: { recorrenciaId: 'r-luz', competencia: '2026-11' },
    });
  });

  it('boleto sem fixa parecida cria conta avulsa', () => {
    const resultado = cruzar(
      leitura('boleto', [], contaLida(48000, '2026-12-05', 'Mensalidade')),
      dados({ recorrencias: [luz] }),
      HOJE,
    );
    expect(resultado.conta?.acao.tipo).toBe('criar');
  });

  const faturaGravada = {
    id: 'c-fatura',
    nome: 'Fatura Banco Aurora',
    valorCentavos: 110770,
    vencimento: '2026-11-20',
    quitaItens: false,
    pagoEm: null,
  };

  it('fatura já cadastrada é atualizada em vez de criar outra', () => {
    const resultado = cruzar(
      leitura(
        'fatura_cartao',
        [saida('2026-10-11', 28790, 'MERCADO')],
        contaLida(110770, '2026-11-20', 'Fatura Banco Aurora'),
      ),
      dados({ contasAvulsas: [faturaGravada] }),
      HOJE,
    );
    expect(resultado.conta?.acao).toMatchObject({
      tipo: 'atualizar_avulsa',
      conta: { contaAvulsaId: 'c-fatura' },
    });
    expect(resultado.linhas[0]?.acao.tipo).toBe('lancar');
  });

  it('fatura já paga avisa que o pagamento vira transferência', () => {
    const resultado = cruzar(
      leitura('fatura_cartao', [], contaLida(110770, '2026-11-20', 'Fatura')),
      dados({ contasAvulsas: [{ ...faturaGravada, pagoEm: '2026-11-19' }] }),
      HOJE,
    );
    expect(resultado.conta?.aviso).toContain('o pagamento passa a ser transferência');
  });

  it('fatura cadastrada como fixa muda a previsão e deixa os itens de fora', () => {
    const cartao = {
      ...aluguel,
      id: 'r-cartao',
      nome: 'Cartão Aurora',
      valorCentavos: 100000,
      dia: 20,
    };
    const resultado = cruzar(
      leitura(
        'fatura_cartao',
        [saida('2026-10-11', 28790, 'MERCADO')],
        contaLida(110770, '2026-11-20', 'Fatura'),
      ),
      dados({ recorrencias: [cartao] }),
      HOJE,
    );
    expect(resultado.conta?.acao).toMatchObject({
      tipo: 'prever_fixa',
      conta: { recorrenciaId: 'r-cartao' },
    });
    expect(resultado.linhas[0]?.acao.tipo).toBe('ignorar');
  });

  it('item de fixa paga no cartão se vincula à fixa (D4)', () => {
    const netflix = {
      ...aluguel,
      id: 'r-netflix',
      nome: 'Netflix',
      valorCentavos: 3990,
      dia: 18,
      pagaNoCartao: true,
    };
    const resultado = cruzar(
      leitura(
        'fatura_cartao',
        [saida('2026-10-18', 3990, 'NETFLIX.COM')],
        contaLida(3990, '2026-11-20', 'Fatura'),
      ),
      dados({ recorrencias: [netflix] }),
      HOJE,
    );
    expect(resultado.linhas[0]?.acao).toMatchObject({
      tipo: 'vincular_fixa',
      conta: { recorrenciaId: 'r-netflix', competencia: '2026-10' },
    });
  });

  it('item de fatura não quita conta do extrato', () => {
    const resultado = cruzar(
      leitura(
        'fatura_cartao',
        [saida('2026-11-05', 120000, 'IMOBILIARIA')],
        contaLida(120000, '2026-11-20', 'Fatura'),
      ),
      dados({ recorrencias: [aluguel] }),
      HOJE,
    );
    expect(resultado.linhas[0]?.acao.tipo).toBe('lancar');
  });
});

describe('linhas que a leitura já desmarcou', () => {
  it('continuam desmarcadas, com o motivo', () => {
    const pagamento = novoLancamento({
      data: '2026-10-20',
      descricao: 'PAGAMENTO RECEBIDO',
      valorCentavos: 152040,
      tipo: 'transferencia',
      marcado: false,
      avisos: ['Pagamento da fatura anterior.'],
    });
    const [linha] = cruzar(leitura('fatura_cartao', [pagamento]), dados(), HOJE).linhas;
    expect(linha?.acao).toEqual({ tipo: 'ignorar', motivo: 'Pagamento da fatura anterior.' });
  });
});
