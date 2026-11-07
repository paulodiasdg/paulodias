import { describe, expect, it } from 'vitest';
import { avaliar } from './avaliacao';
import { descricoesParecidas, palavrasDaDescricao, sugerirCategoria } from './categorias';
import { novoLancamento } from './leitores/comum';
import { LEITOR, type Extracao } from './tipos';
import { mascarar, validarExtracao } from './validacao';

const HOJE = '2026-11-07';

function extracao(parcial: Partial<Extracao>): Extracao {
  return {
    versao: 1,
    leitor: LEITOR,
    formato: 'pdf',
    origem: 'texto',
    tipo: 'extrato',
    tipoInformado: false,
    emissor: null,
    competencia: null,
    conta: null,
    lancamentos: [],
    avisos: [],
    ...parcial,
  };
}

describe('máscaras (4.5 da spec)', () => {
  it('tira CPF, CNPJ, cartão e linha digitável', () => {
    expect(mascarar('PIX ENVIADO 123.456.789-09 CARLOS')).toBe('PIX ENVIADO ***.***.***-** CARLOS');
    expect(mascarar('PIX 12345678909')).toBe('PIX ***.***.***-**');
    expect(mascarar('CPF ***.456.789-**')).toBe('CPF ***.***.***-**');
    expect(mascarar('EMPRESA 12.345.678/0001-90')).toBe('EMPRESA **.***.***/****-**');
    expect(mascarar('Cartão 5555 4444 3333 1234')).toBe('Cartão **** **** **** 1234');
    expect(mascarar('Pague 99793.21453 00000.000778 78889.990012 5 16510000048000')).toBe(
      'Pague [código omitido]',
    );
    expect(mascarar('UBER *TRIP 23,45')).toBe('UBER *TRIP 23,45');
  });
});

describe('validação da leitura', () => {
  it('mascara as descrições e o emissor', () => {
    const lida = validarExtracao(
      extracao({
        emissor: 'Loja 12.345.678/0001-90',
        lancamentos: [
          novoLancamento({
            data: '2026-10-03',
            descricao: 'PIX 123.456.789-09',
            valorCentavos: 100,
            tipo: 'despesa',
          }),
        ],
      }),
      HOJE,
    );
    expect(lida.emissor).toBe('Loja **.***.***/****-**');
    expect(lida.lancamentos[0]?.descricao).toBe('PIX ***.***.***-**');
  });

  it('pede o que falta e desconfia de datas no futuro ou muito antigas', () => {
    const lida = validarExtracao(
      extracao({
        lancamentos: [
          novoLancamento({ data: null, descricao: 'a', valorCentavos: null, tipo: 'despesa' }),
          novoLancamento({
            data: '2026-12-25',
            descricao: 'b',
            valorCentavos: 100,
            tipo: 'despesa',
          }),
          novoLancamento({
            data: '2024-01-01',
            descricao: 'c',
            valorCentavos: 100,
            tipo: 'despesa',
          }),
          novoLancamento({ data: '2026-11-01', descricao: 'd', valorCentavos: 0, tipo: 'despesa' }),
        ],
      }),
      HOJE,
    );
    const [semNada, futuro, antigo, zerado] = lida.lancamentos;
    expect(semNada?.avisos).toEqual(['Informe o valor.', 'Informe a data.']);
    expect(futuro?.confianca.data).toBe(0.5);
    expect(antigo?.confianca.data).toBe(0.7);
    expect(zerado?.valorCentavos).toBeNull();
  });

  it('compara a soma dos itens com o total da fatura e destaca os valores quando difere', () => {
    const itens = [
      novoLancamento({
        data: '2026-10-11',
        descricao: 'MERCADO',
        valorCentavos: 20000,
        tipo: 'despesa',
      }),
      novoLancamento({
        data: '2026-10-12',
        descricao: 'ESTORNO',
        valorCentavos: 5000,
        tipo: 'receita',
      }),
      novoLancamento({
        data: '2026-10-01',
        descricao: 'PAGAMENTO',
        valorCentavos: 90000,
        tipo: 'transferencia',
      }),
    ];
    const conta = {
      nome: 'Fatura',
      valorCentavos: 15000,
      vencimento: '2026-11-20',
      categoria: null,
      confianca: { valor: 1, vencimento: 1 },
      fechamento: null,
    };
    const certa = validarExtracao(
      extracao({ tipo: 'fatura_cartao', conta, lancamentos: itens }),
      HOJE,
    );
    expect(certa.avisos).toEqual([]);
    const errada = validarExtracao(
      extracao({
        tipo: 'fatura_cartao',
        conta: { ...conta, valorCentavos: 15320 },
        lancamentos: itens,
      }),
      HOJE,
    );
    expect(errada.avisos).toEqual(['O total da fatura difere em R$ 3,20 da soma dos itens.']);
    expect(errada.lancamentos.every((l) => l.confianca.valor < 0.8)).toBe(true);
  });
});

