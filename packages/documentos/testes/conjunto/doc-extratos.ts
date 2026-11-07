// Extratos bancários (documentos 19 a 25). Empresas, pessoas e números são inventados.
import {
  dataBr,
  escolher,
  inteiroEntre,
  reais,
  reaisComPonto,
  somarDias,
  sorteio,
} from './apoio.ts';
import { pagina } from './modelos.ts';
import type { DefinicaoDeDocumento, Formato, LancamentoEsperado, Saida } from './tipos.ts';

interface Movimento {
  data: string;
  descricao: string;
  /** Positivo para entrada, negativo para saída. */
  valorCentavos: number;
  tipo: LancamentoEsperado['tipo'];
}

type Modelo = [
  descricao: string,
  minimo: number,
  maximo: number,
  tipo: Movimento['tipo'],
  sinal: 1 | -1,
];

const SAIDAS: Modelo[] = [
  ['COMPRA CARTAO DEB MERCADO BOM PRECO', 3000, 35000, 'despesa', -1],
  ['COMPRA CARTAO DEB PADARIA PAO QUENTE', 800, 4500, 'despesa', -1],
  ['COMPRA CARTAO DEB POSTO ESTRELA', 8000, 25000, 'despesa', -1],
  ['PIX ENVIADO MARIA FICTICIA DA SILVA', 2000, 30000, 'despesa', -1],
  ['PIX ENVIADO JOAO EXEMPLO', 1000, 15000, 'despesa', -1],
  ['PAGTO BOLETO FIBRANET INTERNET', 11990, 11990, 'despesa', -1],
  ['DEB AUTOMATICO ENERGIA SERRA AZUL', 15000, 22000, 'despesa', -1],
  ['TARIFA PACOTE DE SERVICOS', 3290, 3290, 'despesa', -1],
  ['SAQUE 24H', 5000, 30000, 'despesa', -1],
  ['APLICACAO AUTOMATICA', 20000, 100000, 'transferencia', -1],
  ['COMPRA CARTAO DEB FARMACIA VIDA', 1500, 12000, 'despesa', -1],
  ['UBER DO BRASIL', 1200, 4500, 'despesa', -1],
  ['PIX ENVIADO 123.456.789-09 CARLOS FICTICIO', 5000, 25000, 'despesa', -1],
];

const ENTRADAS: Modelo[] = [
  ['PIX RECEBIDO CLIENTE ALFA DESIGN', 30000, 150000, 'receita', 1],
  ['PIX RECEBIDO JOAO EXEMPLO', 2000, 10000, 'receita', 1],
  ['RESGATE AUTOMATICO', 10000, 80000, 'transferencia', 1],
  ['RENDIMENTO POUPANCA', 100, 2000, 'receita', 1],
];

/** Movimentos de um mês, em ordem de data, com o salário no 5º dia útil. */
function movimentosDoMes(
  semente: number,
  quantidade: number,
  inicio: string,
  acentos = false,
): Movimento[] {
  const aleatorio = sorteio(semente);
  const movimentos: Movimento[] = [];
  for (let i = 0; i < quantidade - 1; i++) {
    const [descricao, minimo, maximo, tipo, sinal] =
      aleatorio() < 0.78 ? escolher(aleatorio, SAIDAS) : escolher(aleatorio, ENTRADAS);
    const valor =
      descricao === 'SAQUE 24H'
        ? inteiroEntre(aleatorio, 1, 6) * 5000
        : inteiroEntre(aleatorio, minimo, maximo);
    movimentos.push({
      data: somarDias(inicio, inteiroEntre(aleatorio, 0, 29)),
      descricao: acentos ? comAcentos(descricao) : descricao,
      valorCentavos: sinal * valor,
      tipo,
    });
  }
  movimentos.push({
    data: somarDias(inicio, 4),
    descricao: acentos ? 'TED RECEBIDA ESTÚDIO TRAÇO FINO' : 'TED RECEBIDA ESTUDIO TRACO FINO',
    valorCentavos: 487632,
    tipo: 'receita',
  });
  return movimentos.sort(
    (a, b) => a.data.localeCompare(b.data) || a.descricao.localeCompare(b.descricao),
  );
}

