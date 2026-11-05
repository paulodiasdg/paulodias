import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';

/** Hoje no horário de Brasília, como o app calcula. */
export function hojeEmBrasilia(): { iso: string; dia: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return { iso: `${parte('year')}-${parte('month')}-${parte('day')}`, dia: Number(parte('day')) };
}

/** Cria um cadastro novo pela tela e termina no painel. Devolve o e-mail e a senha. */
export async function entrarComCadastroNovo(page: Page): Promise<{ email: string; senha: string }> {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-${id}@teste.noazul.dev`;
  const senha = `senha-${id}-ok`;
  await page.goto('/criar-cadastro');
  await page.getByLabel('Como quer ser chamado').fill(`Pessoa ${id}`);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha (mínimo de 8 caracteres)').fill(senha);
  await page.getByRole('button', { name: 'Criar cadastro' }).click();
  await expect(page).toHaveURL(/\/painel$/);
  return { email, senha };
}
