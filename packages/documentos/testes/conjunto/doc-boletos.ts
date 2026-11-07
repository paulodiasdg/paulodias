// Boletos e contas de consumo (documentos 07 a 12). Empresas, pessoas e números são inventados.
import { boletoBancario, boletoDeArrecadacao, dataBr, mesCurto, reais } from './apoio.ts';
import { imagemDoCodigoDeBarras, pagina } from './modelos.ts';
import type { DefinicaoDeDocumento } from './tipos.ts';

interface DadosDoBoleto {
  banco: string;
  nomeDoBanco: string;
  beneficiario: string;
  documentoDoBeneficiario: string;
  valorCentavos: number;
  vencimento: string;
  emissao: string;
  numeroDoDocumento: string;
  campoLivre: string;
  instrucoes: string[];
}

/** Ficha de compensação no padrão dos bancos brasileiros. */
async function fichaDeCompensacao(d: DadosDoBoleto): Promise<string> {
  const codigo = boletoBancario(d.banco, d.valorCentavos, d.vencimento, d.campoLivre);
  const barras = await imagemDoCodigoDeBarras(codigo.codigoDeBarras);
  const celula = (rotulo: string, valor: string, extra = '') =>
    `<td class="caixa" ${extra}><span class="rotulo">${rotulo}</span>${valor}</td>`;
  return `
    <p class="dir" style="font-size:10px">Recibo do pagador</p>
    <table>
      <tr>${celula('Beneficiário', d.beneficiario)}${celula('Vencimento', dataBr(d.vencimento))}${celula('Valor do documento', reais(d.valorCentavos))}</tr>
    </table>
    <div class="linha"></div>
    <table>
      <tr>
        <td class="forte" style="font-size:18px;width:180px;border-bottom:2px solid #000">${d.nomeDoBanco}</td>
        <td class="forte centro" style="font-size:18px;width:80px;border-bottom:2px solid #000">${d.banco}-9</td>
        <td class="dir mono forte" style="font-size:13px;border-bottom:2px solid #000">${codigo.linhaDigitavel}</td>
      </tr>
    </table>
    <table>
      <tr>${celula('Local de pagamento', 'Pagável em qualquer banco até o vencimento', 'colspan="5"')}${celula('Vencimento', `<b>${dataBr(d.vencimento)}</b>`, 'style="width:160px"')}</tr>
      <tr>${celula('Beneficiário', `${d.beneficiario} - ${d.documentoDoBeneficiario}`, 'colspan="5"')}${celula('Agência / Código do beneficiário', '0001 / 0098765-4')}</tr>
      <tr>${celula('Data do documento', dataBr(d.emissao))}${celula('Nº do documento', d.numeroDoDocumento)}${celula('Espécie doc.', 'DM')}${celula('Aceite', 'N')}${celula('Data do processamento', dataBr(d.emissao))}${celula('Nosso número', '109/00012345-6')}</tr>
      <tr>${celula('Uso do banco', '')}${celula('Carteira', '109')}${celula('Espécie', 'R$')}${celula('Quantidade', '')}${celula('Valor', '')}${celula('(=) Valor do documento', `<b>${reais(d.valorCentavos)}</b>`)}</tr>
      <tr>${celula('Instruções (texto de responsabilidade do beneficiário)', d.instrucoes.join('<br>'), 'colspan="5" rowspan="4" style="height:110px"')}${celula('(-) Desconto / Abatimento', '')}</tr>
      <tr>${celula('(+) Mora / Multa', '')}</tr>
      <tr>${celula('(+) Outros acréscimos', '')}</tr>
      <tr>${celula('(=) Valor cobrado', '')}</tr>
      <tr>${celula('Pagador', 'Paulo Exemplo de Souza - CPF 123.456.789-09<br>Rua dos Ipês Fictícios, 45 - Cidade Exemplo - SP', 'colspan="6"')}</tr>
    </table>
    <p style="margin-top:10px"><img src="${barras}" style="height:60px;width:420px"></p>
    <p class="dir" style="font-size:10px">Autenticação mecânica - Ficha de compensação</p>`;
}

