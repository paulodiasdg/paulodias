import type { Metadata } from 'next';
import Link from 'next/link';
import {
  competenciaDe,
  listarContas,
  primeiroDiaDa,
  projetarOcorrencias,
  saldoEm,
  somarDias,
  ultimoDiaDa,
  type Conta,
} from '@no-azul/motor';
import { AcaoComConfirmacao, FormularioRapido } from '@/components/acoes-rapidas';
import { AvisoDaReserva } from '@/components/aviso-da-reserva';
import { ItemContaAPagar } from '@/components/conta-a-pagar';
import { classeBotaoLink, classeBotaoPrincipalLink, Secao } from '@/components/formulario';
import { carregarDadosFinanceiros } from '@/lib/financeiro/carregar';
import {
  centavosParaTexto,
  formatarCompetencia,
  formatarData,
  formatarReais,
  hojeNoBrasil,
} from '@/lib/formatacao';
import { criarClienteServidor } from '@/lib/supabase/servidor';
import {
  aporteNaReservaAcao,
  confirmarRecebimentoAcao,
  corrigirReservaAcao,
  desfazerPagamentoAcao,
  desfazerRecebimentoAcao,
} from './acoes';

export const metadata: Metadata = { title: 'Contas e fixas · No Azul' };

/** Quantos dias à frente a lista de contas a pagar mostra. */
const DIAS_A_FRENTE = 45;

