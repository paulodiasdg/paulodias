// Gera apps/web/.env.local com o endereço e a chave pública do Supabase local.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let status;
try {
  status = JSON.parse(
    execFileSync('supabase', ['status', '-o', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }),
  );
} catch {
  console.error('Supabase local não está rodando. Rode `pnpm db:start` antes.');
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
