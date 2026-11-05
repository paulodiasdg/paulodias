import { expect, test } from '@playwright/test';
import { entrarComCadastroNovo, hojeEmBrasilia } from './apoio';

test.beforeEach(async ({ page }) => {
  await entrarComCadastroNovo(page);
});

test('pagar e desfazer uma despesa fixa devolve o lançamento e o saldo da reserva (aceite da Etapa 3)', async ({
  page,
}) => {
  const hoje = hojeEmBrasilia();
  await page.getByRole('link', { name: 'Contas e fixas' }).first().click();
  await expect(page.getByRole('heading', { name: 'Contas e fixas', level: 1 })).toBeVisible();
  await expect(page.getByTestId('saldo-reserva')).toHaveText('R$ 0,00');

  // Guarda R$ 1.000 na reserva de contas.
  await page.getByRole('button', { name: 'Registrar reserva' }).click();
  await page.getByLabel('Valor guardado (R$)').fill('1.000,00');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByTestId('saldo-reserva')).toHaveText('R$ 1.000,00');

  // Cadastra o aluguel vencendo hoje.
  await page.getByRole('link', { name: 'Nova despesa fixa' }).click();
  await page.getByLabel('Nome').fill('Aluguel');
  await page.getByLabel('Valor (R$)').fill('2.130,00');
  await page.getByLabel('Dia do vencimento').fill(String(hoje.dia));
  await page.getByLabel('Categoria').selectOption({ label: 'Moradia' });
  await page.getByRole('button', { name: 'Cadastrar' }).click();
  await expect(page).toHaveURL(/\/contas$/);

  // Vencendo hoje, o aluguel aparece duas vezes nos próximos 45 dias: hoje e no mês que vem.
  const aluguelDoMes = page.locator('#a-pagar [data-conta="Aluguel"]');
  await expect(aluguelDoMes).toHaveCount(2);
  const aPagar = aluguelDoMes.filter({ hasText: 'Vence hoje' });
  await aPagar.getByRole('button', { name: 'Pagar' }).click();
  await expect(aPagar.getByLabel('Valor pago (R$)')).toHaveValue('2130,00');
  await aPagar.getByRole('button', { name: 'Confirmar pagamento' }).click();

  const paga = page.locator('#pagas [data-conta="Aluguel"]');
  await expect(paga).toContainText('Saiu da reserva: R$ 1.000,00');
  await expect(page.getByTestId('saldo-reserva')).toHaveText('R$ 0,00');
  await expect(page.locator('#a-pagar [data-conta="Aluguel"]')).toHaveCount(1);

  await page.goto('/lancamentos');
  await expect(page.getByText('Pagamento de conta')).toBeVisible();
  await expect(page.getByTestId('total-despesas')).toHaveText('R$ 2.130,00');

  // Desfaz: o lançamento some e o dinheiro volta para a reserva.
  await page.goto('/contas');
  await page
    .locator('#pagas [data-conta="Aluguel"]')
    .getByRole('button', { name: 'Desfazer pagamento' })
    .click();
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect(page.getByTestId('saldo-reserva')).toHaveText('R$ 1.000,00');
  await expect(page.locator('#a-pagar [data-conta="Aluguel"]')).toHaveCount(2);
  await expect(page.locator('#pagas [data-conta="Aluguel"]')).toHaveCount(0);

  await page.goto('/lancamentos');
  await expect(page.getByText('Nenhum lançamento neste mês.')).toBeVisible();
  await expect(page.getByTestId('total-despesas')).toHaveText('R$ 0,00');
});

test('confirmar e desfazer o recebimento de uma renda', async ({ page }) => {
  const hoje = hojeEmBrasilia();
  await page.goto('/contas/recorrencias/nova?tipo=renda');
  await page.getByLabel('Nome').fill('Salário');
  await page.getByLabel('Valor previsto (R$)').fill('7.700,00');
  await page.getByLabel('Dia do recebimento').fill(String(hoje.dia));
  await page.getByRole('button', { name: 'Cadastrar' }).click();
  await expect(page).toHaveURL(/\/contas$/);

  const renda = page.locator('#rendas-do-mes [data-renda="Salário"]');
  await renda.getByRole('button', { name: 'Confirmar recebimento' }).click();
  await renda.getByLabel('Valor recebido (R$)').fill('8.000,00');
  await renda.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(renda).toContainText('Recebida em');
  await expect(renda).toContainText('R$ 8.000,00');

  await renda.getByRole('button', { name: 'Desfazer recebimento' }).click();
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect(renda).toContainText('Prevista para');
  await expect(renda).toContainText('R$ 7.700,00');
});

