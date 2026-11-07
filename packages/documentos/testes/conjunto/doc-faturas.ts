// Faturas de cartão (documentos 13 a 18). Empresas, pessoas e números são inventados.
import {
  dataBr,
  diaMes,
  diaMesCurto,
  escolher,
  inteiroEntre,
  reais,
  somarDias,
  sorteio,
} from './apoio.ts';
import { pagina } from './modelos.ts';
import type { DefinicaoDeDocumento, Formato, LancamentoEsperado, Saida } from './tipos.ts';

interface ItemDaFatura {
  /** Data impressa na fatura (a da compra, também nas parcelas). */
  data: string;
  descricao: string;
  /** Positivo para compra e encargo; negativo para pagamento e estorno. */
  valorCentavos: number;
  natureza?: 'compra' | 'pagamento' | 'estorno';
  /** Parcela atual e total, quando a compra é parcelada. */
  parcela?: [number, number];
  cidade?: string;
}

interface DadosDaFatura {
  arquivo: string;
  formato: Formato;
  vencimento: string;
  /** Data de fechamento impressa, ou null quando a fatura não a mostra. */
  fechamento: string | null;
  itens: ItemDaFatura[];
}

function natureza(item: ItemDaFatura): NonNullable<ItemDaFatura['natureza']> {
  return item.natureza ?? 'compra';
}

export function totalDaFatura(itens: readonly ItemDaFatura[]): number {
  return itens
    .filter((item) => natureza(item) !== 'pagamento')
    .reduce((soma, item) => soma + item.valorCentavos, 0);
}

/**
 * O que a leitura deve propor para cada linha (regras da seção 4d do PLANO): o pagamento da
 * fatura anterior é transferência, o estorno é receita, e a parcela de compra antiga leva a data
 * de fechamento (ou de vencimento, sem fechamento impresso).
 */
function lancamentosEsperados(dados: DadosDaFatura): LancamentoEsperado[] {
  return dados.itens.map((item) => {
    const tipo = natureza(item);
    const parcelaAntiga = item.parcela !== undefined && item.parcela[0] > 1;
    return {
      data: parcelaAntiga ? (dados.fechamento ?? dados.vencimento) : item.data,
      valorCentavos: Math.abs(item.valorCentavos),
      tipo: tipo === 'pagamento' ? 'transferencia' : tipo === 'estorno' ? 'receita' : 'despesa',
      descricao: item.descricao,
    };
  });
}

function descricaoImpressa(item: ItemDaFatura, estilo: 'parc' | 'parcela' | 'barra'): string {
  if (!item.parcela) return item.descricao;
  const [atual, total] = item.parcela;
  const doisDigitos = (n: number) => n.toString().padStart(2, '0');
  if (estilo === 'parc')
    return `${item.descricao} PARC ${doisDigitos(atual)}/${doisDigitos(total)}`;
  if (estilo === 'parcela') return `${item.descricao} - PARCELA ${atual} DE ${total}`;
  return `${item.descricao} ${doisDigitos(atual)}/${doisDigitos(total)}`;
}

function definir(
  dados: DadosDaFatura,
  saida: (dados: DadosDaFatura) => Promise<Saida>,
): DefinicaoDeDocumento {
  return {
    gabarito: {
      arquivo: dados.arquivo,
      formato: dados.formato,
      tipo: 'fatura_cartao',
      conta: { valorCentavos: totalDaFatura(dados.itens), vencimento: dados.vencimento },
      lancamentos: lancamentosEsperados(dados),
    },
    saida: () => saida(dados),
  };
}

// ------------------------------------------------------------------------------------------
// Layout A: Banco Aurora (resumo no alto, linhas "dd/mm descrição valor", crédito com sinal)
// ------------------------------------------------------------------------------------------

