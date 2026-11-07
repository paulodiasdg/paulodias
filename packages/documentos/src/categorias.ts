import { normalizar } from './texto';
import type { TipoDeLancamento } from './tipos';

/**
 * Categoria sugerida pela descrição: primeiro a que a pessoa já usou para uma descrição parecida,
 * depois uma lista de palavras. Os slugs são os das categorias padrão (migração inicial).
 */

/** Palavras que não ajudam a comparar descrições. */
const GENERICAS = new Set([
  'pix',
  'enviado',
  'recebido',
  'compra',
  'compras',
  'pagamento',
  'pagto',
  'pgto',
  'cartao',
  'deb',
  'debito',
  'credito',
  'ted',
  'doc',
  'transferencia',
  'parc',
  'parcela',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'e',
  'em',
  'ltda',
  'sa',
  'me',
  'com',
  'br',
  'www',
  'loja',
]);

/** Palavras relevantes de uma descrição, sem acentos, números e palavras genéricas. */
export function palavrasDaDescricao(descricao: string): Set<string> {
  return new Set(
    normalizar(descricao)
      .replace(/[^a-z ]/g, ' ')
      .split(' ')
      .filter((p) => p.length >= 2 && !GENERICAS.has(p)),
  );
}

/** Metade ou mais das palavras em comum (pela descrição menor). */
export function descricoesParecidas(a: string, b: string): boolean {
  const pa = palavrasDaDescricao(a);
  const pb = palavrasDaDescricao(b);
  if (pa.size === 0 || pb.size === 0) return false;
  const comuns = [...pa].filter((p) => pb.has(p)).length;
  return comuns / Math.min(pa.size, pb.size) >= 0.5;
}

type Regra = [RegExp, string];

const REGRAS_DE_DESPESA: Regra[] = [
  [
    /\b(ifood|restaurante|lanchonete|lanches|pizzaria|hamburgueria|bar|cafeteria|delivery|rappi|sabor)\b/,
    'restaurantes',
  ],
  [
    /\b(mercado|supermercado|hortifruti|padaria|acougue|atacadao|sacolao|feira|pao)\b/,
    'alimentacao',
  ],
  [
    /\b(uber|99app|99 pop|taxi|posto|combustivel|gasolina|estacionamento|pedagio|metro|onibus|app transporte|transporte)\b/,
    'transporte',
  ],
  [
    /\b(farmacia|drogaria|clinica|laboratorio|hospital|medico|dentista|plano de saude|saude)\b/,
    'saude',
  ],
  [
    /\b(netflix|spotify|streaming|assinatura|app store|google play|prime video|disney|youtube)\b/,
    'assinaturas',
  ],
  [/\b(cinema|teatro|show|ingresso|parque|museu|livraria|lazer)\b/, 'lazer'],
  [/\b(hotel|pousada|hostel|airbnb|passagem|aerea|viagem|turismo)\b/, 'viagens'],
  [/\b(barbearia|salao|perfumaria|cosmetico|academia|estetica|manicure)\b/, 'cuidados_pessoais'],
  [/\b(escola|curso|faculdade|universidade|idiomas|mensalidade|material escolar)\b/, 'educacao'],
  [/\b(iof|juros|anuidade|tarifa|multa|imposto|ipva|iptu|taxa)\b/, 'impostos_taxas'],
  [/\b(aluguel|condominio|imobiliaria)\b/, 'moradia'],
  [
    /\b(energia|luz|agua|saneamento|esgoto|gas|internet|fibranet|fibra|telefone|celular|telecom)\b/,
    'contas_da_casa',
  ],
  [/\b(brinquedo|brinquedos|presente|presentes|doacao|floricultura)\b/, 'presentes_doacoes'],
  [
    /\b(moda|marketplace|amazon|magazine|eletro|moveis|tech|papelaria|roupa|calcados|shopping)\b/,
    'compras',
  ],
  [/\b(pagamento fatura|pagto fatura|fatura cartao)\b/, 'pagamento_fatura'],
];

const REGRAS_DE_RECEITA: Regra[] = [
  [/\b(salario|folha|holerite|contracheque|vencimentos|ted recebida)\b/, 'salario'],
  [/\b(rpa|autonomo|servico prestado|honorarios|cliente)\b/, 'trabalho_autonomo'],
];

export interface CategoriaDoHistorico {
  descricao: string;
  categoria: string;
}

export function sugerirCategoria(
  descricao: string,
  tipo: TipoDeLancamento,
  historico: readonly CategoriaDoHistorico[] = [],
  disponiveis?: ReadonlySet<string>,
): string | null {
  const permitida = (slug: string | null) =>
    slug && (!disponiveis || disponiveis.has(slug)) ? slug : null;

  if (tipo === 'transferencia') {
    return permitida(/fatura/.test(normalizar(descricao)) ? 'pagamento_fatura' : 'transferencia');
  }
  // O que a pessoa já escolheu vale mais que a lista de palavras (o mais recente primeiro).
  for (let i = historico.length - 1; i >= 0; i--) {
    const item = historico[i];
    if (item && descricoesParecidas(item.descricao, descricao)) {
      const slug = permitida(item.categoria);
      if (slug) return slug;
    }
  }
  const texto = ` ${normalizar(descricao)} `;
  const regras = tipo === 'receita' ? REGRAS_DE_RECEITA : REGRAS_DE_DESPESA;
  for (const [padrao, slug] of regras) {
    if (padrao.test(texto)) return permitida(slug);
  }
  return permitida(tipo === 'receita' ? 'outras_receitas' : null);
}
