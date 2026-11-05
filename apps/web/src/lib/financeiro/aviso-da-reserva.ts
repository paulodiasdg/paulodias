import { motivosDaMudanca, type MotivoDeMudanca, type ReservaDeContas } from '@no-azul/motor';
import { formatarData, formatarReais } from '@/lib/formatacao';

/** Aviso mostrado depois de um cadastro que mudou o valor da semana para contas (D3). */
export interface AvisoDaReserva {
  deCentavos: number;
  paraCentavos: number;
  motivos: string[];
}

export const COOKIE_DO_AVISO = 'no-azul-aviso-reserva';

/** Quantos motivos o aviso lista; o resto vira "e mais N mudanças". */
const MOTIVOS_NO_AVISO = 4;

function descrever(motivo: MotivoDeMudanca): string | null {
  switch (motivo.tipo) {
    case 'conta_incluida':
      return `Entrou ${motivo.conta.nome}: ${formatarReais(motivo.conta.valorCentavos)}, vence em ${formatarData(motivo.conta.vencimento)}.`;
    case 'conta_removida':
      return `Saiu ${motivo.conta.nome}: ${formatarReais(motivo.conta.valorCentavos)}, que vencia em ${formatarData(motivo.conta.vencimento)}.`;
    case 'valor_alterado':
      return `${motivo.conta.nome}, que vence em ${formatarData(motivo.conta.vencimento)}, mudou de ${formatarReais(motivo.deCentavos)} para ${formatarReais(motivo.paraCentavos)}.`;
    case 'vencimento_alterado':
      return `${motivo.conta.nome} passou a vencer em ${formatarData(motivo.para)}, e não mais em ${formatarData(motivo.de)}.`;
    case 'saldo_ajustado':
      return `O saldo da reserva no início da semana foi corrigido de ${formatarReais(motivo.deCentavos)} para ${formatarReais(motivo.paraCentavos)}.`;
    case 'nova_semana':
      return null;
  }
}

/** Monta o aviso quando o valor da semana mudou; null quando não mudou. */
export function avisoDaMudanca(
  antes: ReservaDeContas,
  depois: ReservaDeContas,
): AvisoDaReserva | null {
  if (antes.valorSemanalCentavos === depois.valorSemanalCentavos) return null;
  const descritos = motivosDaMudanca(antes, depois)
    .map(descrever)
    .filter((texto): texto is string => texto !== null);
  const motivos = descritos.slice(0, MOTIVOS_NO_AVISO);
  const resto = descritos.length - motivos.length;
  if (resto > 0) motivos.push(`E mais ${resto} ${resto === 1 ? 'mudança' : 'mudanças'}.`);
  return {
    deCentavos: antes.valorSemanalCentavos,
    paraCentavos: depois.valorSemanalCentavos,
    motivos,
  };
}

export function codificarAviso(aviso: AvisoDaReserva): string {
  return encodeURIComponent(JSON.stringify(aviso));
}

/** Lê o aviso do cookie; qualquer coisa fora do formato é ignorada. */
export function decodificarAviso(valor: string | undefined): AvisoDaReserva | null {
  if (!valor) return null;
  try {
    const aviso = JSON.parse(decodeURIComponent(valor)) as Partial<AvisoDaReserva>;
    if (
      !Number.isSafeInteger(aviso.deCentavos) ||
      !Number.isSafeInteger(aviso.paraCentavos) ||
      !Array.isArray(aviso.motivos) ||
      !aviso.motivos.every((m) => typeof m === 'string')
    ) {
      return null;
    }
    return aviso as AvisoDaReserva;
  } catch {
    return null;
  }
}
