import { expect, test, type Page } from '@playwright/test';
import {
  agendaDeReservas,
  comparacao503020,
  inicioDaSemana,
  projecaoDeMeses,
  resumoDaSemana,
  semanaPassada,
  somarDias,
} from '@no-azul/motor';
import { carregarDadosFinanceiros } from '../src/lib/financeiro/carregar';
import { formatarReais } from '../src/lib/formatacao';
import { entrarComCadastroNovo, hojeEmBrasilia } from './apoio';
import { clienteDaPessoa, montarCenarioDoPainel, type ClienteDoTeste } from './cenario-painel';
import {
  esperadosDaSemanaFutura,
  esperadosDaSemanaPassada,
  esperadosDoPainel,
  esperadosDoPlanejamento,
  type Esperados,
} from './painel-esperado';

/** Todos os números marcados na área principal da tela, na ordem em que aparecem. */
async function numerosDaTela(page: Page): Promise<{ chave: string; texto: string }[]> {
  return page.locator('main [data-valor], main [data-numero]').evaluateAll((elementos) =>
    elementos.map((elemento) => ({
      chave: elemento.getAttribute('data-valor') ?? elemento.getAttribute('data-numero')!,
      texto: (elemento.textContent ?? '').trim(),
    })),
  );
}

/** Trechos com "R$" fora de um número marcado: valores que o teste não conferiria. */
async function reaisSemConferencia(page: Page): Promise<string[]> {
  return page.locator('main').evaluate((main) => {
    const soltos: string[] = [];
    const percurso = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    for (let no = percurso.nextNode(); no; no = percurso.nextNode()) {
      const texto = no.textContent ?? '';
      if (!texto.includes('R$')) continue;
      if (no.parentElement?.closest('[data-valor], [data-aviso]')) continue;
      soltos.push(texto.trim());
    }
    return soltos;
  });
}

/** Confere a tela com o motor: cada número, o conjunto de chaves e nenhum "R$" solto. */
async function conferir(page: Page, esperados: Esperados) {
  const naTela = await numerosDaTela(page);
  for (const { chave, texto } of naTela) {
    expect.soft(texto, `número "${chave}"`).toBe(esperados.get(chave));
  }
  expect(new Set(naTela.map((n) => n.chave))).toEqual(new Set(esperados.keys()));
  expect(await reaisSemConferencia(page)).toEqual([]);
  // A tela cabe na largura do aparelho, sem rolagem lateral.
  const larguras = await page.evaluate(() => ({
    conteudo: document.documentElement.scrollWidth,
    tela: document.documentElement.clientWidth,
  }));
  expect(larguras.conteudo).toBeLessThanOrEqual(larguras.tela);
}

async function prepararCenario(page: Page): Promise<{ cliente: ClienteDoTeste; hoje: string }> {
  const { email, senha } = await entrarComCadastroNovo(page);
  const hoje = hojeEmBrasilia().iso;
  const cliente = await clienteDaPessoa(email, senha);
  await montarCenarioDoPainel(cliente, hoje);
  return { cliente, hoje };
}

test('todo número do painel confere com o motor (aceite da Etapa 4)', async ({ page }) => {
  const { cliente, hoje } = await prepararCenario(page);
  const resumo = resumoDaSemana(await carregarDadosFinanceiros(cliente), hoje);

  await page.goto('/painel');
  await expect(page.locator('[data-bloco="reserva"]')).toBeVisible();
  // O cenário liga os alertas de conta vencida e de meta sem verba completa.
  await expect(page.locator('[data-alerta="conta_vencida"]')).toContainText('Multa de trânsito');
  await expect(page.locator('[data-alerta="meta_sem_verba"]')).toBeVisible();

  const esperados = esperadosDoPainel(resumo);
  // Garante que o cenário cobre todos os blocos do painel.
  for (const prefixo of [
    'reserva.',
    'alerta.',
    'gastos.',
    'conta.',
    'meta.',
    'saude.',
    'divisao.',
  ]) {
    expect(
      [...esperados.keys()].some((chave) => chave.startsWith(prefixo)),
      prefixo,
    ).toBe(true);
  }
  await conferir(page, esperados);
});

