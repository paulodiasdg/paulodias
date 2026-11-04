-- No Azul: estrutura inicial (Etapa 1)
--
-- Nove tabelas da seção 5 da spec, com os ajustes aprovados em docs/PLANO.md (C4 a C6):
-- * valores em centavos inteiros (bigint), sempre em colunas *_centavos;
-- * toda linha pertence a um usuário (usuario_id) e some com ele em cascata;
-- * referências entre tabelas usam chave estrangeira composta (usuario_id, id), para que um
--   usuário não consiga apontar para a linha de outro (RLS não impede isso sozinho);
-- * metas.guardado e valor_da_reserva não existem: saldos saem de movimentos_reserva;
-- * vínculos explícitos (ocorrencia_id, conta_avulsa_id) no lugar de origem_id e vinculo.

-- ---------------------------------------------------------------------------------------------
-- perfis: um por usuário
-- ---------------------------------------------------------------------------------------------
create table public.perfis (
  usuario_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 120),
  teto_variavel_centavos bigint check (teto_variavel_centavos >= 0),
  guardar_original boolean not null default false,
  primeiro_acesso_concluido_em timestamptz,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- categorias: lista padrão copiada no cadastro, mais as categorias próprias
-- ---------------------------------------------------------------------------------------------
create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9_]{1,60}$'),
  nome text not null check (char_length(nome) between 1 and 80),
  grupo text not null check (grupo in ('essencial', 'livre', 'receita', 'transferencia')),
  padrao boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (usuario_id, id),
  unique (usuario_id, slug)
);

-- ---------------------------------------------------------------------------------------------
-- documentos: fila de leitura. extracao_json nunca é lida pelo motor de cálculo.
-- ---------------------------------------------------------------------------------------------
create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 255),
  hash text not null check (hash ~ '^[0-9a-f]{64}$'),
  tipo text check (tipo in ('comprovante', 'boleto', 'fatura_cartao', 'extrato', 'contracheque')),
  status text not null default 'recebido'
    check (status in ('recebido', 'processando', 'em_revisao', 'aprovado', 'erro', 'descartado')),
  extracao_json jsonb,
  modelo_usado text,
  arquivo_chave text,
  reenvio_confirmado boolean not null default false,
  criado_em timestamptz not null default now(),
  aprovado_em timestamptz,
  unique (usuario_id, id),
  check ((status = 'aprovado') = (aprovado_em is not null))
);

-- O mesmo arquivo só entra de novo quando a pessoa confirma o reenvio.
create unique index documentos_hash_unico
  on public.documentos (usuario_id, hash)
  where not reenvio_confirmado;

create index documentos_usuario_criado_em on public.documentos (usuario_id, criado_em);

-- ---------------------------------------------------------------------------------------------
-- recorrencias: rendas e despesas fixas mensais
-- ---------------------------------------------------------------------------------------------
create table public.recorrencias (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('renda', 'fixa')),
  nome text not null check (char_length(nome) between 1 and 120),
  valor_centavos bigint not null check (valor_centavos >= 0),
  -- Dia 31 usa o último dia dos meses menores (regra do motor).
  dia smallint not null check (dia between 1 and 31),
  inicio date not null,
  fim date,
  categoria_id uuid,
  ativa boolean not null default true,
  renda_variavel boolean not null default false,
  -- Fixa paga no cartão: conta no orçamento, mas o dinheiro sai pela fatura (decisão D4).
  paga_no_cartao boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (usuario_id, id),
  check (fim is null or fim >= inicio),
  check (tipo = 'renda' or not renda_variavel),
  check (tipo = 'fixa' or not paga_no_cartao),
  foreign key (usuario_id, categoria_id)
    references public.categorias (usuario_id, id) on delete set null (categoria_id)
);

-- ---------------------------------------------------------------------------------------------
-- lancamentos: gastos, receitas e transferências
-- ---------------------------------------------------------------------------------------------
create table public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data date not null,
  descricao text not null check (char_length(descricao) between 1 and 255),
  valor_centavos bigint not null check (valor_centavos > 0),
  tipo text not null check (tipo in ('despesa', 'receita', 'transferencia')),
  categoria_id uuid,
  -- Vínculo com uma conta: despesa vinculada não conta como gasto variável.
  ocorrencia_id uuid,
  conta_avulsa_id uuid,
  documento_id uuid,
  origem text not null default 'manual' check (origem in ('manual', 'documento', 'pagamento')),
  criado_em timestamptz not null default now(),
  unique (usuario_id, id),
  check (ocorrencia_id is null or conta_avulsa_id is null),
  check (documento_id is null or origem = 'documento'),
  foreign key (usuario_id, categoria_id)
    references public.categorias (usuario_id, id) on delete set null (categoria_id),
  foreign key (usuario_id, documento_id)
    references public.documentos (usuario_id, id) on delete set null (documento_id)
);

