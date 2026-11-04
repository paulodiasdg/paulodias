import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

function novaPessoa() {
  const id = randomUUID().slice(0, 8);
  return { nome: `Pessoa ${id}`, email: `e2e-${id}@teste.noazul.dev`, senha: `senha-${id}-ok` };
}

async function criarCadastro(page: Page, pessoa: ReturnType<typeof novaPessoa>) {
  await page.goto('/criar-cadastro');
  await page.getByLabel('Como quer ser chamado').fill(pessoa.nome);
  await page.getByLabel('E-mail').fill(pessoa.email);
  await page.getByLabel('Senha (mínimo de 8 caracteres)').fill(pessoa.senha);
  await page.getByRole('button', { name: 'Criar cadastro' }).click();
}

test('sem login, o painel leva para a tela de entrar', async ({ page }) => {
  await page.goto('/painel');
  await expect(page).toHaveURL(/\/entrar\?proximo=%2Fpainel$/);
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
});

test('criar cadastro, sair e entrar de novo com e-mail e senha', async ({ page }) => {
  const pessoa = novaPessoa();

  await criarCadastro(page, pessoa);
  await expect(page).toHaveURL(/\/painel$/);
  await expect(page.getByRole('heading', { name: `Olá, ${pessoa.nome}` })).toBeVisible();

  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/entrar$/);

  await page.goto('/painel');
  await expect(page).toHaveURL(/\/entrar\?proximo=%2Fpainel$/);

  await page.getByLabel('E-mail').fill(pessoa.email);
  await page.getByLabel('Senha').fill(pessoa.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/painel$/);
  await expect(page.getByRole('heading', { name: `Olá, ${pessoa.nome}` })).toBeVisible();

  // Quem já entrou não vê a tela de entrar de novo.
  await page.goto('/entrar');
  await expect(page).toHaveURL(/\/painel$/);
});

test('senha errada mostra o erro em português', async ({ page }) => {
  const pessoa = novaPessoa();
  await criarCadastro(page, pessoa);
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/entrar$/);

  await page.getByLabel('E-mail').fill(pessoa.email);
  await page.getByLabel('Senha').fill('senha-errada');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('E-mail ou senha incorretos.');
  await expect(page).toHaveURL(/\/entrar$/);
});

test('cadastro com e-mail repetido é recusado', async ({ page }) => {
  const pessoa = novaPessoa();
  await criarCadastro(page, pessoa);
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/entrar$/);

  await criarCadastro(page, pessoa);
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    'Já existe um cadastro com este e-mail.',
  );
});
