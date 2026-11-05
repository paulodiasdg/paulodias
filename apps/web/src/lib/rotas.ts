/** Rotas que exigem login. */
export const ROTAS_PROTEGIDAS = ['/painel', '/lancamentos', '/contas', '/metas'] as const;

/** Rotas de quem ainda não entrou; quem já entrou vai direto para o painel. */
export const ROTAS_DE_ENTRADA = ['/entrar', '/criar-cadastro'] as const;

export const ROTA_INICIAL = '/painel';

function comecaCom(caminho: string, rotas: readonly string[]): boolean {
  return rotas.some((rota) => caminho === rota || caminho.startsWith(`${rota}/`));
}

export function ehRotaProtegida(caminho: string): boolean {
  return comecaCom(caminho, ROTAS_PROTEGIDAS);
}

export function ehRotaDeEntrada(caminho: string): boolean {
  return comecaCom(caminho, ROTAS_DE_ENTRADA);
}

/**
 * Para onde levar a pessoa depois de entrar. Aceita só caminhos internos, para que um link
 * malicioso (`?proximo=https://...` ou `//site`) não redirecione para fora do sistema.
 */
export function destinoSeguro(proximo: unknown): string {
  if (typeof proximo !== 'string') return ROTA_INICIAL;
  if (!proximo.startsWith('/') || proximo.startsWith('//') || proximo.includes('\\')) {
    return ROTA_INICIAL;
  }
  if (ehRotaDeEntrada(proximo)) return ROTA_INICIAL;
  return proximo;
}
