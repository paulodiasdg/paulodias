'use client';

import { Bar, BarChart, ResponsiveContainer, XAxis } from 'recharts';

export interface MesDoGrafico {
  rotulo: string;
  fixas: number;
  contasAvulsas: number;
  metas: number;
  variaveis: number;
  folga: number;
}

const SERIES: { chave: keyof Omit<MesDoGrafico, 'rotulo'>; nome: string; cor: string }[] = [
  { chave: 'fixas', nome: 'Fixas', cor: '#475569' },
  { chave: 'contasAvulsas', nome: 'Contas avulsas', cor: '#d97706' },
  { chave: 'metas', nome: 'Metas', cor: '#1d5fd1' },
  { chave: 'variaveis', nome: 'Gastos variáveis', cor: '#0d9488' },
  { chave: 'folga', nome: 'Folga', cor: '#cbd5e1' },
];

/** Divisão de cada mês da projeção em barras empilhadas; os valores estão na tabela ao lado. */
export function GraficoDaProjecao({ meses }: { meses: MesDoGrafico[] }) {
  return (
    <div className="grid gap-2" aria-hidden="true">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700">
        {SERIES.map((serie) => (
          <li key={serie.chave} className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm" style={{ backgroundColor: serie.cor }} />
            {serie.nome}
          </li>
        ))}
      </ul>
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={meses} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
            <XAxis
              dataKey="rotulo"
              tickLine={false}
              axisLine={false}
              interval={0}
              tick={{ fontSize: 11, fill: '#475569' }}
            />
            {SERIES.map((serie) => (
              <Bar
                key={serie.chave}
                dataKey={serie.chave}
                name={serie.nome}
                stackId="mes"
                fill={serie.cor}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