function layoutAurora(dados: DadosDaFatura, cartao: string, linhasPorPagina: number): string {
  const total = totalDaFatura(dados.itens);
  const pagamentos = dados.itens.filter((i) => natureza(i) !== 'compra');
  const creditos = pagamentos.reduce((s, i) => s + i.valorCentavos, 0);
  const compras = dados.itens
    .filter((i) => natureza(i) === 'compra')
    .reduce((s, i) => s + i.valorCentavos, 0);
  const saldoAnterior = -dados.itens
    .filter((i) => natureza(i) === 'pagamento')
    .reduce((s, i) => s + i.valorCentavos, 0);
  const ordenados = [...dados.itens].sort((a, b) => a.data.localeCompare(b.data));
  const paginas: ItemDaFatura[][] = [];
  for (let i = 0; i < ordenados.length; i += linhasPorPagina)
    paginas.push(ordenados.slice(i, i + linhasPorPagina));

  const linhas = (itens: ItemDaFatura[]) =>
    itens
      .map(
        (item) =>
          `<tr><td style="width:70px">${diaMes(item.data)}</td><td>${descricaoImpressa(item, 'parc')}</td><td class="dir" style="width:110px">${item.valorCentavos < 0 ? '- ' : ''}${reais(Math.abs(item.valorCentavos))}</td></tr>`,
      )
      .join('');

  const resumo = `
    <table><tr>
      <td><span style="font-size:22px;font-weight:bold;color:#0b4f9c">Banco Aurora</span><br>Fatura do cartão de crédito</td>
      <td class="dir">PAULO EXEMPLO DE SOUZA<br>Cartão ${cartao}</td>
    </tr></table>
    <table style="margin:10px 0">
      <tr>
        <td class="caixa"><span class="rotulo">Vencimento</span><b style="font-size:16px">${dataBr(dados.vencimento)}</b></td>
        <td class="caixa"><span class="rotulo">Total da fatura</span><b style="font-size:16px">R$ ${reais(total)}</b></td>
        <td class="caixa"><span class="rotulo">Pagamento mínimo</span>R$ ${reais(Math.round(total * 0.15))}</td>
        ${dados.fechamento ? `<td class="caixa"><span class="rotulo">Fechamento</span>${dataBr(dados.fechamento)}</td>` : ''}
      </tr>
    </table>
    <table style="max-width:420px">
      <tr><td>Saldo anterior</td><td class="dir">${reais(saldoAnterior)}</td></tr>
      <tr><td>(-) Pagamentos e créditos</td><td class="dir">${reais(creditos)}</td></tr>
      <tr><td>(+) Compras e débitos</td><td class="dir">${reais(compras)}</td></tr>
      <tr><td class="forte">(=) Total desta fatura</td><td class="dir forte">${reais(total)}</td></tr>
    </table>
    <p style="font-size:10px">Limite total R$ 8.000,00 · Limite disponível R$ ${reais(800000 - total)} · CET 12,9% a.m.</p>`;

  return pagina(
    paginas
      .map(
        (itens, indice) => `
        <div class="${indice < paginas.length - 1 ? 'quebra' : ''}">
          ${indice === 0 ? resumo : `<p class="forte">Banco Aurora · Cartão ${cartao} · continuação</p>`}
          <h4>Lançamentos</h4>
          <table class="listra"><tr><th>Data</th><th>Descrição</th><th class="dir">Valor (R$)</th></tr>${linhas(itens)}</table>
          <p class="dir" style="font-size:10px">Página ${indice + 1} de ${paginas.length}</p>
        </div>`,
      )
      .join(''),
    { fonte: "'DejaVu Sans', sans-serif", tamanho: 11 },
  );
}

// ------------------------------------------------------------------------------------------
// Layout B: Banco Horizonte (datas "12 OUT", valores com R$, "Vence em")
// ------------------------------------------------------------------------------------------

function layoutHorizonte(dados: DadosDaFatura): string {
  const total = totalDaFatura(dados.itens);
  const linhas = [...dados.itens]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map(
      (item) =>
        `<tr><td style="width:70px">${diaMesCurto(item.data)}</td><td>${descricaoImpressa(item, 'parcela')}</td><td class="dir" style="width:130px">${item.valorCentavos < 0 ? '- ' : ''}R$ ${reais(Math.abs(item.valorCentavos))}</td></tr>`,
    )
    .join('');
  return pagina(
    `<div style="background:#14213d;color:#fff;padding:14px">
       <span style="font-size:22px;font-weight:bold">Horizonte</span> <span>Cartão Gold</span>
       <p>Olá, Paulo! Sua fatura fechou.</p>
     </div>
     <table style="margin:12px 0"><tr>
       <td><span class="rotulo">Total desta fatura</span><span style="font-size:24px;font-weight:bold">R$ ${reais(total)}</span></td>
       <td><span class="rotulo">Vence em</span><b style="font-size:18px">${dataBr(dados.vencimento)}</b></td>
       <td><span class="rotulo">Fatura fechada em</span>${dados.fechamento ? dataBr(dados.fechamento) : ''}</td>
     </tr></table>
     <p>Cartão final 9876 · Titular PAULO E SOUZA</p>
     <h3>Transações</h3>
     <table class="listra"><tr><th>Data</th><th>Descrição</th><th class="dir">Valor</th></tr>${linhas}</table>
     <p style="font-size:10px">Compras internacionais convertidas pelo dólar do dia da compra. IOF de 3,5%.</p>
     <p style="font-size:10px">Pagamento mínimo R$ ${reais(Math.round(total * 0.15))}. Juros do rotativo 13,5% a.m.</p>`,
    { fonte: "'Inter', sans-serif", tamanho: 12 },
  );
}

