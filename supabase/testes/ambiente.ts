import { execFileSync } from 'node:child_process';

export interface AmbienteSupabase {
  url: string;
  chavePublica: string;
  chaveSecreta: string;
  bancoUrl: string;
}

/**
 * Lê as credenciais do Supabase local. Usa as variáveis de ambiente quando existem (CI) e,
 * se não, pergunta à CLI (`supabase status`).
 */
export function lerAmbiente(): AmbienteSupabase {
  const doAmbiente = {
    url: process.env.SUPABASE_URL,
    chavePublica: process.env.SUPABASE_PUBLISHABLE_KEY,
    chaveSecreta: process.env.SUPABASE_SECRET_KEY,
    bancoUrl: process.env.SUPABASE_DB_URL,
  };
  if (doAmbiente.url && doAmbiente.chavePublica && doAmbiente.chaveSecreta && doAmbiente.bancoUrl) {
    return doAmbiente as AmbienteSupabase;
  }

  let saida: string;
  try {
    saida = execFileSync('supabase', ['status', '-o', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      // No Windows, a CLI instalada pelo pnpm é um atalho .cmd, que só roda pelo shell.
      shell: process.platform === 'win32',
    });
  } catch {
    throw new Error('Supabase local não está rodando. Rode `pnpm db:start` antes dos testes.');
  }
  const status = JSON.parse(saida) as Record<string, string | undefined>;
  const ambiente = {
    url: status.API_URL,
    chavePublica: status.PUBLISHABLE_KEY,
    chaveSecreta: status.SECRET_KEY,
    bancoUrl: status.DB_URL,
  };
  if (!ambiente.url || !ambiente.chavePublica || !ambiente.chaveSecreta || !ambiente.bancoUrl) {
    throw new Error('`supabase status` não devolveu URL e chaves do ambiente local.');
  }
  return ambiente as AmbienteSupabase;
}
