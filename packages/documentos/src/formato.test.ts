import { describe, expect, it } from 'vitest';
import { decodificarTexto, detectarFormato, TAMANHO_MAXIMO_BYTES } from './formato';
import { lerOfx } from './ofx';

const bytes = (texto: string, codificacao: BufferEncoding = 'utf8') =>
  new Uint8Array(Buffer.from(texto, codificacao));

describe('formato pelo conteúdo', () => {
  it('reconhece PDF, JPG, PNG e WEBP mesmo com a extensão errada', () => {
    expect(detectarFormato(bytes('%PDF-1.7\n...'), 'foto.jpg')).toMatchObject({
      ok: true,
      formato: 'pdf',
    });
    expect(detectarFormato(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1]), 'a.pdf')).toMatchObject({
      formato: 'imagem',
      tipoMime: 'image/jpeg',
    });
    expect(
      detectarFormato(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'x'),
    ).toMatchObject({
      tipoMime: 'image/png',
    });
    expect(detectarFormato(bytes('RIFF1234WEBPVP8 '), 'x')).toMatchObject({
      tipoMime: 'image/webp',
    });
  });

  it('reconhece OFX, CSV e XLSX', () => {
    expect(detectarFormato(bytes('OFXHEADER:100\nDATA:OFXSGML'), 'extrato.txt')).toMatchObject({
      formato: 'ofx',
    });
    expect(detectarFormato(bytes('Data;Valor\n01/10/2026;-1,00\n'), 'x.csv')).toMatchObject({
      formato: 'csv',
    });
    expect(detectarFormato(bytes('data,valor\n2026-10-01,1.00\n'), 'sem-extensao')).toMatchObject({
      formato: 'csv',
    });
    expect(
      detectarFormato(bytes('PK\u0003\u0004....xl/workbook.xml'), 'extrato.xlsx'),
    ).toMatchObject({
      formato: 'xlsx',
    });
  });

  it('recusa vazio, grande demais, HEIC, compactado e binário qualquer', () => {
    expect(detectarFormato(new Uint8Array(), 'x')).toMatchObject({ ok: false });
    expect(detectarFormato(new Uint8Array(TAMANHO_MAXIMO_BYTES + 1), 'x')).toMatchObject({
      ok: false,
      motivo: 'O arquivo passa de 15 MB.',
    });
    expect(detectarFormato(bytes('\u0000\u0000\u0000\u0018ftypheic'), 'foto.heic')).toMatchObject({
      ok: false,
    });
    expect(detectarFormato(bytes('PK\u0003\u0004qualquer'), 'pasta.zip')).toMatchObject({
      ok: false,
    });
    expect(detectarFormato(new Uint8Array([1, 2, 3, 4, 5, 0, 7]), 'x.bin')).toMatchObject({
      ok: false,
    });
  });
});

describe('texto do arquivo', () => {
  it('lê UTF-8 e cai para a acentuação do Windows', () => {
    expect(decodificarTexto(bytes('\uFEFFAção'))).toBe('Ação');
    expect(decodificarTexto(bytes('Histórico;AÇÚCAR', 'latin1'))).toBe('Histórico;AÇÚCAR');
  });
});

describe('OFX', () => {
  it('lê OFX 1 (sem fechar os campos) e OFX 2 (XML)', () => {
    const sgml = `<OFX><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261003120000[-3:BRT]
<TRNAMT>-45.90
<MEMO>COMPRA &amp; CIA
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261005
<TRNAMT>4876,32
<NAME>TED RECEBIDA
</STMTTRN>
</BANKTRANLIST></OFX>`;
    expect(lerOfx(sgml)).toEqual([
      { data: '2026-10-03', descricao: 'COMPRA & CIA', valorCentavos: -4590 },
      { data: '2026-10-05', descricao: 'TED RECEBIDA', valorCentavos: 487632 },
    ]);
    const xml =
      '<STMTTRN><DTPOSTED>20261010</DTPOSTED><TRNAMT>-12.5</TRNAMT><MEMO>UBER</MEMO></STMTTRN>';
    expect(lerOfx(xml)).toEqual([{ data: '2026-10-10', descricao: 'UBER', valorCentavos: -1250 }]);
  });

  it('ignora transação sem data, sem valor ou zerada', () => {
    expect(
      lerOfx(
        '<STMTTRN><DTPOSTED>2026</DTPOSTED><TRNAMT>-1.00</TRNAMT></STMTTRN><STMTTRN><DTPOSTED>20261010<TRNAMT>0.00</STMTTRN>',
      ),
    ).toEqual([]);
  });
});
