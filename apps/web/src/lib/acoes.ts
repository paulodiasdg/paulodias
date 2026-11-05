import 'server-only';
import { revalidatePath } from 'next/cache';
import { ErroDeValidacao } from './formatacao';
import type { EstadoFormulario } from './estado-formulario';
import { camposDigitados } from './formularios';
import type { Resultado } from './financeiro/operacoes';

/**
 * Executa uma operação a partir de um formulário: valida, grava, atualiza as telas afetadas e
 * devolve o estado para a tela. Erros de validação voltam como mensagem; os demais sobem.
 */
export async function executar(
  formulario: FormData,
  operacao: () => Promise<Resultado>,
  telas: string[],
  mensagem?: string,
): Promise<EstadoFormulario> {
  try {
    const resultado = await operacao();
    if (!resultado.ok) return { erro: resultado.erro, campos: camposDigitados(formulario) };
  } catch (erro) {
    if (erro instanceof ErroDeValidacao) {
      return { erro: erro.message, campos: camposDigitados(formulario) };
    }
    throw erro;
  }
  for (const tela of telas) revalidatePath(tela);
  return { ok: true, ...(mensagem ? { mensagem } : {}) };
}