test('semanas passadas mostram o que aconteceu, e as futuras, a agenda', async ({ page }) => {
  const { cliente, hoje } = await prepararCenario(page);
  const dados = await carregarDadosFinanceiros(cliente);

  await page.goto('/painel');
  await page.getByRole('link', { name: '← Anterior' }).click();
  const anterior = somarDias(inicioDaSemana(hoje), -7);
  await expect(page).toHaveURL(new RegExp(`semana=${anterior}`));
  await expect(page.getByText('Já passou: o que aconteceu')).toBeVisible();
  await conferir(page, esperadosDaSemanaPassada(semanaPassada(dados, anterior)));
  // O aporte de 7 dias atrás na viagem aparece na semana anterior.
  await expect(page.locator('#guardado')).toContainText('Viagem');

  await page.getByRole('link', { name: 'Esta semana' }).click();
  await expect(page).toHaveURL(/\/painel$/);
  await page.getByRole('link', { name: 'Próxima →' }).click();
  const proxima = somarDias(inicioDaSemana(hoje), 7);
  await expect(page).toHaveURL(new RegExp(`semana=${proxima}`));
  await expect(page.getByText('Previsão da agenda')).toBeVisible();
  const agenda = agendaDeReservas(dados, hoje);
  await conferir(page, esperadosDaSemanaFutura(agenda[1]!));

  // A navegação para na última semana da agenda.
  await page.goto(`/painel?semana=${somarDias(hoje, 365)}`);
  await expect(page.locator(`[data-semana="${agenda[7]!.inicio}"]`)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Próxima →' })).toHaveCount(0);
});

test('o planejamento confere com o motor, e o teto muda o painel', async ({ page }) => {
  const { cliente, hoje } = await prepararCenario(page);
  let dados = await carregarDadosFinanceiros(cliente);

  await page.getByRole('link', { name: 'Planejamento' }).first().click();
  await expect(page.getByRole('heading', { name: 'Planejamento', level: 1 })).toBeVisible();
  await expect(page.getByText('não substitui consultoria financeira')).toBeVisible();
  await conferir(
    page,
    esperadosDoPlanejamento(
      null,
      agendaDeReservas(dados, hoje),
      projecaoDeMeses(dados, hoje),
      comparacao503020(dados, hoje),
    ),
  );

  // Define um teto de R$ 1.500: estimativa, limite e plano das metas passam a usá-lo.
  await page.getByRole('button', { name: 'Definir teto' }).click();
  await page.getByLabel('Teto por mês (R$)').fill('1.500,00');
  await page.getByRole('button', { name: 'Salvar teto' }).click();
  await expect(page.locator('[data-valor="teto"]')).toHaveText('R$ 1.500,00');
  dados = await carregarDadosFinanceiros(cliente);
  expect(dados.perfil.tetoVariavelCentavos).toBe(150_000);
  await conferir(
    page,
    esperadosDoPlanejamento(
      150_000,
      agendaDeReservas(dados, hoje),
      projecaoDeMeses(dados, hoje),
      comparacao503020(dados, hoje),
    ),
  );
  await page.goto('/painel');
  await conferir(page, esperadosDoPainel(resumoDaSemana(dados, hoje)));

  await page.goto('/planejamento');
  await page.getByRole('button', { name: 'Remover teto' }).click();
  await page.getByRole('button', { name: 'Remover', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Definir teto' })).toBeVisible();
  expect((await carregarDadosFinanceiros(cliente)).perfil.tetoVariavelCentavos).toBeNull();
});

test('registrar a reserva da semana pelo painel completa o valor pedido', async ({ page }) => {
  const { cliente, hoje } = await prepararCenario(page);
  const antes = resumoDaSemana(await carregarDadosFinanceiros(cliente), hoje);
  expect(antes.faltaGuardarNaSemanaCentavos).toBeGreaterThan(0);

  await page.goto('/painel');
  const reserva = page.locator('[data-bloco="reserva"]');
  await reserva.getByRole('button', { name: 'Registrar reserva' }).click();
  await expect(reserva.getByLabel('Reserva de contas (R$)')).not.toHaveValue('');
  await reserva.getByRole('button', { name: 'Guardar' }).click();
  await expect(reserva.getByText('Reserva registrada.')).toBeVisible();
  await expect(reserva).toContainText('reserva da semana completa');

  const depois = resumoDaSemana(await carregarDadosFinanceiros(cliente), hoje);
  // O valor pedido não muda depois de registrar a reserva (D3).
  expect(depois.totalAReservarCentavos).toBe(antes.totalAReservarCentavos);
  expect(depois.faltaGuardarNaSemanaCentavos).toBe(0);
  expect(depois.guardadoNaSemanaCentavos).toBe(
    antes.guardadoNaSemanaCentavos + antes.faltaGuardarNaSemanaCentavos,
  );
  await expect(reserva.locator('[data-valor="reserva.guardado"]')).toHaveText(
    formatarReais(depois.guardadoNaSemanaCentavos),
  );
  await conferir(page, esperadosDoPainel(depois));
});

test('cadastrar uma conta que muda o valor da semana mostra o motivo uma vez (D3)', async ({
  page,
}) => {
  const { cliente, hoje } = await prepararCenario(page);
  const antes = resumoDaSemana(await carregarDadosFinanceiros(cliente), hoje);

  await page.goto('/contas/avulsas/nova');
  await page.getByLabel('Nome').fill('Conserto do carro');
  await page.getByLabel('Valor (R$)').fill('1.200,00');
  await page.getByLabel('Vencimento').fill(somarDias(hoje, 2));
  await page.getByRole('button', { name: 'Cadastrar' }).click();
  await expect(page).toHaveURL(/\/contas$/);

  const depois = resumoDaSemana(await carregarDadosFinanceiros(cliente), hoje);
  expect(depois.reservaDeContas.valorSemanalCentavos).not.toBe(
    antes.reservaDeContas.valorSemanalCentavos,
  );
  const aviso = page.locator('[data-aviso="reserva"]');
  await expect(aviso).toContainText(
    `mudou de ${formatarReais(antes.reservaDeContas.valorSemanalCentavos)} para ${formatarReais(depois.reservaDeContas.valorSemanalCentavos)}`,
  );
  await expect(aviso).toContainText('Entrou Conserto do carro: R$ 1.200,00');

  await page.reload();
  await expect(page.locator('[data-aviso="reserva"]')).toHaveCount(0);
});
