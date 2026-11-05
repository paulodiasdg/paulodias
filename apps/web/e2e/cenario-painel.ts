import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { competenciaDe, primeiroDiaDa, somarDias, somarMeses } from '@no-azul/motor';
import type { Database } from '../src/lib/supabase/tipos-banco';

export type ClienteDoTeste = ReturnType<typeof createClient<Database>>;

function lerEnvLocal(): { url: string; chave: string } {
  const texto = readFileSync(fileURLToPath(new URL('../.env.local', import.meta.url)), 'utf8');
  const valor = (nome: string) => texto.match(new RegExp(`^${nome}=(.*)$`, 'm'))?.[1]?.trim();
  const url = valor('NEXT_PUBLIC_SUPABASE_URL');
  const chave = valor('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  if (!url || !chave) throw new Error('Rode `pnpm env:local` antes dos testes ponta a ponta.');
  return { url, chave };
}

/** Cliente do Supabase com a sessão da pessoa do teste (o RLS limita tudo às linhas dela). */
export async function clienteDaPessoa(email: string, senha: string): Promise<ClienteDoTeste> {
  const { url, chave } = lerEnvLocal();
  const cliente = createClient<Database>(url, chave, { auth: { persistSession: false } });
  const { error } = await cliente.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`Falha ao entrar como a pessoa do teste: ${error.code}`);
  return cliente;
}

/** Em inserções de várias linhas, colunas ausentes usam o padrão do banco, não nulo. */
const SEM_NULOS = { defaultToNull: false } as const;

function exigir<T>(resposta: { data: T | null; error: { code?: string } | null }, o: string): T {
  if (resposta.error || resposta.data === null) {
    throw new Error(`Falha ao gravar ${o}: ${resposta.error?.code ?? 'sem dados'}`);
  }
  return resposta.data;
}

/**
 * Cadastro com tudo o que o painel mostra, com datas relativas a hoje: rendas, fixas (uma paga no
 * cartão), contas avulsas (uma vencida), três metas, saldos, aportes e gastos em várias semanas e
 * meses com e sem categoria. A pessoa usa o sistema há 70 dias, para haver meses completos.
 */
export async function montarCenarioDoPainel(cliente: ClienteDoTeste, hoje: string): Promise<void> {
  const inicioDoUso = somarDias(hoje, -70);
  const { data: sessao } = await cliente.auth.getClaims();
  const usuarioId = String(sessao?.claims?.sub);
  exigir(
    await cliente
      .from('perfis')
      .update({ criado_em: `${inicioDoUso}T12:00:00-03:00` })
      .eq('usuario_id', usuarioId)
      .select(),
    'o perfil',
  );

  const categorias = exigir(await cliente.from('categorias').select('id, slug'), 'as categorias');
  const categoria = (slug: string) => categorias.find((c) => c.slug === slug)!.id;
  const inicio = primeiroDiaDa(competenciaDe(hoje));

  exigir(
    await cliente
      .from('recorrencias')
      .insert(
        [
          // A renda vem desde o início do uso, para a comparação 50/30/20 do mês passado.
          { tipo: 'renda', nome: 'Salário', valor_centavos: 750_000, dia: 5, inicio: inicioDoUso },
          {
            tipo: 'fixa',
            nome: 'Aluguel',
            valor_centavos: 210_000,
            dia: 10,
            inicio,
            categoria_id: categoria('moradia'),
          },
          {
            tipo: 'fixa',
            nome: 'Plano de saúde',
            valor_centavos: 52_000,
            dia: 7,
            inicio,
            categoria_id: categoria('saude'),
          },
          {
            tipo: 'fixa',
            nome: 'Luz',
            valor_centavos: 18_990,
            dia: 15,
            inicio,
            categoria_id: categoria('contas_da_casa'),
          },
          {
            tipo: 'fixa',
            nome: 'Streaming',
            valor_centavos: 5_590,
            dia: 12,
            inicio,
            paga_no_cartao: true,
            categoria_id: categoria('assinaturas'),
          },
        ],
        SEM_NULOS,
      )
      .select(),
    'as recorrências',
  );

  exigir(
    await cliente
      .from('contas_avulsas')
      .insert(
        [
          {
            nome: 'IPVA',
            valor_centavos: 98_000,
            vencimento: somarDias(hoje, 9),
            categoria_id: categoria('impostos_taxas'),
          },
          { nome: 'Multa de trânsito', valor_centavos: 19_523, vencimento: somarDias(hoje, -3) },
        ],
        SEM_NULOS,
      )
      .select(),
    'as contas avulsas',
  );

  const metas = exigir(
    await cliente
      .from('metas')
      .insert(
        [
          {
            nome: 'Reserva de emergência',
            alvo_centavos: 3_000_000,
            prazo: somarMeses(hoje, 18),
            prioridade: 1,
            tipo: 'emergencia',
          },
          { nome: 'Viagem', alvo_centavos: 600_000, prazo: somarMeses(hoje, 8), prioridade: 2 },
          // Alvo alto para a verba do mês não cobrir tudo: liga o alerta de meta sem verba.
          {
            nome: 'Notebook',
            alvo_centavos: 2_000_000,
            prazo: somarMeses(hoje, 10),
            prioridade: 3,
          },
        ],
        SEM_NULOS,
      )
      .select('id, nome'),
    'as metas',
  );
  const meta = (nome: string) => metas.find((m) => m.nome === nome)!.id;

  exigir(
    await cliente
      .from('movimentos_reserva')
      .insert(
        [
          { data: inicioDoUso, tipo: 'ajuste', destino: 'contas', valor_centavos: 80_000 },
          {
            data: inicioDoUso,
            tipo: 'ajuste',
            destino: 'meta',
            meta_id: meta('Reserva de emergência'),
            valor_centavos: 780_000,
          },
          { data: hoje, tipo: 'aporte', destino: 'contas', valor_centavos: 30_000 },
          {
            data: somarDias(hoje, -7),
            tipo: 'aporte',
            destino: 'meta',
            meta_id: meta('Viagem'),
            valor_centavos: 13_000,
          },
        ],
        SEM_NULOS,
      )
      .select(),
    'os movimentos',
  );

  const gasto = (descricao: string, valor: number, dias: number, slug: string | null) => ({
    descricao,
    valor_centavos: valor,
    data: somarDias(hoje, dias),
    tipo: 'despesa',
    categoria_id: slug ? categoria(slug) : null,
  });
  exigir(
    await cliente
      .from('lancamentos')
      .insert(
        [
          gasto('Mercado', 18_240, 0, 'alimentacao'),
          gasto('Restaurante', 6_490, 0, 'restaurantes'),
          gasto('Farmácia', 4_500, -7, 'saude'),
          gasto('Cinema', 8_000, -14, 'lazer'),
          gasto('Mercado', 35_000, -21, 'alimentacao'),
          gasto('Roupas', 22_000, -35, 'compras'),
          gasto('Mercado', 40_000, -50, 'alimentacao'),
          gasto('Presente', 15_000, -60, null),
          { ...gasto('Bônus', 50_000, -40, 'salario'), tipo: 'receita' },
        ],
        SEM_NULOS,
      )
      .select(),
    'os lançamentos',
  );
}
