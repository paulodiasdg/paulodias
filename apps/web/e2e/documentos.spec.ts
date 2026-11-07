import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { orcamentoDoMes } from '@no-azul/motor';
import { carregarDadosFinanceiros } from '../src/lib/financeiro/carregar';
import { entrarComCadastroNovo, hojeEmBrasilia } from './apoio';
import { clienteDaPessoa, montarCenarioDoPainel, type ClienteDoTeste } from './cenario-painel';

/**
 * Etapa 5, ponta a ponta: enviar, ler (no próprio servidor, sem IA), revisar, aprovar e
 * descartar. Os documentos vêm do conjunto de teste (packages/documentos/testes/conjunto).
 */

const CONJUNTO = fileURLToPath(
  new URL('../../../packages/documentos/testes/conjunto/arquivos/', import.meta.url),
);

/** A leitura de foto e PDF digitalizado leva alguns segundos (OCR). */
const TEMPO_DA_LEITURA = 90_000;

async function enviar(page: Page, arquivo: string): Promise<string> {
  await page.goto('/documentos');
  await page.locator('input[type=file]').setInputFiles(arquivo);
  await page.getByRole('button', { name: 'Enviar e ler' }).click();
  await page.waitForURL(/\/documentos\/[0-9a-f-]{36}$/);
  return page.url().split('/').pop()!;
}

async function semRolagemDeLado(page: Page) {
  const larguras = await page.evaluate(() => ({
    pagina: document.documentElement.scrollWidth,
    janela: window.innerWidth,
  }));
  expect(larguras.pagina).toBeLessThanOrEqual(larguras.janela);
}

async function esperarRevisao(page: Page) {
  await expect(page.getByRole('heading', { name: 'Confira e aprove' })).toBeVisible({
    timeout: TEMPO_DA_LEITURA,
  });
  await semRolagemDeLado(page);
}

/** Todos os números marcados do painel e do planejamento (as chaves do teste de aceite da Etapa 4). */
async function numerosDasTelas(page: Page): Promise<string[]> {
  const numeros: string[] = [];
  for (const tela of ['/painel', '/planejamento']) {
    await page.goto(tela);
    numeros.push(
      ...(await page
        .locator('main [data-valor], main [data-numero]')
        .evaluateAll((elementos) =>
          elementos.map(
            (e) =>
              `${e.getAttribute('data-valor') ?? e.getAttribute('data-numero')}=${e.textContent?.trim()}`,
          ),
        )),
    );
  }
  return numeros;
}

async function lancamentosDoDocumento(cliente: ClienteDoTeste, documentoId: string) {
  const { data } = await cliente
    .from('lancamentos')
    .select('descricao, valor_centavos, tipo')
    .eq('documento_id', documentoId);
  return data ?? [];
}

test('fatura: nada entra antes de aprovar, e pagá-la pelo extrato não conta o gasto duas vezes', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const { email, senha } = await entrarComCadastroNovo(page);
  const cliente = await clienteDaPessoa(email, senha);
  const hoje = hojeEmBrasilia().iso;
  await montarCenarioDoPainel(cliente, hoje);
  const antes = await numerosDasTelas(page);
  expect(antes.length).toBeGreaterThan(50);

  const fatura = await enviar(page, join(CONJUNTO, '13-fatura-aurora.pdf'));
  await esperarRevisao(page);
  await expect(page.getByText('Itens da fatura · 14 de 15 marcados')).toBeVisible();
  await expect(
    page.getByText('Pagamento da fatura anterior: já entrou quando aquela fatura foi paga.'),
  ).toBeVisible();

  // Aceite: com o documento lido e em revisão, nenhum número do painel ou do planejamento muda.
  expect(await lancamentosDoDocumento(cliente, fatura)).toEqual([]);
  expect(await numerosDasTelas(page)).toEqual(antes);

  // O que outubro e novembro gastam no orçamento (3.2): contas avulsas e gastos variáveis.
  const gastoDosMeses = async () => {
    const dados = await carregarDadosFinanceiros(cliente);
    return ['2026-10', '2026-11'].reduce((total, competencia) => {
      const mes = orcamentoDoMes(dados, competencia);
      return total + mes.contasAvulsasCentavos + mes.gastoVariavelCentavos;
    }, 0);
  };
  const gastoAntes = await gastoDosMeses();

  await page.goto(`/documentos/${fatura}`);
  await esperarRevisao(page);
  await page.getByRole('button', { name: 'Aprovar e gravar' }).click();
  await expect(page).toHaveURL(/\/documentos\?aprovado=1$/);
  await expect(
    page.getByText('Documento aprovado. Os dados já estão nas suas contas.'),
  ).toBeVisible();

  const itens = await lancamentosDoDocumento(cliente, fatura);
  expect(itens).toHaveLength(14);
  expect(itens.find((l) => l.descricao.startsWith('PAGAMENTO RECEBIDO'))).toBeUndefined();
  expect(itens.find((l) => l.descricao === 'ESTORNO LOJA MODA VIVA')).toMatchObject({
    tipo: 'receita',
    valor_centavos: 4500,
  });
  const { data: contaDaFatura } = await cliente
    .from('contas_avulsas')
    .select('id, valor_centavos, vencimento, quita_itens, pago_em')
    .eq('documento_id', fatura)
    .single();
  expect(contaDaFatura).toMatchObject({
    valor_centavos: 110770,
    vencimento: '2026-11-20',
    quita_itens: true,
    pago_em: null,
  });

  // Compras da fatura (sem o estorno, que entra como receita): R$ 1.152,70.
  const comprasDaFatura = itens
    .filter((l) => l.tipo === 'despesa')
    .reduce((s, l) => s + l.valor_centavos, 0);
  expect(comprasDaFatura).toBe(115270);
  expect(await gastoDosMeses()).toBe(gastoAntes + comprasDaFatura);

  // O extrato com o pagamento da fatura: a revisão propõe quitar a conta.
  const pasta = mkdtempSync(join(tmpdir(), 'no-azul-'));
  const extrato = join(pasta, 'extrato-pagamento.csv');
  writeFileSync(
    extrato,
    'Data;Histórico;Valor\n19/11/2026;PAGAMENTO FATURA CARTAO AURORA;-1.107,70\n',
    'latin1',
  );
  const documentoDoExtrato = await enviar(page, extrato);
  await esperarRevisao(page);
  await expect(page.getByText(/Parece o pagamento de Fatura Banco Aurora/)).toBeVisible();
  await expect(page.locator('[data-linha="0"] select').last().locator('option:checked')).toHaveText(
    /Quitar Fatura Banco Aurora/,
  );
  await page.getByRole('button', { name: 'Aprovar e gravar' }).click();
  await expect(page).toHaveURL(/\/documentos\?aprovado=1$/);

  const { data: paga } = await cliente
    .from('contas_avulsas')
    .select('pago_em, lancamento_id')
    .eq('id', contaDaFatura!.id)
    .single();
  expect(paga?.pago_em).toBe('2026-11-19');
  const { data: pagamento } = await cliente
    .from('lancamentos')
    .select('tipo, valor_centavos')
    .eq('id', paga!.lancamento_id!)
    .single();
  // Aceite: o pagamento da fatura com itens importados é transferência; o gasto conta uma vez só.
  expect(pagamento).toEqual({ tipo: 'transferencia', valor_centavos: 110770 });
  expect(await lancamentosDoDocumento(cliente, documentoDoExtrato)).toEqual([]);
  expect(await gastoDosMeses()).toBe(gastoAntes + comprasDaFatura);
});

