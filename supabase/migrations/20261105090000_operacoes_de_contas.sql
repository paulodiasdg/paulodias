-- No Azul: operações de contas (Etapa 3)
--
-- Cada função grava uma operação inteira em uma única transação (regra de integridade da
-- seção 5: pagar uma conta grava o pagamento, o lançamento e o movimento da reserva juntos).
-- Todas são SECURITY INVOKER: rodam com as permissões e o RLS de quem chama.
--
-- Nenhuma função calcula valores: o app obtém do motor (packages/motor, planoDePagamento) o tipo
-- do lançamento e quanto sai da reserva, e a função só grava.

-- Lançamento gerado ao confirmar o recebimento de uma renda recorrente.
alter table public.lancamentos drop constraint lancamentos_origem_check;
alter table public.lancamentos add constraint lancamentos_origem_check
  check (origem in ('manual', 'documento', 'pagamento', 'recebimento'));

-- ---------------------------------------------------------------------------------------------
-- Pagar uma despesa fixa (recorrência + competência) ou uma conta avulsa
-- ---------------------------------------------------------------------------------------------
create function public.registrar_pagamento(
  p_pago_em date,
  p_valor_centavos bigint,
  p_saque_centavos bigint,
  p_tipo_lancamento text default null,
  p_recorrencia_id uuid default null,
  p_competencia text default null,
  p_conta_avulsa_id uuid default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ocorrencia_id uuid;
  v_lancamento_id uuid;
  v_nome text;
  v_categoria_id uuid;
  v_valor_da_conta bigint;
  v_ja_paga_em date;
begin
  if (p_recorrencia_id is null) = (p_conta_avulsa_id is null) then
    raise exception 'Informe a despesa fixa ou a conta avulsa.' using errcode = '22023';
  end if;
  if p_pago_em is null or p_valor_centavos is null or p_saque_centavos is null
     or p_valor_centavos < 0 or p_saque_centavos < 0 or p_saque_centavos > p_valor_centavos then
    raise exception 'Valores do pagamento inválidos.' using errcode = '22023';
  end if;
  if p_tipo_lancamento is not null and p_tipo_lancamento not in ('despesa', 'transferencia') then
    raise exception 'Tipo de lançamento inválido.' using errcode = '22023';
  end if;
  if p_tipo_lancamento is null and p_saque_centavos > 0 then
    raise exception 'Pagamento sem lançamento não sai da reserva.' using errcode = '22023';
  end if;

  if p_recorrencia_id is not null then
    select nome, categoria_id into v_nome, v_categoria_id
    from public.recorrencias
    where id = p_recorrencia_id and tipo = 'fixa';
    if not found then
      raise exception 'Despesa fixa não encontrada.' using errcode = 'P0002';
    end if;

    insert into public.ocorrencias (recorrencia_id, competencia, valor_centavos, status, pago_em)
    values (p_recorrencia_id, p_competencia, p_valor_centavos, 'paga', p_pago_em)
    on conflict (recorrencia_id, competencia) do update
      set valor_centavos = excluded.valor_centavos, status = 'paga', pago_em = excluded.pago_em
      where public.ocorrencias.status = 'pendente'
    returning id into v_ocorrencia_id;
    if v_ocorrencia_id is null then
      raise exception 'Esta conta já está paga.' using errcode = 'P0001';
    end if;
  else
    select nome, categoria_id, valor_centavos, pago_em
    into v_nome, v_categoria_id, v_valor_da_conta, v_ja_paga_em
    from public.contas_avulsas
    where id = p_conta_avulsa_id;
    if not found then
      raise exception 'Conta não encontrada.' using errcode = 'P0002';
    end if;
    if v_ja_paga_em is not null then
      raise exception 'Esta conta já está paga.' using errcode = 'P0001';
    end if;
    -- A conta avulsa guarda um valor só; para pagar outro, a pessoa edita a conta antes. Assim,
    -- desfazer o pagamento devolve a conta exatamente como estava.
    if v_valor_da_conta <> p_valor_centavos then
      raise exception 'Para pagar um valor diferente, edite a conta antes de pagar.'
        using errcode = '22023';
    end if;
    update public.contas_avulsas set pago_em = p_pago_em where id = p_conta_avulsa_id;
  end if;

  if p_tipo_lancamento is not null and p_valor_centavos > 0 then
    insert into public.lancamentos
      (data, descricao, valor_centavos, tipo, categoria_id, ocorrencia_id, conta_avulsa_id, origem)
    values
      (p_pago_em, v_nome, p_valor_centavos, p_tipo_lancamento, v_categoria_id,
       v_ocorrencia_id, p_conta_avulsa_id, 'pagamento')
    returning id into v_lancamento_id;

    if v_ocorrencia_id is not null then
      update public.ocorrencias set lancamento_id = v_lancamento_id where id = v_ocorrencia_id;
    else
      update public.contas_avulsas set lancamento_id = v_lancamento_id where id = p_conta_avulsa_id;
    end if;
  end if;

  if p_saque_centavos > 0 then
    insert into public.movimentos_reserva
      (data, tipo, destino, valor_centavos, ocorrencia_id, conta_avulsa_id)
    values
      (p_pago_em, 'saque', 'contas', p_saque_centavos, v_ocorrencia_id, p_conta_avulsa_id);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Desfazer o pagamento: devolve à reserva o que saiu dela e apaga o lançamento do pagamento
-- ---------------------------------------------------------------------------------------------
create function public.desfazer_pagamento(
  p_ocorrencia_id uuid default null,
  p_conta_avulsa_id uuid default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (p_ocorrencia_id is null) = (p_conta_avulsa_id is null) then
    raise exception 'Informe a despesa fixa ou a conta avulsa.' using errcode = '22023';
  end if;

  if p_ocorrencia_id is not null then
    perform 1 from public.ocorrencias where id = p_ocorrencia_id and status = 'paga';
    if not found then
      raise exception 'Pagamento não encontrado.' using errcode = 'P0002';
    end if;
    delete from public.movimentos_reserva where ocorrencia_id = p_ocorrencia_id and tipo = 'saque';
    delete from public.lancamentos where ocorrencia_id = p_ocorrencia_id and origem = 'pagamento';
    -- A ocorrência só existe por causa do pagamento: apagá-la devolve o mês à previsão da
    -- recorrência, inclusive quando o valor pago foi outro.
    delete from public.ocorrencias where id = p_ocorrencia_id;
  else
    perform 1 from public.contas_avulsas where id = p_conta_avulsa_id and pago_em is not null;
    if not found then
      raise exception 'Pagamento não encontrado.' using errcode = 'P0002';
    end if;
    delete from public.movimentos_reserva
    where conta_avulsa_id = p_conta_avulsa_id and tipo = 'saque';
    delete from public.lancamentos where conta_avulsa_id = p_conta_avulsa_id and origem = 'pagamento';
    update public.contas_avulsas set pago_em = null, lancamento_id = null where id = p_conta_avulsa_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Confirmar e desfazer o recebimento de uma renda recorrente
-- ---------------------------------------------------------------------------------------------
create function public.confirmar_recebimento(
  p_recorrencia_id uuid,
  p_competencia text,
  p_valor_centavos bigint,
  p_recebido_em date
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ocorrencia_id uuid;
  v_lancamento_id uuid;
  v_nome text;
  v_categoria_id uuid;
begin
  if p_recebido_em is null or p_valor_centavos is null or p_valor_centavos < 0 then
    raise exception 'Valores do recebimento inválidos.' using errcode = '22023';
  end if;

  select nome, categoria_id into v_nome, v_categoria_id
  from public.recorrencias
  where id = p_recorrencia_id and tipo = 'renda';
  if not found then
    raise exception 'Renda não encontrada.' using errcode = 'P0002';
  end if;

  insert into public.ocorrencias (recorrencia_id, competencia, valor_centavos, status, pago_em)
  values (p_recorrencia_id, p_competencia, p_valor_centavos, 'recebida', p_recebido_em)
  on conflict (recorrencia_id, competencia) do update
    set valor_centavos = excluded.valor_centavos, status = 'recebida', pago_em = excluded.pago_em
    where public.ocorrencias.status = 'pendente'
  returning id into v_ocorrencia_id;
  if v_ocorrencia_id is null then
    raise exception 'Este recebimento já foi confirmado.' using errcode = 'P0001';
  end if;

  if p_valor_centavos > 0 then
    insert into public.lancamentos
      (data, descricao, valor_centavos, tipo, categoria_id, ocorrencia_id, origem)
    values
      (p_recebido_em, v_nome, p_valor_centavos, 'receita', v_categoria_id, v_ocorrencia_id,
       'recebimento')
    returning id into v_lancamento_id;
    update public.ocorrencias set lancamento_id = v_lancamento_id where id = v_ocorrencia_id;
  end if;
end;
$$;

create function public.desfazer_recebimento(p_ocorrencia_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1 from public.ocorrencias where id = p_ocorrencia_id and status = 'recebida';
  if not found then
    raise exception 'Recebimento não encontrado.' using errcode = 'P0002';
  end if;
  delete from public.lancamentos where ocorrencia_id = p_ocorrencia_id and origem = 'recebimento';
  -- Como no pagamento: o mês volta ao valor previsto da renda.
  delete from public.ocorrencias where id = p_ocorrencia_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Excluir uma meta junto com os aportes registrados nela
-- ---------------------------------------------------------------------------------------------
create function public.excluir_meta(p_meta_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.movimentos_reserva where meta_id = p_meta_id;
  delete from public.metas where id = p_meta_id;
  if not found then
    raise exception 'Meta não encontrada.' using errcode = 'P0002';
  end if;
end;
$$;

-- Só quem entrou chama as funções; o RLS das tabelas limita cada um às próprias linhas.
revoke execute on function public.registrar_pagamento(date, bigint, bigint, text, uuid, text, uuid)
  from public, anon;
revoke execute on function public.desfazer_pagamento(uuid, uuid) from public, anon;
revoke execute on function public.confirmar_recebimento(uuid, text, bigint, date) from public, anon;
revoke execute on function public.desfazer_recebimento(uuid) from public, anon;
revoke execute on function public.excluir_meta(uuid) from public, anon;

grant execute on function public.registrar_pagamento(date, bigint, bigint, text, uuid, text, uuid)
  to authenticated;
grant execute on function public.desfazer_pagamento(uuid, uuid) to authenticated;
grant execute on function public.confirmar_recebimento(uuid, text, bigint, date) to authenticated;
grant execute on function public.desfazer_recebimento(uuid) to authenticated;
grant execute on function public.excluir_meta(uuid) to authenticated;
