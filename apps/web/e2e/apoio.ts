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

/** Cria um cadastro novo pela tela e termina no painel. */
export async function entrarComCadastroNovo(page: Page) {
  const id = randomUUID().slice(0, 8);
  await page.goto('/criar-cadastro');
  await page.getByLabel('Como quer ser chamado').fill(`Pessoa ${id}`);
  await page.getByLabel('E-mail').fill(`e2e-${id}@teste.noazul.dev`);
  await page.getByLabel('Senha (mínimo de 8 caracteres)').fill(`senha-${id}-ok`);
  await page.getByRole('button', { name: 'Criar cadastro' }).click();
  await expect(page).toHaveURL(/\/painel$/);
}
