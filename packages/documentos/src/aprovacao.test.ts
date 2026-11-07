import { gastoVariavelNoMes, pagarConta, type DadosFinanceiros } from '@no-azul/motor';
import { describe, expect, it } from 'vitest';
import { planoDaAprovacao, type LinhaRevisada, type Revisao } from './aprovacao';
import type { AcaoDaConta, ContaSugerida } from './cruzamento';

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
const luz = { ...aluguel, id: 'r-luz', nome: 'Luz', valorCentavos: 15000, dia: 10 };
const netflix = {
  ...aluguel,
  id: 'r-netflix',
  nome: 'Netflix',
  valorCentavos: 3990,
  dia: 18,
  pagaNoCartao: true,
};
const salario = {
  ...aluguel,
  id: 'r-salario',
  tipo: 'renda' as const,
  nome: 'Salário',
  valorCentavos: 500000,
};

function dados(parcial: Partial<DadosFinanceiros> = {}): DadosFinanceiros {
  return {
    perfil: { tetoVariavelCentavos: null, inicioEm: '2026-01-01' },
    recorrencias: [aluguel, luz, netflix, salario],
    ocorrencias: [],
    contasAvulsas: [],
    lancamentos: [],
    metas: [],
    movimentos: [
      {
        id: 'm1',
        data: '2026-11-01',
        tipo: 'aporte',
        destino: 'contas',
        metaId: null,
        valorCentavos: 125000,
        ocorrenciaId: null,
        contaAvulsaId: null,
      },
    ],
    ...parcial,
  };
}

const contaSugerida = (
  chave: string,
  nome: string,
  extra: Partial<ContaSugerida> = {},
): ContaSugerida => ({
  chave,
  origem: 'fixa',
  nome,
  valorCentavos: 0,
  vencimento: '2026-11-05',
  pagoEm: null,
  recorrenciaId: null,
  competencia: null,
  contaAvulsaId: null,
  ...extra,
});

const linha = (parcial: Partial<LinhaRevisada>): LinhaRevisada => ({
  acao: { tipo: 'lancar' },
  data: '2026-11-05',
  descricao: 'MERCADO',
  valorCentavos: 1000,
  tipo: 'despesa',
  categoriaId: null,
  ...parcial,
});

