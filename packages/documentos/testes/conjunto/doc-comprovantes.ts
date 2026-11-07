// Comprovantes e notas fiscais (documentos 01 a 06). Empresas, pessoas e números são inventados.
import { boletoDeArrecadacao, dataBr, reais } from './apoio.ts';
import { pagina } from './modelos.ts';
import type { DefinicaoDeDocumento } from './tipos.ts';

const pix: DefinicaoDeDocumento = {
  gabarito: {
    arquivo: '01-comprovante-pix-aurora.pdf',
    formato: 'pdf_texto',
    tipo: 'comprovante',
    conta: null,
    lancamentos: [
      {
        data: '2026-11-05',
        valorCentavos: 15000,
        tipo: 'despesa',
        descricao: 'Maria Fictícia da Silva',
      },
    ],
  },
  saida: async () => ({
    como: 'pdf',
    html: pagina(
      `<div style="max-width:420px;margin:0 auto">
        <p class="grande" style="color:#0b4f9c">Banco Aurora</p>
        <h2>Comprovante de transferência Pix</h2>
        <p><span class="rotulo">Valor</span><span class="grande">R$ 150,00</span></p>
        <p><span class="rotulo">Data e hora</span>05/11/2026 às 14:32:07</p>
        <div class="linha"></div>
        <h3>Para</h3>
        <p><span class="rotulo">Nome</span>Maria Fictícia da Silva</p>
        <p><span class="rotulo">CPF</span>***.456.789-**</p>
        <p><span class="rotulo">Instituição</span>Banco Horizonte S.A.</p>
        <p><span class="rotulo">Chave Pix</span>maria.ficticia@exemplo.com.br</p>
        <div class="linha"></div>
        <h3>De</h3>
        <p><span class="rotulo">Nome</span>Paulo Exemplo de Souza</p>
        <p><span class="rotulo">CPF</span>123.456.789-09</p>
        <p><span class="rotulo">Agência e conta</span>0001 / 12345-6</p>
        <div class="linha"></div>
        <p><span class="rotulo">ID da transação</span>E99999999202611051432abcdEF12345</p>
        <p style="font-size:10px;color:#555">Ouvidoria Banco Aurora 0800 000 0000</p>
      </div>`,
      { fonte: "'Inter', sans-serif", tamanho: 13 },
    ),
  }),
};

const pixAcademia: DefinicaoDeDocumento = {
  gabarito: {
    arquivo: '02-comprovante-pix-academia.jpg',
    formato: 'foto',
    tipo: 'comprovante',
    conta: null,
    lancamentos: [
      {
        data: '2026-11-03',
        valorCentavos: 8990,
        tipo: 'despesa',
        descricao: 'Academia Movimento Ltda',
      },
    ],
  },
  saida: async () => ({
    como: 'foto',
    largura: 460,
    ajustes: {
      angulo: -2.5,
      desfoque: 0.6,
      brilho: 0.95,
      qualidade: 78,
      ruido: 0.25,
      fundo: '#8a8f99',
      semente: 2,
    },
    html: pagina(
      `<p class="forte" style="font-size:20px">Horizonte</p>
       <p class="centro" style="font-size:16px">Pix enviado</p>
       <p class="centro" style="font-size:32px;font-weight:bold">R$ 89,90</p>
       <p class="centro">03/11/2026 - 07:15</p>
       <div class="linha"></div>
       <table>
        <tr><td>Destino</td><td class="dir forte">Academia Movimento Ltda</td></tr>
        <tr><td>CNPJ</td><td class="dir">12.345.678/0001-90</td></tr>
        <tr><td>Instituição</td><td class="dir">Cooperativa Vale Verde</td></tr>
        <tr><td>Origem</td><td class="dir">Paulo Exemplo de Souza</td></tr>
        <tr><td>Tipo</td><td class="dir">Pix por QR Code</td></tr>
       </table>
       <div class="linha"></div>
       <p style="font-size:11px">Autenticação 7F3A-99B1-0C2D-4E5F</p>`,
      { largura: 460, tamanho: 15, fonte: "'Inter', sans-serif" },
    ),
  }),
};