export default async function PaginaContas() {
  const supabase = await criarClienteServidor();
  const hoje = hojeNoBrasil();
  const competencia = competenciaDe(hoje);
  const dados = await carregarDadosFinanceiros(supabase);

  const saldoDaReserva = saldoEm(dados.movimentos, { destino: 'contas' }, hoje);
  const abertas = listarContas(dados, null, somarDias(hoje, DIAS_A_FRENTE)).filter(
    (c) => c.pagoEm === null,
  );
  const pagas = listarContas(dados, somarDias(hoje, -DIAS_A_FRENTE), somarDias(hoje, DIAS_A_FRENTE))
    .filter((c) => c.pagoEm !== null)
    .sort((a, b) => b.pagoEm!.localeCompare(a.pagoEm!));
  const saquePorConta = (conta: Conta) =>
    dados.movimentos.find(
      (m) =>
        m.tipo === 'saque' &&
        ((conta.ocorrenciaId !== null && m.ocorrenciaId === conta.ocorrenciaId) ||
          (conta.contaAvulsaId !== null && m.contaAvulsaId === conta.contaAvulsaId)),
    )?.valorCentavos ?? 0;
  const rendasDoMes = projetarOcorrencias(
    dados,
    'renda',
    primeiroDiaDa(competencia),
    ultimoDiaDa(competencia),
  );
  const rendas = dados.recorrencias.filter((r) => r.tipo === 'renda');
  const fixas = dados.recorrencias.filter((r) => r.tipo === 'fixa');
  const avulsas = [...dados.contasAvulsas].sort((a, b) => b.vencimento.localeCompare(a.vencimento));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Contas e fixas</h1>
          <p className="text-slate-600">Hoje é {formatarData(hoje)}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/contas/recorrencias/nova?tipo=renda" className={classeBotaoLink}>
            Nova renda
          </Link>
          <Link href="/contas/recorrencias/nova?tipo=fixa" className={classeBotaoLink}>
            Nova despesa fixa
          </Link>
          <Link href="/contas/avulsas/nova" className={classeBotaoPrincipalLink}>
            Nova conta avulsa
          </Link>
        </div>
      </div>

      <AvisoDaReserva />

      <Secao
        id="reserva"
        titulo="Reserva de contas"
        descricao="Dinheiro guardado para pagar as contas. Ao pagar, sai daqui o menor valor entre a conta e o saldo."
      >
        <p className="text-3xl font-semibold" data-testid="saldo-reserva">
          {formatarReais(saldoDaReserva)}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormularioRapido
            acao={aporteNaReservaAcao}
            ocultos={{}}
            abrir="Registrar reserva"
            enviar="Guardar"
            sucesso="Reserva registrada."
            campos={[
              { nome: 'valor', rotulo: 'Valor guardado (R$)', tipo: 'valor', valorInicial: '' },
              { nome: 'data', rotulo: 'Data', tipo: 'data', valorInicial: hoje },
            ]}
          />
          <FormularioRapido
            acao={corrigirReservaAcao}
            ocultos={{}}
            abrir="Corrigir saldo"
            enviar="Corrigir"
            sucesso="Saldo corrigido."
            campos={[
              {
                nome: 'valor',
                rotulo: 'Saldo correto hoje (R$)',
                tipo: 'valor',
                valorInicial: centavosParaTexto(saldoDaReserva),
              },
            ]}
          />
        </div>
      </Secao>

      <Secao
        id="a-pagar"
        titulo="Contas a pagar"
        descricao={`Vencidas e com vencimento nos próximos ${DIAS_A_FRENTE} dias.`}
      >
        {abertas.length === 0 ? (
          <p className="text-sm text-slate-600">Nenhuma conta em aberto.</p>
        ) : (
          <ul className="grid gap-3">
            {abertas.map((conta) => (
              <ItemContaAPagar key={conta.chave} conta={conta} hoje={hoje} />
            ))}
          </ul>
        )}
      </Secao>

      <Secao
        id="pagas"
        titulo="Pagas recentemente"
        descricao={`Pagamentos dos últimos ${DIAS_A_FRENTE} dias.`}
      >
        {pagas.length === 0 ? (
          <p className="text-sm text-slate-600">Nenhum pagamento recente.</p>
        ) : (
          <ul className="grid gap-3">
            {pagas.map((conta) => (
              <li
                key={conta.chave}
                className="grid gap-2 rounded-xl border border-slate-200 p-3"
                data-conta={conta.nome}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{conta.nome}</p>
                    <p className="text-sm text-slate-600">
                      Paga em {formatarData(conta.pagoEm!)} · vencimento{' '}
                      {formatarData(conta.vencimento)}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums">{formatarReais(conta.valorCentavos)}</p>
                </div>
                <p className="text-sm text-slate-600">
                  {conta.pagaNoCartao
                    ? 'Paga pela fatura do cartão; não saiu da reserva.'
                    : `Saiu da reserva: ${formatarReais(saquePorConta(conta))}`}
                </p>
                <AcaoComConfirmacao
                  acao={desfazerPagamentoAcao}
                  ocultos={{ chave: conta.chave }}
                  texto="Desfazer pagamento"
                  textoConfirmar="Desfazer"
                  pergunta="O lançamento é apagado e o valor volta para a reserva."
                />
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao id="rendas-do-mes" titulo={`Rendas de ${formatarCompetencia(competencia)}`}>
        {rendasDoMes.length === 0 ? (
          <p className="text-sm text-slate-600">Nenhuma renda prevista neste mês.</p>
        ) : (
          <ul className="grid gap-3">
            {rendasDoMes.map((renda) => (
              <li
                key={renda.chave}
                className="grid gap-2 rounded-xl border border-slate-200 p-3"
                data-renda={renda.recorrencia.nome}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{renda.recorrencia.nome}</p>
                    <p className="text-sm text-slate-600">
                      {renda.status === 'recebida'
                        ? `Recebida em ${formatarData(renda.pagoEm!)}`
                        : `Prevista para ${formatarData(renda.vencimento)}`}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums">{formatarReais(renda.valorCentavos)}</p>
                </div>
                {renda.status === 'recebida' ? (
                  <AcaoComConfirmacao
                    acao={desfazerRecebimentoAcao}
                    ocultos={{ ocorrenciaId: renda.ocorrenciaId! }}
                    texto="Desfazer recebimento"
                    textoConfirmar="Desfazer"
                    pergunta="O lançamento da receita é apagado e a renda volta ao valor previsto."
                  />
                ) : (
                  <FormularioRapido
                    acao={confirmarRecebimentoAcao}
                    ocultos={{
                      recorrenciaId: renda.recorrencia.id,
                      competencia: renda.competencia,
                    }}
                    abrir="Confirmar recebimento"
                    enviar="Confirmar"
                    campos={[
                      {
                        nome: 'valor',
                        rotulo: 'Valor recebido (R$)',
                        tipo: 'valor',
                        valorInicial: centavosParaTexto(renda.valorCentavos),
                      },
                      { nome: 'recebidoEm', rotulo: 'Data', tipo: 'data', valorInicial: hoje },
                    ]}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao id="cadastros" titulo="Cadastros">
        <div className="grid gap-5 lg:grid-cols-3">
          {[
            { titulo: 'Rendas recorrentes', itens: rendas, vazio: 'Nenhuma renda cadastrada.' },
            { titulo: 'Despesas fixas', itens: fixas, vazio: 'Nenhuma despesa fixa cadastrada.' },
          ].map((grupo) => (
            <div key={grupo.titulo} className="grid content-start gap-2">
              <h3 className="text-sm font-semibold text-slate-700">{grupo.titulo}</h3>
              {grupo.itens.length === 0 ? (
                <p className="text-sm text-slate-600">{grupo.vazio}</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {grupo.itens.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/contas/recorrencias/${r.id}`}
                        className="flex items-baseline justify-between gap-2 px-3 py-2 hover:bg-slate-50"
                      >
                        <span className="min-w-0">
                          <span className="block font-medium">{r.nome}</span>
                          <span className="text-xs text-slate-600">
                            Dia {r.dia}
                            {r.ativa ? '' : ' · encerrada'}
                            {r.pagaNoCartao ? ' · no cartão' : ''}
                            {r.rendaVariavel ? ' · variável' : ''}
                          </span>
                        </span>
                        <span className="tabular-nums">{formatarReais(r.valorCentavos)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <div className="grid content-start gap-2">
            <h3 className="text-sm font-semibold text-slate-700">Contas avulsas</h3>
            {avulsas.length === 0 ? (
              <p className="text-sm text-slate-600">Nenhuma conta avulsa cadastrada.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {avulsas.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/contas/avulsas/${c.id}`}
                      className="flex items-baseline justify-between gap-2 px-3 py-2 hover:bg-slate-50"
                    >
                      <span className="min-w-0">
                        <span className="block font-medium">{c.nome}</span>
                        <span className="text-xs text-slate-600">
                          {formatarData(c.vencimento)}
                          {c.pagoEm ? ' · paga' : ''}
                        </span>
                      </span>
                      <span className="tabular-nums">{formatarReais(c.valorCentavos)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Secao>
    </>
  );
}
