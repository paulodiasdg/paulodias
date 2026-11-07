'use client';

import { useActionState, useState } from 'react';
import {
  CONFIANCA_MINIMA,
  type AcaoDaConta,
  type AcaoDaLinha,
  type Cruzamento,
  type Extracao,
} from '@no-azul/documentos';
import { Aviso, type Opcao } from '@/components/formulario';
import type { EstadoFormulario } from '@/lib/estado-formulario';
import { centavosParaTexto, formatarData, formatarDiaEMes } from '@/lib/formatacao';
import { aprovarAcao } from '../acoes';

export interface CategoriaDaRevisao {
  id: string;
  nome: string;
  slug: string;
  grupo: string;
}

const NOMES_DOS_GRUPOS: Record<string, string> = {
  essencial: 'Essenciais',
  livre: 'Livres',
  receita: 'Receitas',
  transferencia: 'Transferências',
};

const TIPOS: Opcao[] = [
  { valor: 'despesa', rotulo: 'Gasto' },
  { valor: 'receita', rotulo: 'Receita' },
  { valor: 'transferencia', rotulo: 'Transferência' },
];

const classeDoCampo =
  'block w-full min-w-0 rounded-lg border bg-white px-2.5 py-1.5 text-sm outline-none focus:border-azul-600 focus:ring-2 focus:ring-azul-100';

function classeComConfianca(confianca: number): string {
  return `${classeDoCampo} ${confianca < CONFIANCA_MINIMA ? 'border-amber-400 bg-amber-50' : 'border-slate-300'}`;
}

function nomeDaAcaoDaLinha(acao: AcaoDaLinha, tipo: string): string {
  switch (acao.tipo) {
    case 'lancar':
      return tipo === 'receita'
        ? 'Lançar como receita'
        : tipo === 'transferencia'
          ? 'Lançar como transferência'
          : 'Lançar como gasto';
    case 'ignorar':
      return 'Não gravar';
    case 'quitar':
      return `Quitar ${acao.conta.nome} (vence ${formatarDiaEMes(acao.conta.vencimento)})`;
    case 'receber':
      return `Confirmar ${acao.renda.nome} (${formatarDiaEMes(acao.renda.dataPrevista)})`;
    case 'vincular_fixa':
      return `Marcar ${acao.conta.nome} como paga no cartão`;
  }
}

function nomeDaAcaoDaConta(acao: AcaoDaConta): string {
  switch (acao.tipo) {
    case 'criar':
      return 'Criar conta a pagar';
    case 'prever_fixa':
      return `Usar como valor de ${acao.conta.nome} deste mês`;
    case 'atualizar_avulsa':
      return `Atualizar a conta "${acao.conta.nome}"`;
    case 'nao_gravar':
      return 'Não gravar a conta';
  }
}

interface EstadoDaLinha {
  /** Índice da ação escolhida entre as alternativas do cruzamento. */
  acao: number;
  data: string;
  descricao: string;
  valor: string;
  tipo: 'despesa' | 'receita' | 'transferencia';
  categoriaId: string;
}

function Confira({ confianca }: { confianca: number }) {
  return confianca < CONFIANCA_MINIMA ? (
    <span className="text-xs font-medium text-amber-800">Confira</span>
  ) : null;
}

