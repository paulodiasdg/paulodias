import { describe, expect, it } from 'vitest';
import { calcularReservaContas, type DadosFinanceiros } from '@no-azul/motor';
import { avisoDaMudanca, codificarAviso, decodificarAviso } from './aviso-da-reserva';

const HOJE = '2026-11-04';

function dados(extra: Partial<DadosFinanceiros> = {}): DadosFinanceiros {
  return {
    perfil: { tetoVariavelCentavos: null, inicioEm: '2026-11-01' },
    recorrencias: [
      {
        id: 'aluguel',
        tipo: 'fixa',
        nome: 'Aluguel',
        valorCentavos: 213_000,
        dia: 15,
        inicio: '2026-11-01',
        fim: null,
        ativa: true,
      },
    ],
    ocorrencias: [],
    contasAvulsas: [],
    lancamentos: [],
    metas: [],
    movimentos: [],
    ...extra,
  };
}

const ipva = {
  id: 'ipva',
  nome: 'IPVA',
  valorCentavos: 38_000,
  vencimento: '2026-11-06',
  quitaItens: false,
  pagoEm: null,
};

describe('aviso de mudança do valor da semana (D3)', () => {
  it('explica a conta que entrou, com o valor de antes e o de agora', () => {
    const antes = calcularReservaContas(dados(), HOJE);
    const depois = calcularReservaContas(dados({ contasAvulsas: [ipva] }), HOJE);
    expect(avisoDaMudanca(antes, depois)).toEqual({
      deCentavos: antes.valorSemanalCentavos,
      paraCentavos: depois.valorSemanalCentavos,
      motivos: ['Entrou IPVA: R$ 380,00, vence em 06/11/2026.'],
    });
  });

  it('explica valor e vencimento alterados, conta que saiu e saldo corrigido', () => {
    const antes = calcularReservaContas(dados({ contasAvulsas: [ipva] }), HOJE);
    const depois = calcularReservaContas(
      dados({
        recorrencias: [{ ...dados().recorrencias[0]!, valorCentavos: 250_000 }],
        movimentos: [
          {
            id: 'ajuste',
            data: HOJE,
            tipo: 'ajuste',
            destino: 'contas',
            metaId: null,
            valorCentavos: 10_000,
            ocorrenciaId: null,
            contaAvulsaId: null,
          },
        ],
      }),
      HOJE,
    );
    // O aluguel de novembro e o de dezembro estão nas 8 semanas da reserva.
    expect(avisoDaMudanca(antes, depois)?.motivos).toEqual([
      'Aluguel, que vence em 15/11/2026, mudou de R$ 2.130,00 para R$ 2.500,00.',
      'Aluguel, que vence em 15/12/2026, mudou de R$ 2.130,00 para R$ 2.500,00.',
      'Saiu IPVA: R$ 380,00, que vencia em 06/11/2026.',
      'O saldo da reserva no início da semana foi corrigido de R$ 0,00 para R$ 100,00.',
    ]);
  });

  it('explica o vencimento alterado', () => {
    const antes = calcularReservaContas(dados(), HOJE);
    const depois = calcularReservaContas(
      dados({ recorrencias: [{ ...dados().recorrencias[0]!, dia: 6 }] }),
      HOJE,
    );
    expect(avisoDaMudanca(antes, depois)?.motivos[0]).toBe(
      'Aluguel passou a vencer em 06/11/2026, e não mais em 15/11/2026.',
    );
  });

  it('não avisa quando o valor da semana não mudou', () => {
    const antes = calcularReservaContas(dados(), HOJE);
    expect(avisoDaMudanca(antes, calcularReservaContas(dados(), HOJE))).toBeNull();
  });

  it('resume quando há muitas mudanças', () => {
    const muitas = Array.from({ length: 6 }, (_, i) => ({
      ...ipva,
      id: `c${i}`,
      nome: `Conta ${i}`,
    }));
    const aviso = avisoDaMudanca(
      calcularReservaContas(dados(), HOJE),
      calcularReservaContas(dados({ contasAvulsas: muitas }), HOJE),
    )!;
    expect(aviso.motivos).toHaveLength(5);
    expect(aviso.motivos.at(-1)).toBe('E mais 2 mudanças.');
  });

  it('o cookie volta igual e ignora conteúdo fora do formato', () => {
    const aviso = { deCentavos: 92_500, paraCentavos: 102_000, motivos: ['Entrou; algo, "x"'] };
    expect(decodificarAviso(codificarAviso(aviso))).toEqual(aviso);
    expect(decodificarAviso(undefined)).toBeNull();
    expect(decodificarAviso('%7Bquebrado')).toBeNull();
    expect(
      decodificarAviso(encodeURIComponent('{"deCentavos":1.5,"paraCentavos":2,"motivos":[]}')),
    ).toBeNull();
    expect(
      decodificarAviso(encodeURIComponent('{"deCentavos":1,"paraCentavos":2,"motivos":[3]}')),
    ).toBeNull();
  });
});
