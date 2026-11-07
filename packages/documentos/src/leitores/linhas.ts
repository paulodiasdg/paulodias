import type { Centavos } from '@no-azul/motor';
import type { Celula, DocumentoDeTexto, Linha } from '../documento';
import { centavosComSinal, dataNoInicio, normalizar, valoresNoTexto, type DiaEMes } from '../texto';

/**
 * Linhas de lançamento de faturas e extratos em PDF ou foto: uma data no começo, a descrição e o
 * valor. Colunas de saldo, linhas de saldo e totais ficam de fora.
 */
export interface LinhaDeLancamento {
  data: DiaEMes;
  descricao: string;
  /** Com sinal: negativo é saída, pagamento ou crédito, conforme o documento. */
  valorCentavos: Centavos;
  /** Saldo depois do lançamento, quando o extrato tem a coluna. */
  saldoCentavos: Centavos | null;
  confianca: { data: number; valor: number };
  indiceDaLinha: number;
}

/** Descrições que são resumo, não lançamento. */
const RESUMO =
  /^(saldo|total|subtotal|sub-total|limite|pagamento minimo|melhor dia|valor total|data de|resumo|lancamentos|transacoes)\b/;

function faixaDoSaldo(linha: Linha): { x0: number; x1: number } | null {
  const celula = linha.celulas.find((c) => /^saldo\b/.test(normalizar(c.texto)));
  return celula ? { x0: celula.x0, x1: celula.x1 } : null;
}

function ehCabecalho(linha: Linha): boolean {
  const texto = normalizar(linha.texto);
  return /\bdata\b/.test(texto) && /(valor|saldo|debito|credito)/.test(texto);
}

function sobrepoe(celula: Celula, faixa: { x0: number; x1: number }): boolean {
  const folga = (faixa.x1 - faixa.x0) * 0.5;
  return celula.x1 >= faixa.x0 - folga && celula.x0 <= faixa.x1 + folga;
}

function valorDaCelula(celula: Celula, anterior: Celula | undefined): Centavos | null {
  const valor = centavosComSinal(celula.texto);
  if (valor === null || !/,\d{2}|\.\d{2}\b/.test(celula.texto)) return null;
  // Sinal de menos ou "R$" separados do número pelo espaço de uma coluna.
  if (anterior && /^-\s*(R\$)?$/.test(anterior.texto.trim())) return -Math.abs(valor);
  return valor;
}

export function linhasDeLancamento(documento: DocumentoDeTexto): LinhaDeLancamento[] {
  const resultado: LinhaDeLancamento[] = [];
  let saldo: { x0: number; x1: number } | null = null;
  let paginaDoCabecalho = 0;

  documento.linhas.forEach((linha, indiceDaLinha) => {
    if (ehCabecalho(linha)) {
      saldo = faixaDoSaldo(linha);
      paginaDoCabecalho = linha.pagina;
      return;
    }
    if (linha.pagina !== paginaDoCabecalho) saldo = null;

    const primeira = linha.celulas[0];
    if (!primeira) return;
    const data = dataNoInicio(primeira.texto);
    if (!data) return;

    // A descrição pode vir colada na data, na mesma célula.
    const restoDaPrimeira = primeira.texto.slice(data.tamanho).trim();
    const celulas: Celula[] = [
      ...(restoDaPrimeira ? [{ ...primeira, texto: restoDaPrimeira }] : []),
      ...linha.celulas.slice(1),
    ];

    let indiceDoValor = -1;
    let valor: Centavos | null = null;
    let saldoDaLinha: Centavos | null = null;
    const faixa: { x0: number; x1: number } | null = saldo;
    const ehSaldo = (celula: Celula) => faixa !== null && sobrepoe(celula, faixa);
    for (const celula of celulas) {
      if (ehSaldo(celula)) saldoDaLinha = centavosComSinal(celula.texto);
    }
    for (let i = 0; i < celulas.length; i++) {
      const celula = celulas[i];
      if (!celula || i === 0) continue;
      if (ehSaldo(celula)) continue;
      const lido = valorDaCelula(celula, celulas[i - 1]);
      if (lido !== null) {
        indiceDoValor = i;
        valor = lido;
        break;
      }
    }

    let descricao: string;
    let confiancaDoValor: number;
    if (valor !== null && indiceDoValor > 0) {
      descricao = celulas
        .slice(0, indiceDoValor)
        .map((c) => c.texto)
        .filter((t) => !/^-?\s*(R\$)?$/.test(t.trim()))
        .join(' ');
      confiancaDoValor = celulas[indiceDoValor]?.confianca ?? linha.confianca;
    } else {
      // Valor colado no fim da descrição, sem espaço de coluna.
      const semSaldo = celulas.filter((c) => !ehSaldo(c));
      const ultima = semSaldo[semSaldo.length - 1];
      const valores = ultima ? valoresNoTexto(ultima.texto) : [];
      const final = valores[valores.length - 1];
      if (!ultima || !final || ultima.texto.slice(final.fim).trim() !== '') return;
      valor = final.centavos;
      descricao = [
        ...semSaldo.slice(0, -1).map((c) => c.texto),
        ultima.texto.slice(0, final.inicio),
      ]
        .join(' ')
        .replace(/\s*-?\s*(R\$)?\s*$/, '');
      confiancaDoValor = ultima.confianca;
    }

    descricao = descricao.replace(/\s+/g, ' ').trim();
    if (!descricao || valor === null || valor === 0) return;
    // A descrição precisa ter texto: uma linha só de datas e valores é resumo.
    if (!/[a-zA-ZÀ-ú]{2,}/.test(descricao.replace(/R\$/g, ''))) return;
    if (RESUMO.test(normalizar(descricao))) return;

    resultado.push({
      data,
      descricao,
      valorCentavos: valor,
      saldoCentavos: saldoDaLinha,
      confianca: { data: primeira.confianca, valor: confiancaDoValor },
      indiceDaLinha,
    });
  });
  return conferirPeloSaldo(resultado);
}

/**
 * Com a coluna de saldo, a diferença entre um saldo e o anterior é o valor do lançamento: ela
 * confirma o sinal (entrada ou saída) quando o documento não o mostra bem.
 */
function conferirPeloSaldo(linhas: LinhaDeLancamento[]): LinhaDeLancamento[] {
  let anterior: Centavos | null = null;
  return linhas.map((linha) => {
    const saldoAtual = linha.saldoCentavos;
    const conferida =
      anterior !== null &&
      saldoAtual !== null &&
      Math.abs(saldoAtual - anterior) === Math.abs(linha.valorCentavos)
        ? { ...linha, valorCentavos: saldoAtual - anterior }
        : linha;
    if (saldoAtual !== null) anterior = saldoAtual;
    return conferida;
  });
}
