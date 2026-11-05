// Gera apps/web/.env.local com o endereço e a chave pública do Supabase local.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let status;
try {
  status = JSON.parse(
    execFileSync('supabase', ['status', '-o', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      // No Windows, a CLI instalada pelo pnpm é um atalho .cmd, que só roda pelo shell.
      shell: process.platform === 'win32',
    }),
  );
} catch (erro) {
  console.error('Supabase local não está rodando. Rode `pnpm db:start` antes.');
  const detalhe = String(erro?.stderr ?? erro?.message ?? '').trim();
  if (detalhe) console.error(`Detalhe: ${detalhe}`);
  process.exit(1);
}

const destino = fileURLToPath(new URL('../apps/web/.env.local', import.meta.url));
writeFileSync(
  destino,
  [
    `NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${status.PUBLISHABLE_KEY}`,
    '',
  ].join('\n'),
);
console.log(`Gerado ${destino}`);
