import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Gabarito } from './tipos.ts';

const pasta = join(import.meta.dirname, 'arquivos');
const gabaritos = JSON.parse(
  readFileSync(join(import.meta.dirname, 'gabaritos.json'), 'utf8'),
) as Gabarito[];

function dataValida(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  return new Date(`${data}T12:00:00Z`).toISOString().slice(0, 10) === data;
}

describe('conjunto de teste da leitura', () => {
  it('tem 30 documentos, todos no disco', () => {
    expect(gabaritos).toHaveLength(30);
    for (const gabarito of gabaritos) {
      expect(existsSync(join(pasta, gabarito.arquivo)), gabarito.arquivo).toBe(true);
    }
  });

  it('cobre todos os tipos e formatos da seção 4.1 da spec', () => {
    expect(new Set(gabaritos.map((g) => g.tipo))).toEqual(
      new Set(['comprovante', 'boleto', 'fatura_cartao', 'extrato', 'contracheque']),
    );
    expect(new Set(gabaritos.map((g) => g.formato))).toEqual(
      new Set(['pdf_texto', 'pdf_digitalizado', 'foto', 'csv', 'ofx', 'xlsx']),
    );
  });

  it('tem valores em centavos inteiros positivos e datas existentes', () => {
    for (const gabarito of gabaritos) {
      const valores = [
        ...(gabarito.conta ? [gabarito.conta.valorCentavos] : []),
        ...gabarito.lancamentos.map((l) => l.valorCentavos),
      ];
      const datas = [
        ...(gabarito.conta ? [gabarito.conta.vencimento] : []),
        ...gabarito.lancamentos.map((l) => l.data),
      ];
      for (const valor of valores) {
        expect(Number.isSafeInteger(valor) && valor > 0, gabarito.arquivo).toBe(true);
      }
      for (const data of datas) expect(dataValida(data), `${gabarito.arquivo} ${data}`).toBe(true);
    }
  });

  it('tem o total de cada fatura igual às compras menos os estornos', () => {
    for (const gabarito of gabaritos.filter((g) => g.tipo === 'fatura_cartao')) {
      const soma = gabarito.lancamentos.reduce(
        (total, l) =>
          l.tipo === 'despesa'
            ? total + l.valorCentavos
            : l.tipo === 'receita'
              ? total - l.valorCentavos
              : total,
        0,
      );
      expect(soma, gabarito.arquivo).toBe(gabarito.conta?.valorCentavos);
    }
  });
});