const contaDeLuz: DefinicaoDeDocumento = {
  gabarito: {
    arquivo: '07-conta-luz.pdf',
    formato: 'pdf_texto',
    tipo: 'boleto',
    conta: { valorCentavos: 18990, vencimento: '2026-11-18' },
    lancamentos: [],
  },
  saida: async () => {
    const codigo = boletoDeArrecadacao('3', 18990, '0123', '2026111800001234567890123');
    const barras = await imagemDoCodigoDeBarras(codigo.codigoDeBarras);
    return {
      como: 'pdf',
      html: pagina(
        `<table><tr>
          <td><span style="font-size:22px;font-weight:bold;color:#1d5fa8">Companhia de Energia Serra Azul</span><br>
          CNPJ 33.444.555/0001-66 · Atendimento 0800 000 1111</td>
          <td class="dir"><span class="rotulo">Conta de energia elétrica</span><b>Nota fiscal 0045.678.912</b></td>
        </tr></table>
        <div class="linha"></div>
        <table>
          <tr>
            <td class="caixa"><span class="rotulo">Cliente</span>PAULO EXEMPLO DE SOUZA<br>RUA DOS IPES FICTICIOS, 45<br>CIDADE EXEMPLO - SP</td>
            <td class="caixa"><span class="rotulo">Nº da instalação</span>7012345678</td>
            <td class="caixa"><span class="rotulo">Referência</span><b>${mesCurto('2026-10')}</b></td>
          </tr>
          <tr>
            <td class="caixa"><span class="rotulo">Leitura anterior</span>01/10/2026 · 15.230 kWh</td>
            <td class="caixa"><span class="rotulo">Leitura atual</span>31/10/2026 · 15.440 kWh</td>
            <td class="caixa"><span class="rotulo">Consumo</span>210 kWh</td>
          </tr>
          <tr>
            <td class="caixa"><span class="rotulo">Próxima leitura</span>30/11/2026</td>
            <td class="caixa" style="background:#e8f0fb"><span class="rotulo">Vencimento</span><b style="font-size:16px">18/11/2026</b></td>
            <td class="caixa" style="background:#e8f0fb"><span class="rotulo">Total a pagar</span><b style="font-size:16px">R$ 189,90</b></td>
          </tr>
        </table>
        <h4>Itens da fatura</h4>
        <table class="listra">
          <tr><th>Descrição</th><th class="dir">Quantidade</th><th class="dir">Tarifa</th><th class="dir">Valor (R$)</th></tr>
          <tr><td>Consumo TUSD</td><td class="dir">210 kWh</td><td class="dir">0,41250</td><td class="dir">86,63</td></tr>
          <tr><td>Consumo TE</td><td class="dir">210 kWh</td><td class="dir">0,32100</td><td class="dir">67,41</td></tr>
          <tr><td>Bandeira amarela</td><td class="dir">210 kWh</td><td class="dir">0,01885</td><td class="dir">3,96</td></tr>
          <tr><td>Contribuição de iluminação pública</td><td></td><td></td><td class="dir">31,90</td></tr>
          <tr><td class="forte">Total</td><td></td><td></td><td class="dir forte">189,90</td></tr>
        </table>
        <p style="font-size:10px">Tributos: ICMS 18% R$ 27,72 · PIS 0,98% R$ 1,51 · COFINS 4,52% R$ 6,95 (incluídos no valor)</p>
        <div class="linha"></div>
        <p class="forte">Débito automático disponível. Pague até o vencimento e evite multa de 2% e juros.</p>
        <p class="mono" style="font-size:13px">${codigo.linhaDigitavel}</p>
        <p><img src="${barras}" style="height:55px;width:430px"></p>`,
        { fonte: "'DejaVu Sans', sans-serif", tamanho: 11 },
      ),
    };
  },
};

