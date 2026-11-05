import type { DadosFinanceiros } from '../tipos';
import { avulsa, dadosVazios, despesa, fixa, meta, movimento, renda } from './construtores';

/**
 * Cenário fictício da seção 3.6 da spec, montado em quarta-feira, 04/11/2026. A semana 1 vai de
 * 02 a 08/11; as fixas nos dias 7, 15 e 21 e a conta avulsa em 20/11 reproduzem as oito semanas
 * da tabela. Os prazos caem no dia 2, a segunda-feira de referência (D1 e D3), para dar 18, 8 e
 * 10 meses exatos.
 */
export const HOJE_3_6 = '2026-11-04';

export function cenario36(): DadosFinanceiros {
  return dadosVazios({
    perfil: { tetoVariavelCentavos: 220_000, inicioEm: '2026-11-01' },
    recorrencias: [
      renda('salario', 770_000, 5, { nome: 'Salário', inicio: '2026-11-01' }),
      fixa('plano-saude', 52_000, 7, { nome: 'Plano de saúde', inicio: '2026-11-01' }),
      fixa('aluguel', 213_000, 15, { nome: 'Aluguel', inicio: '2026-11-01' }),
      fixa('condominio', 35_000, 21, { nome: 'Condomínio', inicio: '2026-11-01' }),
    ],
    contasAvulsas: [avulsa('ipva', 38_000, '2026-11-20', { nome: 'IPVA' })],
    metas: [
      meta('emergencia', 3_000_000, '2028-05-02', 1, {
        nome: 'Reserva de emergência',
        tipo: 'emergencia',
      }),
      meta('viagem', 450_000, '2027-07-02', 2, { nome: 'Viagem' }),
      meta('notebook', 680_000, '2027-09-02', 3, { nome: 'Notebook' }),
    ],
    movimentos: [
      movimento('saldo-inicial-contas', 'ajuste', 80_000, '2026-11-01'),
      movimento('saldo-inicial-emergencia', 'ajuste', 780_000, '2026-11-01', {
        destino: 'meta',
        metaId: 'emergencia',
      }),
    ],
    // 110% do ritmo: limite de R$ 2.200 × 7/30 (fração mínima de 7 dias) × 1,1 ≈ R$ 564,67.
    lancamentos: [
      despesa('mercado', 40_000, '2026-11-02', { descricao: 'Mercado' }),
      despesa('restaurante', 16_467, '2026-11-03', { descricao: 'Restaurante' }),
    ],
  });
}
