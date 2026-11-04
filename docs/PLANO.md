# No Azul: revisão da especificação e plano das Etapas 1 e 2

04/11/2026 · Referência: `docs/SPEC.md` · **Situação: D1 a D7 aprovadas em 04/11/2026 como recomendado; Etapa 1 entregue**

As decisões D1 a D7 (seção 5) valem sobre o texto da spec.

## 1. Contradições e lacunas que precisam de decisão agora

### C1. O exemplo de metas (3.6) não fecha com a fórmula da 3.3

A 3.3 divide os dias até o prazo por 30,4375. Com datas reais, 18 meses depois de 04/11/2026 são 547 dias, ou 17,97 meses, e os valores mudam:

| Meta                    | Exemplo da spec                | Fórmula da 3.3 com datas reais |
| ----------------------- | ------------------------------ | ------------------------------ |
| Reserva de emergência   | R$ 1.233,33/mês, R$ 285/semana | R$ 1.235,31/mês, R$ 286/semana |
| Viagem                  | R$ 562,50/mês, R$ 130/semana   | R$ 565,99/mês, R$ 131/semana   |
| Notebook                | R$ 324,17/mês, R$ 75/semana    | R$ 318,71/mês, R$ 74/semana    |
| Reserva total da semana | R$ 1.415                       | R$ 1.416                       |

Testei todas as combinações de 500 a 600 dias para a emergência e de 200 a 290 dias para a viagem: nenhuma reproduz 285, 130 e 75 ao mesmo tempo. O exemplo só fecha com meses inteiros.

**Recomendação:** contar meses pelo calendário: meses completos entre hoje e o prazo, mais a fração do mês restante pelos dias daquele mês. Prazo em 04/05/2028 visto em 04/11/2026 dá exatamente 18 meses; o exemplo fecha e a tela bate com o que a pessoa espera ("faltam 18 meses").
**Alternativa:** manter 30,4375 e corrigir o exemplo para 286, 131 e 74.

### C2. O critério "o saldo nunca fica negativo" é sempre verdadeiro

Ao pagar uma conta, sai da reserva o menor valor entre a conta e o saldo (3.1). O saldo nunca fica negativo por construção, e o teste passaria mesmo com um motor errado.

**Recomendação:** trocar por "em 52 semanas simuladas, guardando o valor pedido toda semana, toda conta é paga inteira com a reserva no vencimento". A fórmula já supõe que o valor da semana k é guardado antes das contas da semana k; a simulação guarda na segunda-feira, e o painel orienta "guarde no início da semana".

### C3. A regra da 3.1 não basta para o valor ficar fixo na semana

Mesmo com B do início da semana, o valor pedido ainda muda quando:

- uma conta de semana futura é paga antes: ela sai de Oᵢ, mas o valor sacado volta para B, e o pedido pode cair;
- a reserva não cobre a conta inteira: Oᵢ cai pelo valor total, mas B recebe de volta só o que saiu, e o pedido sobe;
- há saque manual ou ajuste no meio da semana.

**Recomendação:** o cálculo da semana usa a foto da segunda-feira para tudo que é movimento. Contas pagas nesta semana continuam em Oᵢ, na semana original, e B é o saldo de segunda às 00h. Ajuste manual de saldo e mudanças de cadastro (conta nova, valor alterado, renda confirmada com outro valor) recalculam, e o painel mostra o motivo, como "valor atualizado: você cadastrou Conta de luz". A mesma foto vale para as metas (3.3).

### C4. A fatura de cartão pode contar duas vezes no orçamento

A 4.4 resolve o lado do lançamento: o pagamento da fatura vira transferência. Mas a 3.2 subtrai as contas avulsas do Livre, e a fatura é uma conta avulsa cujos itens já entraram como gasto variável.

**Recomendação:**

- Conta com `quita_itens` entra na reserva de contas (3.1), porque o dinheiro sai, mas fica fora de "Contas avulsas" na 3.2 e no índice (3.5).
- Despesa fixa paga no cartão, como assinaturas, ganha a marcação `paga_no_cartao` na recorrência: conta como fixa no orçamento, não entra sozinha na reserva (o dinheiro sai pela fatura) e o item da fatura fica vinculado a ela, sem virar gasto variável.

### C5. O modelo de dados contradiz a regra de saldos derivados (seção 5)

