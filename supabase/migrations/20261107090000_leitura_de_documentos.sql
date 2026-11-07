-- No Azul: leitura de documentos (Etapa 5)
--
-- O arquivo enviado fica no Storage privado, na pasta da pessoa (<usuario_id>/<documento_id>),
-- só até a aprovação ou o descarte, salvo se ela escolheu guardar o original. A leitura é feita
-- no próprio servidor, sem IA (decisão D8), e o resultado fica em documentos.extracao_json, que
-- nenhum cálculo lê (regra 6 do CLAUDE.md). Só a aprovação grava lançamentos e contas.

-- ---------------------------------------------------------------------------------------------
-- Storage: bucket privado e acesso só à própria pasta
-- ---------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', false, 15728640)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy "documentos: dono lê o arquivo" on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "documentos: dono envia o arquivo" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "documentos: dono troca o arquivo" on storage.objects
  for update to authenticated
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "documentos: dono apaga o arquivo" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------------------------
-- documentos: dados do envio e do andamento da leitura
-- ---------------------------------------------------------------------------------------------
alter table public.documentos
  add column tamanho_bytes bigint check (tamanho_bytes > 0 and tamanho_bytes <= 15728640),
  add column tipo_mime text check (char_length(tipo_mime) <= 120),
  add column tipo_informado text
    check (tipo_informado in ('comprovante', 'boleto', 'fatura_cartao', 'extrato', 'contracheque')),
  -- Motivo do erro, sem conteúdo do documento.
  add column erro text check (char_length(erro) <= 300),
  add column processando_desde timestamptz,
  add column processado_em timestamptz,
  add column descartado_em timestamptz,
  add constraint documentos_descarte check ((status = 'descartado') = (descartado_em is not null)),
  add constraint documentos_erro check (status = 'erro' or erro is null);

-- O arquivo de cada documento fica numa chave só sua.
create unique index documentos_arquivo_unico on public.documentos (arquivo_chave)
  where arquivo_chave is not null;