create index lancamentos_usuario_data on public.lancamentos (usuario_id, data);

-- ---------------------------------------------------------------------------------------------
-- ocorrencias: o que aconteceu com uma recorrência em um mês (pagamento, recebimento, valor real)
-- ---------------------------------------------------------------------------------------------
create table public.ocorrencias (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recorrencia_id uuid not null,
  competencia text not null check (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  valor_centavos bigint not null check (valor_centavos >= 0),
  status text not null default 'pendente' check (status in ('pendente', 'paga', 'recebida')),
  pago_em date,
  lancamento_id uuid,
  criado_em timestamptz not null default now(),
  unique (usuario_id, id),
  unique (recorrencia_id, competencia),
  check ((status = 'pendente') = (pago_em is null)),
  foreign key (usuario_id, recorrencia_id)
    references public.recorrencias (usuario_id, id) on delete cascade,
  foreign key (usuario_id, lancamento_id)
    references public.lancamentos (usuario_id, id) on delete set null (lancamento_id)
);

create index ocorrencias_usuario_competencia on public.ocorrencias (usuario_id, competencia);

-- ---------------------------------------------------------------------------------------------
-- contas_avulsas: contas com vencimento único (boletos, faturas, IPVA...)
-- ---------------------------------------------------------------------------------------------
create table public.contas_avulsas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 120),
  valor_centavos bigint not null check (valor_centavos >= 0),
  vencimento date not null,
  categoria_id uuid,
  -- Fatura cujos itens foram importados: entra na reserva, fica fora do orçamento (decisão D4).
  quita_itens boolean not null default false,
  pago_em date,
  lancamento_id uuid,
  documento_id uuid,
  criado_em timestamptz not null default now(),
  unique (usuario_id, id),
  foreign key (usuario_id, categoria_id)
    references public.categorias (usuario_id, id) on delete set null (categoria_id),
  foreign key (usuario_id, lancamento_id)
    references public.lancamentos (usuario_id, id) on delete set null (lancamento_id),
  foreign key (usuario_id, documento_id)
    references public.documentos (usuario_id, id) on delete set null (documento_id)
);

create index contas_avulsas_usuario_vencimento on public.contas_avulsas (usuario_id, vencimento);

-- Vínculos de lançamentos com contas (criados depois por causa da referência circular).
alter table public.lancamentos
  add foreign key (usuario_id, ocorrencia_id)
    references public.ocorrencias (usuario_id, id) on delete set null (ocorrencia_id),
  add foreign key (usuario_id, conta_avulsa_id)
    references public.contas_avulsas (usuario_id, id) on delete set null (conta_avulsa_id);

-- ---------------------------------------------------------------------------------------------
-- metas
-- ---------------------------------------------------------------------------------------------
create table public.metas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 120),
  alvo_centavos bigint not null check (alvo_centavos > 0),
  -- Prazo obrigatório na primeira versão (decisão D6).
  prazo date not null,
  prioridade smallint not null check (prioridade between 1 and 3),
  tipo text not null default 'comum' check (tipo in ('comum', 'emergencia')),
  concluida_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (usuario_id, id)
);

-- Uma reserva de emergência por usuário.
create unique index metas_uma_emergencia
  on public.metas (usuario_id)
  where tipo = 'emergencia';

