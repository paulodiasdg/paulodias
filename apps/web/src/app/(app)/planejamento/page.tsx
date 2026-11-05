import type { Metadata } from 'next';
import {
  agendaDeReservas,
  comparacao503020,
  mesDaComparacao503020,
  orcamentoDoMes,
  projecaoDeMeses,
  competenciaDe,
  type ChaveDoGrupo,
  type Competencia,
  type Comparacao503020,
  type DivisaoDoMes,
  type SemanaDoPlano,
} from '@no-azul/motor';
import { AcaoComConfirmacao, FormularioRapido } from '@/components/acoes-rapidas';
import { Secao } from '@/components/formulario';
import { GraficoDaProjecao } from '@/components/grafico-projecao';
import { Numero, Valor } from '@/components/numeros';
import { carregarDadosFinanceiros } from '@/lib/financeiro/carregar';
import {
  centavosParaTexto,
  comMaiuscula,
  formatarCompetencia,
  formatarData,
  formatarMesCurto,
  formatarSemana,
  hojeNoBrasil,
} from '@/lib/formatacao';
import { criarClienteServidor } from '@/lib/supabase/servidor';
import { definirTetoAcao, removerTetoAcao } from './acoes';

export const metadata: Metadata = { title: 'Planejamento · No Azul' };

