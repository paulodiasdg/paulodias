# No Azul

Sistema de controle financeiro pessoal que lê documentos e diz, toda semana, quanto guardar para pagar as contas e cumprir as metas.

- Especificação: `docs/SPEC.md` (fonte da verdade do produto).
- Revisão da especificação, decisões e plano por etapa: `docs/PLANO.md`. Uma decisão aprovada ali prevalece sobre o texto original da spec.
- Estado atual: **Etapa 4 (painel e planejamento) entregue; aguardando o Paulo conferir os testes para começar a Etapa 5 (leitura de documentos).** Atualize esta linha ao concluir cada etapa.

## Stack

| Camada                  | Escolha                                                      |
| ----------------------- | ------------------------------------------------------------ |
| Interface e servidor    | Next.js (App Router) com TypeScript estrito                  |
| Estilo e gráficos       | Tailwind CSS e Recharts                                      |
| Banco, login e arquivos | Supabase (PostgreSQL, Auth, Storage) com Row Level Security  |
| Leitura de documentos   | API do Claude, saída validada com Zod (Etapa 5)              |
| Segundo plano           | Fila de tarefas, Inngest ou Trigger.dev (decidir na Etapa 5) |
| Testes                  | Vitest (unidade e isolamento) e Playwright (ponta a ponta)   |
| Monorepo                | pnpm workspaces, Node 22                                     |
| Hospedagem              | Vercel e Supabase                                            |

As versões ficam fixadas nos `package.json`. Não troque biblioteca da stack sem combinar antes.

## Estrutura

```text
apps/web/             telas, rotas e ações do servidor
packages/motor/       cálculos financeiros puros e seus testes
packages/documentos/  preparação, extração e cruzamento de documentos (Etapa 5)
supabase/             config, migrações e testes de isolamento (supabase/testes)
scripts/              utilitários de desenvolvimento
docs/                 SPEC.md e PLANO.md
.github/workflows/    integração contínua
```

- `apps/web/src/proxy.ts` renova a sessão e protege as rotas (Next.js 16 trocou `middleware` por `proxy`).
- `apps/web/src/lib/supabase/tipos-banco.ts` é gerado por `pnpm db:types`; não edite à mão. O CI falha se ele estiver desatualizado em relação às migrações.
- `supabase/testes/tabelas.ts` lista todas as tabelas. Tabela nova entra nessa lista e nos casos de `isolamento.test.ts`, senão o meta-teste falha.
- O Next.js instalado traz a documentação da versão em `node_modules/next/dist/docs/`; consulte antes de usar APIs do framework.
- `apps/web/src/lib/financeiro/` liga o app ao banco: `carregar.ts` lê os dados de quem está logado e os converte para o motor; `operacoes.ts` grava as mudanças. Operações de várias tabelas (pagar, desfazer, receber, excluir meta) chamam funções do banco que gravam tudo em uma transação; o que elas gravam vem do motor (`planoDePagamento`).
- O "hoje" do app é o horário de Brasília (`hojeNoBrasil()` em `apps/web/src/lib/formatacao.ts`); é ele que vai para o motor.
- Imports dentro de `packages/motor` não levam extensão (`./datas`, não `./datas.js`): o Turbopack do Next não resolve `.js` para `.ts`.
- `packages/motor/src/index.ts` é a API pública do motor; `resumoDaSemana(dados, hoje)` devolve tudo o que o painel mostra. `packages/motor/src/testes/cenario-3-6.ts` monta o cenário da seção 3.6 da spec.
- Planejamento no motor: `agendaDeReservas` e `projecaoDeMeses` (`plano.ts`, sobre a simulação `simularPlano`), `comparacao503020`, `alertasDaSemana`, `gastosDaSemana`, `semanaPassada`. As regras estão em `docs/PLANO.md`, seção 4c.
- Todo número que o painel e o planejamento mostram passa pelos componentes `Valor` (reais) e `Numero` (`apps/web/src/components/numeros.tsx`), com uma chave. O teste de aceite (`apps/web/e2e/painel.spec.ts`) calcula os mesmos números com o motor em `e2e/painel-esperado.ts` e falha se a tela mostrar um "R$" fora deles. Número novo na tela entra nos dois lugares.
- Gráficos com Recharts só desenham; os valores ficam em texto ao lado, para leitura de tela e para o teste.

## Comandos

Primeira vez: `pnpm install`, `pnpm db:start` e `pnpm env:local`; depois `pnpm dev`.

