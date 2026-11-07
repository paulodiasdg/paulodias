import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Regra 6 do CLAUDE.md (e aceite da Etapa 5): dados de documento nunca entram nos cálculos sem
 * aprovação. O motor só recebe o que `carregar.ts` lê; se ele passar a ler a tabela de documentos
 * ou a extração em revisão, este teste falha.
 */
describe('regra 6: a leitura em revisão não chega ao motor', () => {
  // O código sem os comentários (o comentário de carregar.ts cita a regra).
  const codigo = readFileSync(new URL('./carregar.ts', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  it("carregar.ts não consulta a tabela 'documentos' nem lê extracao_json", () => {
    expect(codigo).not.toMatch(/from\(\s*['"]documentos['"]\s*\)/);
    expect(codigo).not.toMatch(/extracao_json/);
  });

  it('carregar.ts lê só as tabelas de dados gravados', () => {
    const tabelas = [...codigo.matchAll(/from\(\s*['"]([a-z_]+)['"]\s*\)/g)].map((m) => m[1]);
    expect(new Set(tabelas)).toEqual(
      new Set([
        'perfis',
        'recorrencias',
        'ocorrencias',
        'contas_avulsas',
        'lancamentos',
        'metas',
        'movimentos_reserva',
        'categorias',
      ]),
    );
  });
});