const cupomMercado: DefinicaoDeDocumento = {
  gabarito: {
    arquivo: '03-cupom-mercado.jpg',
    formato: 'foto',
    tipo: 'comprovante',
    conta: null,
    lancamentos: [
      { data: '2026-11-05', valorCentavos: 6217, tipo: 'despesa', descricao: 'Mercado Bom Preço' },
    ],
  },
  saida: async () => ({
    como: 'foto',
    largura: 420,
    ajustes: {
      angulo: 3,
      desfoque: 0.8,
      brilho: 0.9,
      qualidade: 72,
      ruido: 0.35,
      fundo: '#a08a6e',
      semente: 3,
    },
    html: pagina(
      `<div class="mono">
       <p class="centro forte">MERCADO BOM PRECO LTDA</p>
       <p class="centro">CNPJ 98.765.432/0001-10<br>Av. das Palmeiras Fictícias, 1500<br>Cidade Exemplo - SP</p>
       <div class="linha"></div>
       <p class="centro">DOCUMENTO AUXILIAR DA NOTA FISCAL<br>DE CONSUMIDOR ELETRÔNICA</p>
       <div class="linha"></div>
       <table>
        <tr><td>ARROZ TIPO 1 5KG</td><td class="dir">27,90</td></tr>
        <tr><td>FEIJAO CARIOCA 1KG</td><td class="dir">8,49</td></tr>
        <tr><td>CAFE TORRADO 500G</td><td class="dir">19,99</td></tr>
        <tr><td>LEITE INTEGRAL 1L</td><td class="dir">5,79</td></tr>
       </table>
       <div class="linha"></div>
       <table>
        <tr><td>QTD. TOTAL DE ITENS</td><td class="dir">4</td></tr>
        <tr><td class="forte">VALOR TOTAL R$</td><td class="dir forte">62,17</td></tr>
        <tr><td>FORMA DE PAGAMENTO</td><td class="dir">VALOR PAGO</td></tr>
        <tr><td>CARTAO DE DEBITO</td><td class="dir">62,17</td></tr>
       </table>
       <div class="linha"></div>
       <p class="centro">NFC-e n. 000123456 Serie 001<br>Emissao 05/11/2026 18:42:10</p>
       <p class="centro">CONSUMIDOR NAO IDENTIFICADO</p>
       </div>`,
      { largura: 420, tamanho: 15, fonte: "'DejaVu Sans Mono', monospace" },
    ),
  }),
};

const cupomFarmacia: DefinicaoDeDocumento = {
  gabarito: {
    arquivo: '04-cupom-farmacia.pdf',
    formato: 'pdf_digitalizado',
    tipo: 'comprovante',
    conta: null,
    lancamentos: [
      { data: '2026-10-28', valorCentavos: 4735, tipo: 'despesa', descricao: 'Farmácia Vida' },
    ],
  },
  saida: async () => ({
    como: 'digitalizado',
    largura: 560,
    semente: 4,
    html: pagina(
      `<div class="mono">
       <p class="centro forte" style="font-size:18px">FARMACIA VIDA</p>
       <p class="centro">Drogaria Vida Saudavel Ltda<br>CNPJ 11.222.333/0001-44<br>Rua das Acacias Ficticias, 77</p>
       <div class="linha"></div>
       <p class="centro">DOCUMENTO AUXILIAR DA NFC-e</p>
       <table>
        <tr><th>Descricao</th><th class="dir">Qtd</th><th class="dir">Total</th></tr>
        <tr><td>DIPIRONA 500MG 10CP</td><td class="dir">1</td><td class="dir">12,90</td></tr>
        <tr><td>VITAMINA C 1G 10CP</td><td class="dir">1</td><td class="dir">21,50</td></tr>
        <tr><td>PROTETOR LABIAL</td><td class="dir">1</td><td class="dir">12,95</td></tr>
       </table>
       <div class="linha"></div>
       <table>
        <tr><td class="forte">VALOR TOTAL R$</td><td class="dir forte">47,35</td></tr>
        <tr><td>Desconto R$</td><td class="dir">0,00</td></tr>
        <tr><td>PIX</td><td class="dir">47,35</td></tr>
       </table>
       <div class="linha"></div>
       <p class="centro">Emissao: 28/10/2026 10:05:44<br>Protocolo 135260000123456</p>
       <p class="centro">CPF do consumidor: 123.456.789-09</p>
       </div>`,
      { largura: 560, tamanho: 16, fonte: "'DejaVu Sans Mono', monospace" },
    ),
  }),
};

