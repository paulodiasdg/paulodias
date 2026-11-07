import { normalizar } from '../texto';
import type { TipoDeDocumento } from '../tipos';

type Pista = [RegExp, number];

/** Palavras que indicam o tipo do documento, com o peso de cada uma. */
const PISTAS: Record<TipoDeDocumento, Pista[]> = {
  comprovante: [
    [/\bcomprovante\b/, 5],
    [/\bpix (enviado|recebido)\b|transferencia pix|pix por qr/, 4],
    [
      /documento auxiliar da (nota fiscal|nfc-e)|\bnfc-e\b|cupom fiscal|nota fiscal de consumidor/,
      5,
    ],
    [/\bted\b/, 1],
    [/\bvalor pago\b/, 2],
    [/\bautenticacao\b/, 1],
  ],
  boleto: [
    [/local de pagamento/, 4],
    [/ficha de compensacao/, 3],
    [/\bbeneficiario\b/, 2],
    [/nosso numero/, 3],
    [/conta de (energia|luz|agua|gas)/, 4],
    [/\bkwh\b|\bm³|\bm3\b/, 2],
    [/total a pagar|valor a pagar/, 2],
    [/leitura (anterior|atual)|data da leitura/, 2],
    [/\bvencimento\b/, 1],
    [/saneamento|energia eletrica|gas (encanado|canalizado)/, 2],
  ],
  fatura_cartao: [
    [/fatura (do|de) cartao|cartao de credito/, 4],
    [/total (da|desta) fatura/, 4],
    [/pagamento minimo/, 3],
    [/limite (total|disponivel)/, 2],
    [/melhor dia de compra/, 2],
    [/\bfatura\b/, 1],
  ],
  extrato: [
    [/\bextrato\b/, 4],
    [/saldo anterior/, 3],
    [/saldo do dia/, 3],
    [/conta corrente/, 2],
    [/\bhistorico\b/, 1],
  ],
  contracheque: [
    [/contracheque|holerite|demonstrativo de pagamento/, 5],
    [/recibo de pagamento a autonomo|\brpa\b/, 5],
    [/folha de pagamento/, 4],
    [/\bproventos\b|total de vencimentos/, 2],
    [/liquido a receber|valor liquido|total liquido/, 3],
    [/\b(inss|irrf|fgts)\b/, 1],
    [/salario base/, 2],
  ],
};

export function pontuarTipos(texto: string): Record<TipoDeDocumento, number> {
  const normal = normalizar(texto);
  const pontos = { comprovante: 0, boleto: 0, fatura_cartao: 0, extrato: 0, contracheque: 0 };
  for (const [tipo, pistas] of Object.entries(PISTAS) as [TipoDeDocumento, Pista[]][]) {
    for (const [padrao, peso] of pistas) if (padrao.test(normal)) pontos[tipo] += peso;
  }
  return pontos;
}

/**
 * Tipo pelas palavras do documento. O começo do documento pesa mais: "Comprovante de pagamento"
 * no título vence o código de barras citado no corpo. Comprovante, boleto e contracheque têm um
 * lançamento só; com várias linhas de data e valor, o documento é extrato ou fatura.
 */
export function detectarTipo(texto: string, linhasDeLancamento = 0): TipoDeDocumento {
  const titulo = texto.split('\n').slice(0, 6).join('\n');
  const noCorpo = pontuarTipos(texto);
  const noTitulo = pontuarTipos(titulo);
  const varias = linhasDeLancamento >= 4;
  const pontos = (Object.keys(noCorpo) as TipoDeDocumento[]).map((tipo) => {
    const unico = tipo === 'comprovante' || tipo === 'boleto' || tipo === 'contracheque';
    return [tipo, noCorpo[tipo] + noTitulo[tipo] - (varias && unico ? 10 : 0)] as const;
  });
  const [melhor] = [...pontos].sort((a, b) => b[1] - a[1]);
  return melhor && melhor[1] > 0 ? melhor[0] : 'comprovante';
}
