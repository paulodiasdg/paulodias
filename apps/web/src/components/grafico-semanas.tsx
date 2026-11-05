'use client';

import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, XAxis } from 'recharts';

export interface BarraDaSemana {
  rotulo: string;
  gastoCentavos: number;
  atual: boolean;
}

/**
 * Gasto variável de cada semana contra o limite da semana atual (linha); a semana atual fica em
 * azul, ou vermelho acima do limite, e as anteriores em cinza. Só desenha: os valores
 * aparecem em texto ao lado, e o gráfico fica fora da leitura de tela.
 */
export function GraficoDasSemanas({
  semanas,
  limiteCentavos,
}: {
  semanas: BarraDaSemana[];
  limiteCentavos: number;
}) {
  return (
    <div className="h-40 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={semanas} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <XAxis
            dataKey="rotulo"
            tickLine={false}
            axisLine={false}
            interval={0}
            tick={{ fontSize: 11, fill: '#475569' }}
          />
          <Bar dataKey="gastoCentavos" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {semanas.map((semana) => (
              <Cell
                key={semana.rotulo}
                fill={
                  !semana.atual
                    ? '#94a3b8'
                    : semana.gastoCentavos > limiteCentavos
                      ? '#dc2626'
                      : '#1d5fd1'
                }
              />
            ))}
          </Bar>
          {limiteCentavos > 0 ? (
            <ReferenceLine y={limiteCentavos} stroke="#0f2a5c" strokeDasharray="4 4" />
          ) : null}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