- `metas.guardado` é coluna, mas a spec diz que "saldos e metas são derivados" de `movimentos_reserva` e que saldos nunca são editados. **Recomendação:** remover a coluna. O guardado é a soma dos movimentos, e o saldo inicial do primeiro acesso entra como `ajuste`.
- `valor_da_reserva` em `ocorrencias` e `contas_avulsas` repete o saque gravado em `movimentos_reserva`. **Recomendação:** guardar só o movimento, ligado à conta.
- `movimentos_reserva.origem_id` e `lancamentos.vinculo` apontam para tabelas diferentes, então não podem ter chave estrangeira. **Recomendação:** colunas explícitas (`ocorrencia_id`, `conta_avulsa_id`), cada uma com chave estrangeira.

### C6. Faltam campos no modelo de dados

- `categorias.slug`: o JSON de extração usa `"alimentacao"`, e a tabela só tem id e nome. As categorias padrão são copiadas para cada usuário no cadastro, o que mantém "todas as tabelas ligadas ao usuário".
- `perfis.guardar_original` (escolha da 4.5) e `perfis.primeiro_acesso_concluido_em`.
- `recorrencias.fim`, opcional: financiamentos e parcelamentos terminam. Só existe frequência mensal; IPVA, IPTU e anuidades ficam como contas avulsas na primeira versão.
- `recorrencias.paga_no_cartao` (C4).
- `documentos.reenvio_confirmado`: o hash é único por usuário "salvo quando a pessoa confirma o reenvio", e isso exige um campo para o índice único parcial.
- `criado_em` em todas as tabelas.

### C7. Os arredondamentos intermediários não estão definidos

O exemplo mostra R$ 1.233,33 (22.200 ÷ 18 arredondado ao centavo), mas a spec não diz o arredondamento do necessário mensal nem do índice.

**Recomendação:**

| Valor                              | Arredondamento                                                              |
| ---------------------------------- | --------------------------------------------------------------------------- |
| Necessário e alocado por mês       | Centavo mais próximo (reproduz o exemplo)                                   |
| Reserva de contas e aporte semanal | Para cima, em reais inteiros (como na spec)                                 |
| Limite semanal e limite por dia    | Para baixo, no centavo, para não prometer mais do que há                    |
| Índice de saúde                    | Componentes com uma casa decimal; total arredondado ao inteiro mais próximo |

### C8. Faltam regras para casos de borda

- **Ritmo de gastos no começo do mês:** no dia 1, a fração decorrida é quase zero, e qualquer gasto passa de 150%. Com limite zero, a conta divide por zero. **Recomendação:** fração mínima de 7 dias; com limite zero, 15 pontos se não houve gasto e 0 se houve.
- **Contas em dia sem compromissos no mês:** 15 pontos se nada estiver vencido.
- **Renda zero no mês** (renda variável sem previsão): tratar como "sem renda" e não mostrar o índice.
- **Meta sem prazo**, comum na reserva de emergência: a fórmula exige prazo. **Recomendação:** prazo obrigatório na primeira versão, com sugestão de 12 meses para a emergência.
- **Meta com prazo vencido e não concluída:** o `max(1, …)` pede tudo em um mês. **Recomendação:** situação "prazo vencido", com alerta e convite para mudar o prazo.
- **Semana que cruza dois meses**, como 30/11 a 06/12: **recomendação** de limite semanal pela soma dia a dia (limite de cada mês ÷ dias daquele mês) e verba das metas pelo mês da segunda-feira.

## 2. Lacunas que podem esperar a etapa correspondente