const contaDeAgua: DefinicaoDeDocumento = {
  gabarito: {
    arquivo: '08-conta-agua.jpg',
    formato: 'foto',
    tipo: 'boleto',
    conta: { valorCentavos: 9640, vencimento: '2026-11-22' },
    lancamentos: [],
  },
  saida: async () => ({
    como: 'foto',
    largura: 760,
    ajustes: {
      angulo: 2,
      desfoque: 0.7,
      brilho: 0.92,
      qualidade: 74,
      ruido: 0.3,
      fundo: '#9c8b74',
      semente: 8,
    },
    html: pagina(
      `<p style="font-size:24px;font-weight:bold;color:#0a7a9c">Águas do Vale Saneamento</p>
       <p>CNPJ 44.555.666/0001-77 · SAC 0800 000 2222</p>
       <table>
        <tr>
         <td class="caixa"><span class="rotulo">Matrícula</span>00456789-0</td>
         <td class="caixa"><span class="rotulo">Mês de referência</span>10/2026</td>
         <td class="caixa"><span class="rotulo">Consumo</span>12 m³</td>
        </tr>
        <tr>
         <td class="caixa"><span class="rotulo">Data da leitura</span>29/10/2026</td>
         <td class="caixa"><span class="rotulo">Vencimento</span><b style="font-size:20px">22/11/2026</b></td>
         <td class="caixa"><span class="rotulo">Valor a pagar</span><b style="font-size:20px">R$ 96,40</b></td>
        </tr>
       </table>
       <table class="listra" style="margin-top:10px">
        <tr><th>Serviço</th><th class="dir">Valor</th></tr>
        <tr><td>Água - 12 m³</td><td class="dir">53,20</td></tr>
        <tr><td>Esgoto - 80%</td><td class="dir">42,56</td></tr>
        <tr><td>Taxa de religação parcelada</td><td class="dir">0,64</td></tr>
       </table>
       <p>Cliente: PAULO EXEMPLO DE SOUZA</p>`,
      { largura: 760, tamanho: 16, fonte: "'Carlito', sans-serif" },
    ),
  }),
};

const boletoInternet: DefinicaoDeDocumento = {
  gabarito: {
    arquivo: '09-boleto-internet.pdf',
    formato: 'pdf_texto',
    tipo: 'boleto',
    conta: { valorCentavos: 11990, vencimento: '2026-11-15' },
    lancamentos: [],
  },
  saida: async () => ({
    como: 'pdf',
    html: pagina(
      `<p style="font-size:20px;font-weight:bold">FibraNet Internet</p>
       <p>Plano Fibra 500 Mega · Fatura de novembro/2026 · Contrato 556677</p>
       ${await fichaDeCompensacao({
         banco: '999',
         nomeDoBanco: 'Banco Aurora',
         beneficiario: 'FibraNet Telecomunicações Ltda',
         documentoDoBeneficiario: 'CNPJ 55.666.777/0001-88',
         valorCentavos: 11990,
         vencimento: '2026-11-15',
         emissao: '2026-10-30',
         numeroDoDocumento: '556677-11',
         campoLivre: '1090001234560001098765400',
         instrucoes: [
           'Após o vencimento, multa de 2% e juros de 1% ao mês.',
           'Não receber após 30 dias do vencimento.',
         ],
       })}`,
      { fonte: "'DejaVu Sans', sans-serif", tamanho: 10 },
    ),
  }),
};

const boletoCondominio: DefinicaoDeDocumento = {
  gabarito: {
    arquivo: '10-boleto-condominio.pdf',
    formato: 'pdf_digitalizado',
    tipo: 'boleto',
    conta: { valorCentavos: 65000, vencimento: '2026-11-10' },
    lancamentos: [],
  },
  saida: async () => ({
    como: 'digitalizado',
    largura: 794,
    semente: 10,
    html: pagina(
      `<p style="font-size:20px;font-weight:bold">Condomínio Edifício Jardim Exemplo</p>
       <p>Taxa condominial · Unidade 52 · Competência 11/2026</p>
       ${await fichaDeCompensacao({
         banco: '998',
         nomeDoBanco: 'Banco Horizonte',
         beneficiario: 'Condomínio Edifício Jardim Exemplo',
         documentoDoBeneficiario: 'CNPJ 66.777.888/0001-99',
         valorCentavos: 65000,
         vencimento: '2026-11-10',
         emissao: '2026-10-25',
         numeroDoDocumento: '52-1126',
         campoLivre: '0052112600000000123450001',
         instrucoes: [
           'Taxa ordinária R$ 580,00',
           'Fundo de reserva R$ 70,00',
           'Após o vencimento, multa de 2%.',
         ],
       })}`,
      { largura: 794, fonte: "'DejaVu Sans', sans-serif", tamanho: 12 },
    ),
  }),
};