// ------------------------------------------------------------------------------------------
// Layout C: fatura simples, para digitalizar ou fotografar
// ------------------------------------------------------------------------------------------

function layoutSimples(
  dados: DadosDaFatura,
  banco: string,
  largura: number,
  tamanho: number,
): string {
  const total = totalDaFatura(dados.itens);
  const linhas = [...dados.itens]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map(
      (item) =>
        `<tr><td>${diaMes(item.data)}</td><td>${descricaoImpressa(item, 'barra')}</td><td class="dir">${reais(item.valorCentavos)}</td></tr>`,
    )
    .join('');
  return pagina(
    `<p style="font-size:22px;font-weight:bold">${banco}</p>
     <p>Fatura do cartão · PAULO EXEMPLO DE SOUZA · Cartão **** **** **** 4321</p>
     <table style="margin:8px 0">
       <tr><td class="caixa">Vencimento: <b>${dataBr(dados.vencimento)}</b></td>
       ${dados.fechamento ? `<td class="caixa">Data de fechamento: ${dataBr(dados.fechamento)}</td>` : ''}
       <td class="caixa">Valor total: <b>R$ ${reais(total)}</b></td></tr>
     </table>
     <table class="listra"><tr><th>Data</th><th>Lançamento</th><th class="dir">Valor R$</th></tr>${linhas}</table>
     <p style="margin-top:12px">Total da fatura R$ ${reais(total)}</p>`,
    { largura, tamanho, fonte: "'DejaVu Sans', sans-serif" },
  );
}

// ------------------------------------------------------------------------------------------
// Layout D: fatura longa com cidade e seções (nacionais, internacionais, encargos)
// ------------------------------------------------------------------------------------------

function layoutLongo(dados: DadosDaFatura): string {
  const total = totalDaFatura(dados.itens);
  const secoes: [string, ItemDaFatura[]][] = [
    ['Pagamentos', dados.itens.filter((i) => natureza(i) === 'pagamento')],
    [
      'Lançamentos nacionais',
      dados.itens.filter(
        (i) =>
          natureza(i) === 'compra' &&
          !i.descricao.startsWith('IOF') &&
          i.cidade !== 'EXTERIOR' &&
          !i.descricao.startsWith('JUROS'),
      ),
    ],
    ['Lançamentos internacionais', dados.itens.filter((i) => i.cidade === 'EXTERIOR')],
    [
      'Encargos',
      dados.itens.filter((i) => i.descricao.startsWith('IOF') || i.descricao.startsWith('JUROS')),
    ],
  ];
  const tabela = secoes
    .map(
      ([titulo, itens]) => `
      <h4>${titulo}</h4>
      <table class="listra"><tr><th style="width:60px">Data</th><th>Estabelecimento</th><th style="width:130px">Cidade</th><th class="dir" style="width:100px">Valor R$</th></tr>
      ${[...itens]
        .sort((a, b) => a.data.localeCompare(b.data))
        .map(
          (item) =>
            `<tr><td>${diaMes(item.data)}</td><td>${descricaoImpressa(item, 'parc')}</td><td>${item.cidade ?? ''}</td><td class="dir">${item.valorCentavos < 0 ? '-' : ''}${reais(Math.abs(item.valorCentavos))}</td></tr>`,
        )
        .join('')}
      </table>
      <p class="dir">Subtotal ${reais(itens.reduce((s, i) => s + i.valorCentavos, 0))}</p>`,
    )
    .join('');
  return pagina(
    `<p style="font-size:22px;font-weight:bold;color:#6b2c91">Banco Ponte Digital</p>
     <p>Resumo da fatura de PAULO EXEMPLO DE SOUZA · Cartão 5555 4444 3333 1234</p>
     <table style="max-width:520px">
       <tr><td>Data de vencimento</td><td class="dir forte">${dataBr(dados.vencimento)}</td></tr>
       <tr><td>Data de fechamento</td><td class="dir">${dados.fechamento ? dataBr(dados.fechamento) : ''}</td></tr>
       <tr><td>Melhor dia de compra</td><td class="dir">${dados.fechamento ? dataBr(somarDias(dados.fechamento, 1)) : ''}</td></tr>
       <tr><td class="forte">Valor total a pagar</td><td class="dir forte">R$ ${reais(total)}</td></tr>
     </table>
     ${tabela}
     <p class="forte">Total da fatura: R$ ${reais(total)}</p>`,
    { fonte: "'Carlito', sans-serif", tamanho: 12 },
  );
}

