// Contracheques e recibos de pagamento (documentos 26 a 30). Empresas e pessoas são inventadas.
import { mesPorExtenso, reais } from './apoio.ts';
import { pagina } from './modelos.ts';
import type { DefinicaoDeDocumento, Formato } from './tipos.ts';

interface Verba {
  codigo: string;
  descricao: string;
  referencia: string;
  provento?: number;
  desconto?: number;
}

interface DadosDoContracheque {
  arquivo: string;
  formato: Formato;
  empresa: string;
  cnpj: string;
  funcionario: string;
  cargo: string;
  competencia: string;
  /** Data do crédito impressa, ou null quando o documento não a mostra. */
  pagamento: string | null;
  verbas: Verba[];
}

function liquido(d: DadosDoContracheque): number {
  return d.verbas.reduce((soma, v) => soma + (v.provento ?? 0) - (v.desconto ?? 0), 0);
}

function ultimoDia(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number) as [number, number];
  const dia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${competencia}-${dia.toString().padStart(2, '0')}`;
}

function definir(
  d: DadosDoContracheque,
  html: (d: DadosDoContracheque) => string,
  como: 'pdf' | 'digitalizado' | 'foto',
): DefinicaoDeDocumento {
  return {
    gabarito: {
      arquivo: d.arquivo,
      formato: d.formato,
      tipo: 'contracheque',
      conta: null,
      lancamentos: [
        {
          data: d.pagamento ?? ultimoDia(d.competencia),
          valorCentavos: liquido(d),
          tipo: 'receita',
          descricao: `Salário ${d.empresa}`,
        },
      ],
    },
    saida: async () => {
      if (como === 'pdf') return { como, html: html(d) };
      if (como === 'digitalizado')
        return { como, html: html(d), largura: 794, semente: Number(d.arquivo.slice(0, 2)) };
      return {
        como,
        html: html(d),
        largura: 794,
        ajustes: {
          angulo: 1.8,
          desfoque: 0.7,
          brilho: 0.94,
          qualidade: 76,
          ruido: 0.3,
          fundo: '#8d8172',
          semente: 27,
        },
      };
    },
  };
}

const [ano, mes] = ['2026', '10'];

function totais(d: DadosDoContracheque) {
  const proventos = d.verbas.reduce((s, v) => s + (v.provento ?? 0), 0);
  const descontos = d.verbas.reduce((s, v) => s + (v.desconto ?? 0), 0);
  return { proventos, descontos };
}

function tabelaDeVerbas(d: DadosDoContracheque): string {
  return `<table class="listra">
    <tr><th>Cód.</th><th>Descrição</th><th class="dir">Ref.</th><th class="dir">Proventos</th><th class="dir">Descontos</th></tr>
    ${d.verbas
      .map(
        (v) =>
          `<tr><td>${v.codigo}</td><td>${v.descricao}</td><td class="dir">${v.referencia}</td><td class="dir">${v.provento ? reais(v.provento) : ''}</td><td class="dir">${v.desconto ? reais(v.desconto) : ''}</td></tr>`,
      )
      .join('')}
  </table>`;
}

/** Modelo clássico: cabeçalho da empresa, tabela de verbas e o líquido no rodapé. */
function modeloClassico(d: DadosDoContracheque): string {
  const { proventos, descontos } = totais(d);
  return pagina(
    `<table><tr>
       <td><b style="font-size:16px">${d.empresa}</b><br>CNPJ ${d.cnpj}</td>
       <td class="dir"><b>Demonstrativo de Pagamento de Salário</b><br>Referência: ${mesPorExtenso(d.competencia)}</td>
     </tr></table>
     <table style="margin:8px 0">
       <tr><td class="caixa"><span class="rotulo">Funcionário</span>${d.funcionario}</td><td class="caixa"><span class="rotulo">Cargo</span>${d.cargo}</td><td class="caixa"><span class="rotulo">Admissão</span>03/02/2022</td></tr>
       <tr><td class="caixa"><span class="rotulo">CPF</span>123.456.789-09</td><td class="caixa"><span class="rotulo">Banco / Agência / Conta</span>999 / 0001 / 12345-6</td><td class="caixa"><span class="rotulo">Data de crédito</span>${d.pagamento ? d.pagamento.split('-').reverse().join('/') : ''}</td></tr>
     </table>
     ${tabelaDeVerbas(d)}
     <table style="margin-top:8px">
       <tr><td class="caixa">Total de vencimentos<br><b>${reais(proventos)}</b></td><td class="caixa">Total de descontos<br><b>${reais(descontos)}</b></td><td class="caixa" style="background:#eee">Líquido a receber<br><b style="font-size:16px">R$ ${reais(liquido(d))}</b></td></tr>
     </table>
     <p style="font-size:10px">Base INSS ${reais(proventos)} · Base FGTS ${reais(proventos)} · FGTS do mês ${reais(Math.round(proventos * 0.08))}</p>
     <p style="margin-top:30px">Declaro ter recebido a importância líquida discriminada neste recibo.<br><br>______________________________<br>Assinatura do funcionário</p>`,
    { fonte: "'DejaVu Sans', sans-serif", tamanho: 11, largura: undefined },
  );
}

/** Holerite em formato de recibo, com "Valor líquido" e "Pago em". */
function modeloHolerite(d: DadosDoContracheque): string {
  const { proventos, descontos } = totais(d);
  return pagina(
    `<p class="centro" style="font-size:20px;font-weight:bold">HOLERITE</p>
     <p class="centro">${d.empresa} · CNPJ ${d.cnpj}</p>
     <table style="margin:10px 0">
       <tr><td>Empregado: <b>${d.funcionario}</b></td><td>Mês/Ano: <b>${d.competencia.slice(5)}/${d.competencia.slice(0, 4)}</b></td></tr>
       <tr><td>Função: ${d.cargo}</td><td>Pago em: <b>${d.pagamento ? d.pagamento.split('-').reverse().join('/') : ''}</b></td></tr>
     </table>
     ${tabelaDeVerbas(d)}
     <table style="margin-top:10px">
       <tr><td>Total proventos: ${reais(proventos)}</td><td>Total descontos: ${reais(descontos)}</td></tr>
       <tr><td class="forte" style="font-size:18px">Valor líquido</td><td class="forte dir" style="font-size:18px">${reais(liquido(d))}</td></tr>
     </table>`,
    { fonte: "'Carlito', sans-serif", tamanho: 16, largura: 794 },
  );
}

/** Recibo de pagamento a autônomo (RPA). */
function modeloRpa(d: DadosDoContracheque): string {
  const { proventos } = totais(d);
  return pagina(
    `<h2 class="centro">Recibo de Pagamento a Autônomo - RPA</h2>
     <table>
       <tr><td class="caixa"><span class="rotulo">Contratante</span>${d.empresa}<br>CNPJ ${d.cnpj}</td><td class="caixa"><span class="rotulo">Competência</span>${d.competencia.slice(5)}/${d.competencia.slice(0, 4)}</td></tr>
       <tr><td class="caixa"><span class="rotulo">Prestador</span>${d.funcionario} · CPF 123.456.789-09 · NIT 123.45678.90-1</td><td class="caixa"><span class="rotulo">Data do pagamento</span>${d.pagamento ? d.pagamento.split('-').reverse().join('/') : ''}</td></tr>
     </table>
     <p>Serviço prestado: ${d.cargo}</p>
     <table class="listra">
       <tr><th>Discriminação</th><th class="dir">Valor (R$)</th></tr>
       <tr><td>Valor bruto do serviço</td><td class="dir">${reais(proventos)}</td></tr>
       ${d.verbas
         .filter((v) => v.desconto)
         .map(
           (v) =>
             `<tr><td>(-) ${v.descricao}</td><td class="dir">${reais(v.desconto ?? 0)}</td></tr>`,
         )
         .join('')}
       <tr><td class="forte">Valor líquido</td><td class="dir forte">R$ ${reais(liquido(d))}</td></tr>
     </table>
     <p style="margin-top:20px">Recebi de ${d.empresa} a importância acima pelos serviços prestados.</p>`,
    { fonte: "'Inter', sans-serif", tamanho: 12 },
  );
}

/** Folha simples, sem data do crédito. */
function modeloFolha(d: DadosDoContracheque): string {
  const { proventos, descontos } = totais(d);
  return pagina(
    `<p style="font-size:16px"><b>${d.empresa}</b> · Folha de pagamento mensal</p>
     <p>Competência: ${d.competencia.slice(5)}/${d.competencia.slice(0, 4)} · Colaborador: ${d.funcionario} · Matrícula 00321</p>
     ${tabelaDeVerbas(d)}
     <p>Proventos ${reais(proventos)} · Descontos ${reais(descontos)}</p>
     <p class="forte" style="font-size:15px">Total líquido: R$ ${reais(liquido(d))}</p>`,
    { fonte: "'DejaVu Serif', serif", tamanho: 12 },
  );
}

const tracoFino = definir(
  {
    arquivo: '26-contracheque-traco-fino.pdf',
    formato: 'pdf_texto',
    empresa: 'Estúdio Traço Fino Design Ltda',
    cnpj: '10.203.040/0001-50',
    funcionario: 'PAULO EXEMPLO DE SOUZA',
    cargo: 'Designer sênior',
    competencia: `${ano}-${mes}`,
    pagamento: '2026-11-05',
    verbas: [
      { codigo: '001', descricao: 'Salário base', referencia: '30 dias', provento: 580000 },
      { codigo: '050', descricao: 'Horas extras 50%', referencia: '4h', provento: 15816 },
      { codigo: '901', descricao: 'INSS', referencia: '11,7%', desconto: 64251 },
      { codigo: '902', descricao: 'IRRF', referencia: '7,5%', desconto: 28133 },
      { codigo: '940', descricao: 'Vale-transporte', referencia: '6%', desconto: 15600 },
    ],
  },
  modeloClassico,
  'pdf',
);

const holeriteFoto = definir(
  {
    arquivo: '27-holerite-foto.jpg',
    formato: 'foto',
    empresa: 'Agência Ponto Criativo Ltda',
    cnpj: '20.304.050/0001-60',
    funcionario: 'ANA EXEMPLO LIMA',
    cargo: 'Redatora',
    competencia: '2026-10',
    pagamento: '2026-10-30',
    verbas: [
      { codigo: '01', descricao: 'Salário', referencia: '30', provento: 380000 },
      { codigo: '20', descricao: 'Adicional noturno', referencia: '10h', provento: 7600 },
      { codigo: '61', descricao: 'INSS', referencia: '9%', desconto: 34884 },
      { codigo: '62', descricao: 'IRRF', referencia: '', desconto: 9136 },
    ],
  },
  modeloHolerite,
  'foto',
);

const clinicaDigitalizado = definir(
  {
    arquivo: '28-contracheque-digitalizado.pdf',
    formato: 'pdf_digitalizado',
    empresa: 'Clínica Bem Estar S.A.',
    cnpj: '30.405.060/0001-70',
    funcionario: 'PAULO EXEMPLO DE SOUZA',
    cargo: 'Assistente de marketing',
    competencia: '2026-09',
    pagamento: '2026-10-05',
    verbas: [
      { codigo: '001', descricao: 'Salário base', referencia: '30 dias', provento: 340000 },
      { codigo: '901', descricao: 'INSS', referencia: '9%', desconto: 30600 },
      { codigo: '920', descricao: 'Plano de saúde', referencia: '', desconto: 14385 },
      { codigo: '940', descricao: 'Vale-refeição', referencia: '', desconto: 2000 },
    ],
  },
  modeloClassico,
  'digitalizado',
);

const rpa = definir(
  {
    arquivo: '29-rpa-editora.pdf',
    formato: 'pdf_texto',
    empresa: 'Editora Folha Viva Ltda',
    cnpj: '40.506.070/0001-80',
    funcionario: 'PAULO EXEMPLO DE SOUZA',
    cargo: 'Projeto gráfico de livro',
    competencia: '2026-10',
    pagamento: '2026-10-31',
    verbas: [
      { codigo: '', descricao: 'Serviço', referencia: '', provento: 250000 },
      { codigo: '', descricao: 'INSS 11%', referencia: '', desconto: 27500 },
      { codigo: '', descricao: 'ISS 5%', referencia: '', desconto: 12500 },
    ],
  },
  modeloRpa,
  'pdf',
);

const semData = definir(
  {
    arquivo: '30-folha-sem-data.pdf',
    formato: 'pdf_texto',
    empresa: 'Mercado Bom Preço Ltda',
    cnpj: '98.765.432/0001-10',
    funcionario: 'JOSE EXEMPLO COSTA',
    cargo: 'Operador de caixa',
    competencia: '2026-10',
    pagamento: null,
    verbas: [
      { codigo: '001', descricao: 'Salário', referencia: '30', provento: 210000 },
      { codigo: '010', descricao: 'Comissões', referencia: '', provento: 8745 },
      { codigo: '901', descricao: 'INSS', referencia: '7,5%', desconto: 16000 },
      { codigo: '950', descricao: 'Adiantamento', referencia: '', desconto: 5000 },
    ],
  },
  modeloFolha,
  'pdf',
);

export const contracheques = [tracoFino, holeriteFoto, clinicaDigitalizado, rpa, semData];
