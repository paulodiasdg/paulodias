import { describe, expect, it } from 'vitest';
import { lancamentosEmCsv } from './csv';
import type { LinhaDeLancamento } from './consultas';

function lancamento(parcial: Partial<LinhaDeLancamento>): LinhaDeLancamento {
  return {
    id: 'l',
    usuario_id: 'u',
    data: '2026-11-05',
    descricao: 'Mercado',
    valor_centavos: 28_790,
    tipo: 'despesa',
    categoria_id: 'c1',
    ocorrencia_id: null,
    conta_avulsa_id: null,
    documento_id: null,
    origem: 'manual',
    criado_em: '2026-11-05T12:00:00Z',
    ...parcial,
  };
}

describe('exportação de lançamentos em CSV', () => {
  it('usa ponto e vírgula, vírgula decimal e datas brasileiras', () => {
    const csv = lancamentosEmCsv(
      [
        lancamento({}),
        lancamento({
          descricao: 'Salário',
          tipo: 'receita',
          valor_centavos: 770_000,
          categoria_id: null,
        }),
      ],
      new Map([['c1', 'Alimentação']]),
    );
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual([
      'Data;Descrição;Categoria;Tipo;Valor (R$)',
      '05/11/2026;Mercado;Alimentação;Gasto;287,90',
      '05/11/2026;Salário;Sem categoria;Receita;7700,00',
      '',
    ]);
  });

  it('protege aspas, separadores e fórmulas nas descrições', () => {
    const csv = lancamentosEmCsv(
      [
        lancamento({ descricao: 'Pão; leite "integral"' }),
        lancamento({ descricao: '=HYPERLINK("x")' }),
      ],
      new Map(),
    );
    const [, primeira, segunda] = csv.slice(1).split('\r\n');
    expect(primeira).toBe('05/11/2026;"Pão; leite ""integral""";Sem categoria;Gasto;287,90');
    expect(segunda).toBe(`05/11/2026;"'=HYPERLINK(""x"")";Sem categoria;Gasto;287,90`);
  });
});