// ------------------------------------------------------------------------------------------
// As seis faturas
// ------------------------------------------------------------------------------------------

const aurora = definir(
  {
    arquivo: '13-fatura-aurora.pdf',
    formato: 'pdf_texto',
    vencimento: '2026-11-20',
    fechamento: '2026-11-10',
    itens: [
      {
        data: '2026-10-20',
        descricao: 'PAGAMENTO RECEBIDO - OBRIGADO',
        valorCentavos: -152040,
        natureza: 'pagamento',
      },
      { data: '2026-10-11', descricao: 'MERCADO BOM PRECO', valorCentavos: 28790 },
      { data: '2026-10-13', descricao: 'POSTO ESTRELA', valorCentavos: 18000 },
      { data: '2026-10-15', descricao: 'IFOOD *RESTAURANTE SABOR', valorCentavos: 5490 },
      { data: '2026-10-16', descricao: 'UBER *TRIP', valorCentavos: 2345 },
      { data: '2026-10-18', descricao: 'NETFLIX.COM', valorCentavos: 3990 },
      { data: '2026-08-20', descricao: 'LOJA MODA VIVA', valorCentavos: 12000, parcela: [3, 10] },
      { data: '2026-10-22', descricao: 'FARMACIA VIDA', valorCentavos: 6780 },
      {
        data: '2026-10-25',
        descricao: 'ESTORNO LOJA MODA VIVA',
        valorCentavos: -4500,
        natureza: 'estorno',
      },
      { data: '2026-10-28', descricao: 'CINEMA CENTRAL', valorCentavos: 6400 },
      { data: '2026-11-01', descricao: 'PADARIA PAO QUENTE', valorCentavos: 1875 },
      { data: '2026-11-03', descricao: 'IFOOD *PIZZARIA BELLA', valorCentavos: 7990 },
      { data: '2026-11-05', descricao: 'UBER *TRIP', valorCentavos: 3120 },
      { data: '2026-11-07', descricao: 'MARKETPLACE CASA FACIL', valorCentavos: 14990 },
      { data: '2026-11-08', descricao: 'ANUIDADE CARTAO', valorCentavos: 3500 },
    ],
  },
  async (dados) => ({ como: 'pdf', html: layoutAurora(dados, '5555 **** **** 1234', 8) }),
);

const horizonte = definir(
  {
    arquivo: '14-fatura-horizonte.pdf',
    formato: 'pdf_texto',
    vencimento: '2026-11-15',
    fechamento: '2026-11-05',
    itens: [
      {
        data: '2026-10-07',
        descricao: 'PAGAMENTO EFETUADO',
        valorCentavos: -98750,
        natureza: 'pagamento',
      },
      { data: '2026-10-06', descricao: 'SUPERMERCADO ECONOMIA', valorCentavos: 21340 },
      { data: '2026-10-09', descricao: 'DROGARIA BEM ESTAR', valorCentavos: 3890 },
      { data: '2026-10-12', descricao: 'RESTAURANTE SABOR CASEIRO', valorCentavos: 8650 },
      {
        data: '2026-07-14',
        descricao: 'LOJA TECH NOTEBOOK',
        valorCentavos: 41650,
        parcela: [4, 6],
      },
      { data: '2026-10-15', descricao: 'SPOTIFY USD 5,99', valorCentavos: 3250 },
      { data: '2026-10-15', descricao: 'IOF TRANSACAO EXTERIOR', valorCentavos: 114 },
      { data: '2026-10-18', descricao: 'POSTO AVENIDA', valorCentavos: 15000 },
      { data: '2026-10-21', descricao: 'LIVRARIA PAGINA', valorCentavos: 7490 },
      { data: '2026-10-24', descricao: 'APP TRANSPORTE', valorCentavos: 2780 },
      { data: '2026-10-27', descricao: 'PET SHOP AMIGO', valorCentavos: 12900 },
      { data: '2026-10-30', descricao: 'SUPERMERCADO ECONOMIA', valorCentavos: 18765 },
      { data: '2026-11-02', descricao: 'STREAMING VIDEO PLUS', valorCentavos: 2990 },
      { data: '2026-11-04', descricao: 'PADARIA DOCE MANHA', valorCentavos: 2240 },
    ],
  },
  async (dados) => ({ como: 'pdf', html: layoutHorizonte(dados) }),
);