test('lançamentos: criar, buscar, filtrar, exportar, editar e excluir', async ({ page }) => {
  await page.getByRole('link', { name: 'Lançamentos' }).first().click();
  await page.getByRole('link', { name: 'Novo lançamento' }).click();
  await page.getByLabel('Descrição').fill('Mercado do mês');
  await page.getByLabel('Valor (R$)').fill('287,90');
  await page.getByLabel('Categoria').selectOption({ label: 'Alimentação' });
  await page.getByRole('button', { name: 'Lançar' }).click();

  await expect(page.getByText('Mercado do mês')).toBeVisible();
  await expect(page.getByTestId('total-despesas')).toHaveText('R$ 287,90');

  await page.getByLabel('Buscar').fill('merc');
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await expect(page).toHaveURL(/busca=merc/);
  await expect(page.getByText('Mercado do mês')).toBeVisible();
  await page.getByLabel('Buscar').fill('farmácia');
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await expect(page.getByText('Nenhum lançamento com esses filtros.')).toBeVisible();

  // Limpar volta ao mês sem filtros, e o campo de busca fica vazio.
  await page.getByRole('link', { name: 'Limpar' }).click();
  await expect(page).toHaveURL(/\/lancamentos\?mes=\d{4}-\d{2}$/);
  await expect(page.getByLabel('Buscar')).toHaveValue('');

  await page.getByLabel('Categoria').selectOption({ label: 'Alimentação' });
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await expect(page).toHaveURL(/categoria=/);
  await expect(page.getByText('Mercado do mês')).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Exportar CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^lancamentos-\d{4}-\d{2}\.csv$/);
  const caminho = await download.path();
  const conteudo = (await import('node:fs')).readFileSync(caminho!, 'utf8');
  expect(conteudo).toContain('Mercado do mês;Alimentação;Gasto;287,90');

  await page.getByRole('link', { name: /Mercado do mês/ }).click();
  await page.getByLabel('Valor (R$)').fill('300,00');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByTestId('total-despesas')).toHaveText('R$ 300,00');

  await page.getByRole('link', { name: /Mercado do mês/ }).click();
  await page.getByRole('button', { name: 'Excluir lançamento' }).click();
  await page.getByRole('button', { name: 'Excluir de vez' }).click();
  await expect(page.getByText('Nenhum lançamento neste mês.')).toBeVisible();
});

test('metas: criar, registrar aporte e ver o progresso', async ({ page }) => {
  await page.getByRole('link', { name: 'Metas' }).first().click();
  await page.getByRole('link', { name: 'Nova meta' }).click();
  await page.getByLabel('Nome').fill('Viagem');
  await page.getByLabel('Quanto quer juntar (R$)').fill('4.500,00');
  await page.getByRole('button', { name: 'Criar meta' }).click();

  const meta = page.locator('[data-meta="Viagem"]');
  await expect(meta.getByTestId('guardado')).toHaveText('R$ 0,00 de R$ 4.500,00');
  // Sem renda cadastrada, não há verba para a meta.
  await expect(meta).toContainText('Sem verba neste mês');

  await meta.getByRole('button', { name: 'Registrar aporte' }).click();
  await meta.getByLabel('Valor guardado (R$)').fill('285,00');
  await meta.getByRole('button', { name: 'Guardar' }).click();
  await expect(meta.getByTestId('guardado')).toHaveText('R$ 285,00 de R$ 4.500,00');
  await expect(meta.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '6');
});

test('a conta avulsa paga fica bloqueada até desfazer o pagamento', async ({ page }) => {
  const hoje = hojeEmBrasilia();
  await page.goto('/contas/avulsas/nova');
  await page.getByLabel('Nome').fill('IPVA');
  await page.getByLabel('Valor (R$)').fill('380,00');
  await page.getByLabel('Vencimento').fill(hoje.iso);
  await page.getByRole('button', { name: 'Cadastrar' }).click();

  const conta = page.locator('#a-pagar [data-conta="IPVA"]');
  await conta.getByRole('button', { name: 'Pagar' }).click();
  // Conta avulsa não pede valor: paga o valor cadastrado.
  await expect(conta.getByLabel('Valor pago (R$)')).toHaveCount(0);
  await conta.getByRole('button', { name: 'Confirmar pagamento' }).click();
  await expect(page.locator('#pagas [data-conta="IPVA"]')).toContainText(
    'Saiu da reserva: R$ 0,00',
  );

  await page.locator('#cadastros').getByRole('link', { name: /IPVA/ }).click();
  await expect(page.getByText('Para alterar ou excluir, desfaça o pagamento')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Excluir conta' })).toHaveCount(0);
});
