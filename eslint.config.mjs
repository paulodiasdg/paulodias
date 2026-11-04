import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const arquivosWeb = ['apps/web/**/*.{ts,tsx,mjs}'];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'apps/web/next-env.d.ts',
      'apps/web/src/lib/supabase/tipos-banco.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  ...[...nextVitals, ...nextTypescript].map((config) => ({ ...config, files: arquivosWeb })),
  {
    files: arquivosWeb,
    settings: { next: { rootDir: 'apps/web' } },
  },
  {
    // Regras 1 a 3 do CLAUDE.md: o motor é puro e recebe a data atual como parâmetro.
    files: ['packages/motor/src/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'O motor recebe a data atual como parâmetro (CLAUDE.md, regra 3).',
        },
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'O motor recebe a data atual como parâmetro (CLAUDE.md, regra 3).',
        },
        {
          selector: "MemberExpression[object.name='process']",
          message: 'O motor não lê variáveis de ambiente nem o processo (CLAUDE.md, regra 1).',
        },
        {
          selector: "CallExpression[callee.name='parseFloat']",
          message: 'Valores monetários são centavos inteiros (CLAUDE.md, regra 2).',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'node:*',
                'fs',
                'path',
                'pg',
                '@supabase/*',
                'next',
                'next/*',
                'react',
                'react/*',
              ],
              message:
                'O motor é puro: sem banco, rede, tela ou sistema de arquivos (CLAUDE.md, regra 1).',
            },
          ],
        },
      ],
    },
  },
);