| Lacuna                                                                                                                                                                                                                                | Etapa | Proposta                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agenda de 8 semanas, projeção de 6 meses, comparação 50/30/20 e alerta de "gasto acima do ritmo" não têm regra na seção 3                                                                                                             | 4     | Definir antes da Etapa 4, dentro de `packages/motor`. A agenda deve simular semana a semana, supondo que a pessoa guarda o valor pedido; repetir o r da semana atual nas 8 semanas seria enganoso, porque ele é recalculado toda semana |
| Navegar para semanas passadas exigiria reconstruir quanto o sistema pediu na época                                                                                                                                                    | 4     | Semanas passadas mostram o que aconteceu (aportes, contas pagas, gastos contra o limite); semanas futuras mostram a agenda                                                                                                              |
| Contracheque e crédito de salário no extrato podem duplicar a renda recorrente                                                                                                                                                        | 5     | O cruzamento também procura renda prevista em aberto, não só contas                                                                                                                                                                     |
| Descrições de extrato (PIX) trazem nomes e CPF parcial, e a 4.5 depende só da instrução ao modelo                                                                                                                                     | 5     | Mascarar CPF e CNPJ por expressão regular na validação, antes de gravar `extracao_json`                                                                                                                                                 |
| Compras parceladas: a fatura mostra só a parcela atual, e as futuras não entram na agenda nem na projeção                                                                                                                             | 5     | Aceitar na primeira versão e registrar como limitação conhecida                                                                                                                                                                         |
| A exclusão em cascata do banco não apaga arquivos do Storage                                                                                                                                                                          | 7     | Rotina própria de exclusão, coberta por teste                                                                                                                                                                                           |
| A reserva ignora quando a renda cai. No exemplo, a semana pede R$ 1.415 (cerca de R$ 6.130 por mês), enquanto o mês comporta R$ 5.500 para contas e metas, porque o saldo é baixo e a semana 2 tem R$ 2.130                           | 4     | A fórmula está certa; o painel explica o pico junto com a data mais apertada                                                                                                                                                            |
| O índice dá nota máxima com 6 meses de fixas mais variáveis (R$ 31.200 no exemplo), mas o alvo da emergência no exemplo é R$ 30.000                                                                                                   | 3     | Sugerir alvo de 6 meses ao criar a meta de emergência                                                                                                                                                                                   |
| Três conversões entre mês e semana: 12 ÷ 52 nos aportes, 7 ÷ dias do mês no limite e 30,4375 no prazo. Arredondar os aportes para cima faz a semana pedir um pouco mais que a verba (R$ 490 × 52 ÷ 12 = R$ 2.123,33, contra R$ 2.120) | 2     | Diferença pequena; manter como na spec                                                                                                                                                                                                  |
| "Média dos últimos 3 meses com dados" não diz se o mês atual ou um mês parcial contam                                                                                                                                                 | 2     | Usar só meses completos, ignorando o mês parcial de entrada no sistema                                                                                                                                                                  |
| "Conta" tem três sentidos: conta a pagar, conta bancária e conta do usuário                                                                                                                                                           | 1     | No código, "conta" é conta a pagar; a do usuário é "cadastro" (glossário no `CLAUDE.md`)                                                                                                                                                |
| O diagrama da seção 6 não veio na exportação ("embedded content")                                                                                                                                                                     | —     | A tabela de camadas basta                                                                                                                                                                                                               |

## 3. Plano da Etapa 1: base do projeto

**Entregas**

1. **Monorepo pnpm** com `apps/web` (Next.js com App Router, TypeScript estrito, Tailwind), `packages/motor` (estrutura e Vitest, sem regras ainda) e `supabase/`. ESLint, Prettier e Node 22 fixado em `.nvmrc`.
2. **Supabase local**, com a CLI como dependência de desenvolvimento, e a primeira migração com as nove tabelas, já com os ajustes C4 a C6:
   - `usuario_id uuid not null default auth.uid()`, ligado a `auth.users` com `on delete cascade`, em todas as tabelas;
   - valores em `bigint` (centavos) com `check (valor >= 0)`; status e tipos como `check`; `competencia` no formato `AAAA-MM`;
   - chaves estrangeiras compostas `(usuario_id, id)`, porque RLS não impede que o usuário B aponte para uma categoria do usuário A, e a chave composta impede;
   - índices: lançamentos por usuário e data; único por recorrência e competência; uma reserva de emergência por usuário (índice único parcial); hash único por usuário, salvo reenvio confirmado;
   - gatilho no cadastro que cria o perfil e copia as categorias padrão.
3. **RLS em todas as tabelas**, com políticas de leitura, inclusão, alteração e exclusão por `usuario_id = (select auth.uid())` e nenhum acesso para quem não entrou.
4. **Login com Supabase Auth** (e-mail e senha) via `@supabase/ssr`: telas Entrar, Criar cadastro e Sair, e a rota protegida `/painel`, vazia, com o nome da pessoa. Interface em português.
5. **Testes**
   - **Isolamento** (Vitest e supabase-js contra o banco local): cria os usuários A e B. Em cada uma das nove tabelas, A grava uma linha, e B não lê, não altera, não apaga, não grava em nome de A e não referencia a linha de A em chave estrangeira. Quem não entrou não lê nada.
   - **Meta-teste** (SQL direto): toda tabela do schema `public` tem RLS ligado e políticas. Uma tabela nova sem RLS quebra o teste.
   - **Ponta a ponta** (Playwright): entrar com e-mail e senha leva ao painel; sem login, `/painel` leva para `/entrar`.
   - **Motor:** um teste simples, só para provar que a cadeia de testes roda.
