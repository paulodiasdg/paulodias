import { randomUUID, createHash } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AmbienteSupabase } from './ambiente.js';
import type { Tabela } from './tabelas.js';

const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };

export function clienteAdmin(ambiente: AmbienteSupabase): SupabaseClient {
  return createClient(ambiente.url, ambiente.chaveSecreta, opcoes);
}

export function clienteVisitante(ambiente: AmbienteSupabase): SupabaseClient {
  return createClient(ambiente.url, ambiente.chavePublica, opcoes);
}

export interface UsuarioDeTeste {
  id: string;
  email: string;
  cliente: SupabaseClient;
}

/** Cria um usuário confirmado e devolve um cliente já autenticado como ele. */
export async function criarUsuario(
  ambiente: AmbienteSupabase,
  nome: string,
): Promise<UsuarioDeTeste> {
  const admin = clienteAdmin(ambiente);
  const email = `${nome.toLowerCase()}-${randomUUID()}@teste.noazul.dev`;
  const senha = `senha-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (error || !data.user) throw error ?? new Error('Usuário não criado');

  const cliente = createClient(ambiente.url, ambiente.chavePublica, opcoes);
  const login = await cliente.auth.signInWithPassword({ email, password: senha });
  if (login.error) throw login.error;
  return { id: data.user.id, email, cliente };
}

export async function excluirUsuario(ambiente: AmbienteSupabase, id: string): Promise<void> {
  const { error } = await clienteAdmin(ambiente).auth.admin.deleteUser(id);
  if (error) throw error;
}

async function inserir(
  cliente: SupabaseClient,
  tabela: Tabela,
  linha: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await cliente.from(tabela).insert(linha).select('id').single();
  if (error) throw new Error(`Falha ao inserir em ${tabela}: ${error.message}`);
  return (data as { id: string }).id;
}

export type IdsDasLinhas = Record<Tabela, string>;

/**
 * Cria, como o próprio usuário, uma linha em cada tabela, com todas as referências preenchidas.
 * O perfil já existe: o gatilho de cadastro o cria.
 */
export async function criarUmaLinhaPorTabela(usuario: UsuarioDeTeste): Promise<IdsDasLinhas> {
  const c = usuario.cliente;
  const sufixo = randomUUID().slice(0, 8);

  const categorias = await inserir(c, 'categorias', {
    slug: `propria_${sufixo}`,
    nome: 'Categoria própria',
    grupo: 'livre',
  });
  const documentos = await inserir(c, 'documentos', {
    nome: 'fatura-novembro.pdf',
    hash: createHash('sha256').update(sufixo).digest('hex'),
    tipo: 'fatura_cartao',
    status: 'em_revisao',
    extracao_json: { tipo: 'fatura_cartao', lancamentos: [] },
  });
  const recorrencias = await inserir(c, 'recorrencias', {
    tipo: 'fixa',
    nome: 'Aluguel',
    valor_centavos: 213000,
    dia: 15,
    inicio: '2026-11-01',
    categoria_id: categorias,
  });
  const lancamentos = await inserir(c, 'lancamentos', {
    data: '2026-11-04',
    descricao: 'Mercado',
    valor_centavos: 28790,
    tipo: 'despesa',
    categoria_id: categorias,
    documento_id: documentos,
    origem: 'documento',
  });
  const ocorrencias = await inserir(c, 'ocorrencias', {
    recorrencia_id: recorrencias,
    competencia: '2026-11',
    valor_centavos: 213000,
    status: 'paga',
    pago_em: '2026-11-15',
    lancamento_id: lancamentos,
  });
  const contas_avulsas = await inserir(c, 'contas_avulsas', {
    nome: 'Fatura do cartão',
    valor_centavos: 184250,
    vencimento: '2026-11-20',
    quita_itens: true,
    documento_id: documentos,
  });
  const metas = await inserir(c, 'metas', {
    nome: 'Viagem',
    alvo_centavos: 450000,
    prazo: '2027-07-04',
    prioridade: 2,
  });
  const movimentos_reserva = await inserir(c, 'movimentos_reserva', {
    data: '2026-11-04',
    tipo: 'aporte',
    destino: 'meta',
    meta_id: metas,
    valor_centavos: 13000,
  });

  return {
    perfis: usuario.id,
    categorias,
    documentos,
    recorrencias,
    lancamentos,
    ocorrencias,
    contas_avulsas,
    metas,
    movimentos_reserva,
  };
}
