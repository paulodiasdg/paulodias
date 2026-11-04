import type { Metadata } from 'next';
import { FormularioCadastro } from './formulario-cadastro';

export const metadata: Metadata = { title: 'Criar cadastro · No Azul' };

export default function PaginaCriarCadastro() {
  return <FormularioCadastro />;
}