6. **Integração contínua no GitHub Actions:** um job rápido (lint, tipos e testes unitários) e um job de integração (Supabase local, migrações, isolamento, build e Playwright).
7. `CLAUDE.md` atualizado com os comandos reais.

**Aceite:** o teste ponta a ponta prova o login, e o teste de isolamento prova que A não lê dados de B, local e no CI. Mostro a saída dos testes e o link da execução do CI.

**Fica fora da Etapa 1:** deploy na Vercel e projeto Supabase na nuvem (proposta: Etapa 4, quando houver tela útil), autenticação em dois fatores (Etapa 7) e Storage (Etapa 5).

**Risco conhecido:** o Supabase local precisa de Docker. Neste ambiente o Docker funciona e o Docker Hub responde, mas o registro padrão das imagens do Supabase (`public.ecr.aws`) é bloqueado pela rede. Vou configurar a CLI para baixar do Docker Hub. Se não der, aviso antes de mudar a abordagem dos testes de isolamento.

### Resultado da Etapa 1 (04/11/2026)

- O Supabase local roda com as imagens do Docker Hub (`SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io`); no GitHub Actions, usa o registro padrão.
- Testes de isolamento: 78 verificações (Vitest e supabase-js), cobrindo as nove tabelas, chaves estrangeiras entre usuários, exclusão pelo dono e exclusão do cadastro em cascata. Desligar o RLS de uma tabela ou criar uma tabela fora da lista quebra 5 verificações, o que confirma que o teste pega a falha.
- Ponta a ponta: 4 cenários de login no Playwright, em computador e celular (8 execuções).
- O ESLint impede `new Date()`, `Date.now()`, `process`, `parseFloat` e imports de banco, rede ou tela dentro de `packages/motor`.

**Escolhas de implementação** que a spec não detalhava:

| Item                         | Escolha                                                                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Nomes das colunas de valor   | Sempre `*_centavos` (`valor_centavos`, `alvo_centavos`, `teto_variavel_centavos`)                                                            |
| `ocorrencias.status`         | `pendente`, `paga` (fixa) ou `recebida` (renda); `pago_em` preenchido sempre que não estiver pendente                                        |
| `lancamentos.origem`         | `manual`, `documento` ou `pagamento` (gerado ao pagar uma conta)                                                                             |
| `documentos.tipo`            | `comprovante`, `boleto`, `fatura_cartao`, `extrato` ou `contracheque`; vazio até a extração                                                  |
| Valores negativos            | Só em `movimentos_reserva` do tipo `ajuste`; aporte e saque são sempre positivos                                                             |
| Perfil                       | Criado pelo gatilho de cadastro; a pessoa lê e altera, mas não cria nem exclui (só sai com o cadastro)                                       |
| Categorias padrão            | 20 categorias copiadas no cadastro: 7 essenciais, 8 livres, 3 de receita e 2 de transferência                                                |
| Login                        | E-mail e senha, mínimo de 8 caracteres. No ambiente local o e-mail não precisa de confirmação; na nuvem, a tela avisa que o link foi enviado |
| Exclusão de categoria em uso | A referência fica vazia (`set null`), e o lançamento passa a "sem categoria"                                                                 |

## 4. Plano da Etapa 2: motor de cálculo

O pacote `@no-azul/motor` é TypeScript puro, sem dependências em tempo de execução, sem banco, rede ou relógio. A data atual entra como parâmetro.

**Módulos**