const pagamentoDeBoleto: DefinicaoDeDocumento = {
  gabarito: {
    arquivo: '05-comprovante-pagamento-luz.pdf',
    formato: 'pdf_texto',
    tipo: 'comprovante',
    conta: null,
    lancamentos: [
      {
        data: '2026-11-06',
        valorCentavos: 18990,
        tipo: 'despesa',
        descricao: 'Companhia de Energia Serra Azul',
      },
    ],
  },
  saida: async () => {
    const codigo = boletoDeArrecadacao('3', 18990, '0123', '2026111800001234567890123');
    return {
      como: 'pdf',
      html: pagina(
        `<p class="grande" style="color:#0b4f9c">Banco Aurora</p>
         <h2>Comprovante de pagamento</h2>
         <table style="max-width:520px">
          <tr><td>Tipo de pagamento</td><td class="forte">Conta de consumo</td></tr>
          <tr><td>Empresa</td><td class="forte">Companhia de Energia Serra Azul</td></tr>
          <tr><td>Código de barras</td><td class="mono" style="font-size:11px">${codigo.linhaDigitavel}</td></tr>
          <tr><td>Data do vencimento</td><td>${dataBr('2026-11-18')}</td></tr>
          <tr><td>Data do pagamento</td><td>06/11/2026</td></tr>
          <tr><td>Valor pago</td><td class="forte">R$ ${reais(18990)}</td></tr>
          <tr><td>Pagador</td><td>Paulo Exemplo de Souza</td></tr>
          <tr><td>Conta debitada</td><td>Ag. 0001 C/C 12345-6</td></tr>
          <tr><td>Autenticação</td><td class="mono">A1B2.C3D4.E5F6.G7H8</td></tr>
         </table>`,
        { fonte: "'Carlito', sans-serif", tamanho: 14 },
      ),
    };
  },
};

const ted: DefinicaoDeDocumento = {
  gabarito: {
    arquivo: '06-comprovante-ted-aluguel.jpg',
    formato: 'foto',
    tipo: 'comprovante',
    conta: null,
    lancamentos: [
      {
        data: '2026-11-04',
        valorCentavos: 120000,
        tipo: 'despesa',
        descricao: 'Imobiliária Lar Doce Ltda',
      },
    ],
  },
  saida: async () => ({
    como: 'foto',
    largura: 640,
    ajustes: {
      angulo: -1.5,
      desfoque: 0.7,
      brilho: 1.05,
      qualidade: 75,
      ruido: 0.3,
      fundo: '#5d6b5a',
      semente: 6,
    },
    html: pagina(
      `<p class="forte" style="font-size:20px;color:#2d6a2d">Cooperativa Vale Verde</p>
       <h3>Comprovante de Transferência - TED</h3>
       <table>
        <tr><td>Data da transferência</td><td class="forte">04/11/2026</td></tr>
        <tr><td>Valor</td><td class="forte">R$ 1.200,00</td></tr>
        <tr><td>Finalidade</td><td>Pagamento de aluguel</td></tr>
       </table>
       <div class="linha"></div>
       <p class="forte">Favorecido</p>
       <table>
        <tr><td>Nome</td><td>Imobiliária Lar Doce Ltda</td></tr>
        <tr><td>CNPJ</td><td>22.333.444/0001-55</td></tr>
        <tr><td>Banco</td><td>Banco Horizonte S.A.</td></tr>
        <tr><td>Agência / Conta</td><td>4321 / 98765-4</td></tr>
       </table>
       <div class="linha"></div>
       <p class="forte">Remetente</p>
       <table>
        <tr><td>Nome</td><td>Paulo Exemplo de Souza</td></tr>
        <tr><td>CPF</td><td>123.456.789-09</td></tr>
       </table>
       <p style="font-size:11px">Controle 2026110400004567</p>`,
      { largura: 640, tamanho: 16, fonte: "'DejaVu Sans', sans-serif" },
    ),
  }),
};

export const comprovantes = [pix, pixAcademia, cupomMercado, cupomFarmacia, pagamentoDeBoleto, ted];
