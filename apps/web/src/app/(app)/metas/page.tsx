import type { Metadata } from 'next';
import Link from 'next/link';
import { competenciaDe, inicioDaSemana, planoDasMetas, type PlanoDaMeta } from '@no-azul/motor';
import { AcaoComConfirmacao, FormularioRapido } from '@/components/acoes-rapidas';
import { classeBotaoPrincipalLink, Secao } from '@/components/formulario';
import { carregarDadosFinanceiros } from '@/lib/financeiro/carregar';
import {
  centavosParaTexto,
  formatarCompetencia,
  formatarData,
  formatarReais,
  hojeNoBrasil,
} from '@/lib/formatacao';
import { criarClienteServidor } from '@/lib/supabase/servidor';
import { aporteNaMetaAcao, concluirMetaAcao, corrigirGuardadoAcao } from './acoes';

export const metadata: Metadata = { title: 'Metas · No Azul' };

const SITUACOES: Record<PlanoDaMeta['situacao'], { texto: string; classe: string }> = {
  completa: { texto: 'No ritmo do prazo', classe: 'bg-emerald-50 text-emerald-800' },
  parcial: { texto: 'Verba parcial', classe: 'bg-amber-50 text-amber-900' },
  sem_verba: { texto: 'Sem verba neste mês', classe: 'bg-red-50 text-red-800' },
  concluida: { texto: 'Concluída', classe: 'bg-emerald-50 text-emerald-800' },
};

function meses(m: PlanoDaMeta['mesesAtePrazo']): string {
  if (m.inteiros === 0 && m.diasRestantes === 0) return 'prazo vencido';
  const partes = [];
  if (m.inteiros > 0) partes.push(`${m.inteiros} ${m.inteiros === 1 ? 'mês' : 'meses'}`);
  if (m.diasRestantes > 0)
    partes.push(`${m.diasRestantes} ${m.diasRestantes === 1 ? 'dia' : 'dias'}`);
  return partes.join(' e ');
}

export default async function PaginaMetas() {
  const supabase = await criarClienteServidor();
  const hoje = hojeNoBrasil();
  const dados = await carregarDadosFinanceiros(supabase);
  const plano = planoDasMetas(dados, hoje);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Metas</h1>
          <p className="text-slate-600">
            Verba de {formatarCompetencia(competenciaDe(inicioDaSemana(hoje)))}:{' '}
            {formatarReais(plano.verbaCentavos)} · alocado{' '}
            {formatarReais(plano.alocadoMensalCentavos)} por mês · aporte da semana{' '}
            {formatarReais(plano.aporteSemanalCentavos)}
          </p>
        </div>
        <Link href="/metas/nova" className={classeBotaoPrincipalLink}>
          Nova meta
        </Link>
      </div>

      {plano.metas.length === 0 ? (
        <Secao titulo="Nenhuma meta ainda">
          <p className="text-sm text-slate-600">
            Crie uma meta para saber quanto guardar por semana, se cabe no orçamento e quando ela
            termina.
          </p>
        </Secao>
      ) : null}

      {plano.metas.map((p) => {
        const situacao = SITUACOES[p.situacao];
        return (
          <article
            key={p.meta.id}
            className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
            data-meta={p.meta.nome}
          >
            <header className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">{p.meta.nome}</h2>
                <div className="mt-1 flex flex-wrap gap-2 text-xs font-medium">
                  <span className={`rounded-full px-2 py-0.5 ${situacao.classe}`}>
                    {situacao.texto}
                  </span>
                  {p.prazoVencido && p.situacao !== 'concluida' ? (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-800">
                      Prazo vencido
                    </span>
                  ) : null}
                  {p.meta.tipo === 'emergencia' ? (
                    <span className="rounded-full bg-azul-50 px-2 py-0.5 text-azul-900">
                      Reserva de emergência
                    </span>
                  ) : null}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                    Prioridade {p.meta.prioridade}
                  </span>
                </div>
              </div>
              <Link href={`/metas/${p.meta.id}`} className="text-sm text-azul-700 underline">
                Editar
              </Link>
            </header>

            <div className="grid gap-1">
              <div
                className="h-2.5 overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={p.progressoPercentual}
                aria-label={`Guardado na meta ${p.meta.nome}`}
              >
                <div
                  className="h-full rounded-full bg-azul-600"
                  style={{ width: `${p.progressoPercentual}%` }}
                />
              </div>
              <p className="text-sm text-slate-700" data-testid="guardado">
                {formatarReais(p.guardadoAtualCentavos)} de {formatarReais(p.meta.alvoCentavos)}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-slate-600">Aporte da semana</dt>
                <dd className="font-semibold tabular-nums" data-testid="aporte-semanal">
                  {formatarReais(p.aporteSemanalCentavos)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600">Necessário por mês</dt>
                <dd className="font-semibold tabular-nums">
                  {formatarReais(p.necessarioMensalCentavos)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600">Prazo</dt>
                <dd className="font-semibold">
                  {formatarData(p.meta.prazo)}{' '}
                  <span className="font-normal text-slate-600">({meses(p.mesesAtePrazo)})</span>
                </dd>
              </div>
              <div>
                <dt className="text-slate-600">Previsão de término</dt>
                <dd className="font-semibold">
                  {p.previsaoTermino
                    ? formatarData(p.previsaoTermino)
                    : p.situacao === 'concluida'
                      ? '—'
                      : 'Sem previsão'}
                </dd>
              </div>
              {p.faltaPorMesCentavos > 0 ? (
                <div className="col-span-2">
                  <dt className="text-slate-600">Falta por mês para cumprir o prazo</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatarReais(p.faltaPorMesCentavos)}
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="grid gap-3 sm:grid-cols-3">
              {p.meta.concluidaEm === null ? (
                <FormularioRapido
                  acao={aporteNaMetaAcao}
                  ocultos={{ metaId: p.meta.id }}
                  abrir="Registrar aporte"
                  enviar="Guardar"
                  sucesso="Aporte registrado."
                  campos={[
                    {
                      nome: 'valor',
                      rotulo: 'Valor guardado (R$)',
                      tipo: 'valor',
                      valorInicial:
                        p.aporteSemanalCentavos > 0
                          ? centavosParaTexto(p.aporteSemanalCentavos)
                          : '',
                    },
                    { nome: 'data', rotulo: 'Data', tipo: 'data', valorInicial: hoje },
                  ]}
                />
              ) : null}
              <FormularioRapido
                acao={corrigirGuardadoAcao}
                ocultos={{ metaId: p.meta.id }}
                abrir="Corrigir guardado"
                enviar="Corrigir"
                sucesso="Valor corrigido."
                campos={[
                  {
                    nome: 'valor',
                    rotulo: 'Guardado hoje (R$)',
                    tipo: 'valor',
                    valorInicial: centavosParaTexto(p.guardadoAtualCentavos),
                  },
                ]}
              />
              <AcaoComConfirmacao
                acao={concluirMetaAcao}
                ocultos={{
                  metaId: p.meta.id,
                  concluir: p.meta.concluidaEm === null ? 'sim' : 'nao',
                }}
                texto={p.meta.concluidaEm === null ? 'Marcar como concluída' : 'Reabrir meta'}
                textoConfirmar={p.meta.concluidaEm === null ? 'Concluir' : 'Reabrir'}
                pergunta={
                  p.meta.concluidaEm === null
                    ? 'A meta deixa de pedir aportes.'
                    : 'A meta volta a pedir aportes.'
                }
              />
            </div>
          </article>
        );
      })}
    </>
  );
}
