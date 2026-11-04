import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { lerAmbiente } from './ambiente.js';
import { TABELAS } from './tabelas.js';

/**
 * Meta-teste: confere no catálogo do Postgres que nenhuma tabela, view ou função do schema
 * public escapa da regra "toda tabela tem RLS e teste de isolamento".
 */
describe('regras de acesso do schema public', () => {
  const banco = new pg.Client({ connectionString: lerAmbiente().bancoUrl });

  beforeAll(async () => {
    await banco.connect();
  });

  afterAll(async () => {
    await banco.end();
  });

  it('toda tabela está coberta pelo teste de isolamento', async () => {
    const { rows } = await banco.query<{ tabela: string }>(`
      select c.relname as tabela
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p')
      order by 1
    `);
    expect(rows.map((linha) => linha.tabela)).toEqual([...TABELAS].sort());
  });

  it('toda tabela tem RLS ligado e ao menos uma política', async () => {
    const { rows } = await banco.query<{ tabela: string; rls: boolean; politicas: number }>(`
      select c.relname as tabela,
             c.relrowsecurity as rls,
             (select count(*)::int from pg_policies p
               where p.schemaname = 'public' and p.tablename = c.relname) as politicas
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p')
    `);
    const semRegra = rows.filter((linha) => !linha.rls || linha.politicas === 0);
    expect(semRegra).toEqual([]);
  });

  it('toda política vale só para autenticados e filtra pelo dono', async () => {
    const { rows } = await banco.query<{
      tabela: string;
      politica: string;
      papeis: string[];
      usando: string | null;
      conferindo: string | null;
    }>(`
      select tablename as tabela, policyname as politica, roles::text[] as papeis,
             qual as usando, with_check as conferindo
      from pg_policies
      where schemaname = 'public'
    `);
    expect(rows.length).toBeGreaterThan(0);
    for (const linha of rows) {
      expect(linha.papeis, linha.politica).toEqual(['authenticated']);
      for (const expressao of [linha.usando, linha.conferindo]) {
        if (expressao !== null) expect(expressao, linha.politica).toContain('auth.uid()');
      }
    }
  });

  it('quem não entrou não tem permissão em nenhuma tabela', async () => {
    const { rows } = await banco.query<{ tabela: string }>(`
      select c.relname as tabela
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
        and has_table_privilege('anon', c.oid, 'select, insert, update, delete')
    `);
    expect(rows).toEqual([]);
  });

  it('views do schema public respeitam o RLS de quem consulta', async () => {
    const { rows } = await banco.query<{ view: string }>(`
      select c.relname as view
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('v', 'm')
        and not coalesce(c.reloptions @> array['security_invoker=true'], false)
    `);
    expect(rows).toEqual([]);
  });

  it('funções security definer não podem ser chamadas pela API', async () => {
    const { rows } = await banco.query<{ funcao: string }>(`
      select p.oid::regprocedure::text as funcao
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
        and (has_function_privilege('anon', p.oid, 'execute')
          or has_function_privilege('authenticated', p.oid, 'execute'))
    `);
    expect(rows).toEqual([]);
  });
});