export function Revisao({
  documentoId,
  extracao,
  cruzamento,
  categorias,
}: {
  documentoId: string;
  extracao: Extracao;
  cruzamento: Cruzamento;
  categorias: CategoriaDaRevisao[];
}) {
  const [estado, executar, pendente] = useActionState<EstadoFormulario, FormData>(aprovarAcao, {});
  const idDoSlug = (slug: string | null) => categorias.find((c) => c.slug === slug)?.id ?? '';
  const gruposDeCategorias = ['essencial', 'livre', 'receita', 'transferencia'].map((grupo) => ({
    grupo,
    opcoes: categorias.filter((c) => c.grupo === grupo),
  }));

  const [linhas, setLinhas] = useState<EstadoDaLinha[]>(() =>
    extracao.lancamentos.map((l) => ({
      acao: 0,
      data: l.data ?? '',
      descricao: l.descricao,
      valor: l.valorCentavos !== null ? centavosParaTexto(l.valorCentavos) : '',
      tipo: l.tipo,
      categoriaId: idDoSlug(l.categoria),
    })),
  );
  const conta = extracao.conta;
  const [estadoDaConta, setEstadoDaConta] = useState(() => ({
    acao: 0,
    nome: conta?.nome ?? '',
    valor: conta?.valorCentavos != null ? centavosParaTexto(conta.valorCentavos) : '',
    vencimento: conta?.vencimento ?? '',
    categoriaId: idDoSlug(conta?.categoria ?? null),
  }));

  const mudarLinha = (indice: number, mudanca: Partial<EstadoDaLinha>) =>
    setLinhas((atuais) => atuais.map((l, i) => (i === indice ? { ...l, ...mudanca } : l)));

  const alternativasDa = (indice: number) =>
    cruzamento.linhas[indice]?.alternativas ?? [{ tipo: 'lancar' as const }];
  const acaoDa = (indice: number): AcaoDaLinha =>
    alternativasDa(indice)[linhas[indice]?.acao ?? 0] ?? { tipo: 'lancar' };
  const marcadas = linhas.filter((_, i) => acaoDa(i).tipo !== 'ignorar').length;

  function marcar(indice: number, marcado: boolean) {
    const alternativas = alternativasDa(indice);
    const alvo = marcado
      ? Math.max(
          0,
          alternativas.findIndex((a) => a.tipo !== 'ignorar'),
        )
      : alternativas.findIndex((a) => a.tipo === 'ignorar');
    mudarLinha(indice, { acao: Math.max(0, alvo) });
  }

  function revisaoEmJson(): string {
    const alternativasDaConta = cruzamento.conta?.alternativas ?? [{ tipo: 'criar' as const }];
    return JSON.stringify({
      conta: conta
        ? {
            acao: alternativasDaConta[estadoDaConta.acao] ?? { tipo: 'criar' },
            nome: estadoDaConta.nome,
            valor: estadoDaConta.valor,
            vencimento: estadoDaConta.vencimento,
            categoriaId: estadoDaConta.categoriaId || null,
          }
        : null,
      linhas: linhas.map((l, i) => ({
        acao: acaoDa(i),
        data: l.data,
        descricao: l.descricao,
        valor: l.valor,
        tipo: l.tipo,
        categoriaId: l.categoriaId || null,
      })),
    });
  }

  const selecaoDeCategoria = (valor: string, aoMudar: (id: string) => void, rotulo: string) => (
    <select
      aria-label={rotulo}
      value={valor}
      onChange={(e) => aoMudar(e.target.value)}
      className={`${classeDoCampo} border-slate-300`}
    >
      <option value="">Sem categoria</option>
      {gruposDeCategorias.map(({ grupo, opcoes }) =>
        opcoes.length ? (
          <optgroup key={grupo} label={NOMES_DOS_GRUPOS[grupo] ?? grupo}>
            {opcoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </optgroup>
        ) : null,
      )}
    </select>
  );

  const avisosGerais = [
    ...extracao.avisos,
    ...(cruzamento.conta?.aviso ? [cruzamento.conta.aviso] : []),
  ];

  return (
    <form
      action={(formulario) => {
        formulario.set('revisao', revisaoEmJson());
        executar(formulario);
      }}
      className="grid gap-4"
    >
      <input type="hidden" name="documentoId" value={documentoId} />

      {avisosGerais.length ? (
        <ul className="grid gap-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {avisosGerais.map((aviso) => (
            <li key={aviso}>{aviso}</li>
          ))}
        </ul>
      ) : null}

      {conta ? (
        <fieldset
          className="grid gap-3 rounded-xl border border-slate-200 p-3"
          data-revisao="conta"
        >
          <legend className="px-1 text-sm font-semibold">Conta a pagar</legend>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">O que fazer</span>
            <select
              value={estadoDaConta.acao}
              onChange={(e) => setEstadoDaConta({ ...estadoDaConta, acao: Number(e.target.value) })}
              className={`${classeDoCampo} border-slate-300`}
              name="acaoDaConta"
            >
              {(cruzamento.conta?.alternativas ?? [{ tipo: 'criar' as const }]).map((acao, i) => (
                <option key={i} value={i}>
                  {nomeDaAcaoDaConta(acao)}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Nome</span>
              <input
                value={estadoDaConta.nome}
                onChange={(e) => setEstadoDaConta({ ...estadoDaConta, nome: e.target.value })}
                className={`${classeDoCampo} border-slate-300`}
                name="nomeDaConta"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="flex justify-between font-medium text-slate-700">
                Valor (R$) <Confira confianca={conta.confianca.valor} />
              </span>
              <input
                inputMode="decimal"
                value={estadoDaConta.valor}
                onChange={(e) => setEstadoDaConta({ ...estadoDaConta, valor: e.target.value })}
                className={classeComConfianca(conta.confianca.valor)}
                name="valorDaConta"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="flex justify-between font-medium text-slate-700">
                Vencimento <Confira confianca={conta.confianca.vencimento} />
              </span>
              <input
                type="date"
                value={estadoDaConta.vencimento}
                onChange={(e) => setEstadoDaConta({ ...estadoDaConta, vencimento: e.target.value })}
                className={classeComConfianca(conta.confianca.vencimento)}
                name="vencimentoDaConta"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Categoria</span>
              {selecaoDeCategoria(
                estadoDaConta.categoriaId,
                (id) => setEstadoDaConta({ ...estadoDaConta, categoriaId: id }),
                'Categoria da conta',
              )}
            </label>
          </div>
          {conta.fechamento ? (
            <p className="text-xs text-slate-500">
              Fechamento da fatura: {formatarData(conta.fechamento)}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {linhas.length ? (
        <fieldset className="grid gap-2" data-revisao="linhas">
          <legend className="mb-1 text-sm font-semibold">
            {extracao.tipo === 'fatura_cartao' ? 'Itens da fatura' : 'Lançamentos'} · {marcadas} de{' '}
            {linhas.length} marcados
          </legend>
          {linhas.map((linha, i) => {
            const lida = extracao.lancamentos[i];
            const sugestao = cruzamento.linhas[i];
            const acao = acaoDa(i);
            const marcada = acao.tipo !== 'ignorar';
            const avisos = [...(lida?.avisos ?? []), ...(sugestao?.aviso ? [sugestao.aviso] : [])];
            return (
              <div
                key={i}
                data-linha={i}
                className={`grid gap-2 rounded-xl border p-3 ${marcada ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-75'}`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    aria-label={`Gravar ${linha.descricao}`}
                    checked={marcada}
                    onChange={(e) => marcar(i, e.target.checked)}
                    className="mt-2 size-4 shrink-0 accent-azul-600"
                  />
                  <input
                    aria-label="Descrição"
                    value={linha.descricao}
                    onChange={(e) => mudarLinha(i, { descricao: e.target.value })}
                    className={`${classeDoCampo} border-slate-300`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="grid gap-0.5 text-xs text-slate-600">
                    <span className="flex justify-between">
                      Data <Confira confianca={lida?.confianca.data ?? 1} />
                    </span>
                    <input
                      type="date"
                      value={linha.data}
                      onChange={(e) => mudarLinha(i, { data: e.target.value })}
                      className={classeComConfianca(lida?.confianca.data ?? 1)}
                    />
                  </label>
                  <label className="grid gap-0.5 text-xs text-slate-600">
                    <span className="flex justify-between">
                      Valor (R$) <Confira confianca={lida?.confianca.valor ?? 1} />
                    </span>
                    <input
                      inputMode="decimal"
                      value={linha.valor}
                      onChange={(e) => mudarLinha(i, { valor: e.target.value })}
                      className={classeComConfianca(lida?.confianca.valor ?? 1)}
                    />
                  </label>
                  <label className="grid gap-0.5 text-xs text-slate-600">
                    Tipo
                    <select
                      value={linha.tipo}
                      onChange={(e) =>
                        mudarLinha(i, { tipo: e.target.value as EstadoDaLinha['tipo'] })
                      }
                      className={`${classeDoCampo} border-slate-300`}
                    >
                      {TIPOS.map((t) => (
                        <option key={t.valor} value={t.valor}>
                          {t.rotulo}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-0.5 text-xs text-slate-600">
                    Categoria
                    {selecaoDeCategoria(
                      linha.categoriaId,
                      (id) => mudarLinha(i, { categoriaId: id }),
                      `Categoria de ${linha.descricao}`,
                    )}
                  </label>
                </div>
                {marcada && alternativasDa(i).filter((a) => a.tipo !== 'ignorar').length > 1 ? (
                  <label className="grid gap-0.5 text-xs text-slate-600">
                    O que fazer
                    <select
                      value={linha.acao}
                      onChange={(e) => mudarLinha(i, { acao: Number(e.target.value) })}
                      className={`${classeDoCampo} border-slate-300`}
                    >
                      {alternativasDa(i).map((alternativa, indice) =>
                        alternativa.tipo === 'ignorar' ? null : (
                          <option key={indice} value={indice}>
                            {nomeDaAcaoDaLinha(alternativa, linha.tipo)}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                ) : null}
                {avisos.length ? (
                  <ul className="text-xs text-amber-800">
                    {avisos.map((aviso) => (
                      <li key={aviso}>{aviso}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </fieldset>
      ) : null}

      <Aviso erro={estado.erro} />
      <button
        type="submit"
        disabled={pendente}
        className="w-full rounded-lg bg-azul-600 px-4 py-2.5 font-medium text-white transition hover:bg-azul-700 disabled:opacity-60"
      >
        {pendente ? 'Gravando…' : 'Aprovar e gravar'}
      </button>
    </form>
  );
}
