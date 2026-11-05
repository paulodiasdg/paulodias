/** Estado devolvido pelas ações de formulário para a tela. */
export interface EstadoFormulario {
  ok?: boolean;
  erro?: string;
  mensagem?: string;
  campos?: Record<string, string>;
}

export const ESTADO_INICIAL: EstadoFormulario = {};