-- ---------------------------------------------------------------------------------------------
-- Aprovar um documento: grava tudo o que a pessoa confirmou numa transação só
-- ---------------------------------------------------------------------------------------------
--
-- A função não calcula: o app monta, com o motor, quanto sai da reserva em cada pagamento
-- (planoDePagamento, um depois do outro) e passa os valores prontos. Parâmetros (jsonb):
--
-- p_conta: null, ou uma das ações
--   {"acao":"criar","nome","valor_centavos","vencimento","categoria_id","quita_itens"}
--   {"acao":"atualizar_avulsa","conta_avulsa_id","valor_centavos","vencimento","quita_itens"}
--   {"acao":"prever_fixa","recorrencia_id","competencia","valor_centavos"}
-- p_pagamentos: [{"pago_em","valor_centavos","saque_centavos","tipo_lancamento",
--                 "recorrencia_id","competencia","conta_avulsa_id"}]
-- p_recebimentos: [{"recorrencia_id","competencia","valor_centavos","recebido_em"}]
-- p_lancamentos: [{"data","descricao","valor_centavos","tipo","categoria_id",
--                  "recorrencia_id","competencia"}]  (os dois últimos vinculam o item da fatura
--                  à fixa paga no cartão)
-- p_manter_arquivo: se false, o documento deixa de apontar para o arquivo (o app o apaga depois).
create function public.aprovar_documento(
  p_documento_id uuid,
  p_conta jsonb,
  p_pagamentos jsonb,
  p_recebimentos jsonb,
  p_lancamentos jsonb,
  p_manter_arquivo boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status text;
  v_conta_id uuid;
  v_pago_em date;
  v_lancamento_do_pagamento uuid;
  v_ocorrencia_id uuid;
  v_quita_itens boolean;
  item jsonb;
begin
  select status into v_status from public.documentos where id = p_documento_id for update;
  if not found then
    raise exception 'Documento não encontrado.' using errcode = 'P0002';
  end if;
  if v_status <> 'em_revisao' then
    raise exception 'Este documento não está em revisão.' using errcode = 'P0001';
  end if;

  -- Conta do documento (boleto ou fatura)
  if p_conta is not null and jsonb_typeof(p_conta) = 'object' then
    v_quita_itens := coalesce((p_conta->>'quita_itens')::boolean, false);
    case p_conta->>'acao'
      when 'criar' then
        insert into public.contas_avulsas
          (nome, valor_centavos, vencimento, categoria_id, quita_itens, documento_id)
        values
          (p_conta->>'nome', (p_conta->>'valor_centavos')::bigint, (p_conta->>'vencimento')::date,
           (p_conta->>'categoria_id')::uuid, v_quita_itens, p_documento_id);

      when 'atualizar_avulsa' then
        v_conta_id := (p_conta->>'conta_avulsa_id')::uuid;
        select pago_em, lancamento_id into v_pago_em, v_lancamento_do_pagamento
        from public.contas_avulsas where id = v_conta_id for update;
        if not found then
          raise exception 'Conta não encontrada.' using errcode = 'P0002';
        end if;
        if v_pago_em is null then
          update public.contas_avulsas
          set valor_centavos = (p_conta->>'valor_centavos')::bigint,
              vencimento = (p_conta->>'vencimento')::date,
              quita_itens = v_quita_itens,
              documento_id = p_documento_id
          where id = v_conta_id;
        else
          -- Fatura já paga: o valor fica como foi pago. Com os itens importados, o pagamento
          -- passa a ser transferência, para o gasto não contar duas vezes (4.4 da spec).
          update public.contas_avulsas
          set quita_itens = v_quita_itens, documento_id = p_documento_id
          where id = v_conta_id;
          if v_quita_itens and v_lancamento_do_pagamento is not null then
            update public.lancamentos set tipo = 'transferencia'
            where id = v_lancamento_do_pagamento;
          end if;
        end if;

      when 'prever_fixa' then
        perform 1 from public.recorrencias
        where id = (p_conta->>'recorrencia_id')::uuid and tipo = 'fixa';
        if not found then
          raise exception 'Despesa fixa não encontrada.' using errcode = 'P0002';
        end if;
        insert into public.ocorrencias (recorrencia_id, competencia, valor_centavos, status)
        values ((p_conta->>'recorrencia_id')::uuid, p_conta->>'competencia',
                (p_conta->>'valor_centavos')::bigint, 'pendente')
        on conflict (recorrencia_id, competencia) do update
          set valor_centavos = excluded.valor_centavos
          where public.ocorrencias.status = 'pendente'
        returning id into v_ocorrencia_id;
        if v_ocorrencia_id is null then
          raise exception 'Esta conta já está paga.' using errcode = 'P0001';
        end if;

      else
        raise exception 'Ação da conta inválida.' using errcode = '22023';
    end case;
  end if;

  -- Contas quitadas por linhas do documento (pagamento em extrato ou comprovante)
  for item in select * from jsonb_array_elements(coalesce(p_pagamentos, '[]'::jsonb)) loop
    perform public.registrar_pagamento(
      (item->>'pago_em')::date,
      (item->>'valor_centavos')::bigint,
      (item->>'saque_centavos')::bigint,
      item->>'tipo_lancamento',
      (item->>'recorrencia_id')::uuid,
      item->>'competencia',
      (item->>'conta_avulsa_id')::uuid
    );
  end loop;

  -- Rendas confirmadas por linhas do documento (extrato ou contracheque)
  for item in select * from jsonb_array_elements(coalesce(p_recebimentos, '[]'::jsonb)) loop
    perform public.confirmar_recebimento(
      (item->>'recorrencia_id')::uuid,
      item->>'competencia',
      (item->>'valor_centavos')::bigint,
      (item->>'recebido_em')::date
    );
  end loop;

  -- Lançamentos novos
  for item in select * from jsonb_array_elements(coalesce(p_lancamentos, '[]'::jsonb)) loop
    v_ocorrencia_id := null;
    if item->>'recorrencia_id' is not null then
      select id into v_ocorrencia_id from public.ocorrencias
      where recorrencia_id = (item->>'recorrencia_id')::uuid
        and competencia = item->>'competencia' and status = 'paga';
      if v_ocorrencia_id is null then
        raise exception 'A despesa fixa do item não foi marcada como paga.' using errcode = 'P0001';
      end if;
    end if;
    insert into public.lancamentos
      (data, descricao, valor_centavos, tipo, categoria_id, ocorrencia_id, documento_id, origem)
    values
      ((item->>'data')::date, item->>'descricao', (item->>'valor_centavos')::bigint,
       item->>'tipo', (item->>'categoria_id')::uuid, v_ocorrencia_id, p_documento_id, 'documento');
  end loop;

  update public.documentos
  set status = 'aprovado',
      aprovado_em = now(),
      arquivo_chave = case when p_manter_arquivo then arquivo_chave else null end
  where id = p_documento_id;
end;
$$;

revoke execute on function public.aprovar_documento(uuid, jsonb, jsonb, jsonb, jsonb, boolean)
  from public, anon;
grant execute on function public.aprovar_documento(uuid, jsonb, jsonb, jsonb, jsonb, boolean)
  to authenticated;
