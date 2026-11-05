import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Testes que gravam no Supabase local (pnpm db:start). */
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['src/**/*.integracao.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
