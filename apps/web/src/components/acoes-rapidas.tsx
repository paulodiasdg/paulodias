'use client';

import { useActionState, useState } from 'react';
import type { EstadoFormulario } from '@/lib/estado-formulario';
import { Aviso, BotaoEnviar, Campo, CampoValor } from './formulario';

type Acao = (estado: EstadoFormulario, formulario: FormData) => Promise<EstadoFormulario>;

/** Botão que pede confirmação antes de executar a ação (desfazer, excluir, encerrar). */
export function AcaoComConfirmacao({
  acao,
  ocultos,
  texto,
  textoConfirmar,
  pergunta,
  perigo = false,
}: {
  acao: Acao;
  ocultos: Record<string, string>;
  texto: string;
  textoConfirmar: string;
  pergunta: string;
  perigo?: boolean;
}) {
  const [estado, executar, pendente] = useActionState<EstadoFormulario, FormData>(acao, {});
  const [confirmando, setConfirmando] = useState(false);

  return (
    <form
      action={(formulario) => {
        setConfirmando(false);
        executar(formulario);
      }}
      className="grid gap-2"
    >
      {Object.entries(ocultos).map(([nome, valor]) => (
        <input key={nome} type="hidden" name={nome} value={valor} />
      ))}
      {confirmando ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-700">{pergunta}</span>
          <BotaoEnviar
            pendente={pendente}
            texto={textoConfirmar}
            largura="auto"
            variante={perigo ? 'perigo' : 'principal'}
          />
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            disabled={pendente}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${perigo ? 'border-red-200 text-red-700 hover:bg-red-50' : 'border-slate-300 text-slate-800 hover:bg-slate-50'}`}
          >
            {pendente ? 'Aguarde…' : texto}
          </button>
        </div>
      )}
      <Aviso erro={estado.erro} />
    </form>
  );
}

export interface CampoRapido {
  nome: string;
  rotulo: string;
  tipo: 'valor' | 'data';
  valorInicial: string;
}

/** Formulário curto que abre no próprio item da lista (pagar, receber, registrar aporte). */
export function FormularioRapido({
  acao,
  ocultos,
  campos,
  abrir,
  enviar,
  sucesso,
  sobreFundoEscuro = false,
}: {
  acao: Acao;
  ocultos: Record<string, string>;
  campos: CampoRapido[];
  abrir: string;
  enviar: string;
  sucesso?: string;
  /** Botão claro, para quando o formulário fica sobre um fundo azul. */
  sobreFundoEscuro?: boolean;
}) {
  const [estado, executar, pendente] = useActionState<EstadoFormulario, FormData>(acao, {});
  // Guarda o estado de quando o formulário abriu: um estado novo com ok fecha o formulário.
  const [abertoEm, setAbertoEm] = useState<EstadoFormulario | null>(null);
  const concluiu = abertoEm !== null && estado !== abertoEm && estado.ok === true;
  const aberto = abertoEm !== null && !concluiu;

  if (!aberto) {
    return (
      <div className="grid gap-2">
        <div>
          <button
            type="button"
            onClick={() => setAbertoEm(estado)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${sobreFundoEscuro ? 'bg-white text-azul-700 hover:bg-azul-50' : 'bg-azul-600 text-white hover:bg-azul-700'}`}
          >
            {abrir}
          </button>
        </div>
        {concluiu && sucesso ? <Aviso mensagem={sucesso} /> : null}
      </div>
    );
  }

  return (
    <form action={executar} className="grid gap-3 rounded-xl bg-slate-50 p-3 text-slate-900">
      {Object.entries(ocultos).map(([nome, valor]) => (
        <input key={nome} type="hidden" name={nome} value={valor} />
      ))}
      <div className="grid gap-3 sm:grid-cols-2">
        {campos.map((campo) =>
          campo.tipo === 'valor' ? (
            <CampoValor
              key={campo.nome}
              rotulo={campo.rotulo}
              name={campo.nome}
              defaultValue={estado.campos?.[campo.nome] ?? campo.valorInicial}
              required
            />
          ) : (
            <Campo
              key={campo.nome}
              rotulo={campo.rotulo}
              name={campo.nome}
              type="date"
              defaultValue={estado.campos?.[campo.nome] ?? campo.valorInicial}
              required
            />
          ),
        )}
      </div>
      <Aviso erro={estado.erro} />
      <div className="flex flex-wrap gap-2">
        <BotaoEnviar pendente={pendente} texto={enviar} largura="auto" />
        <button
          type="button"
          onClick={() => setAbertoEm(null)}
          className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
