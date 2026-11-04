# No Azul

Sistema de controle financeiro pessoal que lê documentos e diz, toda semana, quanto guardar para pagar as contas e cumprir as metas.

- Especificação: `docs/SPEC.md` (fonte da verdade do produto).
- Revisão da especificação, decisões e plano por etapa: `docs/PLANO.md`. Uma decisão aprovada ali prevalece sobre o texto original da spec.
- Estado atual: **Etapa 0, especificação revisada, aguardando aprovação do plano.** Os comandos abaixo passam a existir na Etapa 1. Atualize esta linha ao concluir cada etapa.

## Stack

| Camada | Escolha |
| --- | --- |
| Interface e servidor | Next.js (App Router) com TypeScript estrito |
| Estilo e gráficos | Tailwind CSS e Recharts |
| Banco, login e arquivos | Supabase (PostgreSQL, Auth, Storage) com Row Level Security |
| Leitura de documentos | API do Claude, saída validada com Zod (Etapa 5) |
| Segundo plano | Fila de tarefas, Inngest ou Trigger.dev (decidir na Etapa 5) |
| Testes | Vitest (unidade e isolamento) e Playwright (ponta a ponta) |
| Monorepo | pnpm workspaces, Node 22 |
| Hospedagem | Vercel e Supabase |

As versões ficam fixadas nos `package.json`. Não troque biblioteca da stack sem combinar antes.

## Estrutura

```text
apps/web/             telas, rotas e ações do servidor
packages/motor/       cálculos financeiros puros e seus testes
packages/documentos/  preparação, extração e cruzamento de documentos (Etapa 5)
supabase/             config, migrações, seed e testes de isolamento
docs/                 SPEC.md e PLANO.md
```

## Comandos

```bash
pnpm install                       # dependências
pnpm dev                           # app em http://localhost:3000 (precisa do Supabase local)
pnpm lint                          # ESLint
pnpm typecheck                     # tsc em todos os pacotes
pnpm format                        # Prettier
pnpm test                          # testes unitários de todos os pacotes (Vitest)
pnpm --filter @no-azul/motor test  # só o motor
pnpm db:start                      # sobe o Supabase local (Docker)
pnpm db:reset                      # recria o banco local com migrações e seed
pnpm db:stop                       # derruba o Supabase local
pnpm db:types                      # gera os tipos TypeScript do banco
pnpm test:rls                      # isolamento entre usuários (precisa do Supabase local)
pnpm test:e2e                      # Playwright (precisa do Supabase local)
```

Antes de dar uma tarefa por concluída, rode `pnpm lint`, `pnpm typecheck` e `pnpm test`. Se mexer em migração ou política, rode também `pnpm db:reset` e `pnpm test:rls`.

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
