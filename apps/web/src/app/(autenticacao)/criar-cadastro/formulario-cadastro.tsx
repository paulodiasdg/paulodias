'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { criarCadastro, type EstadoFormulario } from '../acoes';
import { Aviso, BotaoEnviar, Campo } from '../campos';

export function FormularioCadastro() {
  const [estado, acao, pendente] = useActionState<EstadoFormulario, FormData>(criarCadastro, {});

  return (
    <form action={acao} className="space-y-4" noValidate>
      <h1 className="text-lg font-semibold">Criar cadastro</h1>
      <Aviso erro={estado.erro} mensagem={estado.mensagem} />
      <Campo
        rotulo="Como quer ser chamado"
        name="nome"
        autoComplete="given-name"
        required
        maxLength={120}
        defaultValue={estado.campos?.nome}
      />
      <Campo
        rotulo="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={estado.campos?.email}
      />
      <Campo
        rotulo="Senha (mínimo de 8 caracteres)"
        name="senha"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <BotaoEnviar pendente={pendente} texto="Criar cadastro" />
      <p className="text-center text-sm text-slate-600">
        Já tem cadastro?{' '}
        <Link href="/entrar" className="font-medium text-azul-700 underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
