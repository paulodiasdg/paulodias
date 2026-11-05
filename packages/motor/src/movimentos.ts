import type { DataCivil } from './datas';
import { somar, type Centavos } from './dinheiro';
import type { MovimentoReserva } from './tipos';

/** Efeito do movimento no saldo: aporte soma, saque subtrai, ajuste vale com o próprio sinal. */
export function efeitoNoSaldo(movimento: MovimentoReserva): Centavos {
  return movimento.tipo === 'saque' ? -movimento.valorCentavos : movimento.valorCentavos;
}

export type Destino = { destino: 'contas' } | { destino: 'meta'; metaId: string };

function doDestino(movimentos: readonly MovimentoReserva[], destino: Destino): MovimentoReserva[] {
  return movimentos.filter((movimento) =>
    destino.destino === 'contas'
      ? movimento.destino === 'contas'
      : movimento.destino === 'meta' && movimento.metaId === destino.metaId,
  );
}

/** Saldo do destino ao fim do dia `ate`. */
export function saldoEm(
  movimentos: readonly MovimentoReserva[],
  destino: Destino,
  ate: DataCivil,
): Centavos {
  return somar(
    doDestino(movimentos, destino)
      .filter((movimento) => movimento.data <= ate)
      .map(efeitoNoSaldo),
  );
}

/**
 * Saldo da foto de segunda-feira (decisão D3): tudo o que aconteceu antes da semana, mais os
 * ajustes feitos nela até hoje. Aportes, saques e pagamentos da semana não mudam a foto, para
 * que o valor pedido não mude depois de registrado.
 */
export function saldoNoInicioDaSemana(
  movimentos: readonly MovimentoReserva[],
  destino: Destino,
  segunda: DataCivil,
  hoje: DataCivil,
): Centavos {
  return somar(
    doDestino(movimentos, destino)
      .filter(
        (movimento) =>
          movimento.data < segunda || (movimento.tipo === 'ajuste' && movimento.data <= hoje),
      )
      .map(efeitoNoSaldo),
  );
}

/** Aportes do destino entre `de` e `ate` (inclusive). */
export function aportesEntre(
  movimentos: readonly MovimentoReserva[],
  destino: Destino,
  de: DataCivil,
  ate: DataCivil,
): Centavos {
  return somar(
    doDestino(movimentos, destino)
      .filter((movimento) => movimento.tipo === 'aporte')
      .filter((movimento) => movimento.data >= de && movimento.data <= ate)
      .map((movimento) => movimento.valorCentavos),
  );
}