```bash
pnpm install                       # dependências
pnpm dev                           # app em http://localhost:3000 (precisa do Supabase local)
pnpm build                         # build de produção do app
pnpm lint                          # ESLint (inclui as regras de pureza do motor)
pnpm typecheck                     # tsc em todos os pacotes e nos testes de isolamento
pnpm format                        # Prettier (pnpm format:check só confere)
pnpm test                          # testes unitários de todos os pacotes (Vitest)
pnpm --filter @no-azul/motor test  # só o motor
pnpm --filter @no-azul/motor test:cobertura  # motor com relatório de cobertura
pnpm db:start                      # sobe o Supabase local (Docker), sem Studio e serviços extras
pnpm db:reset                      # recria o banco local aplicando as migrações
pnpm db:stop                       # derruba o Supabase local
pnpm db:types                      # gera os tipos TypeScript do banco
pnpm env:local                     # gera apps/web/.env.local a partir do Supabase local
pnpm test:rls                      # isolamento entre usuários (precisa do Supabase local)
pnpm test:integracao               # operações do app gravando no banco local (precisa do Supabase local)
pnpm test:e2e                      # Playwright, computador e celular (precisa do Supabase local)
```

Antes de dar uma tarefa por concluída, rode `pnpm lint`, `pnpm typecheck` e `pnpm test`. Se mexer em migração, política ou operação do app, rode também `pnpm db:reset`, `pnpm db:types`, `pnpm test:rls` e `pnpm test:integracao`. Se mexer em tela ou rota, rode `pnpm test:e2e`.

Para o Supabase completo, com Studio, use `pnpm exec supabase start`.

### Sessões na nuvem do Claude Code

- O Docker não sobe sozinho: rode `sudo dockerd` em segundo plano antes de `pnpm db:start`.
- O registro padrão das imagens do Supabase (`public.ecr.aws`) é bloqueado pela rede. Use o Docker Hub: `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io pnpm db:start`. Se o Docker Hub responder 429 (limite de requisições), espere um pouco e tente `docker pull` da imagem que falhou.
- O Chromium do Playwright já vem instalado; não rode `playwright install`. A versão de `@playwright/test` precisa continuar igual à do ambiente (1.63.0).

## Regras do projeto

Estas regras não têm exceção. Se uma tarefa parecer exigir quebrar alguma, pare e pergunte.

1. **Cálculos financeiros ficam em `packages/motor`, como funções puras.** O motor não acessa banco, rede, relógio, variáveis de ambiente nem tela. Telas e rotas só chamam o motor e exibem o resultado; nenhum número financeiro é calculado fora dele.
2. **Valores monetários usam centavos inteiros, nunca ponto flutuante.** No banco, `bigint`; no TypeScript, o tipo `Centavos` (inteiro). Toda divisão passa por um helper de arredondamento explícito do motor (para cima, para baixo ou ao mais próximo, conforme `docs/PLANO.md`). Conversão para reais com vírgula só na exibição.
3. **A data atual é sempre passada como parâmetro para o motor.** Nada de `new Date()` ou `Date.now()` dentro de `packages/motor`. Datas do domínio são datas civis `AAAA-MM-DD`, sem fuso; a semana vai de segunda a domingo.
4. **Toda regra financeira nova vem com teste.** O teste entra no mesmo commit da regra. O cenário da seção 3.6 da spec é teste de regressão e nunca pode quebrar.
5. **Toda tabela tem Row Level Security e teste de isolamento entre usuários.** Tabela nova sem RLS, sem política ou sem caso no teste de isolamento não entra. Referências entre tabelas usam chave estrangeira composta com `usuario_id`, para que um usuário não aponte para linha de outro.
6. **Dados de documento nunca entram nos cálculos sem aprovação do usuário.** O motor só recebe lançamentos e contas já gravados; extração em revisão fica em `documentos.extracao_json` e não é lida por nenhum cálculo.
7. **Interface e mensagens em português do Brasil.** Vale para telas, erros, e-mails e textos de validação. Moeda no formato `R$ 1.234,56` e datas `dd/mm/aaaa`.

## Convenções

- Nomes do domínio em português, como na spec: tabelas, colunas, tipos e funções do motor (`calcularReservaContas`, `planoMetas`). Termos técnicos genéricos podem ficar em inglês.
- Glossário: **conta** é conta a pagar (ocorrência de despesa fixa ou conta avulsa); **reserva de contas** é o saldo guardado para pagá-las; **cadastro** é a conta do usuário no sistema.
- Saldos nunca são editados direto: tudo sai de `movimentos_reserva`, e correções entram como movimento `ajuste`.
- Pagar conta grava pagamento, lançamento e movimento da reserva na mesma transação.
- Segredos (chave da API do Claude, chave de serviço do Supabase) só no servidor. Nunca use prefixo `NEXT_PUBLIC_` para eles.
- Logs não levam conteúdo de documento nem valores financeiros.
- Pesos e limites do índice de saúde ficam em arquivo de configuração do motor, não espalhados no código.

## Fluxo de trabalho

- O desenvolvimento segue as etapas da seção 7 da spec, detalhadas em `docs/PLANO.md`.
- Não avance de etapa sem cumprir os critérios de aceite e mostrar ao Paulo a saída dos testes.
- Migrações novas em vez de editar migração já aplicada fora do ambiente local.
- Contradição ou lacuna nova na spec: registre em `docs/PLANO.md` e pergunte antes de decidir sozinho.