const boletoCurso: DefinicaoDeDocumento = {
  gabarito: {
    arquivo: '11-boleto-curso.jpg',
    formato: 'foto',
    tipo: 'boleto',
    conta: { valorCentavos: 48000, vencimento: '2026-12-05' },
    lancamentos: [],
  },
  saida: async () => ({
    como: 'foto',
    largura: 900,
    ajustes: {
      angulo: 1.2,
      desfoque: 0.5,
      brilho: 0.97,
      qualidade: 80,
      ruido: 0.2,
      fundo: '#6f6457',
      semente: 11,
    },
    html: pagina(
      `<p style="font-size:20px;font-weight:bold">Escola de Idiomas Mundo</p>
       <p>Mensalidade de dezembro/2026 · Aluno: Paulo Exemplo de Souza · Turma Inglês B2</p>
       ${await fichaDeCompensacao({
         banco: '997',
         nomeDoBanco: 'Cooperativa Vale Verde',
         beneficiario: 'Escola de Idiomas Mundo Ltda',
         documentoDoBeneficiario: 'CNPJ 77.888.999/0001-00',
         valorCentavos: 48000,
         vencimento: '2026-12-05',
         emissao: '2026-11-01',
         numeroDoDocumento: 'MENS-1226',
         campoLivre: '3214500000000777888999001',
         instrucoes: [
           'Desconto de R$ 20,00 até o dia 01/12/2026.',
           'Após o vencimento, multa de 2%.',
         ],
       })}`,
      { largura: 900, fonte: "'DejaVu Sans', sans-serif", tamanho: 13 },
    ),
  }),
};

const contaDeGas: DefinicaoDeDocumento = {
  gabarito: {
    arquivo: '12-conta-gas.pdf',
    formato: 'pdf_texto',
    tipo: 'boleto',
    conta: { valorCentavos: 7425, vencimento: '2026-11-25' },
    lancamentos: [],
  },
  saida: async () => {
    const codigo = boletoDeArrecadacao('3', 7425, '0456', '0000987654320261125000000');
    const barras = await imagemDoCodigoDeBarras(codigo.codigoDeBarras);
    return {
      como: 'pdf',
      html: pagina(
        `<p style="font-size:22px;font-weight:bold;color:#c25a00">Gás Encanado do Vale</p>
         <p>Distribuidora de Gás Canalizado do Vale S.A. · CNPJ 88.999.000/0001-11</p>
         <table>
           <tr><td>Cliente</td><td>PAULO EXEMPLO DE SOUZA</td><td>Código do cliente</td><td>9876543</td></tr>
           <tr><td>Período de consumo</td><td>27/09/2026 a 27/10/2026</td><td>Consumo</td><td>9 m³</td></tr>
           <tr><td>Data de emissão</td><td>03/11/2026</td><td>Próxima leitura</td><td>26/11/2026</td></tr>
         </table>
         <div class="caixa" style="margin:12px 0;display:flex;justify-content:space-between">
           <span>VENCIMENTO <b>25/11/2026</b></span><span>VALOR R$ <b>74,25</b></span>
         </div>
         <table class="listra">
           <tr><th>Descrição</th><th class="dir">R$</th></tr>
           <tr><td>Consumo de gás 9 m³</td><td class="dir">61,65</td></tr>
           <tr><td>Tarifa fixa</td><td class="dir">12,60</td></tr>
         </table>
         <div class="linha"></div>
         <p class="mono">${codigo.linhaDigitavel}</p>
         <p><img src="${barras}" style="height:55px;width:430px"></p>`,
        { fonte: "'Inter', sans-serif", tamanho: 12 },
      ),
    };
  },
};

export const boletos = [
  contaDeLuz,
  contaDeAgua,
  boletoInternet,
  boletoCondominio,
  boletoCurso,
  contaDeGas,
];
