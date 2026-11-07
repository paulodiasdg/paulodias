import type { Centavos, DataCivil } from '@no-azul/motor';
import type { TransacaoDoOfx } from '../ofx';
import { centavosComSinal, lerDataCompleta, normalizar } from '../texto';
import type { LancamentoExtraido, TipoDeDocumento } from '../tipos';
import { naturezaNaFatura, novoLancamento, tipoNoExtrato } from './comum';
import type { Parcial } from './documentos';

interface Colunas {
  data: number;
  descricao: number;
  valor: number | null;
  debito: number | null;
  credito: number | null;
}

function indice(cabecalho: readonly string[], padrao: RegExp): number | null {
  const achado = cabecalho.findIndex((celula) => padrao.test(normalizar(celula)));
  return achado >= 0 ? achado : null;
}

/** Acha a linha de cabeçalho (data, descrição e valor ou débito e crédito) e as colunas. */
function acharColunas(tabela: readonly string[][]): { linha: number; colunas: Colunas } | null {
  for (let linha = 0; linha < Math.min(tabela.length, 30); linha++) {
    const cabecalho = tabela[linha] ?? [];
    const data = indice(cabecalho, /^(data|dt\.?|date)\b/);
    const descricao = indice(
      cabecalho,
      /(historico|descricao|lancamento|detalhe|memo|estabelecimento|title|description)/,
    );
    const valor = indice(cabecalho, /^(valor|montante|quantia|amount)\b/);
    const debito = indice(cabecalho, /^(debito|saida|saidas)\b/);
    const credito = indice(cabecalho, /^(credito|entrada|entradas)\b/);
    if (
      data !== null &&
      descricao !== null &&
      (valor !== null || debito !== null || credito !== null)
    ) {
      return { linha, colunas: { data, descricao, valor, debito, credito } };
    }
  }
  return null;
}

function valorDaLinha(celulas: readonly string[], colunas: Colunas): Centavos | null {
  if (colunas.valor !== null) return centavosComSinal(celulas[colunas.valor] ?? '');
  const debito = colunas.debito !== null ? centavosComSinal(celulas[colunas.debito] ?? '') : null;
  const credito =
    colunas.credito !== null ? centavosComSinal(celulas[colunas.credito] ?? '') : null;
  if (debito) return -Math.abs(debito);
  if (credito) return Math.abs(credito);
  return null;
}

function lancamentoDaLinha(
  data: DataCivil,
  descricao: string,
  valor: Centavos,
  tipoDoDocumento: TipoDeDocumento,
): LancamentoExtraido {
  if (tipoDoDocumento === 'fatura_cartao') {
    // Na fatura em planilha, compra vem positiva e crédito, negativo.
    const { tipo, natureza } = naturezaNaFatura(descricao, -valor);
    return novoLancamento({
      data,
      descricao,
      valorCentavos: Math.abs(valor),
      tipo,
      natureza,
      marcado: natureza !== 'pagamento_de_fatura',
    });
  }
  return novoLancamento({
    data,
    descricao,
    valorCentavos: Math.abs(valor),
    tipo: tipoNoExtrato(descricao, valor),
  });
}

/** Extrato (ou fatura) em CSV ou XLSX. */
export function lerTabela(tabela: readonly string[][], tipoDoDocumento: TipoDeDocumento): Parcial {
  const resultado: Parcial = {
    emissor: null,
    competencia: null,
    conta: null,
    lancamentos: [],
    avisos: [],
  };
  const achadas = acharColunas(tabela);
  if (!achadas) {
    resultado.avisos.push('Não achei as colunas de data, descrição e valor na planilha.');
    return resultado;
  }
  const { linha: cabecalho, colunas } = achadas;
  const titulo = tabela
    .slice(0, cabecalho)
    .map((l) => l.find((c) => c.trim() !== ''))
    .find((c): c is string => Boolean(c));
  resultado.emissor = titulo ? (titulo.split(/\s+[-–]\s+/)[0] ?? null) : null;

  for (const celulas of tabela.slice(cabecalho + 1)) {
    const data = lerDataCompleta(celulas[colunas.data] ?? '');
    const descricao = (celulas[colunas.descricao] ?? '').replace(/\s+/g, ' ').trim();
    const valor = valorDaLinha(celulas, colunas);
    if (!data || !descricao || valor === null || valor === 0) continue;
    if (/^saldo\b/.test(normalizar(descricao))) continue;
    resultado.lancamentos.push(lancamentoDaLinha(data, descricao, valor, tipoDoDocumento));
  }
  if (resultado.lancamentos.length === 0)
    resultado.avisos.push('Não achei lançamentos na planilha.');
  return resultado;
}

/** Extrato em OFX: os campos do padrão já trazem data e valor com sinal. */
export function lerTransacoesDoOfx(transacoes: readonly TransacaoDoOfx[]): Parcial {
  return {
    emissor: null,
    competencia: null,
    conta: null,
    lancamentos: transacoes.map((t) =>
      novoLancamento({
        data: t.data,
        descricao: t.descricao.replace(/\s+/g, ' ').trim() || 'Lançamento do extrato',
        valorCentavos: Math.abs(t.valorCentavos),
        tipo: tipoNoExtrato(t.descricao, t.valorCentavos),
      }),
    ),
    avisos: transacoes.length === 0 ? ['Não achei lançamentos no OFX.'] : [],
  };
}
