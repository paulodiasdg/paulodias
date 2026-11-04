import type { InputHTMLAttributes } from 'react';

interface CampoProps extends InputHTMLAttributes<HTMLInputElement> {
  rotulo: string;
  name: string;
}

export function Campo({ rotulo, name, ...props }: CampoProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{rotulo}</span>
      <input
        name={name}
        className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-azul-600 focus:ring-2 focus:ring-azul-100"
        {...props}
      />
    </label>
  );
}

export function Aviso({
  erro,
  mensagem,
}: {
  erro?: string | undefined;
  mensagem?: string | undefined;
}) {
  if (erro) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
        {erro}
      </p>
    );
  }
  if (mensagem) {
    return (
      <p role="status" className="rounded-lg bg-azul-50 px-3 py-2 text-sm text-azul-900">
        {mensagem}
      </p>
    );
  }
  return null;
}

export function BotaoEnviar({ pendente, texto }: { pendente: boolean; texto: string }) {
  return (
    <button
      type="submit"
      disabled={pendente}
      className="w-full rounded-lg bg-azul-600 px-4 py-2.5 font-medium text-white transition hover:bg-azul-700 disabled:opacity-60"
    >
      {pendente ? 'Aguarde…' : texto}
    </button>
  );
}