describe('categorias', () => {
  it('compara descrições sem acentos, números e palavras genéricas', () => {
    expect([...palavrasDaDescricao('PIX ENVIADO 123 Maria Fictícia')]).toEqual([
      'maria',
      'ficticia',
    ]);
    expect(descricoesParecidas('COMPRA CARTAO DEB MERCADO BOM PRECO', 'Mercado Bom Preço')).toBe(
      true,
    );
    expect(descricoesParecidas('UBER *TRIP', 'IFOOD *LANCHES')).toBe(false);
    expect(descricoesParecidas('PIX ENVIADO', 'PIX RECEBIDO')).toBe(false);
  });

  it('usa primeiro a escolha da pessoa e depois a lista de palavras', () => {
    const historico = [{ descricao: 'Padaria Pão Quente', categoria: 'restaurantes' }];
    expect(sugerirCategoria('PADARIA PAO QUENTE', 'despesa', historico)).toBe('restaurantes');
    expect(sugerirCategoria('PADARIA PAO QUENTE', 'despesa')).toBe('alimentacao');
    expect(sugerirCategoria('IFOOD *PIZZARIA', 'despesa')).toBe('restaurantes');
    expect(sugerirCategoria('POSTO ESTRELA', 'despesa')).toBe('transporte');
    expect(sugerirCategoria('NETFLIX.COM', 'despesa')).toBe('assinaturas');
    expect(sugerirCategoria('TED RECEBIDA EMPRESA', 'receita')).toBe('salario');
    expect(sugerirCategoria('PIX RECEBIDO JOAO', 'receita')).toBe('outras_receitas');
    expect(sugerirCategoria('APLICACAO AUTOMATICA', 'transferencia')).toBe('transferencia');
    expect(sugerirCategoria('PAGAMENTO FATURA', 'transferencia')).toBe('pagamento_fatura');
    expect(sugerirCategoria('PET SHOP AMIGO', 'despesa')).toBe('outros');
    expect(sugerirCategoria('LOJA ONLINE GLOBAL', 'despesa')).toBe('compras');
    expect(sugerirCategoria('XYZ', 'despesa')).toBeNull();
  });

  it('só sugere categorias que a pessoa tem', () => {
    expect(sugerirCategoria('POSTO ESTRELA', 'despesa', [], new Set(['alimentacao']))).toBeNull();
  });
});

describe('avaliação contra o gabarito', () => {
  it('conta acertos, linhas que faltam e linhas a mais', () => {
    const lida = extracao({
      conta: {
        nome: 'x',
        valorCentavos: 100,
        vencimento: '2026-11-20',
        categoria: null,
        confianca: { valor: 1, vencimento: 1 },
        fechamento: null,
      },
      lancamentos: [
        novoLancamento({ data: '2026-10-01', descricao: 'a', valorCentavos: 500, tipo: 'despesa' }),
        novoLancamento({ data: '2026-10-03', descricao: 'b', valorCentavos: 700, tipo: 'despesa' }),
        novoLancamento({ data: '2026-10-09', descricao: 'c', valorCentavos: 999, tipo: 'despesa' }),
      ],
    });
    const resultado = avaliar(lida, {
      conta: { valorCentavos: 100, vencimento: '2026-11-21' },
      lancamentos: [
        { data: '2026-10-01', valorCentavos: 500 },
        { data: '2026-10-02', valorCentavos: 700 },
        { data: '2026-10-05', valorCentavos: 300 },
      ],
    });
    expect(resultado).toMatchObject({ acertos: 4, esperados: 8, aMais: 2 });
    expect(resultado.taxa).toBeCloseTo(0.4);
  });
});