function Teto({ tetoCentavos, fonte }: { tetoCentavos: number | null; fonte: string }) {
  return (
    <Secao
      id="teto"
      titulo="Teto de gastos variáveis"
      descricao="Quanto você quer gastar por mês fora das contas. Ele limita os gastos e libera verba para as metas."
    >
      {tetoCentavos === null ? (
        <p className="text-sm text-slate-700">
          Sem teto definido: a estimativa de gastos variáveis usa {fonte}.
        </p>
      ) : (
        <p className="text-lg">
          <Valor chave="teto" centavos={tetoCentavos} className="font-semibold" /> por mês
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <FormularioRapido
          acao={definirTetoAcao}
          ocultos={{}}
          abrir={tetoCentavos === null ? 'Definir teto' : 'Alterar teto'}
          enviar="Salvar teto"
          sucesso="Teto salvo."
          campos={[
            {
              nome: 'valor',
              rotulo: 'Teto por mês (R$)',
              tipo: 'valor',
              valorInicial: tetoCentavos === null ? '' : centavosParaTexto(tetoCentavos),
            },
          ]}
        />
        {tetoCentavos !== null ? (
          <AcaoComConfirmacao
            acao={removerTetoAcao}
            ocultos={{}}
            texto="Remover teto"
            textoConfirmar="Remover"
            pergunta="A estimativa volta a usar a média dos últimos meses."
          />
        ) : null}
      </div>
    </Secao>
  );
}

function Agenda({ semanas }: { semanas: SemanaDoPlano[] }) {
  return (
    <Secao
      id="agenda"
      titulo="Agenda de reservas: 8 semanas"
      descricao="Quanto o sistema vai pedir em cada semana, supondo que você guarda o valor pedido e paga as contas no vencimento."
    >
      <ol className="grid gap-2">
        {semanas.map((semana) => {
          const chave = `agenda.${semana.inicio}`;
          return (
            <li
              key={semana.inicio}
              className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-slate-200 p-3 text-sm md:grid-cols-[1.3fr_repeat(5,1fr)] md:items-center"
              data-semana={semana.inicio}
            >
              <div className="col-span-2 md:col-span-1">
                <p className="font-semibold">{formatarSemana(semana.inicio, semana.fim)}</p>
                {semana.numero === 1 ? <p className="text-xs text-azul-700">Esta semana</p> : null}
              </div>
              <dl className="contents">
                {(
                  [
                    ['Contas que vencem', 'contas-que-vencem', semana.contasCentavos],
                    ['Para contas', 'contas', semana.paraContasCentavos],
                    ['Para metas', 'metas', semana.paraMetasCentavos],
                    ['Total', 'total', semana.totalCentavos],
                    ['Saldo no domingo', 'saldo', semana.saldoDeContasNoFimCentavos],
                  ] as const
                ).map(([rotulo, sufixo, centavos]) => (
                  <div key={sufixo}>
                    <dt className="text-xs text-slate-600">{rotulo}</dt>
                    <dd className={sufixo === 'total' ? 'font-semibold' : ''}>
                      <Valor chave={`${chave}.${sufixo}`} centavos={centavos} />
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ol>
    </Secao>
  );
}

const LINHAS_DA_PROJECAO: { rotulo: string; chave: string; valor: (m: DivisaoDoMes) => number }[] =
  [
    { rotulo: 'Renda', chave: 'renda', valor: (m) => m.rendaCentavos },
    { rotulo: 'Fixas', chave: 'fixas', valor: (m) => m.fixasCentavos },
    { rotulo: 'Contas avulsas', chave: 'contas-avulsas', valor: (m) => m.contasAvulsasCentavos },
    { rotulo: 'Metas', chave: 'metas', valor: (m) => m.metasCentavos },
    { rotulo: 'Gastos variáveis', chave: 'variaveis', valor: (m) => m.variaveisCentavos },
  ];

function Projecao({ meses }: { meses: DivisaoDoMes[] }) {
  return (
    <Secao
      id="projecao"
      titulo="Projeção de 6 meses"
      descricao="Divisão de cada mês, seguindo o plano das metas. Meta que termina libera verba para as próximas."
    >
      <GraficoDaProjecao
        meses={meses.map((mes) => ({
          rotulo: formatarMesCurto(mes.competencia),
          fixas: mes.fixasCentavos,
          contasAvulsas: mes.contasAvulsasCentavos,
          metas: mes.metasCentavos,
          variaveis: mes.variaveisCentavos,
          folga: Math.max(0, mes.folgaCentavos),
        }))}
      />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {meses.map((mes) => {
          const chave = `projecao.${mes.competencia}`;
          return (
            <li
              key={mes.competencia}
              className="grid gap-1 rounded-xl border border-slate-200 p-3 text-sm"
              data-mes={mes.competencia}
            >
              <p className="font-semibold">{comMaiuscula(formatarCompetencia(mes.competencia))}</p>
              <dl className="grid gap-1">
                {LINHAS_DA_PROJECAO.map((linha) => (
                  <div key={linha.chave} className="flex justify-between gap-2">
                    <dt className="text-slate-600">{linha.rotulo}</dt>
                    <dd>
                      <Valor chave={`${chave}.${linha.chave}`} centavos={linha.valor(mes)} />
                    </dd>
                  </div>
                ))}
                <div className="flex justify-between gap-2 border-t border-slate-100 pt-1">
                  <dt className="font-medium">{mes.folgaCentavos < 0 ? 'Falta' : 'Folga'}</dt>
                  <dd className={`font-semibold ${mes.folgaCentavos < 0 ? 'text-red-700' : ''}`}>
                    <Valor
                      chave={`${chave}.${mes.folgaCentavos < 0 ? 'falta' : 'folga'}`}
                      centavos={Math.abs(mes.folgaCentavos)}
                    />
                  </dd>
                </div>
              </dl>
              {mes.metas.some((m) => m.situacao === 'concluida') ? (
                <p className="text-xs text-slate-600">
                  Concluída:{' '}
                  {mes.metas
                    .filter((m) => m.situacao === 'concluida')
                    .map((m) => m.nome)
                    .join(', ')}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Secao>
  );
}

const GRUPOS: Record<ChaveDoGrupo, { nome: string; explicacao: string }> = {
  necessidades: { nome: 'Necessidades', explicacao: 'até 50% da renda' },
  desejos: { nome: 'Desejos', explicacao: 'até 30% da renda' },
  metas: { nome: 'Metas', explicacao: '20% da renda ou mais' },
};

function Regra503020({
  comparacao,
  mes,
}: {
  comparacao: Comparacao503020 | null;
  mes: Competencia;
}) {
  if (comparacao === null) {
    return (
      <Secao id="regra-50-30-20" titulo="Comparação 50/30/20">
        <p className="text-sm text-slate-600">
          Não há renda registrada em {formatarCompetencia(mes)}, o mês da comparação. Ela aparece
          quando houver renda no mês.
        </p>
      </Secao>
    );
  }
  return (
    <Secao
      id="regra-50-30-20"
      titulo="Comparação 50/30/20"
      descricao={
        comparacao.parcial ? (
          <>
            Ainda não há um mês completo: a comparação usa{' '}
            {formatarCompetencia(comparacao.competencia)} até {formatarData(comparacao.ate)}, com a
            renda e as contas do mês inteiro.
          </>
        ) : (
          <>
            O que aconteceu em {formatarCompetencia(comparacao.competencia)}, com renda de{' '}
            <Valor chave="regra.renda" centavos={comparacao.rendaCentavos} />.
          </>
        )
      }
    >
      {comparacao.parcial ? (
        <p className="text-sm text-slate-700">
          Renda do mês: <Valor chave="regra.renda" centavos={comparacao.rendaCentavos} />.
        </p>
      ) : null}
      <ul className="grid gap-4">
        {comparacao.grupos.map((grupo) => (
          <li key={grupo.chave} className="grid gap-1" data-grupo={grupo.chave}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span>
                <span className="font-medium">{GRUPOS[grupo.chave].nome}</span>{' '}
                <span className="text-slate-600">({GRUPOS[grupo.chave].explicacao})</span>
              </span>
              <span>
                <Valor chave={`regra.${grupo.chave}`} centavos={grupo.valorCentavos} />{' '}
                <Numero
                  chave={`regra.${grupo.chave}.percentual`}
                  className={`font-semibold ${grupo.dentroDaReferencia ? 'text-emerald-700' : 'text-red-700'}`}
                >
                  {grupo.percentual}%
                </Numero>
              </span>
            </div>
            <div className="relative h-2.5 rounded-full bg-slate-100" aria-hidden="true">
              <div
                className={`h-full rounded-full ${grupo.dentroDaReferencia ? 'bg-emerald-600' : 'bg-red-600'}`}
                style={{ width: `${Math.min(100, grupo.percentual)}%` }}
              />
              <div
                className="absolute top-[-3px] h-4 w-0.5 bg-slate-900"
                style={{ left: `${grupo.referenciaPercentual}%` }}
              />
            </div>
            <p className="text-xs text-slate-600">
              {grupo.dentroDaReferencia ? 'Dentro da referência' : 'Fora da referência'} de{' '}
              <Valor
                chave={`regra.${grupo.chave}.referencia`}
                centavos={grupo.referenciaCentavos}
              />
            </p>
          </li>
        ))}
      </ul>
      {comparacao.semCategoriaCentavos > 0 ? (
        <p className="text-sm text-slate-700">
          <Valor chave="regra.sem-categoria" centavos={comparacao.semCategoriaCentavos} /> (
          <Numero chave="regra.sem-categoria.percentual">
            {comparacao.semCategoriaPercentual}%
          </Numero>
          ) ficaram sem categoria. Classifique os lançamentos e as contas para a comparação ficar
          completa.
        </p>
      ) : null}
    </Secao>
  );
}

const FONTES = {
  media: 'a média dos últimos meses',
  percentual_renda: '30% da renda, até haver histórico',
  teto: 'o teto',
} as const;

export default async function PaginaPlanejamento() {
  const supabase = await criarClienteServidor();
  const hoje = hojeNoBrasil();
  const dados = await carregarDadosFinanceiros(supabase);
  const estimativa = orcamentoDoMes(dados, competenciaDe(hoje), hoje).estimativaVariaveis;

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Planejamento</h1>
        <p className="max-w-prose text-slate-600">
          O No Azul organiza e calcula, mas não substitui consultoria financeira.
        </p>
      </div>
      <Teto tetoCentavos={dados.perfil.tetoVariavelCentavos} fonte={FONTES[estimativa.fonte]} />
      <Agenda semanas={agendaDeReservas(dados, hoje)} />
      <Projecao meses={projecaoDeMeses(dados, hoje)} />
      <Regra503020
        comparacao={comparacao503020(dados, hoje)}
        mes={mesDaComparacao503020(dados, hoje).competencia}
      />
    </>
  );
}