describe('plano da aprovação', () => {
  it('quita contas em sequência, com o saque de cada uma vindo do motor', () => {
    const revisao: Revisao = {
      tipoDoDocumento: 'extrato',
      conta: null,
      linhas: [
        linha({
          acao: { tipo: 'quitar', conta: contaSugerida('fixa:r-aluguel:2026-11', 'Aluguel') },
          valorCentavos: 120000,
        }),
        linha({
          acao: { tipo: 'quitar', conta: contaSugerida('fixa:r-luz:2026-11', 'Luz') },
          data: '2026-11-10',
          valorCentavos: 18990,
        }),
        linha({ acao: { tipo: 'ignorar', motivo: 'repetido' } }),
      ],
    };
    const resultado = planoDaAprovacao(revisao, dados());
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    // Reserva de R$ 1.250: o aluguel leva R$ 1.200 e a luz, o que sobrou (R$ 50).
    expect(resultado.plano.pagamentos).toEqual([
      {
        pago_em: '2026-11-05',
        valor_centavos: 120000,
        saque_centavos: 120000,
        tipo_lancamento: 'despesa',
        recorrencia_id: 'r-aluguel',
        competencia: '2026-11',
        conta_avulsa_id: null,
      },
      {
        pago_em: '2026-11-10',
        valor_centavos: 18990,
        saque_centavos: 5000,
        tipo_lancamento: 'despesa',
        recorrencia_id: 'r-luz',
        competencia: '2026-11',
        conta_avulsa_id: null,
      },
    ]);
    expect(resultado.plano.lancamentos).toEqual([]);
  });

  it('fatura com itens importados é criada como fatura que quita itens; sem itens, não', () => {
    const conta = {
      acao: { tipo: 'criar' as const },
      nome: 'Fatura Aurora',
      valorCentavos: 30000,
      vencimento: '2026-11-20',
      categoriaId: null,
    };
    const comItens = planoDaAprovacao(
      { tipoDoDocumento: 'fatura_cartao', conta, linhas: [linha({})] },
      dados(),
    );
    expect(comItens.ok && comItens.plano.conta).toMatchObject({ acao: 'criar', quita_itens: true });
    const semItens = planoDaAprovacao(
      {
        tipoDoDocumento: 'fatura_cartao',
        conta,
        linhas: [linha({ acao: { tipo: 'ignorar', motivo: 'x' } })],
      },
      dados(),
    );
    expect(semItens.ok && semItens.plano.conta).toMatchObject({
      acao: 'criar',
      quita_itens: false,
    });
  });

  it('pagar no extrato a fatura que quita itens vira transferência: o gasto não conta duas vezes (aceite)', () => {
    const fatura = {
      id: 'c-fatura',
      nome: 'Fatura Aurora',
      valorCentavos: 30000,
      vencimento: '2026-11-20',
      quitaItens: true,
      pagoEm: null,
    };
    const itens = [
      {
        id: 'i1',
        data: '2026-10-11',
        descricao: 'MERCADO',
        valorCentavos: 20000,
        tipo: 'despesa' as const,
        ocorrenciaId: null,
        contaAvulsaId: null,
      },
      {
        id: 'i2',
        data: '2026-10-15',
        descricao: 'POSTO',
        valorCentavos: 10000,
        tipo: 'despesa' as const,
        ocorrenciaId: null,
        contaAvulsaId: null,
      },
    ];
    const antes = dados({ contasAvulsas: [fatura], lancamentos: itens });
    const resultado = planoDaAprovacao(
      {
        tipoDoDocumento: 'extrato',
        conta: null,
        linhas: [
          linha({
            acao: {
              tipo: 'quitar',
              conta: contaSugerida('avulsa:c-fatura', 'Fatura Aurora', {
                origem: 'avulsa',
                contaAvulsaId: 'c-fatura',
              }),
            },
            data: '2026-11-19',
            valorCentavos: 30000,
            descricao: 'PAGAMENTO FATURA',
          }),
        ],
      },
      antes,
    );
    expect(resultado.ok && resultado.plano.pagamentos[0]?.tipo_lancamento).toBe('transferencia');
    const depois = pagarConta(
      antes,
      {
        chave: 'avulsa:c-fatura',
        origem: 'avulsa',
        nome: 'Fatura Aurora',
        valorCentavos: 30000,
        vencimento: '2026-11-20',
        pagoEm: null,
        recorrenciaId: null,
        competencia: null,
        ocorrenciaId: null,
        contaAvulsaId: 'c-fatura',
        quitaItens: true,
        pagaNoCartao: false,
        categoriaId: null,
      },
      '2026-11-19',
    );
    expect(gastoVariavelNoMes(depois, '2026-10')).toBe(30000);
    expect(gastoVariavelNoMes(depois, '2026-11')).toBe(0);
  });

  it('item de fixa paga no cartão marca a fixa sem sair da reserva e fica vinculado a ela', () => {
    const resultado = planoDaAprovacao(
      {
        tipoDoDocumento: 'fatura_cartao',
        conta: null,
        linhas: [
          linha({
            acao: {
              tipo: 'vincular_fixa',
              conta: contaSugerida('fixa:r-netflix:2026-10', 'Netflix'),
            },
            data: '2026-10-18',
            valorCentavos: 3990,
            descricao: 'NETFLIX.COM',
          }),
        ],
      },
      dados(),
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.plano.pagamentos[0]).toMatchObject({
      saque_centavos: 0,
      tipo_lancamento: null,
      recorrencia_id: 'r-netflix',
    });
    expect(resultado.plano.lancamentos[0]).toMatchObject({
      recorrencia_id: 'r-netflix',
      competencia: '2026-10',
      tipo: 'despesa',
    });
  });

  it('confirma a renda prevista com o valor lido, uma vez só', () => {
    const renda = {
      recorrenciaId: 'r-salario',
      competencia: '2026-11',
      nome: 'Salário',
      valorPrevistoCentavos: 500000,
      dataPrevista: '2026-11-05',
    };
    const uma = planoDaAprovacao(
      {
        tipoDoDocumento: 'contracheque',
        conta: null,
        linhas: [
          linha({ acao: { tipo: 'receber', renda }, valorCentavos: 487632, tipo: 'receita' }),
        ],
      },
      dados(),
    );
    expect(uma.ok && uma.plano.recebimentos).toEqual([
      {
        recorrencia_id: 'r-salario',
        competencia: '2026-11',
        valor_centavos: 487632,
        recebido_em: '2026-11-05',
      },
    ]);
    const duas = planoDaAprovacao(
      {
        tipoDoDocumento: 'extrato',
        conta: null,
        linhas: [
          linha({ acao: { tipo: 'receber', renda }, tipo: 'receita' }),
          linha({ acao: { tipo: 'receber', renda }, tipo: 'receita' }),
        ],
      },
      dados(),
    );
    expect(duas.ok).toBe(false);
  });

  it('recusa quitar conta já paga, conta avulsa com outro valor e linha sem valor', () => {
    const paga = dados({
      ocorrencias: [
        {
          id: 'o1',
          recorrenciaId: 'r-aluguel',
          competencia: '2026-11',
          valorCentavos: 120000,
          status: 'paga',
          pagoEm: '2026-11-04',
        },
      ],
    });
    const quitarAluguel = linha({
      acao: { tipo: 'quitar', conta: contaSugerida('fixa:r-aluguel:2026-11', 'Aluguel') },
      valorCentavos: 120000,
    });
    expect(
      planoDaAprovacao({ tipoDoDocumento: 'extrato', conta: null, linhas: [quitarAluguel] }, paga),
    ).toMatchObject({ ok: false });

    const avulsa = dados({
      contasAvulsas: [
        {
          id: 'c1',
          nome: 'IPVA',
          valorCentavos: 50000,
          vencimento: '2026-11-10',
          quitaItens: false,
          pagoEm: null,
        },
      ],
    });
    const outroValor = linha({
      acao: {
        tipo: 'quitar',
        conta: contaSugerida('avulsa:c1', 'IPVA', { origem: 'avulsa', contaAvulsaId: 'c1' }),
      },
      valorCentavos: 49999,
    });
    expect(
      planoDaAprovacao({ tipoDoDocumento: 'extrato', conta: null, linhas: [outroValor] }, avulsa),
    ).toMatchObject({ ok: false });

    expect(
      planoDaAprovacao(
        { tipoDoDocumento: 'extrato', conta: null, linhas: [linha({ valorCentavos: 0 })] },
        dados(),
      ),
    ).toMatchObject({ ok: false });
  });

  it('boleto de fixa vira a previsão do mês; "não gravar" não grava conta', () => {
    const conta = (acao: AcaoDaConta) => ({
      acao,
      nome: 'Luz',
      valorCentavos: 18990,
      vencimento: '2026-11-10',
      categoriaId: null,
    });
    const prever = planoDaAprovacao(
      {
        tipoDoDocumento: 'boleto',
        conta: conta({
          tipo: 'prever_fixa',
          conta: contaSugerida('fixa:r-luz:2026-11', 'Luz', {
            recorrenciaId: 'r-luz',
            competencia: '2026-11',
          }),
        }),
        linhas: [],
      },
      dados(),
    );
    expect(prever.ok && prever.plano.conta).toEqual({
      acao: 'prever_fixa',
      recorrencia_id: 'r-luz',
      competencia: '2026-11',
      valor_centavos: 18990,
    });
    const nada = planoDaAprovacao(
      { tipoDoDocumento: 'boleto', conta: conta({ tipo: 'nao_gravar', motivo: 'x' }), linhas: [] },
      dados(),
    );
    expect(nada.ok && nada.plano.conta).toBeNull();
  });
});
