import type { Metadata } from 'next';
import Link from 'next/link';
import {
  agendaDeReservas,
  inicioDaSemana,
  lerData,
  resumoDaSemana,
  semanaPassada,
  semanasNavegaveis,
  somarDias,
  type DataCivil,
} from '@no-azul/motor';
import { AvisoDaReserva } from '@/components/aviso-da-reserva';
import { carregarDadosFinanceiros } from '@/lib/financeiro/carregar';
import { formatarSemana, hojeNoBrasil } from '@/lib/formatacao';
import { criarClienteServidor } from '@/lib/supabase/servidor';
import { SemanaFutura, SemanaQuePassou } from './outras-semanas';
import { SemanaAtual } from './semana-atual';

export const metadata: Metadata = { title: 'Painel · No Azul' };

/** Segunda-feira da semana pedida em `?semana=AAAA-MM-DD`, ou null se a data for inválida. */
function semanaPedida(parametro: string | string[] | undefined): DataCivil | null {
  if (typeof parametro !== 'string') return null;
  try {
    lerData(parametro);
  } catch {
    return null;
  }
  return inicioDaSemana(parametro);
}

const classeDoLinkDeSemana =
  'inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50';

export default async function PaginaPainel({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string | string[] }>;
}) {
  const { semana: parametro } = await searchParams;
  const supabase = await criarClienteServidor();
  const hoje = hojeNoBrasil();
  const [dados, { data: perfil }] = await Promise.all([
    carregarDadosFinanceiros(supabase),
    supabase.from('perfis').select('nome').single(),
  ]);

  const limites = semanasNavegaveis(dados, hoje);
  const pedida = semanaPedida(parametro) ?? limites.atual;
  const semana =
    pedida < limites.primeira
      ? limites.primeira
      : pedida > limites.ultima
        ? limites.ultima
        : pedida;
  const fim = somarDias(semana, 6);
  const anterior = semana > limites.primeira ? somarDias(semana, -7) : null;
  const proxima = semana < limites.ultima ? somarDias(semana, 7) : null;
  const tipo = semana === limites.atual ? 'atual' : semana < limites.atual ? 'passada' : 'futura';

  return (
    <>
      <div className="grid gap-3">
        <h1 className="text-2xl font-semibold">Olá, {perfil?.nome ?? 'tudo certo'}</h1>
        <nav aria-label="Semanas" className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold" data-semana={semana}>
              Semana de {formatarSemana(semana, fim)}
            </p>
            <p className="text-sm text-slate-600">
              {tipo === 'atual'
                ? 'Esta semana'
                : tipo === 'passada'
                  ? 'Já passou: o que aconteceu'
                  : 'Previsão da agenda'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {anterior ? (
              <Link href={`/painel?semana=${anterior}`} className={classeDoLinkDeSemana}>
                ← Anterior
              </Link>
            ) : null}
            {tipo !== 'atual' ? (
              <Link href="/painel" className={classeDoLinkDeSemana}>
                Esta semana
              </Link>
            ) : null}
            {proxima ? (
              <Link href={`/painel?semana=${proxima}`} className={classeDoLinkDeSemana}>
                Próxima →
              </Link>
            ) : null}
          </div>
        </nav>
      </div>

      <AvisoDaReserva />

      {tipo === 'atual' ? (
        <SemanaAtual resumo={resumoDaSemana(dados, hoje)} />
      ) : tipo === 'passada' ? (
        <SemanaQuePassou semana={semanaPassada(dados, semana)} />
      ) : (
        <SemanaFutura
          semana={agendaDeReservas(dados, hoje).find((item) => item.inicio === semana)!}
        />
      )}
    </>
  );
}
