import { describe, expect, it } from 'vitest';
import { alertasDaSemana } from './alertas';
import { ritmoDoMes } from './ritmo';
import { cenario36, HOJE_3_6 } from './testes/cenario-3-6';
import { dadosVazios, despesa, fixa, meta, renda } from './testes/construtores';
import type { DadosFinanceiros } from './tipos';

const tipos = (dados: DadosFinanceiros, hoje: string) =>
  alertasDaSemana(dados, hoje).map((alerta) => alerta.tipo);

describe('alertas do painel', () => {
  it('no cenário 3.6, avisa da meta sem verba completa e do gasto acima do ritmo', () => {
    const alertas = alertasDaSemana(cenario36(), HOJE_3_6);
    expect(alertas.map((alerta) => alerta.tipo)).toEqual([
      'meta_sem_verba',
      'gasto_acima_do_ritmo',
    ]);
    const semVerba = alertas[0]!;
    expect(semVerba.tipo === 'meta_sem_verba' && semVerba.metas.map((p) => p.meta.id)).toEqual([
      'notebook',
    ]);
  });

  describe('conta vencida', () => {
    const base = dadosVazios({
      recorrencias: [
        renda('salario', 500_000, 5, { inicio: '2026-11-01' }),
        fixa('luz', 20_000, 3, { inicio: '2026-11-01' }),
      ],
    });

    it('avisa da conta em aberto que venceu antes de hoje, com o total', () => {
      const [alerta] = alertasDaSemana(base, '2026-11-04');
      expect(alerta).toMatchObject({ tipo: 'conta_vencida', totalCentavos: 20_000 });
      expect(alerta?.tipo === 'conta_vencida' && alerta.contas.map((c) => c.nome)).toEqual(['luz']);
    });

    it('não avisa da conta que vence hoje', () => {
      expect(tipos(base, '2026-11-03')).not.toContain('conta_vencida');
    });

    it('não avisa da conta paga', () => {
      const paga: DadosFinanceiros = {
        ...base,
        ocorrencias: [
          {
            id: 'o1',
            recorrenciaId: 'luz',
            competencia: '2026-11',
            valorCentavos: 20_000,
            status: 'paga',
            pagoEm: '2026-11-04',
          },
        ],
      };
      expect(tipos(paga, '2026-11-04')).not.toContain('conta_vencida');
    });

    it('não avisa da fixa paga no cartão, que sai pela fatura', () => {
      const noCartao = dadosVazios({
        recorrencias: [fixa('streaming', 5_000, 3, { inicio: '2026-11-01', pagaNoCartao: true })],
      });
      expect(tipos(noCartao, '2026-11-04')).not.toContain('conta_vencida');
    });
  });

  it('avisa da meta com prazo vencido e não concluída', () => {
    const dados = dadosVazios({
      recorrencias: [renda('salario', 500_000, 5, { inicio: '2026-11-01' })],
      metas: [
        meta('atrasada', 100_000, '2026-10-30', 1),
        meta('concluida', 100_000, '2026-10-30', 2, { concluidaEm: '2026-10-20' }),
      ],
    });
    const alerta = alertasDaSemana(dados, '2026-11-04').find(
      (a) => a.tipo === 'meta_prazo_vencido',
    );
    expect(alerta?.tipo === 'meta_prazo_vencido' && alerta.metas.map((p) => p.meta.id)).toEqual([
      'atrasada',
    ]);
  });

  it('avisa da meta sem nenhuma verba', () => {
    const dados = dadosVazios({
      perfil: { tetoVariavelCentavos: 300_000, inicioEm: '2026-11-01' },
      recorrencias: [renda('salario', 300_000, 5, { inicio: '2026-11-01' })],
      metas: [meta('viagem', 100_000, '2027-11-02', 1)],
    });
    const alerta = alertasDaSemana(dados, '2026-11-04').find((a) => a.tipo === 'meta_sem_verba');
    expect(alerta?.tipo === 'meta_sem_verba' && alerta.metas[0]?.situacao).toBe('sem_verba');
  });

  describe('gasto acima do ritmo', () => {
    // Limite de R$ 3.000 em novembro (30 dias): no dia 10, o ritmo permite R$ 1.000.
    const comGasto = (valor: number) =>
      dadosVazios({
        perfil: { tetoVariavelCentavos: 300_000, inicioEm: '2026-11-01' },
        recorrencias: [renda('salario', 1_000_000, 5, { inicio: '2026-11-01' })],
        lancamentos: valor > 0 ? [despesa('compras', valor, '2026-11-02')] : [],
      });

    it('avisa quando o gasto do mês passa do limite proporcional aos dias', () => {
      expect(tipos(comGasto(100_001), '2026-11-10')).toContain('gasto_acima_do_ritmo');
      const ritmo = ritmoDoMes(comGasto(100_001), '2026-11-10');
      expect(ritmo).toMatchObject({
        limiteMensalCentavos: 300_000,
        gastoNoMesCentavos: 100_001,
        diasConsiderados: 10,
        diasDoMes: 30,
        esperadoAteHojeCentavos: 100_000,
        acimaDoRitmo: true,
      });
    });

    it('não avisa quando o gasto está exatamente no ritmo', () => {
      expect(tipos(comGasto(100_000), '2026-11-10')).not.toContain('gasto_acima_do_ritmo');
    });

    it('usa no mínimo 7 dias no começo do mês, como o índice', () => {
      // Dia 2: sem o mínimo, o ritmo permitiria R$ 200; com 7 dias, R$ 700.
      expect(tipos(comGasto(60_000), '2026-11-02')).not.toContain('gasto_acima_do_ritmo');
      expect(ritmoDoMes(comGasto(60_000), '2026-11-02').esperadoAteHojeCentavos).toBe(70_000);
      expect(tipos(comGasto(70_001), '2026-11-02')).toContain('gasto_acima_do_ritmo');
    });

    it('com limite zero, avisa de qualquer gasto, e só dele', () => {
      const semLimite = (valor: number) => ({
        ...comGasto(valor),
        perfil: { tetoVariavelCentavos: 0, inicioEm: '2026-11-01' },
      });
      expect(tipos(semLimite(0), '2026-11-10')).not.toContain('gasto_acima_do_ritmo');
      expect(tipos(semLimite(1), '2026-11-10')).toContain('gasto_acima_do_ritmo');
    });
  });

  it('sem nada fora do lugar, não há alertas', () => {
    const dados = dadosVazios({
      perfil: { tetoVariavelCentavos: 100_000, inicioEm: '2026-11-01' },
      recorrencias: [renda('salario', 500_000, 5, { inicio: '2026-11-01' })],
      metas: [meta('viagem', 100_000, '2027-11-02', 1)],
    });
    expect(alertasDaSemana(dados, '2026-11-04')).toEqual([]);
  });
});
