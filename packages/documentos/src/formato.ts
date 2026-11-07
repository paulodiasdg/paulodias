import type { FormatoDoArquivo } from './tipos';

/** 15 MB por arquivo (seção 4d do PLANO). */
export const TAMANHO_MAXIMO_BYTES = 15 * 1024 * 1024;

export type ResultadoDoFormato =
  { ok: true; formato: FormatoDoArquivo; tipoMime: string } | { ok: false; motivo: string };

function comeca(bytes: Uint8Array, assinatura: readonly number[], deslocamento = 0): boolean {
  return assinatura.every((byte, i) => bytes[deslocamento + i] === byte);
}

function ascii(bytes: Uint8Array, inicio: number, fim: number): string {
  return String.fromCharCode(...bytes.subarray(inicio, fim));
}

/** Texto do arquivo: UTF-8 ou, se não for, a acentuação do Windows (windows-1252). */
export function decodificarTexto(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/**
 * Formato pelo conteúdo, não pela extensão: um PDF renomeado para .jpg continua PDF, e um
 * arquivo que não é nenhum dos aceitos é recusado.
 */
export function detectarFormato(bytes: Uint8Array, nome: string): ResultadoDoFormato {
  if (bytes.length === 0) return { ok: false, motivo: 'O arquivo está vazio.' };
  if (bytes.length > TAMANHO_MAXIMO_BYTES) {
    return { ok: false, motivo: 'O arquivo passa de 15 MB.' };
  }
  const inicio = ascii(bytes, 0, Math.min(bytes.length, 1024));
  if (inicio.includes('%PDF-')) return { ok: true, formato: 'pdf', tipoMime: 'application/pdf' };
  if (comeca(bytes, [0xff, 0xd8, 0xff]))
    return { ok: true, formato: 'imagem', tipoMime: 'image/jpeg' };
  if (comeca(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { ok: true, formato: 'imagem', tipoMime: 'image/png' };
  }
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') {
    return { ok: true, formato: 'imagem', tipoMime: 'image/webp' };
  }
  if (ascii(bytes, 4, 8) === 'ftyp' && /heic|heix|mif1|msf1/.test(ascii(bytes, 8, 12))) {
    return {
      ok: false,
      motivo: 'Fotos em HEIC ainda não são lidas. No celular, envie a foto como JPG.',
    };
  }
  if (comeca(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    const conteudo = ascii(bytes, 0, Math.min(bytes.length, 64 * 1024));
    if (conteudo.includes('xl/') || /\.xlsx$/i.test(nome)) {
      return {
        ok: true,
        formato: 'xlsx',
        tipoMime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }
    return {
      ok: false,
      motivo: 'Arquivo compactado não é aceito. Envie PDF, foto, CSV, OFX ou XLSX.',
    };
  }

  const amostra = bytes.subarray(0, Math.min(bytes.length, 8192));
  if (amostra.some((byte) => byte < 9 || (byte > 13 && byte < 32 && byte !== 27))) {
    return {
      ok: false,
      motivo: 'Formato não aceito. Envie PDF, foto (JPG ou PNG), CSV, OFX ou XLSX.',
    };
  }
  const texto = decodificarTexto(amostra);
  if (/OFXHEADER|<OFX>/i.test(texto)) {
    return { ok: true, formato: 'ofx', tipoMime: 'application/x-ofx' };
  }
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim() !== '');
  const comSeparador = linhas.filter((l) => /[;,\t]/.test(l)).length;
  if (/\.(csv|txt)$/i.test(nome) || (linhas.length >= 2 && comSeparador >= linhas.length * 0.8)) {
    return { ok: true, formato: 'csv', tipoMime: 'text/csv' };
  }
  return {
    ok: false,
    motivo: 'Formato não aceito. Envie PDF, foto (JPG ou PNG), CSV, OFX ou XLSX.',
  };
}
