import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lerCsv, lerXlsx } from './planilhas';

const arquivo = (nome: string) =>
  new Uint8Array(readFileSync(join(import.meta.dirname, '../../testes/conjunto/arquivos', nome)));

describe('planilhas', () => {
  it('CSV com ponto e vírgula e acentuação do Windows', () => {
    const tabela = lerCsv(arquivo('21-extrato-vale-verde.csv'));
    expect(tabela[0]).toEqual(['Data', 'Histórico', 'Documento', 'Valor', 'Saldo']);
    expect(tabela.some((linha) => linha[1]?.includes('PREÇO'))).toBe(true);
  });

  it('CSV com vírgula, aspas e marca de UTF-8', () => {
    const tabela = lerCsv(arquivo('22-extrato-ponte.csv'));
    expect(tabela[0]?.[0]).toBe('Data');
    expect(tabela.find((linha) => linha[1]?.includes(', LOJA 2'))).toBeDefined();
  });

  it('XLSX com datas e números das células', async () => {
    const tabela = await lerXlsx(arquivo('23-extrato-ponte.xlsx'));
    expect(tabela[0]?.[0]).toBe('Banco Ponte Digital - Extrato de conta corrente');
    const cabecalho = tabela.findIndex((linha) => linha[0] === 'Data');
    const [data, , valor] = tabela[cabecalho + 1] ?? [];
    expect(data).toMatch(/^2026-10-\d{2}$/);
    expect(valor).toMatch(/^-?\d+(\.\d{2})?$/);
  });
});