const ponteDigitalizada = definir(
  {
    arquivo: '15-fatura-ponte-digitalizada.pdf',
    formato: 'pdf_digitalizado',
    vencimento: '2026-11-12',
    fechamento: null,
    itens: [
      { data: '2026-10-02', descricao: 'MERCADO BOM PRECO', valorCentavos: 15680 },
      { data: '2026-10-05', descricao: 'POSTO ESTRELA', valorCentavos: 12000 },
      {
        data: '2026-09-09',
        descricao: 'LOJA DE MOVEIS LAR',
        valorCentavos: 30000,
        parcela: [2, 5],
      },
      { data: '2026-10-14', descricao: 'RESTAURANTE PRATO FEITO', valorCentavos: 4590 },
      { data: '2026-10-19', descricao: 'FARMACIA VIDA', valorCentavos: 2899 },
      { data: '2026-10-23', descricao: 'CINEMA CENTRAL', valorCentavos: 5200 },
      { data: '2026-10-27', descricao: 'UBER *TRIP', valorCentavos: 1870 },
      { data: '2026-10-30', descricao: 'ACADEMIA MOVIMENTO', valorCentavos: 8990 },
    ],
  },
  async (dados) => ({
    como: 'digitalizado',
    largura: 794,
    semente: 15,
    html: layoutSimples(dados, 'Banco Ponte Digital', 794, 15),
  }),
);

const valeVerdeFoto = definir(
  {
    arquivo: '16-fatura-vale-verde-foto.jpg',
    formato: 'foto',
    vencimento: '2026-11-07',
    fechamento: '2026-10-28',
    itens: [
      {
        data: '2026-10-01',
        descricao: 'PAGAMENTO FATURA',
        valorCentavos: -64320,
        natureza: 'pagamento',
      },
      { data: '2026-10-03', descricao: 'HORTIFRUTI VERDE', valorCentavos: 4570 },
      { data: '2026-10-08', descricao: 'POSTO ESTRELA', valorCentavos: 9000 },
      { data: '2026-10-12', descricao: 'IFOOD *LANCHES', valorCentavos: 3890 },
      { data: '2026-10-17', descricao: 'MERCADO BOM PRECO', valorCentavos: 22130 },
      { data: '2026-10-24', descricao: 'BARBEARIA CLASSICA', valorCentavos: 4500 },
      { data: '2026-10-26', descricao: 'PAPELARIA CRIATIVA', valorCentavos: 2765 },
    ],
  },
  async (dados) => ({
    como: 'foto',
    largura: 760,
    ajustes: {
      angulo: -2,
      desfoque: 0.6,
      brilho: 0.93,
      qualidade: 76,
      ruido: 0.28,
      fundo: '#7b6f60',
      semente: 16,
    },
    html: layoutSimples(dados, 'Cooperativa Vale Verde', 760, 17),
  }),
);

