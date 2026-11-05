import Link from 'next/link';
import type {
  Alerta,
  ChaveDaParte,
  ChaveDoComponente,
  ComponenteDaSaude,
  DivisaoDoMes,
  MedidaParaExibir,
  PlanoDaMeta,
  ResumoDaSemana,
} from '@no-azul/motor';
import { FormularioRapido } from '@/components/acoes-rapidas';
import { Chip, ItemContaAPagar } from '@/components/conta-a-pagar';
import { Secao } from '@/components/formulario';
import { GraficoDasSemanas } from '@/components/grafico-semanas';
import { Numero, Valor } from '@/components/numeros';
import {
  centavosParaTexto,
  formatarCompetencia,
  formatarData,
  formatarDecimos,
  formatarDiaEMes,
  formatarMesesDecimos,
  formatarPercentualDecimos,
  formatarSemana,
} from '@/lib/formatacao';
import { registrarReservaAcao } from './acoes';

// ---------------------------------------------------------------------------------------------
// 1. Valor a reservar na semana
// ---------------------------------------------------------------------------------------------

function ReservaDaSemana({ resumo }: { resumo: ResumoDaSemana }) {
  const { reservaDeContas: contas, metas } = resumo;
  const comAporte = metas.metas.filter((plano) => plano.aporteSemanalCentavos > 0);
  const abertas = metas.metas.filter((plano) => plano.situacao !== 'concluida');
  const critica = contas.semanaCritica === null ? null : contas.semanas[contas.semanaCritica - 1]!;

  return (
    <section
      aria-labelledby="reserva-titulo"
      className="grid gap-4 rounded-2xl bg-azul-700 p-5 text-white"
      data-bloco="reserva"
    >
      <div>
        <h2 id="reserva-titulo" className="text-sm font-medium text-azul-100">
          Guardar nesta semana
        </h2>
        <p className="text-4xl font-semibold">
          <Valor chave="reserva.total" centavos={resumo.totalAReservarCentavos} />
        </p>
      </div>

      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-3 border-b border-white/15 pb-1">
          <dt>Reserva de contas</dt>
          <dd className="font-semibold">
            <Valor chave="reserva.contas" centavos={contas.valorSemanalCentavos} />
          </dd>
        </div>
        {comAporte.map((plano) => (
          <div
            key={plano.meta.id}
            className="flex justify-between gap-3 border-b border-white/15 pb-1"
          >
            <dt className="min-w-0 truncate">{plano.meta.nome}</dt>
            <dd className="font-semibold">
              <Valor
                chave={`reserva.meta.${plano.meta.id}`}
                centavos={plano.aporteSemanalCentavos}
              />
            </dd>
          </div>
        ))}
      </dl>

      <p className="text-sm text-azul-50">
        Já guardado na semana:{' '}
        <Valor chave="reserva.guardado" centavos={resumo.guardadoNaSemanaCentavos} />
        {' · '}
        {resumo.faltaGuardarNaSemanaCentavos > 0 ? (
          <>
            falta <Valor chave="reserva.falta" centavos={resumo.faltaGuardarNaSemanaCentavos} />
          </>
        ) : (
          'reserva da semana completa'
        )}
      </p>

      <div className="grid gap-1 text-sm text-azul-50">
        {contas.dataLimite ? (
          <p>
            Com <Valor chave="reserva.contas" centavos={contas.valorSemanalCentavos} /> por semana
            para contas, nada vence descoberto até{' '}
            <Numero chave="reserva.data-limite">{formatarData(contas.dataLimite)}</Numero>.
          </p>
        ) : (
          <p>O saldo da reserva de contas já cobre as contas das próximas 8 semanas.</p>
        )}
        {critica && critica.numero > 1 ? (
          <p>
            A semana mais apertada é a de {formatarSemana(critica.inicio, critica.fim)}: até lá
            vencem <Valor chave="reserva.critica.acumulado" centavos={critica.acumuladoCentavos} />{' '}
            em contas, e a reserva começou a semana com{' '}
            <Valor chave="reserva.saldo-inicio" centavos={contas.saldoInicioSemanaCentavos} />.
          </p>
        ) : null}
      </div>

      <div>
        <FormularioRapido
          acao={registrarReservaAcao}
          ocultos={{}}
          abrir="Registrar reserva"
          enviar="Guardar"
          sucesso="Reserva registrada."
          sobreFundoEscuro
          campos={[
            {
              nome: 'contas',
              rotulo: 'Reserva de contas (R$)',
              tipo: 'valor',
              valorInicial: centavosParaTexto(contas.faltaGuardarNaSemanaCentavos),
            },
            ...abertas.map((plano) => ({
              nome: `meta:${plano.meta.id}`,
              rotulo: `${plano.meta.nome} (R$)`,
              tipo: 'valor' as const,
              valorInicial: centavosParaTexto(plano.faltaGuardarNaSemanaCentavos),
            })),
            { nome: 'data', rotulo: 'Data', tipo: 'data', valorInicial: resumo.hoje },
          ]}
        />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// 2. Alertas
// ---------------------------------------------------------------------------------------------

function TextoDoAlerta({ alerta }: { alerta: Alerta }) {
  switch (alerta.tipo) {
    case 'conta_vencida':
      return alerta.contas.length === 1 ? (
        <>
          <strong>Conta vencida:</strong> {alerta.contas[0]!.nome},{' '}
          <Valor chave="alerta.vencidas.total" centavos={alerta.totalCentavos} />, venceu em{' '}
          {formatarData(alerta.contas[0]!.vencimento)}.{' '}
          <Link href="/contas#a-pagar" className="underline">
            Pagar
          </Link>
        </>
      ) : (
        <>
          <strong>{alerta.contas.length} contas vencidas,</strong> somando{' '}
          <Valor chave="alerta.vencidas.total" centavos={alerta.totalCentavos} />:{' '}
          {alerta.contas.map((conta) => conta.nome).join(', ')}.{' '}
          <Link href="/contas#a-pagar" className="underline">
            Ver contas
          </Link>
        </>
      );
    case 'meta_prazo_vencido':
      return (
        <>
          <strong>Prazo vencido:</strong>{' '}
          {alerta.metas
            .map((plano) => `${plano.meta.nome} (${formatarData(plano.meta.prazo)})`)
            .join(', ')}
          . Mude o prazo ou conclua a meta.{' '}
          <Link href="/metas" className="underline">
            Ver metas
          </Link>
        </>
      );
    case 'meta_sem_verba':
      return (
        <>
          <strong>Meta sem verba completa:</strong>{' '}
          {alerta.metas.map((plano, indice) => (
            <span key={plano.meta.id}>
              {indice > 0 ? '; ' : ''}
              {plano.meta.nome} recebe{' '}
              <Valor
                chave={`alerta.meta.${plano.meta.id}.alocado`}
                centavos={plano.alocadoMensalCentavos}
              />{' '}
              dos{' '}
              <Valor
                chave={`alerta.meta.${plano.meta.id}.necessario`}
                centavos={plano.necessarioMensalCentavos}
              />{' '}
              por mês necessários
              {plano.previsaoTermino ? ` e termina em ${formatarData(plano.previsaoTermino)}` : ''}
            </span>
          ))}
          .{' '}
          <Link href="/metas" className="underline">
            Ver metas
          </Link>
        </>
      );
    case 'gasto_acima_do_ritmo':
      return (
        <>
          <strong>Gasto acima do ritmo:</strong>{' '}
          <Valor chave="alerta.ritmo.gasto" centavos={alerta.ritmo.gastoNoMesCentavos} /> no mês,
          quando o limite permitia{' '}
          <Valor chave="alerta.ritmo.esperado" centavos={alerta.ritmo.esperadoAteHojeCentavos} />{' '}
          até hoje.{' '}
          <Link href="/lancamentos" className="underline">
            Ver lançamentos
          </Link>
        </>
      );
  }
}

function Alertas({ alertas }: { alertas: Alerta[] }) {
  if (alertas.length === 0) {
    return (
      <p
        className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        data-bloco="alertas"
      >
        Nenhum alerta nesta semana.
      </p>
    );
  }
  return (
    <ul className="grid gap-2" aria-label="Alertas" data-bloco="alertas">
      {alertas.map((alerta) => (
        <li
          key={alerta.tipo}
          data-alerta={alerta.tipo}
          className={`rounded-xl px-4 py-3 text-sm ${alerta.tipo === 'conta_vencida' || alerta.tipo === 'meta_prazo_vencido' ? 'bg-red-50 text-red-900' : 'bg-amber-50 text-amber-950'}`}
        >
          <TextoDoAlerta alerta={alerta} />
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------------------------
// 3. Gastos da semana
// ---------------------------------------------------------------------------------------------

function GastosDaSemana({ resumo }: { resumo: ResumoDaSemana }) {
  const { gastos, limite } = resumo;
  const uso = gastos.usoDoLimitePercentual;
  return (
    <Secao
      id="gastos"
      titulo="Gastos da semana"
      descricao="Gastos variáveis, sem as contas, contra o limite da semana."
    >
      <div className="grid gap-2">
        <p className="text-lg">
          <Valor chave="gastos.total" centavos={gastos.totalCentavos} className="font-semibold" />{' '}
          <span className="text-slate-600">
            de <Valor chave="gastos.limite" centavos={gastos.limiteSemanalCentavos} />
          </span>
        </p>
        <div
          className="h-2.5 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-label="Gasto da semana contra o limite"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={uso === null ? 100 : Math.min(100, uso)}
        >
          <div
            className={`h-full rounded-full ${gastos.acimaDoLimiteCentavos > 0 ? 'bg-red-600' : 'bg-azul-600'}`}
            style={{
              width: `${uso === null ? (gastos.totalCentavos > 0 ? 100 : 0) : Math.min(100, uso)}%`,
            }}
          />
        </div>
        <p className="text-sm text-slate-700">
          {gastos.acimaDoLimiteCentavos > 0 ? (
            <>
              Passou <Valor chave="gastos.acima" centavos={gastos.acimaDoLimiteCentavos} /> do
              limite da semana.
            </>
          ) : (
            <>
              Ainda cabem{' '}
              <Valor chave="gastos.disponivel" centavos={gastos.disponivelNaSemanaCentavos} /> nesta
              semana.
            </>
          )}{' '}
          No mês: <Valor chave="limite.gasto-mes" centavos={limite.gastoNoMesCentavos} /> de{' '}
          <Valor chave="limite.mensal" centavos={limite.limiteMensalCentavos} />; até o fim do mês,
          dá para gastar <Valor chave="limite.por-dia" centavos={limite.disponivelPorDiaCentavos} />{' '}
          por dia.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="grid content-start gap-2">
          <h3 className="text-sm font-semibold text-slate-700">Por categoria</h3>
          {gastos.porCategoria.length === 0 ? (
            <p className="text-sm text-slate-600">Nenhum gasto variável nesta semana.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {gastos.porCategoria.map((item) => (
                <li key={item.categoriaId ?? 'sem'} className="flex justify-between gap-3 py-1.5">
                  <span className="min-w-0 truncate">{item.nome ?? 'Sem categoria'}</span>
                  <Valor
                    chave={`gastos.categoria.${item.categoriaId ?? 'sem'}`}
                    centavos={item.valorCentavos}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="grid content-start gap-2">
          <h3 className="text-sm font-semibold text-slate-700">Últimas semanas</h3>
          {gastos.semanasAnteriores.length === 0 ? (
            <p className="text-sm text-slate-600">
              A comparação aparece depois da primeira semana de uso.
            </p>
          ) : (
            <>
              <p className="text-xs text-slate-600">A linha tracejada é o limite desta semana.</p>
              <GraficoDasSemanas
                limiteCentavos={gastos.limiteSemanalCentavos}
                semanas={[
                  ...gastos.semanasAnteriores.map((semana) => ({
                    rotulo: formatarDiaEMes(semana.inicio),
                    gastoCentavos: semana.gastoCentavos,
                    atual: false,
                  })),
                  {
                    rotulo: formatarDiaEMes(gastos.semana.inicio),
                    gastoCentavos: gastos.totalCentavos,
                    atual: true,
                  },
                ]}
              />
              <ul className="grid gap-1 text-sm">
                {gastos.semanasAnteriores.map((semana) => (
                  <li key={semana.inicio} className="flex justify-between gap-3">
                    <span className="text-slate-600">
                      {formatarSemana(semana.inicio, semana.fim)}
                    </span>
                    <Valor
                      chave={`gastos.semana.${semana.inicio}`}
                      centavos={semana.gastoCentavos}
                    />
                  </li>
                ))}
              </ul>
              {gastos.mediaDasAnterioresCentavos !== null ? (
                <p className="text-sm text-slate-700">
                  Média das semanas anteriores:{' '}
                  <Valor chave="gastos.media" centavos={gastos.mediaDasAnterioresCentavos} />
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </Secao>
  );
}

// ---------------------------------------------------------------------------------------------
// 4. Contas dos próximos 14 dias e 5. Progresso das metas
// ---------------------------------------------------------------------------------------------

function ProximasContas({ resumo }: { resumo: ResumoDaSemana }) {
  return (
    <Secao
      id="proximas-contas"
      titulo="Contas dos próximos 14 dias"
      descricao="Em aberto, com as vencidas primeiro."
      acoes={
        <Link href="/contas" className="text-sm text-azul-700 underline">
          Todas as contas
        </Link>
      }
    >
      {resumo.proximasContas.length === 0 ? (
        <p className="text-sm text-slate-600">Nenhuma conta em aberto nos próximos 14 dias.</p>
      ) : (
        <ul className="grid gap-3">
          {resumo.proximasContas.map((conta) => (
            <ItemContaAPagar key={conta.chave} conta={conta} hoje={resumo.hoje} />
          ))}
        </ul>
      )}
    </Secao>
  );
}

const SITUACOES: Record<PlanoDaMeta['situacao'], { texto: string; classe: string }> = {
  completa: { texto: 'No ritmo do prazo', classe: 'bg-emerald-50 text-emerald-800' },
  parcial: { texto: 'Verba parcial', classe: 'bg-amber-50 text-amber-900' },
  sem_verba: { texto: 'Sem verba neste mês', classe: 'bg-red-50 text-red-800' },
  concluida: { texto: 'Concluída', classe: 'bg-emerald-50 text-emerald-800' },
};

function ProgressoDasMetas({ resumo }: { resumo: ResumoDaSemana }) {
  return (
    <Secao
      id="metas"
      titulo="Metas"
      acoes={
        <Link href="/metas" className="text-sm text-azul-700 underline">
          Ver metas
        </Link>
      }
    >
      {resumo.metas.metas.length === 0 ? (
        <p className="text-sm text-slate-600">
          Nenhuma meta ainda.{' '}
          <Link href="/metas/nova" className="underline">
            Criar meta
          </Link>
        </p>
      ) : (
        <ul className="grid gap-4">
          {resumo.metas.metas.map((plano) => {
            const situacao = SITUACOES[plano.situacao];
            return (
              <li key={plano.meta.id} className="grid gap-1.5" data-meta={plano.meta.nome}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{plano.meta.nome}</span>
                  <Chip classe={situacao.classe}>{situacao.texto}</Chip>
                </div>
                <div
                  className="h-2.5 overflow-hidden rounded-full bg-slate-100"
                  role="progressbar"
                  aria-label={`Guardado na meta ${plano.meta.nome}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={plano.progressoPercentual}
                >
                  <div
                    className="h-full rounded-full bg-azul-600"
                    style={{ width: `${plano.progressoPercentual}%` }}
                  />
                </div>
                <p className="text-sm text-slate-700">
                  <Valor
                    chave={`meta.${plano.meta.id}.guardado`}
                    centavos={plano.guardadoAtualCentavos}
                  />{' '}
                  de{' '}
                  <Valor chave={`meta.${plano.meta.id}.alvo`} centavos={plano.meta.alvoCentavos} />{' '}
                  (
                  <Numero chave={`meta.${plano.meta.id}.progresso`}>
                    {plano.progressoPercentual}%
                  </Numero>
                  ){' · '}prazo {formatarData(plano.meta.prazo)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Secao>
  );
}

// ---------------------------------------------------------------------------------------------
// 6. Saúde financeira
// ---------------------------------------------------------------------------------------------

function medida(m: MedidaParaExibir): string {
  return m.unidade === 'meses'
    ? formatarMesesDecimos(m.decimos)
    : formatarPercentualDecimos(m.decimos);
}

const EXPLICACOES: Record<
  ChaveDoComponente,
  { medida: string; regra: (maxima: string, zero: string) => string }
> = {
  compromissoDaRenda: {
    medida: 'da renda vai para fixas e contas avulsas',
    regra: (maxima, zero) => `Nota máxima até ${maxima}; zero com ${zero} ou mais.`,
  },
  capacidadeDePoupar: {
    medida: 'da renda sobra depois de fixas, contas e gastos estimados',
    regra: (maxima, zero) => `Nota máxima com ${maxima} ou mais; zero com ${zero} ou menos.`,
  },
  reservaDeEmergencia: {
    medida: 'de fixas e gastos guardados na reserva de emergência',
    regra: (maxima) => `Nota máxima com ${maxima}.`,
  },
  contasEmDia: {
    medida: 'dos compromissos do mês está vencido',
    regra: () => 'Nota máxima sem nada vencido.',
  },
  ritmoDeGastos: {
    medida: 'do ritmo do limite foi gasto no mês',
    regra: (maxima, zero) => `Nota máxima até ${maxima}; zero com ${zero} ou mais.`,
  },
};

function Componente({ componente }: { componente: ComponenteDaSaude }) {
  const explicacao = EXPLICACOES[componente.chave];
  const chave = `saude.${componente.chave}`;
  return (
    <li className="grid gap-0.5 py-2" data-componente={componente.chave}>
      <div className="flex justify-between gap-3">
        <span className="font-medium">{componente.nome}</span>
        <span>
          <Numero chave={`${chave}.pontos`} className="font-semibold">
            {formatarDecimos(componente.pontosEmDecimos)}
          </Numero>{' '}
          <span className="text-slate-600">
            de <Numero chave={`${chave}.maximo`}>{componente.pontosMaximos}</Numero>
          </span>
        </span>
      </div>
      <p className="text-sm text-slate-600">
        {componente.exibicao ? (
          <>
            <Numero chave={`${chave}.medida`}>{medida(componente.exibicao)}</Numero>{' '}
            {explicacao.medida}.{' '}
          </>
        ) : (
          'Sem medida neste mês. '
        )}
        {explicacao.regra(
          medida(componente.limites.notaMaxima),
          medida(componente.limites.notaZero),
        )}
      </p>
    </li>
  );
}

function SaudeFinanceira({ resumo }: { resumo: ResumoDaSemana }) {
  const saude = resumo.saude;
  return (
    <Secao
      id="saude"
      titulo="Saúde financeira"
      descricao="Índice de 0 a 100, com os pontos de cada parte."
    >
      {saude === null ? (
        <p className="text-sm text-slate-600">
          Cadastre sua renda em{' '}
          <Link href="/contas" className="underline">
            Contas e fixas
          </Link>{' '}
          para ver o índice.
        </p>
      ) : (
        <>
          <p className="flex items-baseline gap-2">
            <Numero chave="saude.total" className="text-4xl font-semibold">
              {saude.total}
            </Numero>
            <span className="text-slate-600">de 100 ·</span>
            <span className="font-medium" data-faixa={saude.faixa}>
              {saude.nomeDaFaixa}
            </span>
          </p>
          <ul className="divide-y divide-slate-100">
            {saude.componentes.map((componente) => (
              <Componente key={componente.chave} componente={componente} />
            ))}
          </ul>
        </>
      )}
    </Secao>
  );
}

// ---------------------------------------------------------------------------------------------
// 7. Divisão do mês
// ---------------------------------------------------------------------------------------------

const PARTES: Record<ChaveDaParte, { nome: string; cor: string }> = {
  fixas: { nome: 'Fixas', cor: 'bg-slate-600' },
  contasAvulsas: { nome: 'Contas avulsas', cor: 'bg-amber-600' },
  metas: { nome: 'Metas', cor: 'bg-azul-600' },
  variaveis: { nome: 'Gastos variáveis', cor: 'bg-teal-600' },
  folga: { nome: 'Folga', cor: 'bg-slate-300' },
};

const FONTES: Record<DivisaoDoMes['fonteDosVariaveis'], string> = {
  teto: 'pelo teto que você definiu',
  media: 'pela média dos últimos meses',
  percentual_renda: 'como 30% da renda, até haver histórico',
};

function DivisaoDoMesBloco({ divisao }: { divisao: DivisaoDoMes }) {
  return (
    <Secao
      id="divisao"
      titulo={`Divisão de ${formatarCompetencia(divisao.competencia)}`}
      descricao={
        <>
          Renda do mês: <Valor chave="divisao.renda" centavos={divisao.rendaCentavos} />. Gastos
          variáveis estimados {FONTES[divisao.fonteDosVariaveis]}.
        </>
      }
    >
      <div className="flex h-4 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        {divisao.partes.map((parte) => (
          <div
            key={parte.chave}
            className={PARTES[parte.chave].cor}
            style={{ width: `${parte.percentual}%` }}
          />
        ))}
      </div>
      <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
        {divisao.partes.map((parte) => (
          <li key={parte.chave} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span className={`size-3 rounded-sm ${PARTES[parte.chave].cor}`} aria-hidden="true" />
              {PARTES[parte.chave].nome}
            </span>
            <span>
              <Valor chave={`divisao.${parte.chave}`} centavos={parte.valorCentavos} />{' '}
              <Numero chave={`divisao.${parte.chave}.percentual`} className="text-slate-600">
                {parte.percentual}%
              </Numero>
            </span>
          </li>
        ))}
      </ul>
      {divisao.folgaCentavos < 0 ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">
          Os compromissos e os gastos estimados passam da renda: faltam{' '}
          <Valor chave="divisao.falta" centavos={-divisao.folgaCentavos} /> neste mês.
        </p>
      ) : null}
    </Secao>
  );
}

/** O painel da semana atual, na ordem da seção 2 da spec. */
export function SemanaAtual({ resumo }: { resumo: ResumoDaSemana }) {
  return (
    <>
      <ReservaDaSemana resumo={resumo} />
      <Alertas alertas={resumo.alertas} />
      <GastosDaSemana resumo={resumo} />
      <div className="grid gap-5 lg:grid-cols-2">
        <ProximasContas resumo={resumo} />
        <ProgressoDasMetas resumo={resumo} />
      </div>
      <SaudeFinanceira resumo={resumo} />
      <DivisaoDoMesBloco divisao={resumo.divisaoDoMes} />
    </>
  );
}
