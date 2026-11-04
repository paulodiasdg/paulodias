import { defineConfig, devices } from '@playwright/test';

const PORTA = 3100;
const naIntegracaoContinua = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: naIntegracaoContinua,
  retries: naIntegracaoContinua ? 1 : 0,
  reporter: naIntegracaoContinua ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORTA}`,
    locale: 'pt-BR',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'computador', use: { ...devices['Desktop Chrome'] } },
    { name: 'celular', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // No CI o build já foi feito; localmente o servidor de desenvolvimento basta.
    command: naIntegracaoContinua
      ? `pnpm exec next start -p ${PORTA}`
      : `pnpm exec next dev -p ${PORTA}`,
    url: `http://127.0.0.1:${PORTA}/entrar`,
    reuseExistingServer: !naIntegracaoContinua,
    timeout: 120_000,
  },
});