| Arquivo                        | Conteúdo                                                                                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dinheiro.ts`                  | Tipo `Centavos` (inteiro), somas e divisões com arredondamento explícito (C7)                                                                         |
| `datas.ts`                     | Datas civis `AAAA-MM-DD` sem fuso, semana de segunda a domingo, dias do mês, dia 31 nos meses menores, meses até o prazo (C1)                         |
| `recorrencias.ts`              | Projeta as ocorrências de rendas e fixas de um período, juntando as previstas com as gravadas                                                         |
| `reserva-contas.ts`            | Regra 3.1: valor semanal, semana mais apertada, data limite e foto da segunda-feira (C3)                                                              |
| `orcamento.ts`                 | Regra 3.2: renda, fixas, avulsas, Livre e estimativa de variáveis com a fonte usada (teto, média ou 30%)                                              |
| `metas.ts`                     | Regra 3.3: necessário, alocado, aporte semanal, situação (completa, parcial, sem verba, prazo vencido, concluída), nova data prevista e falta por mês |
| `limite.ts`                    | Regra 3.4: limite mensal, semanal (soma dia a dia) e disponível por dia                                                                               |
| `saude.ts` e `config/saude.ts` | Regra 3.5: componentes, faixa, pesos e limites em configuração                                                                                        |
| `semana.ts`                    | Junta tudo: reserva da semana igual a contas mais metas, com a explicação de cada parte                                                               |
| `simulacao.ts`                 | Avança semanas aplicando aportes e pagamentos, para os testes e, depois, para a agenda                                                                |

A entrada do motor são objetos simples: perfil, recorrências, ocorrências, contas avulsas, lançamentos, metas e movimentos. O motor nunca recebe documentos, só dados já aprovados e gravados.

**Testes**

1. **Cenário da 3.6**, montado com hoje em 04/11/2026 (quarta-feira). A semana 1 vai de 02 a 08/11, e a data "até 15/11" da spec é o domingo da semana 2. Fixas de R$ 520 no dia 7, R$ 2.130 no dia 15 e R$ 350 no dia 21, e a conta avulsa de R$ 380 em 20/11 reproduzem as oito semanas da tabela. O teste confere cada valor: R$ 925 "até 15/11", Livre de R$ 4.320, verba de R$ 2.120, aportes de 285, 130 e 75, total de R$ 1.415, limite de R$ 2.200 e R$ 513,33, e índice 82 (25 + 25 + 5 + 15 + 12), faixa saudável.
2. **Simulação de 52 semanas** (critério C2), com contas geradas aleatoriamente a partir de semente fixa (fast-check): toda conta é paga inteira pela reserva no vencimento.
3. **Valor fixo na semana** (C3): registrar a reserva, pagar conta da semana, pagar antes uma conta de semana futura e pagar com saldo insuficiente não mudam o valor pedido. Cadastrar conta nova muda o valor e informa o motivo.
4. **Casos de borda:** dia 31 em fevereiro e em meses de 30 dias, ano bissexto, semana que cruza mês e ano, conta vencida na semana 1, saldo maior que todas as contas (valor zero), sem renda (sem índice), limite zero, meta concluída, meta com prazo vencido, verba zero e desempate de prioridade pelo prazo.
5. **Pagar e desfazer** no motor devolve o saldo ao estado anterior, preparando o aceite da Etapa 3.

**Aceite:** os três critérios da seção 7, com o critério da simulação reescrito conforme C2. Mostro a saída do Vitest e o relatório de cobertura de `packages/motor`.

## 5. Decisões para aprovar

As cinco decisões da seção 8 da spec seguem a recomendação de lá: uso pessoal com estrutura para vários usuários, limite mensal de documentos, arquivo original apagado por padrão, só pessoa física e nome provisório No Azul.

| #   | Decisão                                    | Recomendação                                                     |
| --- | ------------------------------------------ | ---------------------------------------------------------------- |
| D1  | Contagem de meses até o prazo (C1)         | Meses de calendário; o exemplo 3.6 fica como está                |
| D2  | Critério da simulação de 52 semanas (C2)   | Toda conta paga inteira pela reserva no vencimento               |
| D3  | Valor fixo na semana (C3)                  | Foto da segunda-feira; cadastros recalculam e mostram o motivo   |
| D4  | Fatura e fixas pagas no cartão (C4)        | Fatura na reserva e fora do orçamento; marcação `paga_no_cartao` |
| D5  | Ajustes no modelo de dados (C5 e C6)       | Todos os listados                                                |
| D6  | Arredondamentos e casos de borda (C7 e C8) | Como proposto                                                    |
| D7  | Deploy                                     | Só local e CI até a Etapa 4                                      |
