import type { GastosDaSemana, SemanaDoPlano, SemanaPassada } from '@no-azul/motor';
import { Secao } from '@/components/formulario';
import { Valor } from '@/components/numeros';
import { formatarData } from '@/lib/formatacao';

function GastosContraOLimite({ gastos, prefixo }: { gastos: GastosDaSemana; prefixo: string }) {
  return (
    <Secao
      id="gastos"
      titulo="Gastos da semana"
      descricao="Contra o limite daquela semana, recalculado com os cadastros de hoje."
    >
      <p className="text-lg">
        <Valor
          chave={`${prefixo}.gastos.total`}
          centavos={gastos.totalCentavos}
          className="font-semibold"
        />{' '}
        <span className="text-slate-600">
          de <Valor chave={`${prefixo}.gastos.limite`} centavos={gastos.limiteSemanalCentavos} />
        </span>
      </p>
      {gastos.porCategoria.length === 0 ? (
        <p className="text-sm text-slate-600">Nenhum gasto variável nesta semana.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {gastos.porCategoria.map((item) => (
            <li key={item.categoriaId ?? 'sem'} className="flex justify-between gap-3 py-1.5">
              <span className="min-w-0 truncate">{item.nome ?? 'Sem categoria'}</span>
              <Valor
                chave={`${prefixo}.gastos.categoria.${item.categoriaId ?? 'sem'}`}
                centavos={item.valorCentavos}
              />
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}

/** Semana que já terminou: o que aconteceu (PLANO.md, seção 4c). */
export function SemanaQuePassou({ semana }: { semana: SemanaPassada }) {
  return (
    <>
      <Secao id="guardado" titulo="Guardado na semana">
        <p className="text-3xl font-semibold">
          <Valor chave="passada.guardado.total" centavos={semana.guardadoTotalCentavos} />
        </p>
        <dl className="grid gap-1 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-3">
            <dt>Reserva de contas</dt>
            <dd>
              <Valor chave="passada.guardado.contas" centavos={semana.guardadoContasCentavos} />
            </dd>
          </div>
          {semana.guardadoMetas.map((aporte) => (
            <div key={aporte.metaId} className="flex justify-between gap-3">
              <dt className="min-w-0 truncate">{aporte.nome}</dt>
              <dd>
                <Valor
                  chave={`passada.guardado.meta.${aporte.metaId}`}
                  centavos={aporte.valorCentavos}
                />
              </dd>
            </div>
          ))}
        </dl>
      </Secao>

      <Secao id="contas-pagas" titulo="Contas pagas na semana">
        {semana.contasPagas.length === 0 ? (
          <p className="text-sm text-slate-600">Nenhuma conta paga nesta semana.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {semana.contasPagas.map(({ conta, saiuDaReservaCentavos }) => (
              <li key={conta.chave} className="grid gap-0.5 py-2" data-conta={conta.nome}>
                <div className="flex justify-between gap-3">
                  <span className="font-medium">{conta.nome}</span>
                  <Valor chave={`passada.conta.${conta.chave}`} centavos={conta.valorCentavos} />
                </div>
                <p className="text-slate-600">
                  Paga em {formatarData(conta.pagoEm!)} ·{' '}
                  {conta.pagaNoCartao ? (
                    'pela fatura do cartão'
                  ) : (
                    <>
                      saiu da reserva{' '}
                      <Valor
                        chave={`passada.conta.${conta.chave}.reserva`}
                        centavos={saiuDaReservaCentavos}
                      />
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <GastosContraOLimite gastos={semana.gastos} prefixo="passada" />
    </>
  );
}

/** Semana futura: a semana da agenda (PLANO.md, seção 4c). */
export function SemanaFutura({ semana }: { semana: SemanaDoPlano }) {
  return (
    <>
      <section
        aria-labelledby="previsao-titulo"
        className="grid gap-3 rounded-2xl border border-azul-100 bg-azul-50 p-5"
      >
        <div>
          <h2 id="previsao-titulo" className="text-sm font-medium text-azul-900">
            Previsão para guardar nesta semana
          </h2>
          <p className="text-3xl font-semibold text-azul-900">
            <Valor chave="futura.total" centavos={semana.totalCentavos} />
          </p>
        </div>
        <dl className="grid gap-1 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-3">
            <dt>Reserva de contas</dt>
            <dd>
              <Valor chave="futura.contas" centavos={semana.paraContasCentavos} />
            </dd>
          </div>
          {semana.paraMetas.map((aporte) => (
            <div key={aporte.metaId} className="flex justify-between gap-3">
              <dt className="min-w-0 truncate">{aporte.nome}</dt>
              <dd>
                <Valor chave={`futura.meta.${aporte.metaId}`} centavos={aporte.valorCentavos} />
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-slate-700">
          Supõe que você guarda o valor pedido em cada semana até lá e paga as contas no vencimento.
          Saldo previsto da reserva de contas no domingo:{' '}
          <Valor chave="futura.saldo" centavos={semana.saldoDeContasNoFimCentavos} />.
        </p>
      </section>

      <Secao id="contas-da-semana" titulo="Contas que vencem na semana">
        {semana.contas.length === 0 ? (
          <p className="text-sm text-slate-600">Nenhuma conta vence nesta semana.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {semana.contas.map((conta) => (
              <li
                key={conta.chave}
                className="flex justify-between gap-3 py-2"
                data-conta={conta.nome}
              >
                <span>
                  <span className="font-medium">{conta.nome}</span>{' '}
                  <span className="text-slate-600">· {formatarData(conta.vencimento)}</span>
                </span>
                <Valor chave={`futura.conta.${conta.chave}`} centavos={conta.valorCentavos} />
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </>
  );
}
