/**
 * Datas civis no formato `AAAA-MM-DD`, sem hora e sem fuso. As contas usam o número do dia
 * (dias desde 1970-01-01) em aritmética inteira; o motor não usa o objeto Date.
 */
export type DataCivil = string;

/** Mês de competência no formato `AAAA-MM`. */
export type Competencia = string;

const FORMATO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const FORMATO_COMPETENCIA = /^(\d{4})-(\d{2})$/;

function doisDigitos(valor: number): string {
  return String(valor).padStart(2, '0');
}

export function ehBissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

export function diasNoMes(ano: number, mes: number): number {
  if (mes === 2) return ehBissexto(ano) ? 29 : 28;
  return [4, 6, 9, 11].includes(mes) ? 30 : 31;
}

export function lerData(data: DataCivil): { ano: number; mes: number; dia: number } {
  const partes = FORMATO_DATA.exec(data);
  if (!partes) throw new RangeError(`Data inválida: "${data}". Use AAAA-MM-DD.`);
  const ano = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasNoMes(ano, mes)) {
    throw new RangeError(`Data inexistente: "${data}".`);
  }
  return { ano, mes, dia };
}

export function montarData(ano: number, mes: number, dia: number): DataCivil {
  const data = `${String(ano).padStart(4, '0')}-${doisDigitos(mes)}-${doisDigitos(dia)}`;
  lerData(data);
  return data;
}

/** Dias desde 1970-01-01 (algoritmo days_from_civil, de Howard Hinnant). */
export function numeroDoDia(data: DataCivil): number {
  const { ano, mes, dia } = lerData(data);
  const anoAjustado = mes <= 2 ? ano - 1 : ano;
  const era = Math.floor(anoAjustado / 400);
  const anoDaEra = anoAjustado - era * 400;
  const mesDesdeMarco = (mes + 9) % 12;
  const diaDoAno = Math.floor((153 * mesDesdeMarco + 2) / 5) + dia - 1;
  const diaDaEra =
    anoDaEra * 365 + Math.floor(anoDaEra / 4) - Math.floor(anoDaEra / 100) + diaDoAno;
  return era * 146097 + diaDaEra - 719468;
}

/** Inverso de numeroDoDia (algoritmo civil_from_days, de Howard Hinnant). */
export function dataDoNumero(numero: number): DataCivil {
  const z = numero + 719468;
  const era = Math.floor(z / 146097);
  const diaDaEra = z - era * 146097;
  const anoDaEra = Math.floor(
    (diaDaEra -
      Math.floor(diaDaEra / 1460) +
      Math.floor(diaDaEra / 36524) -
      Math.floor(diaDaEra / 146096)) /
      365,
  );
  const diaDoAno =
    diaDaEra - (365 * anoDaEra + Math.floor(anoDaEra / 4) - Math.floor(anoDaEra / 100));
  const mesDesdeMarco = Math.floor((5 * diaDoAno + 2) / 153);
  const dia = diaDoAno - Math.floor((153 * mesDesdeMarco + 2) / 5) + 1;
  const mes = mesDesdeMarco < 10 ? mesDesdeMarco + 3 : mesDesdeMarco - 9;
  const ano = anoDaEra + era * 400 + (mes <= 2 ? 1 : 0);
  return montarData(ano, mes, dia);
}

export function somarDias(data: DataCivil, dias: number): DataCivil {
  return dataDoNumero(numeroDoDia(data) + dias);
}

/** Quantos dias vão de `de` até `ate` (negativo se `ate` vier antes). */
export function diferencaEmDias(de: DataCivil, ate: DataCivil): number {
  return numeroDoDia(ate) - numeroDoDia(de);
}

/** Dia da semana de 1 (segunda) a 7 (domingo). */
export function diaDaSemana(data: DataCivil): number {
  const resto = (((numeroDoDia(data) + 3) % 7) + 7) % 7;
  return resto + 1;
}