function comAcentos(descricao: string): string {
  return descricao
    .replace('CARTAO', 'CARTÃO')
    .replace('DEB ', 'DÉB ')
    .replace('PRECO', 'PREÇO')
    .replace('PAO', 'PÃO')
    .replace('FARMACIA', 'FARMÁCIA')
    .replace('FICTICIA', 'FICTÍCIA')
    .replace('APLICACAO', 'APLICAÇÃO')
    .replace('POUPANCA', 'POUPANÇA')
    .replace('SERVICOS', 'SERVIÇOS');
}

function esperados(movimentos: readonly Movimento[]): LancamentoEsperado[] {
  return movimentos.map((m) => ({
    data: m.data,
    valorCentavos: Math.abs(m.valorCentavos),
    tipo: m.tipo,
    descricao: m.descricao,
  }));
}

function definir(
  arquivo: string,
  formato: Formato,
  movimentos: Movimento[],
  saida: (movimentos: Movimento[]) => Promise<Saida>,
): DefinicaoDeDocumento {
  return {
    gabarito: {
      arquivo,
      formato,
      tipo: 'extrato',
      conta: null,
      lancamentos: esperados(movimentos),
    },
    saida: () => saida(movimentos),
  };
}

function comSaldo(movimentos: readonly Movimento[], saldoInicial: number): [Movimento, number][] {
  let saldo = saldoInicial;
  return movimentos.map((m) => {
    saldo += m.valorCentavos;
    return [m, saldo];
  });
}

const ofxData = (data: string) => `${data.replaceAll('-', '')}120000[-3:BRT]`;

// 19: OFX 1.0 (SGML), como os bancos costumam exportar
const ofxAurora = definir(
  '19-extrato-aurora.ofx',
  'ofx',
  movimentosDoMes(19, 20, '2026-10-01'),
  async (movimentos) => {
    const transacoes = movimentos
      .map(
        (m, i) => `<STMTTRN>
<TRNTYPE>${m.valorCentavos < 0 ? 'DEBIT' : 'CREDIT'}
<DTPOSTED>${ofxData(m.data)}
<TRNAMT>${reaisComPonto(m.valorCentavos)}
<FITID>2026100${i.toString().padStart(3, '0')}
<CHECKNUM>${(1000 + i).toString()}
<MEMO>${m.descricao}
</STMTTRN>`,
      )
      .join('\n');
    const texto = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>20261101090000[-3:BRT]
<LANGUAGE>POR
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1001
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>0999
<ACCTID>12345-6
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20261001000000[-3:BRT]
<DTEND>20261031235959[-3:BRT]
${transacoes}
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>3456.78
<DTASOF>20261031235959[-3:BRT]
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`;
    return { como: 'arquivo', conteudo: Buffer.from(texto.replaceAll('\n', '\r\n'), 'latin1') };
  },
);

// 20: OFX 2 (XML)
const ofxHorizonte = definir(
  '20-extrato-horizonte.ofx',
  'ofx',
  movimentosDoMes(20, 12, '2026-10-01'),
  async (movimentos) => {
    const transacoes = movimentos
      .map(
        (m, i) =>
          `      <STMTTRN><TRNTYPE>${m.valorCentavos < 0 ? 'PAYMENT' : 'DEP'}</TRNTYPE><DTPOSTED>${m.data.replaceAll('-', '')}</DTPOSTED><TRNAMT>${reaisComPonto(m.valorCentavos)}</TRNAMT><FITID>H${i}</FITID><NAME>${m.descricao.slice(0, 32)}</NAME><MEMO>${m.descricao}</MEMO></STMTTRN>`,
      )
      .join('\n');
    const texto = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<?OFX OFXHEADER="200" VERSION="211" SECURITY="NONE" OLDFILEUID="NONE" NEWFILEUID="NONE"?>
<OFX>
  <SIGNONMSGSRSV1><SONRS><STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS><DTSERVER>20261102</DTSERVER><LANGUAGE>POR</LANGUAGE></SONRS></SIGNONMSGSRSV1>
  <BANKMSGSRSV1><STMTTRNRS><TRNUID>0</TRNUID><STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>
    <STMTRS><CURDEF>BRL</CURDEF>
      <BANKACCTFROM><BANKID>998</BANKID><BRANCHID>4321</BRANCHID><ACCTID>987654</ACCTID><ACCTTYPE>CHECKING</ACCTTYPE></BANKACCTFROM>
      <BANKTRANLIST><DTSTART>20261001</DTSTART><DTEND>20261031</DTEND>
${transacoes}
      </BANKTRANLIST>
      <LEDGERBAL><BALAMT>1200.00</BALAMT><DTASOF>20261031</DTASOF></LEDGERBAL>
    </STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>
`;
    return { como: 'arquivo', conteudo: Buffer.from(texto, 'utf8') };
  },
);

