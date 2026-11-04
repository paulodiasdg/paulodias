/**
 * Pesos e limites do índice de saúde financeira (regra 3.5 da spec). São uma proposta do
 * produto, não um padrão oficial. Limites em pontos-base: 10.000 = 100% (ou 1 mês, na reserva
 * de emergência).
 */
export const CONFIG_SAUDE = {
  compromissoDaRenda: {
    nome: 'Compromisso da renda',
    peso: 25,
    /** (Fixas + avulsas) ÷ renda: nota máxima até 50%, zero com 80% ou mais. */
    notaMaxima: 5_000,
    notaZero: 8_000,
  },
  capacidadeDePoupar: {
    nome: 'Capacidade de poupar',
    peso: 25,
    /** (Livre − variáveis estimados) ÷ renda: máxima com 20% ou mais, zero com 0% ou menos. */
    notaMaxima: 2_000,
    notaZero: 0,
  },
  reservaDeEmergencia: {
    nome: 'Reserva de emergência',
    peso: 20,
    /** Guardado ÷ (fixas + variáveis estimados), em meses: máxima com 6, zero com 0. */
    notaMaxima: 60_000,
    notaZero: 0,
  },
  contasEmDia: {
    nome: 'Contas em dia',
    peso: 15,
    /** Vencido ÷ compromissos do mês: máxima sem nada vencido, zero com 100% ou mais. */
    notaMaxima: 0,
    notaZero: 10_000,
  },
  ritmoDeGastos: {
    nome: 'Ritmo de gastos',
    peso: 15,
    /** Gasto ÷ (limite × fração do mês decorrida): máxima até 100%, zero com 150% ou mais. */
    notaMaxima: 10_000,
    notaZero: 15_000,
    /** Fração mínima do mês, em dias, para o começo do mês não distorcer o ritmo (C8). */
    diasMinimosDecorridos: 7,
  },
  faixas: [
    { minimo: 80, faixa: 'saudavel', nome: 'Saudável' },
    { minimo: 60, faixa: 'estavel', nome: 'Estável' },
    { minimo: 40, faixa: 'atencao', nome: 'Atenção' },
    { minimo: 0, faixa: 'critico', nome: 'Crítico' },
  ],
} as const;

export type ConfigSaude = typeof CONFIG_SAUDE;
export type FaixaDeSaude = ConfigSaude['faixas'][number]['faixa'];