-- ---------------------------------------------------------------------------------------------
-- movimentos_reserva: fonte única dos saldos da reserva de contas e das metas
-- ---------------------------------------------------------------------------------------------
create table public.movimentos_reserva (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data date not null,
  tipo text not null check (tipo in ('aporte', 'saque', 'ajuste')),
  destino text not null check (destino in ('contas', 'meta')),
  meta_id uuid,
  -- Aporte e saque são positivos; ajuste pode ser positivo ou negativo.
  valor_centavos bigint not null,
  -- Conta paga com este saque (vínculo explícito no lugar de origem_id).
  ocorrencia_id uuid,
  conta_avulsa_id uuid,
  criado_em timestamptz not null default now(),
  unique (usuario_id, id),
  check (
    (tipo in ('aporte', 'saque') and valor_centavos > 0)
    or (tipo = 'ajuste' and valor_centavos <> 0)
  ),
  check ((destino = 'meta') = (meta_id is not null)),
  check (ocorrencia_id is null or conta_avulsa_id is null),
  check (
    (ocorrencia_id is null and conta_avulsa_id is null)
    or (tipo = 'saque' and destino = 'contas')
  ),
  foreign key (usuario_id, meta_id) references public.metas (usuario_id, id),
  foreign key (usuario_id, ocorrencia_id)
    references public.ocorrencias (usuario_id, id) on delete set null (ocorrencia_id),
  foreign key (usuario_id, conta_avulsa_id)
    references public.contas_avulsas (usuario_id, id) on delete set null (conta_avulsa_id)
);

create index movimentos_reserva_usuario_data on public.movimentos_reserva (usuario_id, data);

-- ---------------------------------------------------------------------------------------------
-- Acesso: só usuários autenticados, e cada um só às próprias linhas
-- ---------------------------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
grant all on all tables in schema public to service_role;

alter table public.perfis enable row level security;
grant select, update on public.perfis to authenticated;

create policy "perfis: dono lê" on public.perfis
  for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy "perfis: dono altera" on public.perfis
  for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

-- As demais tabelas têm as mesmas quatro políticas.
do $$
declare
  tabela text;
begin
  foreach tabela in array array[
    'categorias', 'documentos', 'recorrencias', 'lancamentos', 'ocorrencias',
    'contas_avulsas', 'metas', 'movimentos_reserva'
  ] loop
    execute format('alter table public.%I enable row level security', tabela);
    execute format('grant select, insert, update, delete on public.%I to authenticated', tabela);

    execute format(
      'create policy %I on public.%I for select to authenticated '
      'using (usuario_id = (select auth.uid()))',
      tabela || ': dono lê', tabela);
    execute format(
      'create policy %I on public.%I for insert to authenticated '
      'with check (usuario_id = (select auth.uid()))',
      tabela || ': dono inclui', tabela);
    execute format(
      'create policy %I on public.%I for update to authenticated '
      'using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()))',
      tabela || ': dono altera', tabela);
    execute format(
      'create policy %I on public.%I for delete to authenticated '
      'using (usuario_id = (select auth.uid()))',
      tabela || ': dono exclui', tabela);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Cadastro: cria o perfil e copia as categorias padrão
-- ---------------------------------------------------------------------------------------------
create function public.ao_criar_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (usuario_id, nome)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nome'), ''),
      split_part(new.email, '@', 1),
      'Sem nome'
    )
  );

  insert into public.categorias (usuario_id, slug, nome, grupo, padrao)
  select new.id, padrao.slug, padrao.nome, padrao.grupo, true
  from (values
    ('moradia', 'Moradia', 'essencial'),
    ('contas_da_casa', 'Contas da casa', 'essencial'),
    ('alimentacao', 'Alimentação', 'essencial'),
    ('transporte', 'Transporte', 'essencial'),
    ('saude', 'Saúde', 'essencial'),
    ('educacao', 'Educação', 'essencial'),
    ('impostos_taxas', 'Impostos e taxas', 'essencial'),
    ('restaurantes', 'Restaurantes e delivery', 'livre'),
    ('lazer', 'Lazer', 'livre'),
    ('compras', 'Compras', 'livre'),
    ('assinaturas', 'Assinaturas', 'livre'),
    ('viagens', 'Viagens', 'livre'),
    ('cuidados_pessoais', 'Cuidados pessoais', 'livre'),
    ('presentes_doacoes', 'Presentes e doações', 'livre'),
    ('outros', 'Outros', 'livre'),
    ('salario', 'Salário', 'receita'),
    ('trabalho_autonomo', 'Trabalho autônomo', 'receita'),
    ('outras_receitas', 'Outras receitas', 'receita'),
    ('transferencia', 'Transferência entre contas', 'transferencia'),
    ('pagamento_fatura', 'Pagamento de fatura', 'transferencia')
  ) as padrao (slug, nome, grupo);

  return new;
end;
$$;

revoke execute on function public.ao_criar_usuario() from public, anon, authenticated;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.ao_criar_usuario();
