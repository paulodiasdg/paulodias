import { montarData, type Centavos, type DataCivil } from '@no-azul/motor';
import { centavosComPonto, centavosDeTexto } from './texto';

/** Uma transação do OFX, com o valor com sinal (negativo é saída). */
export interface TransacaoDoOfx {
  data: DataCivil;
  descricao: string;
  valorCentavos: Centavos;
}

function campo(bloco: string, nome: string): string | null {
  // OFX 1 (SGML) não fecha os campos; OFX 2 (XML) fecha. O valor vai até o próximo "<".
  const achado = new RegExp(`<${nome}>([^<\\r\\n]*)`, 'i').exec(bloco);
  const valor = achado?.[1]?.trim();
  return valor ? valor : null;
}

function dataDoOfx(texto: string | null): DataCivil | null {
  const partes = texto ? /^(\d{4})(\d{2})(\d{2})/.exec(texto) : null;
  if (!partes) return null;
  try {
    return montarData(Number(partes[1]), Number(partes[2]), Number(partes[3]));
  } catch {
    return null;
  }
}

function valorDoOfx(texto: string | null): Centavos | null {
  if (!texto) return null;
  const comVirgula = /^([-+]?)(\d+),(\d{1,2})$/.exec(texto.trim());
  if (comVirgula?.[2] && comVirgula[3]) {
    const valor = centavosDeTexto(`${comVirgula[2]},${comVirgula[3].padEnd(2, '0')}`);
    return valor === null ? null : comVirgula[1] === '-' ? -valor : valor;
  }
  return centavosComPonto(texto);
}

function desfazerEntidades(texto: string): string {
  return texto
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/** Lê as transações de um OFX 1 (SGML) ou 2 (XML). Contas e saldos são ignorados. */
export function lerOfx(texto: string): TransacaoDoOfx[] {
  const transacoes: TransacaoDoOfx[] = [];
  for (const achado of texto.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)) {
    const bloco = achado[1] ?? '';
    const data = dataDoOfx(campo(bloco, 'DTPOSTED'));
    const valor = valorDoOfx(campo(bloco, 'TRNAMT'));
    const descricao = campo(bloco, 'MEMO') ?? campo(bloco, 'NAME') ?? campo(bloco, 'PAYEE') ?? '';
    if (data && valor !== null && valor !== 0) {
      transacoes.push({ data, descricao: desfazerEntidades(descricao), valorCentavos: valor });
    }
  }
  return transacoes;
}
