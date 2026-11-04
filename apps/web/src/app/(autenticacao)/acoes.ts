'use server';

import { redirect } from 'next/navigation';
import { destinoSeguro } from '@/lib/rotas';
import { criarClienteServidor } from '@/lib/supabase/servidor';

export interface EstadoFormulario {
  erro?: string;
  mensagem?: string;
  campos?: Record<string, string>;
}

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SENHA_MINIMA = 8;

function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === 'string' ? valor.trim() : '';
}

/** Traduz os erros do Supabase Auth para mensagens em português. */
function mensagemDeErro(codigo: string | undefined): string {
  switch (codigo) {
    case 'invalid_credentials':
      return 'E-mail ou senha incorretos.';
    case 'email_not_confirmed':
      return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
    case 'user_already_exists':
    case 'email_exists':
      return 'Já existe um cadastro com este e-mail.';
    case 'weak_password':
      return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
    default:
      return 'Não foi possível concluir agora. Tente de novo em instantes.';
  }
}

export async function entrar(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const email = texto(formData, 'email').toLowerCase();
  const senha = formData.get('senha');
  const campos = { email };

  if (!EMAIL_VALIDO.test(email) || typeof senha !== 'string' || senha.length === 0) {
    return { erro: 'Informe seu e-mail e sua senha.', campos };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) return { erro: mensagemDeErro(error.code), campos };

  redirect(destinoSeguro(formData.get('proximo')));
}

export async function criarCadastro(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const nome = texto(formData, 'nome');
  const email = texto(formData, 'email').toLowerCase();
  const senha = formData.get('senha');
  const campos = { nome, email };

  if (nome.length === 0 || nome.length > 120) {
    return { erro: 'Informe como quer ser chamado.', campos };
  }
  if (!EMAIL_VALIDO.test(email)) {
    return { erro: 'Informe um e-mail válido.', campos };
  }
  if (typeof senha !== 'string' || senha.length < SENHA_MINIMA) {
    return { erro: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`, campos };
  }

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: { data: { nome } },
  });
  if (error) return { erro: mensagemDeErro(error.code), campos };

  if (!data.session) {
    return { mensagem: 'Cadastro criado. Enviamos um link de confirmação para o seu e-mail.' };
  }
  redirect('/painel');
}

export async function sair(): Promise<void> {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect('/entrar');
}
