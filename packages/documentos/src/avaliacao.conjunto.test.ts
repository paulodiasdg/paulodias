import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { Gabarito } from '../testes/conjunto/tipos.ts';
import { avaliar, type ResultadoDaAvaliacao } from './avaliacao';
import { encerrarOcr, lerDocumento } from './leitura';

/**
 * Aceite da Etapa 5: nos 30 documentos fictícios, 95% dos valores e datas lidos corretamente.
 * Roda a leitura completa (PDF, OCR, código de barras, planilhas), sem nenhum serviço externo.
 */

const pasta = join(import.meta.dirname, '../testes/conjunto');
const gabaritos = JSON.parse(readFileSync(join(pasta, 'gabaritos.json'), 'utf8')) as Gabarito[];
const HOJE = '2026-11-07';
const META = 0.95;

const resultados: { gabarito: Gabarito; avaliacao: ResultadoDaAvaliacao; tipoLido: string }[] = [];

afterAll(async () => {
  await encerrarOcr();
});

describe('leitura dos 30 documentos do conjunto de teste', () => {
  it('lê 95% ou mais dos valores e datas', async () => {
    for (const gabarito of gabaritos) {
      const bytes = new Uint8Array(readFileSync(join(pasta, 'arquivos', gabarito.arquivo)));
      const lido = await lerDocumento(bytes, { nome: gabarito.arquivo, hoje: HOJE });
      if (!lido.ok) throw new Error(`${gabarito.arquivo}: ${lido.motivo}`);
      resultados.push({
        gabarito,
        avaliacao: avaliar(lido.extracao, gabarito),
        tipoLido: lido.extracao.tipo,
      });
    }

    const total = resultados.reduce(
      (soma, r) => ({
        acertos: soma.acertos + r.avaliacao.acertos,
        base: soma.base + r.avaliacao.esperados + r.avaliacao.aMais,
      }),
      { acertos: 0, base: 0 },
    );
    const porFormato = new Map<string, { acertos: number; base: number }>();
    for (const r of resultados) {
      const atual = porFormato.get(r.gabarito.formato) ?? { acertos: 0, base: 0 };
      atual.acertos += r.avaliacao.acertos;
      atual.base += r.avaliacao.esperados + r.avaliacao.aMais;
      porFormato.set(r.gabarito.formato, atual);
    }

    const pct = (a: number, b: number) => `${((a / b) * 100).toFixed(1).replace('.', ',')}%`;
    const linhas = resultados.map((r) => {
      const { acertos, esperados, aMais } = r.avaliacao;
      const tipo = r.tipoLido === r.gabarito.tipo ? '' : ` (lido como ${r.tipoLido})`;
      const erros =
        r.avaliacao.erros.length > 0
          ? `\n      ${r.avaliacao.erros.slice(0, 6).join('\n      ')}`
          : '';
      return `  ${r.gabarito.arquivo.padEnd(36)} ${String(acertos).padStart(3)}/${String(esperados + aMais).padEnd(3)} ${pct(acertos, esperados + aMais).padStart(6)}${tipo}${erros}`;
    });
    console.log(
      [
        '',
        'Leitura do conjunto de teste (valores e datas)',
        ...linhas,
        '',
        ...[...porFormato.entries()].map(
          ([formato, s]) =>
            `  ${formato.padEnd(18)} ${String(s.acertos).padStart(3)}/${s.base} ${pct(s.acertos, s.base)}`,
        ),
        '',
        `  TOTAL ${total.acertos}/${total.base} = ${pct(total.acertos, total.base)} (meta: 95%)`,
        '',
      ].join('\n'),
    );

    expect(resultados).toHaveLength(30);
    expect(total.acertos / total.base).toBeGreaterThanOrEqual(META);
  }, 300_000);
});
