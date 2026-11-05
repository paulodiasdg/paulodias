'use client';

import { useEffect } from 'react';

/** Apaga um cookie de aviso depois que ele foi mostrado, para não aparecer de novo. */
export function ApagarCookie({ nome }: { nome: string }) {
  useEffect(() => {
    document.cookie = `${nome}=; Max-Age=0; path=/; SameSite=Lax`;
  }, [nome]);
  return null;
}
