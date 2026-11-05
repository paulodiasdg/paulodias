import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

const classeDoCampo =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-azul-600 focus:ring-2 focus:ring-azul-100';

interface CampoProps extends InputHTMLAttributes<HTMLInputElement> {
  rotulo: string;
  name: string;
  ajuda?: string;
}

export function Campo({ rotulo, name, ajuda, ...props }: CampoProps) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-sm font-medium text-slate-700">{rotulo}</span>
      <input name={name} className={classeDoCampo} {...props} />
      {ajuda ? <span className="mt-1 block text-xs text-slate-500">{ajuda}</span> : null}
    </label>
  );
}

/** Valor em reais, digitado como 1.234,56. */
export function CampoValor(props: Omit<CampoProps, 'type' | 'inputMode'>) {
  return <Campo inputMode="decimal" autoComplete="off" placeholder="0,00" {...props} />;
}

export interface Opcao {
  valor: string;
  rotulo: string;
}

interface SelecaoProps extends SelectHTMLAttributes<HTMLSelectElement> {
  rotulo: string;
  name: string;
  opcoes?: Opcao[];
  grupos?: { rotulo: string; opcoes: Opcao[] }[];
  vazio?: string;
}

export function Selecao({ rotulo, name, opcoes, grupos, vazio, ...props }: SelecaoProps) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-sm font-medium text-slate-700">{rotulo}</span>
      <select name={name} className={classeDoCampo} {...props}>
        {vazio !== undefined ? <option value="">{vazio}</option> : null}
        {opcoes?.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
        {grupos?.map((grupo) =>
          grupo.opcoes.length ? (
            <optgroup key={grupo.rotulo} label={grupo.rotulo}>
              {grupo.opcoes.map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>
                  {opcao.rotulo}
                </option>
              ))}
            </optgroup>
          ) : null,
        )}
      </select>
    </label>
  );
}

export function Marcar({
  rotulo,
  name,
  ajuda,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { rotulo: string; name: string; ajuda?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm text-slate-700">
      <input type="checkbox" name={name} className="mt-0.5 size-4 accent-azul-600" {...props} />
      <span>
        {rotulo}
        {ajuda ? <span className="block text-xs text-slate-500">{ajuda}</span> : null}
      </span>
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

export function BotaoEnviar({
  pendente,
  texto,
  largura = 'total',
  variante = 'principal',
}: {
  pendente: boolean;
  texto: string;
  largura?: 'total' | 'auto';
  variante?: 'principal' | 'perigo' | 'secundario';
}) {
  const cores = {
    principal: 'bg-azul-600 text-white hover:bg-azul-700',
    perigo: 'bg-red-700 text-white hover:bg-red-800',
    secundario: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
  }[variante];
  return (
    <button
      type="submit"
      disabled={pendente}
      className={`${largura === 'total' ? 'w-full' : ''} rounded-lg px-4 py-2.5 font-medium transition disabled:opacity-60 ${cores}`}
    >
      {pendente ? 'Aguarde…' : texto}
    </button>
  );
}

/** Caixa branca de uma seção da tela. */
export function Secao({
  titulo,
  descricao,
  acoes,
  children,
  id,
}: {
  titulo: string;
  descricao?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-titulo` : undefined}
      className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id={id ? `${id}-titulo` : undefined} className="text-base font-semibold">
            {titulo}
          </h2>
          {descricao ? <p className="mt-0.5 text-sm text-slate-600">{descricao}</p> : null}
        </div>
        {acoes ? <div className="flex flex-wrap gap-2">{acoes}</div> : null}
      </header>
      {children}
    </section>
  );
}

export const classeBotaoLink =
  'inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50';

export const classeBotaoPrincipalLink =
  'inline-flex items-center rounded-lg bg-azul-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-azul-700';