const viradaDeAno = definir(
  {
    arquivo: '17-fatura-virada-de-ano.pdf',
    formato: 'pdf_texto',
    vencimento: '2026-01-10',
    fechamento: '2025-12-31',
    itens: [
      {
        data: '2025-12-01',
        descricao: 'PAGAMENTO RECEBIDO - OBRIGADO',
        valorCentavos: -210000,
        natureza: 'pagamento',
      },
      { data: '2025-12-02', descricao: 'MERCADO BOM PRECO', valorCentavos: 31250 },
      { data: '2025-12-05', descricao: 'LOJA DE BRINQUEDOS ALEGRIA', valorCentavos: 18990 },
      { data: '2025-12-08', descricao: 'POSTO ESTRELA', valorCentavos: 20000 },
      { data: '2025-12-12', descricao: 'PERFUMARIA AROMA', valorCentavos: 25900 },
      { data: '2025-12-15', descricao: 'HOTEL PRAIA SERENA', valorCentavos: 96000 },
      { data: '2025-12-18', descricao: 'RESTAURANTE MAR AZUL', valorCentavos: 23480 },
      { data: '2025-12-20', descricao: 'MARKETPLACE CASA FACIL', valorCentavos: 8970 },
      { data: '2025-12-23', descricao: 'SUPERMERCADO ECONOMIA', valorCentavos: 44560 },
      { data: '2025-12-27', descricao: 'UBER *TRIP', valorCentavos: 4250 },
      { data: '2025-12-29', descricao: 'IFOOD *RESTAURANTE SABOR', valorCentavos: 6790 },
    ],
  },
  async (dados) => ({ como: 'pdf', html: layoutAurora(dados, '5555 **** **** 7788', 20) }),
);

function itensDaFaturaLonga(): ItemDaFatura[] {
  const aleatorio = sorteio(18);
  const lojas: [string, number, number][] = [
    ['MERCADO BOM PRECO', 4000, 32000],
    ['SUPERMERCADO ECONOMIA', 3000, 28000],
    ['PADARIA PAO QUENTE', 900, 4500],
    ['POSTO ESTRELA', 8000, 22000],
    ['IFOOD *RESTAURANTE SABOR', 3500, 9500],
    ['UBER *TRIP', 1200, 5200],
    ['FARMACIA VIDA', 1500, 14000],
    ['LIVRARIA PAGINA', 3000, 12000],
    ['CINEMA CENTRAL', 2800, 9000],
    ['PET SHOP AMIGO', 4000, 18000],
    ['HORTIFRUTI VERDE', 1500, 7000],
    ['LOJA MODA VIVA', 6000, 30000],
  ];
  const itens: ItemDaFatura[] = [
    {
      data: '2026-10-05',
      descricao: 'PAGAMENTO RECEBIDO',
      valorCentavos: -287415,
      natureza: 'pagamento',
      cidade: '',
    },
  ];
  for (let i = 0; i < 34; i++) {
    const [descricao, minimo, maximo] = escolher(aleatorio, lojas);
    itens.push({
      data: somarDias('2026-10-04', inteiroEntre(aleatorio, 0, 29)),
      descricao,
      valorCentavos: inteiroEntre(aleatorio, minimo, maximo),
      cidade: escolher(aleatorio, ['CIDADE EXEMPLO', 'VILA FICTICIA', 'SAO EXEMPLO']),
    });
  }
  itens.push(
    {
      data: '2026-06-18',
      descricao: 'ELETRO CASA GELADEIRA',
      valorCentavos: 35990,
      parcela: [5, 10],
      cidade: 'CIDADE EXEMPLO',
    },
    {
      data: '2026-10-21',
      descricao: 'ACADEMIA MOVIMENTO',
      valorCentavos: 8990,
      parcela: [1, 3],
      cidade: 'CIDADE EXEMPLO',
    },
    {
      data: '2026-10-12',
      descricao: 'APP STORE ASSINATURA',
      valorCentavos: 2790,
      cidade: 'EXTERIOR',
    },
    { data: '2026-10-12', descricao: 'IOF COMPRA INTERNACIONAL', valorCentavos: 98, cidade: '' },
    {
      data: '2026-10-26',
      descricao: 'LOJA ONLINE GLOBAL',
      valorCentavos: 15430,
      cidade: 'EXTERIOR',
    },
    { data: '2026-10-26', descricao: 'IOF COMPRA INTERNACIONAL', valorCentavos: 540, cidade: '' },
  );
  return itens;
}

const longa = definir(
  {
    arquivo: '18-fatura-longa.pdf',
    formato: 'pdf_texto',
    vencimento: '2026-11-13',
    fechamento: '2026-11-03',
    itens: itensDaFaturaLonga(),
  },
  async (dados) => ({ como: 'pdf', html: layoutLongo(dados) }),
);

export const faturas = [aurora, horizonte, ponteDigitalizada, valeVerdeFoto, viradaDeAno, longa];