/** Segunda-feira da semana da data. A semana vai de segunda a domingo. */
export function inicioDaSemana(data: DataCivil): DataCivil {
  return somarDias(data, 1 - diaDaSemana(data));
}

/** Domingo da semana da data. */
export function fimDaSemana(data: DataCivil): DataCivil {
  return somarDias(inicioDaSemana(data), 6);
}

export function lerCompetencia(competencia: Competencia): { ano: number; mes: number } {
  const partes = FORMATO_COMPETENCIA.exec(competencia);
  const ano = Number(partes?.[1]);
  const mes = Number(partes?.[2]);
  if (!partes || mes < 1 || mes > 12) {
    throw new RangeError(`Competência inválida: "${competencia}". Use AAAA-MM.`);
  }
  return { ano, mes };
}

export function competenciaDe(data: DataCivil): Competencia {
  const { ano, mes } = lerData(data);
  return `${String(ano).padStart(4, '0')}-${doisDigitos(mes)}`;
}

export function somarMesesNaCompetencia(competencia: Competencia, meses: number): Competencia {
  const { ano, mes } = lerCompetencia(competencia);
  const indice = ano * 12 + (mes - 1) + meses;
  const novoAno = Math.floor(indice / 12);
  return `${String(novoAno).padStart(4, '0')}-${doisDigitos(indice - novoAno * 12 + 1)}`;
}

export function diasDaCompetencia(competencia: Competencia): number {
  const { ano, mes } = lerCompetencia(competencia);
  return diasNoMes(ano, mes);
}

export function primeiroDiaDa(competencia: Competencia): DataCivil {
  const { ano, mes } = lerCompetencia(competencia);
  return montarData(ano, mes, 1);
}

export function ultimoDiaDa(competencia: Competencia): DataCivil {
  const { ano, mes } = lerCompetencia(competencia);
  return montarData(ano, mes, diasNoMes(ano, mes));
}

/** Data do dia `dia` na competência. Dia 31 vira o último dia nos meses menores. */
export function dataNaCompetencia(competencia: Competencia, dia: number): DataCivil {
  const { ano, mes } = lerCompetencia(competencia);
  return montarData(ano, mes, Math.min(dia, diasNoMes(ano, mes)));
}

/** Mesmo dia do mês, `meses` depois; sem esse dia no mês de destino, usa o último. */
export function somarMeses(data: DataCivil, meses: number): DataCivil {
  const { dia } = lerData(data);
  return dataNaCompetencia(somarMesesNaCompetencia(competenciaDe(data), meses), dia);
}

/**
 * Meses de calendário de `de` até `ate` (decisão D1): meses completos mais a fração do mês
 * seguinte, contada pelos dias desse mês. Devolve a fração como
 * `(inteiros × diasDoMes + diasRestantes) ÷ diasDoMes`. Se `ate` não vem depois de `de`,
 * o resultado é zero.
 */
export function mesesDeCalendario(
  de: DataCivil,
  ate: DataCivil,
): { inteiros: number; diasRestantes: number; diasDoMes: number } {
  if (ate <= de) return { inteiros: 0, diasRestantes: 0, diasDoMes: 1 };

  const inicio = lerData(de);
  const fim = lerData(ate);
  let inteiros = (fim.ano - inicio.ano) * 12 + (fim.mes - inicio.mes);
  if (somarMeses(de, inteiros) > ate) inteiros -= 1;

  const base = somarMeses(de, inteiros);
  return {
    inteiros,
    diasRestantes: diferencaEmDias(base, ate),
    diasDoMes: diferencaEmDias(base, somarMeses(de, inteiros + 1)),
  };
}

export function menorData(a: DataCivil, b: DataCivil): DataCivil {
  return a <= b ? a : b;
}

export function maiorData(a: DataCivil, b: DataCivil): DataCivil {
  return a >= b ? a : b;
}