// 21: CSV com ponto e vírgula, vírgula decimal e acentuação do Windows (latin1)
const csvValeVerde = definir(
  '21-extrato-vale-verde.csv',
  'csv',
  movimentosDoMes(21, 20, '2026-10-01', true),
  async (movimentos) => {
    const linhas = [
      'Data;Histórico;Documento;Valor;Saldo',
      `01/10/2026;SALDO ANTERIOR;;;${reais(254380)}`,
      ...comSaldo(movimentos, 254380).map(
        ([m, saldo], i) =>
          `${dataBr(m.data)};${m.descricao};${(500100 + i).toString()};${reais(m.valorCentavos)};${reais(saldo)}`,
      ),
    ];
    return { como: 'arquivo', conteudo: Buffer.from(`${linhas.join('\r\n')}\r\n`, 'latin1') };
  },
);

// 22: CSV com vírgula, ponto decimal, colunas de débito e crédito e datas ISO
const csvPonte = definir(
  '22-extrato-ponte.csv',
  'csv',
  movimentosDoMes(22, 15, '2026-10-01'),
  async (movimentos) => {
    const linhas = [
      'Data,Descrição,Débito,Crédito,Saldo',
      ...comSaldo(movimentos, 98000).map(([m, saldo]) => {
        const descricao = m.descricao.includes('MERCADO')
          ? `"${m.descricao}, LOJA 2"`
          : m.descricao;
        const debito = m.valorCentavos < 0 ? reaisComPonto(-m.valorCentavos) : '';
        const credito = m.valorCentavos > 0 ? reaisComPonto(m.valorCentavos) : '';
        return `${m.data},${descricao},${debito},${credito},${reaisComPonto(saldo)}`;
      }),
    ];
    return { como: 'arquivo', conteudo: Buffer.from(`\uFEFF${linhas.join('\n')}\n`, 'utf8') };
  },
);

// 23: XLSX com título acima da tabela
const xlsxPonte = definir(
  '23-extrato-ponte.xlsx',
  'xlsx',
  movimentosDoMes(23, 15, '2026-10-01'),
  async (movimentos) => ({
    como: 'xlsx',
    larguras: [12, 46, 14, 14],
    linhas: [
      ['Banco Ponte Digital - Extrato de conta corrente', null, null, null],
      ['Cliente: PAULO EXEMPLO DE SOUZA', null, null, null],
      ['Período: 01/10/2026 a 31/10/2026', null, null, null],
      [null, null, null, null],
      ['Data', 'Lançamento', 'Valor (R$)', 'Saldo (R$)'],
      ...comSaldo(movimentos, 150000).map(([m, saldo]): (string | number | Date | null)[] => {
        const [ano, mes, dia] = m.data.split('-').map(Number) as [number, number, number];
        return [
          new Date(Date.UTC(ano, mes - 1, dia)),
          m.descricao,
          m.valorCentavos / 100,
          saldo / 100,
        ];
      }),
      [null, null, null, null],
      ['Saldo final', null, null, null],
    ],
  }),
);