test('foto: lê o boleto pelo código de barras; reenviar avisa; descartar não grava nada', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const { email, senha } = await entrarComCadastroNovo(page);
  const cliente = await clienteDaPessoa(email, senha);

  const primeiro = await enviar(page, join(CONJUNTO, '11-boleto-curso.jpg'));
  await esperarRevisao(page);
  const conta = page.locator('[data-revisao="conta"]');
  await expect(conta.locator('input[name="valorDaConta"]')).toHaveValue('480,00');
  await expect(conta.locator('input[name="vencimentoDaConta"]')).toHaveValue('2026-12-05');
  await expect(conta.locator('input[name="nomeDaConta"]')).toHaveValue('Mensalidade');

  await page.getByRole('button', { name: 'Descartar documento' }).click();
  await page.getByRole('button', { name: 'Descartar', exact: true }).click();
  await expect(page).toHaveURL(/\/documentos\?descartado=1$/);
  await expect(page.getByText('Documento descartado. Nada foi gravado.')).toBeVisible();
  const { data: descartado } = await cliente
    .from('documentos')
    .select('status, arquivo_chave')
    .eq('id', primeiro)
    .single();
  expect(descartado).toEqual({ status: 'descartado', arquivo_chave: null });
  const { data: contas } = await cliente.from('contas_avulsas').select('id');
  expect(contas).toEqual([]);

  // O mesmo arquivo de novo: aviso com a data do envio anterior e a opção de enviar de novo.
  await page.locator('input[type=file]').setInputFiles(join(CONJUNTO, '11-boleto-curso.jpg'));
  await page.getByRole('button', { name: 'Enviar e ler' }).click();
  await expect(page.getByText(/Este arquivo já foi enviado em \d{2}\/\d{2}\/\d{4}/)).toBeVisible();
  await page.getByRole('button', { name: 'Enviar de novo' }).click();
  await page.waitForURL(/\/documentos\/[0-9a-f-]{36}$/);
  await esperarRevisao(page);
  expect(page.url()).not.toContain(primeiro);
});

test('arquivo que não dá para ler vai para erro, com ler de novo e lançar à mão', async ({
  page,
}) => {
  await entrarComCadastroNovo(page);
  const pasta = mkdtempSync(join(tmpdir(), 'no-azul-'));
  const quebrado = join(pasta, 'quebrado.pdf');
  writeFileSync(quebrado, 'isto não é um pdf');
  await enviar(page, quebrado);
  await expect(page.getByRole('heading', { name: 'Não consegui ler este documento' })).toBeVisible({
    timeout: TEMPO_DA_LEITURA,
  });
  await expect(page.locator('main').getByRole('alert')).toContainText('Formato não aceito');
  await expect(page.getByRole('link', { name: 'Lançar à mão' })).toHaveAttribute(
    'href',
    '/lancamentos/novo',
  );
  await expect(page.getByRole('button', { name: 'Ler de novo' })).toBeVisible();
  await page.goto('/documentos');
  await expect(page.getByText('Erro na leitura')).toBeVisible();
});
