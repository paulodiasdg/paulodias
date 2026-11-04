'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { entrar, type EstadoFormulario } from '../acoes';
import { Aviso, BotaoEnviar, Campo } from '../campos';

export function FormularioEntrar({ proximo }: { proximo: string | undefined }) {
  const [estado, acao, pendente] = useActionState<EstadoFormulario, FormData>(entrar, {});

  return (
    <form action={acao} className="space-y-4" noValidate>
      <h1 className="text-lg font-semibold">Entrar</h1>
      <Aviso erro={estado.erro} mensagem={estado.mensagem} />
      {proximo ? <input type="hidden" name="proximo" value={proximo} /> : null}
      <Campo
        rotulo="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={estado.campos?.email}
      />
      <Campo rotulo="Senha" name="senha" type="password" autoComplete="current-password" required />
      <BotaoEnviar pendente={pendente} texto="Entrar" />
      <p className="text-center text-sm text-slate-600">
        Ainda não tem cadastro?{' '}
        <Link href="/criar-cadastro" className="font-medium text-azul-700 underline">
          Criar cadastro
        </Link>
      </p>
    </form>
  );
}