// 24: PDF com D/C e linhas de saldo do dia
const pdfHorizonte = definir(
  '24-extrato-horizonte.pdf',
  'pdf_texto',
  movimentosDoMes(24, 18, '2026-10-01'),
  async (movimentos) => {
    const linhas: string[] = [];
    let ultimoDia = '';
    const saldos = comSaldo(movimentos, 312050);
    saldos.forEach(([m, saldo], i) => {
      linhas.push(
        `<tr><td>${dataBr(m.data)}</td><td>${m.descricao}</td><td class="dir">${reais(Math.abs(m.valorCentavos))} ${m.valorCentavos < 0 ? 'D' : 'C'}</td><td></td></tr>`,
      );
      const proximo = saldos[i + 1];
      if (!proximo || proximo[0].data !== m.data) {
        linhas.push(
          `<tr><td></td><td class="forte">SALDO DO DIA</td><td></td><td class="dir">${reais(Math.abs(saldo))} ${saldo < 0 ? 'D' : 'C'}</td></tr>`,
        );
      }
      ultimoDia = m.data;
    });
    return {
      como: 'pdf',
      html: pagina(
        `<p style="font-size:20px;font-weight:bold">Banco Horizonte S.A.</p>
         <p>Extrato de conta corrente · Agência 4321 · Conta 98765-4 · PAULO EXEMPLO DE SOUZA</p>
         <p>Período: 01/10/2026 a ${dataBr(ultimoDia)} · Emitido em 02/11/2026 às 08:15</p>
         <table class="listra">
           <tr><th>Data</th><th>Histórico</th><th class="dir">Valor (R$)</th><th class="dir">Saldo (R$)</th></tr>
           <tr><td>30/09/2026</td><td class="forte">SALDO ANTERIOR</td><td></td><td class="dir">${reais(312050)} C</td></tr>
           ${linhas.join('')}
         </table>
         <p style="font-size:10px">Os lançamentos do dia podem ser alterados até o fechamento. Central 0800 000 3333.</p>`,
        { fonte: "'DejaVu Sans', sans-serif", tamanho: 11 },
      ),
    };
  },
);

// 25: PDF longo, com "R$" em cada valor e o cabeçalho repetido em cada página
const pdfLongo = definir(
  '25-extrato-aurora-longo.pdf',
  'pdf_texto',
  [...movimentosDoMes(251, 30, '2026-09-01'), ...movimentosDoMes(252, 30, '2026-10-01')],
  async (movimentos) => {
    const saldos = comSaldo(movimentos, 120000);
    const paginas: [Movimento, number][][] = [];
    for (let i = 0; i < saldos.length; i += 25) paginas.push(saldos.slice(i, i + 25));
    const corpo = paginas
      .map(
        (linhas, indice) => `
        <div class="${indice < paginas.length - 1 ? 'quebra' : ''}">
          <p><b style="font-size:18px;color:#0b4f9c">Banco Aurora</b> · Extrato de 01/09/2026 a 31/10/2026 · Página ${indice + 1}/${paginas.length}</p>
          <table class="listra">
            <tr><th>Data</th><th>Descrição</th><th class="dir">Valor</th><th class="dir">Saldo</th></tr>
            ${linhas
              .map(
                ([m, saldo]) =>
                  `<tr><td>${dataBr(m.data)}</td><td>${m.descricao}</td><td class="dir">${m.valorCentavos < 0 ? '-' : ''}R$ ${reais(Math.abs(m.valorCentavos))}</td><td class="dir">R$ ${reais(saldo)}</td></tr>`,
              )
              .join('')}
          </table>
        </div>`,
      )
      .join('');
    return { como: 'pdf', html: pagina(corpo, { fonte: "'Inter', sans-serif", tamanho: 10 }) };
  },
);

export const extratos = [
  ofxAurora,
  ofxHorizonte,
  csvValeVerde,
  csvPonte,
  xlsxPonte,
  pdfHorizonte,
  pdfLongo,
];
