# No Azul: revisão da especificação e plano das etapas

04/11/2026 · Referência: `docs/SPEC.md` · **Situação: D1 a D7 aprovadas em 04/11/2026 como recomendado (D7 revista em 05/11/2026), D8 em 07/11/2026; Etapas 1 a 5 entregues**

As decisões D1 a D8 (seção 5) valem sobre o texto da spec.

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

| Lacuna                                                                                                                                                                                                                                | Etapa | Proposta                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Agenda de 8 semanas, projeção de 6 meses, comparação 50/30/20 e alerta de "gasto acima do ritmo" não têm regra na seção 3                                                                                                             | 4     | Definir antes da Etapa 4, dentro de `packages/motor`. A agenda deve simular semana a semana, supondo que a pessoa guarda o valor pedido; repetir o r da semana atual nas 8 semanas seria enganoso, porque ele é recalculado toda semana. **Definidas na seção 4c** |
| Navegar para semanas passadas exigiria reconstruir quanto o sistema pediu na época                                                                                                                                                    | 4     | Semanas passadas mostram o que aconteceu (aportes, contas pagas, gastos contra o limite); semanas futuras mostram a agenda. **Detalhado na seção 4c**                                                                                                              |
| Contracheque e crédito de salário no extrato podem duplicar a renda recorrente                                                                                                                                                        | 5     | O cruzamento também procura renda prevista em aberto, não só contas                                                                                                                                                                                                |
| Descrições de extrato (PIX) trazem nomes e CPF parcial, e a 4.5 depende só da instrução ao modelo                                                                                                                                     | 5     | Mascarar CPF e CNPJ por expressão regular na validação, antes de gravar `extracao_json`                                                                                                                                                                            |
| Compras parceladas: a fatura mostra só a parcela atual, e as futuras não entram na agenda nem na projeção                                                                                                                             | 5     | Aceitar na primeira versão e registrar como limitação conhecida                                                                                                                                                                                                    |
| A exclusão em cascata do banco não apaga arquivos do Storage                                                                                                                                                                          | 7     | Rotina própria de exclusão, coberta por teste                                                                                                                                                                                                                      |
| A reserva ignora quando a renda cai. No exemplo, a semana pede R$ 1.415 (cerca de R$ 6.130 por mês), enquanto o mês comporta R$ 5.500 para contas e metas, porque o saldo é baixo e a semana 2 tem R$ 2.130                           | 4     | A fórmula está certa; o painel explica o pico junto com a data mais apertada (seção 4c)                                                                                                                                                                            |
| O índice dá nota máxima com 6 meses de fixas mais variáveis (R$ 31.200 no exemplo), mas o alvo da emergência no exemplo é R$ 30.000                                                                                                   | 3     | Sugerir alvo de 6 meses ao criar a meta de emergência                                                                                                                                                                                                              |
| Três conversões entre mês e semana: 12 ÷ 52 nos aportes, 7 ÷ dias do mês no limite e 30,4375 no prazo. Arredondar os aportes para cima faz a semana pedir um pouco mais que a verba (R$ 490 × 52 ÷ 12 = R$ 2.123,33, contra R$ 2.120) | 2     | Diferença pequena; manter como na spec                                                                                                                                                                                                                             |
| "Média dos últimos 3 meses com dados" não diz se o mês atual ou um mês parcial contam                                                                                                                                                 | 2     | Usar só meses completos, ignorando o mês parcial de entrada no sistema                                                                                                                                                                                             |
| "Conta" tem três sentidos: conta a pagar, conta bancária e conta do usuário                                                                                                                                                           | 1     | No código, "conta" é conta a pagar; a do usuário é "cadastro" (glossário no `CLAUDE.md`)                                                                                                                                                                           |
| O diagrama da seção 6 não veio na exportação ("embedded content")                                                                                                                                                                     | —     | A tabela de camadas basta                                                                                                                                                                                                                                          |

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

### Resultado da Etapa 2 (04/11/2026)

- 95 testes no Vitest, com 100% das linhas e 97,4% dos ramos de `packages/motor` cobertos.
- Cenário 3.6: todos os valores da spec batem, de R$ 925 "até 15/11" ao índice 82. Na semana 7, a tabela da spec mostra R$ 747,14; o motor mostra R$ 747,15, porque arredonda para cima no centavo (C7). Isso não muda o resultado, definido pela semana 2.
- Simulação de 52 semanas: no cenário 3.6 e em 150 cenários aleatórios (fast-check, semente fixa), guardando o valor pedido, nenhuma conta fica descoberta. Guardar R$ 1 a menos por semana deixa o aluguel descoberto, o que mostra que o valor pedido é o mínimo.
- Valor fixo na semana: o valor é o mesmo de segunda a domingo, e não muda com aporte, pagamento da semana, pagamento antecipado, pagamento com saldo insuficiente, saque manual ou pagamento desfeito. Conta nova, valor ou vencimento alterado, conta removida e ajuste de saldo recalculam e informam o motivo. Usar o saldo atual no lugar da foto de segunda quebra 5 desses testes.

**Escolhas de implementação** que decorrem das decisões aprovadas:

| Item                            | Escolha                                                                                                                                                                                                                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Referência das metas            | Os meses até o prazo contam a partir da segunda-feira da semana, não de hoje. É consequência de D1 e D3 juntas: contando de hoje, a fração do mês muda todo dia e o aporte semanal mudaria no meio da semana. No teste, os prazos do cenário 3.6 caem no dia 2 (a segunda de referência) para dar 18, 8 e 10 meses exatos |
| Fração do mês                   | Meses completos mais os dias restantes divididos pelos dias do mês seguinte ao último completo. Ex.: de 31/01 a 15/03 são 1 + 15/31 meses                                                                                                                                                                                 |
| Ajuste e saque manual na semana | Ajuste recalcula (é correção de cadastro); saque manual não muda o valor da semana (é movimento) e entra na foto da semana seguinte                                                                                                                                                                                       |
| Fixas não marcadas como pagas   | Toda ocorrência entre o início da recorrência e hoje sem pagamento conta como vencida. Na Etapa 3, o cadastro deve sugerir como início o próximo vencimento, para não criar dívidas antigas por engano                                                                                                                    |
| Meta com verba parcial          | Nova data = segunda-feira + (falta ÷ alocado por mês) meses, arredondado para cima                                                                                                                                                                                                                                        |
| Meta com prazo vencido          | Segue a fórmula da spec (pede tudo o que falta no mês) e sai marcada como vencida para o alerta. Pode consumir a verba das metas seguintes; a tela deve convidar a mudar o prazo                                                                                                                                          |
| Desfazer pagamento de fixa      | A ocorrência gravada no pagamento é apagada e o mês volta à previsão da recorrência (revisto na Etapa 3, quando o pagamento passou a aceitar outro valor)                                                                                                                                                                 |
| "Vencido" no índice             | Contas sem pagamento com vencimento antes de hoje, sem contar fixas pagas no cartão                                                                                                                                                                                                                                       |
| "Meses com dados" na média      | Meses completos com ao menos um gasto variável, até 3, do mais recente para trás                                                                                                                                                                                                                                          |
| Datas no motor                  | Aritmética própria com o número do dia, sem o objeto `Date`; o ESLint bloqueia `new Date()` e `Date.now()` no pacote                                                                                                                                                                                                      |

## 4b. Etapa 3: cadastros e lançamentos

**Entregue em 05/11/2026.** Telas de Contas e fixas, Lançamentos e Metas, com navegação comum, em computador e celular.

| Tela           | O que faz                                                                                                                                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contas e fixas | Reserva de contas (registrar reserva, corrigir saldo); contas a pagar (vencidas e próximos 45 dias) com pagamento; pagas recentemente com "desfazer"; rendas do mês com confirmação de recebimento; cadastros de rendas, despesas fixas e contas avulsas (criar, editar, encerrar, excluir) |
| Lançamentos    | Mês a mês, com busca por descrição, filtro por categoria, totais de gastos, receitas e transferências, criar, editar, excluir e exportar em CSV                                                                                                                                             |
| Metas          | Plano do motor (aporte da semana, necessário por mês, prazo, previsão, situação), criar, editar, registrar aporte, corrigir o guardado, concluir e excluir                                                                                                                                  |

**Aceite (pagar e desfazer devolve lançamentos e saldos ao estado anterior):** coberto em três níveis. No motor, o estado depois de pagar e desfazer é igual ao de antes. No banco (17 testes de integração), a foto de lançamentos, movimentos, contas em aberto, saldo e números do painel volta igual para despesa fixa, conta avulsa, fatura e fixa paga no cartão, também quando a fixa foi paga com outro valor. Na tela (Playwright), pagar o aluguel tira R$ 1.000 da reserva e cria o lançamento; desfazer devolve o saldo e apaga o lançamento.

**Escolhas de implementação:**

| Item                      | Escolha                                                                                                                                                                                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transação                 | Pagar, desfazer, receber, desfazer recebimento e excluir meta são funções do banco (`SECURITY INVOKER`, com o RLS de quem chama). Elas não calculam: o app pede ao motor o tipo do lançamento e quanto sai da reserva (`planoDePagamento`) e passa os valores prontos |
| Desfazer                  | Apaga o saque, o lançamento e a ocorrência do mês; o mês volta à previsão da recorrência (o motor faz o mesmo)                                                                                                                                                        |
| Valor diferente ao pagar  | Despesa fixa aceita o valor real (conta de luz que veio mais alta). Conta avulsa só é paga pelo valor cadastrado; para pagar outro, edita-se a conta antes, e assim desfazer devolve tudo como estava                                                                 |
| Histórico protegido       | Recorrência com pagamento ou recebimento não é excluída, só encerrada (o pagamento continua vinculado e não vira gasto variável). Conta avulsa paga não é editada nem excluída. Lançamento de pagamento ou recebimento só muda desfazendo a operação na conta         |
| Reserva de contas         | "Registrar reserva" e "Corrigir saldo" ficam em Contas e fixas; a correção grava um ajuste com a diferença calculada pelo motor (`valorDoAjuste`). O painel da Etapa 4 terá o atalho para registrar a reserva da semana                                               |
| Excluir meta              | Apaga a meta e os aportes dela na mesma transação; o dinheiro continua onde estiver, o sistema só deixa de acompanhar                                                                                                                                                 |
| Data de hoje              | Horário de Brasília para todos na primeira versão                                                                                                                                                                                                                     |
| Início de uma recorrência | Hoje, por padrão, para não criar meses antigos vencidos (ponto 2 da Etapa 2)                                                                                                                                                                                          |
| CSV                       | Ponto e vírgula, vírgula decimal, datas dd/mm/aaaa e BOM UTF-8, para abrir direto no Excel e no Google Planilhas; descrições que começam com =, +, - ou @ ganham um apóstrofo para não virarem fórmula                                                                |
| Limite de login local     | O Supabase local aceita 300 entradas e cadastros a cada 5 minutos (o padrão é 30), porque a bateria de testes cria dezenas de usuários; não afeta o projeto na nuvem                                                                                                  |

**Lacunas novas, para decidir depois:**

- A spec prevê categorias próprias, mas nenhuma tela para criá-las. Hoje só há as 20 categorias padrão; proposta: criar e renomear categorias numa tela de configurações na Etapa 6.
- Não há como mudar a previsão de um mês só (ex.: aluguel reajustado só em dezembro) sem pagar; hoje se edita a recorrência inteira. Proposta: deixar para quando a leitura de boletos (Etapa 5) trouxer o valor real antes do vencimento.

## 4c. Etapa 4: painel e planejamento

**Decisões do Paulo em 05/11/2026:**

- A comparação 50/30/20 usa o último mês completo, com o que de fato aconteceu.
- O deploy na Vercel e no Supabase na nuvem fica para a Etapa 7 (D7 revista).
- **Fim da meta (lacuna nova, achada na simulação):** pela regra 3.3, a menos de um mês do prazo a semana pede o que falta × 12 ÷ 52, cerca de 23%. Como o cálculo é refeito toda semana, a meta nunca terminava no prazo: faltando R$ 845 a 4 semanas, pedia R$ 195, R$ 151, R$ 117… e meses depois ainda faltava. Agora, a menos de um mês do prazo e com verba completa, o aporte da semana é o que falta ÷ semanas até o prazo, para cima em reais (R$ 212 no exemplo, e a meta termina no prazo). Com o prazo vencido, pede o que falta na semana, junto com o alerta. Com verba parcial, segue mensal × 12 ÷ 52. O exemplo 3.6 não muda.

**Telas**

| Tela         | O que mostra, de cima para baixo                                                                                                                                                                                                                                                                                                                                                                                  | O que a pessoa faz                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Painel       | 1. Valor a reservar na semana, dividido entre contas e cada meta, com o já guardado e a data mais apertada. 2. Alertas. 3. Gastos da semana contra o limite, por categoria, e as 6 semanas anteriores. 4. Contas dos próximos 14 dias (e as vencidas). 5. Progresso das metas. 6. Índice de saúde com a medida e os pontos de cada componente. 7. Divisão do mês: fixas, contas avulsas, metas, variáveis e folga | Registrar a reserva da semana, pagar conta, mudar de semana |
| Planejamento | Teto de gastos, agenda de 8 semanas, projeção de 6 meses, comparação 50/30/20 e o aviso de que o sistema não substitui consultoria financeira (seção 6 da spec)                                                                                                                                                                                                                                                   | Definir, alterar ou remover o teto                          |

A análise por IA da tela Planejamento fica para a Etapa 6, como na spec.

**Regras novas no motor** (cada uma com teste):

| Regra                        | Definição                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Simulação do plano           | Parte de hoje e supõe que a pessoa segue o plano. Na semana atual, completa hoje o que falta guardar (contas e cada meta) e paga as contas em aberto no vencimento (as vencidas, hoje). Nas seguintes, guarda na segunda-feira o que o motor pedir para contas e para cada meta e paga cada conta da reserva no vencimento. Fixa paga no cartão não sai da reserva                                                                         |
| Agenda de 8 semanas          | Para cada semana da simulação: contas que vencem, valor para contas, valor para cada meta, total e saldo previsto da reserva de contas no domingo. A semana atual repete o painel                                                                                                                                                                                                                                                          |
| Projeção de 6 meses          | Mês atual e os 5 seguintes, com a divisão do mês: renda prevista, fixas, contas avulsas, metas (verba alocada no mês, com o guardado da simulação), gastos variáveis estimados e folga. Folga = Livre − variáveis − metas; negativa, é o que falta no mês. Meta que termina libera verba para as seguintes                                                                                                                                 |
| Média de variáveis no futuro | A média dos últimos 3 meses (3.2) só usa meses já encerrados. Nos meses futuros da projeção, o mês atual, pela metade, não entra; a estimativa fica igual à do mês atual                                                                                                                                                                                                                                                                   |
| Divisão do mês               | A projeção do mês atual. Cada parte traz o percentual da renda (ao inteiro mais próximo); quando os compromissos passam da renda, o percentual é sobre o total                                                                                                                                                                                                                                                                             |
| 50/30/20                     | Último mês completo (a pessoa usava o sistema desde o dia 1); sem ele, o mês atual até hoje, com aviso. Necessidades: fixas, contas avulsas (sem as faturas com itens importados) e gastos variáveis em categorias essenciais. Desejos: o mesmo em categorias livres. Metas: aportes feitos nas metas no mês. Sem categoria aparece à parte. Percentuais sobre a renda do mês (3.2), ao inteiro mais próximo. Sem renda, não há comparação |
| Alertas                      | Conta vencida: em aberto e com vencimento antes de hoje, sem as fixas pagas no cartão (como no índice). Meta sem verba: situação parcial ou sem verba. Meta com prazo vencido. Gasto acima do ritmo: gasto variável do mês maior que limite mensal × dias decorridos ÷ dias do mês, com o mínimo de 7 dias do índice (C8); com limite zero, qualquer gasto                                                                                 |
| Gastos da semana             | Gasto variável da semana por categoria, em ordem de valor, contra o limite semanal (3.4), e o gasto de cada uma das 6 semanas anteriores, sem as semanas antes do início do uso                                                                                                                                                                                                                                                            |
| Semanas passadas             | Mostram o que aconteceu: quanto foi guardado (contas e cada meta), contas pagas e quanto saiu da reserva, gastos por categoria contra o limite semanal daquela semana (recalculado com os cadastros de hoje). A navegação vai da semana do início do uso até a última semana da agenda                                                                                                                                                     |
| Semanas futuras              | Mostram a semana da agenda: o que o motor vai pedir, as contas que vencem e o saldo previsto                                                                                                                                                                                                                                                                                                                                               |
| Motivo da mudança (D3)       | Ao salvar um cadastro (renda, fixa, conta avulsa ou correção de saldo) que muda o valor da semana, a tela seguinte mostra de quanto para quanto e por quê (`motivosDaMudanca`, da Etapa 2)                                                                                                                                                                                                                                                 |
| Números da tela              | Percentual de progresso das metas (para baixo), medida de cada componente do índice (percentual ou meses, com uma casa) e o que falta guardar na semana passam a vir do motor; a tela não faz conta                                                                                                                                                                                                                                        |

**Registrar a reserva da semana** no painel abre um formulário com o que falta guardar para contas e para cada meta, já preenchido. Os aportes são gravados em uma única inserção: ou entram todos, ou nenhum.

**Testes**

1. Motor: cada regra acima, incluindo a agenda e a projeção do cenário 3.6, metas que terminam no meio da projeção, mês com folga negativa, semana que cruza o mês, 50/30/20 com e sem mês completo e itens sem categoria, e cada alerta ligado e desligado.
2. Integração com o banco: registrar a reserva da semana grava todos os aportes ou nenhum; o teto é salvo e removido.
3. Ponta a ponta, em computador e celular: um cadastro com rendas, fixas, contas avulsas, metas, aportes e gastos em várias semanas. O teste calcula com o motor tudo o que o painel deve mostrar e confere cada número da tela. Ele também falha se aparecer na tela um valor em reais que o teste não conferiu.

**Aceite:** todo número do painel confere com o motor, em computador e celular.

### Resultado da Etapa 4 (05/11/2026)

- Motor: 161 testes no Vitest (66 novos), com 100% das linhas cobertas. O cenário 3.6 continua batendo, e a agenda dele foi conferida à mão: R$ 925, R$ 925, R$ 730 e R$ 707 nas quatro primeiras semanas, com o aluguel pago inteiro na semana 2.
- Integração com o banco: 23 testes (6 novos). A reserva da semana grava todos os aportes ou nenhum: com a meta de outra pessoa no meio, a inserção inteira é recusada. O teto é salvo e removido só no perfil de quem está logado.
- Ponta a ponta: 14 cenários em computador e celular (28 execuções), e os 5 novos repetidos 4 vezes sem falha. O teste de aceite monta um cadastro com rendas, fixas, conta vencida, fixa no cartão, três metas, aportes e gastos em 10 semanas. Ele calcula com o motor tudo o que o painel deve mostrar e confere cada número. Hoje são 73 números no painel e 86 no planejamento; a quantidade muda conforme o dia, porque as datas do cadastro são relativas a hoje. Ele também confere que a tela não rola de lado. Com R$ 0,01 a mais em um número, ou com um "R$" escrito fora de um número conferido, o teste falha.

**Escolhas de implementação:**

| Item                     | Escolha                                                                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Números conferidos       | Todo valor do painel e do planejamento passa pelos componentes `Valor` e `Numero`, que marcam a chave do número; o teste de aceite usa essas chaves                                                                                  |
| Gráficos                 | Recharts nas últimas semanas e na projeção, sem números no desenho; os valores aparecem em texto ao lado. A semana atual fica azul, ou vermelha acima do limite; as anteriores, cinza, porque a linha é o limite desta semana        |
| Aviso de mudança (D3)    | Cadastro, edição, encerramento e exclusão de rendas, fixas e contas avulsas, e a correção de saldo, comparam a reserva antes e depois. Se o valor mudou, um cookie de 2 minutos leva o aviso à tela seguinte, que o apaga ao mostrar |
| Semana na URL            | `/painel?semana=AAAA-MM-DD`; qualquer dia da semana leva à segunda-feira, e datas fora do intervalo vão para a primeira ou a última semana permitida                                                                                 |
| Teto                     | Fica na tela Planejamento. Zero é aceito: limite zero, e qualquer gasto liga o alerta de ritmo                                                                                                                                       |
| Renda nos meses passados | A comparação 50/30/20 usa a renda do mês como no orçamento (3.2): recebida ou, sem confirmação, a prevista                                                                                                                           |

**Lacunas novas, para decidir depois:**

- A pessoa pode alterar `perfis.criado_em` pela API, porque a permissão de alteração vale para a tabela inteira. Isso só muda os cálculos dela (a média de gastos e as semanas visíveis), mas o certo é liberar só as colunas editáveis. Proposta: permissão por coluna na revisão de segurança da Etapa 7.
- O campo de data do celular segue o idioma do aparelho, não o do sistema. No navegador de teste, que estava em inglês, apareceu 11/04/2026 para 04/11/2026. Proposta: conferir em aparelhos reais antes da Etapa 6.

## 4d. Etapa 5: leitura de documentos

**Decisões do Paulo em 07/11/2026:**

- **D8. Leitura local, sem IA.** O próprio No Azul lê os documentos, sem enviar nada para um serviço de IA e sem custo por documento. Isso substitui a API do Claude das seções 4.2 e 6 da spec, e o aviso de IA da 4.5 vira "o arquivo é lido aqui no No Azul". A extração continua só propondo os dados; nada entra nos cálculos sem a revisão.
- Fotos e PDFs digitalizados também são lidos, com reconhecimento de texto (OCR) no próprio servidor; o boleto em foto usa o código de barras.
- Sem fila externa: o servidor lê o documento logo depois do envio. Sem IA externa, a leitura leva segundos e não há chamada para repetir.
- Sem limite mensal de documentos, porque não há custo de IA. Fica o limite de 15 MB por arquivo; os limites de uso voltam na revisão de segurança da Etapa 7.
- Os 30 documentos de teste são fictícios, criados por mim com o gabarito de cada um, antes das regras de leitura.

**Caminho de um documento**

| Passo      | O que acontece                                                                                                                                                                                                                                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Envio      | Na tela Documentos, a pessoa escolhe o arquivo ou tira a foto e, se quiser, informa o tipo. O navegador calcula o hash; o servidor confere o tamanho, o formato e se o arquivo já foi enviado (avisa a data do envio anterior e oferece "Enviar de novo"). O arquivo vai do navegador direto para o Storage privado, na pasta da pessoa, porque a Vercel recusa requisições acima de 4,5 MB |
| Leitura    | Logo depois do envio, o servidor confere o formato real pelo conteúdo e o hash, e o status vira "processando". Se a leitura falhar ou demorar demais, o status vira "erro" com o motivo (sem conteúdo do documento), e a pessoa pode tentar de novo ou lançar à mão                                                                                                                         |
| Preparação | OFX, CSV e XLSX viram uma tabela. PDF com texto vira as linhas de cada página. PDF digitalizado e foto passam pelo OCR (Tesseract, em português, rodando no servidor), depois de endireitar e limpar a imagem. A foto perde os metadados, inclusive a localização. Boleto: valor e vencimento saem do código de barras ou da linha digitável, conferidos pelos dígitos verificadores        |
| Extração   | Regras por tipo de documento (tabela abaixo) montam o resultado no formato da seção 4.3. Cada campo tem uma confiança: 1 para tabela e código de barras, menor para texto achado por aproximação e para OCR. A categoria vem da descrição: primeiro a que a pessoa já usou para uma descrição parecida, depois uma lista de palavras (iFood, Uber, posto, farmácia…)                        |
| Validação  | Datas existentes, valores em centavos positivos, soma dos itens contra o total do documento. CPF, CNPJ, número de cartão e código de barras são mascarados nas descrições antes de gravar `extracao_json`. O status vira "em revisão"                                                                                                                                                       |
| Cruzamento | Feito quando a pessoa abre a revisão, com os dados daquele momento (tabela abaixo). O resultado é só sugestão                                                                                                                                                                                                                                                                               |
| Revisão    | O arquivo aparece ao lado dos dados, por um link temporário. Cada linha pode ser corrigida, marcada ou desmarcada; campo com confiança abaixo de 0,8 fica destacado; avisos e sugestões aparecem na linha                                                                                                                                                                                   |
| Gravação   | Uma função do banco grava tudo em uma transação: lançamentos, contas, pagamentos e recebimentos. Quanto sai da reserva em cada pagamento vem do motor, um depois do outro. O status vira "aprovado", o arquivo original é apagado (salvo se a pessoa escolheu guardar) e, se o valor da semana mudou, a tela seguinte mostra o motivo (D3)                                                  |

**Leitura por tipo de documento**

| Documento                | O que as regras procuram                                                                                                                                                                                                                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Comprovante, nota fiscal | Valor ("Valor", "Total", "Valor pago"), data, e o destinatário ou o estabelecimento como descrição. Vira uma despesa                                                                                                                                                                                                        |
| Boleto, conta de consumo | Código de barras ou linha digitável (valor e vencimento exatos); sem eles, "Vencimento" e "Valor do documento", "Total a pagar". O nome vem do tipo de conta (luz, água, gás, internet, condomínio) ou do beneficiário. Vira uma conta a pagar                                                                              |
| Fatura de cartão         | Total, vencimento e fechamento; cada linha com data, descrição e valor vira um item. Pagamento da fatura anterior, estorno, IOF, juros e anuidade são reconhecidos pela descrição                                                                                                                                           |
| Extrato                  | OFX pelos campos do padrão; CSV e XLSX pelas colunas de data, descrição e valor (ou débito e crédito), com ponto e vírgula ou vírgula e com acentuação do Windows; PDF pelas linhas com data e valor, sem as de saldo. Entrada vira receita; saída, despesa; aplicação, resgate e transferência entre contas, transferência |
| Contracheque             | Líquido, mês de referência e data do crédito. Vira uma receita pelo líquido. Sem data do crédito, usa o último dia do mês de referência                                                                                                                                                                                     |

O tipo vem da escolha da pessoa no envio ou, sem ela, das palavras do documento (fatura, beneficiário, extrato, líquido…).

**Regras do cruzamento** (funções puras, cada uma com teste):

| Situação                                  | Quando se aplica                                                                                                                                                                                                                                     | O que a revisão propõe                                                                                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Duplicata (4.4)                           | Lançamento já gravado com valor igual, data a até 1 dia e descrição parecida: metade ou mais das palavras em comum, sem acentos, números e palavras genéricas como "pix", "compra" e "pagamento"                                                     | Linha desmarcada, com aviso e o lançamento parecido                                                                                                              |
| Conta ou renda já registrada              | Saída com o valor de uma conta já paga, ou entrada com o valor de uma renda já recebida, a até 5 dias da data do pagamento ou do recebimento                                                                                                         | Linha desmarcada, com aviso ("parece o pagamento de Aluguel já registrado")                                                                                      |
| Pagamento em extrato ou comprovante (4.4) | Saída com valor igual a uma conta em aberto (fixa ou avulsa) e data a até 5 dias do vencimento                                                                                                                                                       | "Quitar Aluguel": a linha vira o pagamento da conta, e não um gasto a mais                                                                                       |
| Renda prevista (lacuna da seção 2)        | Entrada a até 5 dias do dia previsto de uma renda em aberto, com o mesmo valor (renda variável: qualquer valor). No contracheque, qualquer valor, a até 10 dias do dia previsto: o mês de referência do salário costuma ser o anterior ao do crédito | "Confirmar recebimento de Salário" com o valor real                                                                                                              |
| Boleto de despesa fixa                    | Boleto que vence no mês de uma fixa em aberto, com nome ou categoria parecidos                                                                                                                                                                       | "Usar como valor de Luz em novembro": muda a previsão só daquele mês, sem criar conta avulsa. Resolve a lacuna da Etapa 3                                        |
| Fatura ou boleto já cadastrado            | Conta avulsa a até 5 dias do vencimento, com o mesmo valor, ou com nome parecido e até 20% de diferença no valor                                                                                                                                     | Atualizar a conta existente em vez de criar outra. Se a fatura já foi paga, o pagamento vira transferência na mesma gravação, para o gasto não contar duas vezes |
| Fatura cadastrada como despesa fixa       | Fixa a até 5 dias do vencimento com "fatura", "cartão" ou "crédito" no nome, ou com o nome do banco                                                                                                                                                  | Aviso. A fatura muda a previsão da fixa no mês, sem os itens; para importar os itens, a fatura precisa ser conta avulsa                                          |
| Item de fixa paga no cartão (D4)          | Item da fatura com o valor ou o nome de uma fixa paga no cartão, no mês do item                                                                                                                                                                      | O item marca a fixa como paga e fica vinculado a ela, sem virar gasto variável                                                                                   |

**Regras da extração** (lacunas novas, com proposta):

- **Pagamento da fatura anterior** dentro da fatura: vem desmarcado, porque já entrou quando aquela fatura foi paga.
- **Estorno ou devolução na fatura:** entra como receita avulsa, com aviso. Na folga do mês, o efeito é o mesmo de abater a compra. O lançamento não aceita valor negativo, e mudar isso mexeria no motor inteiro.
- **Parcela de compra antiga** (PARC 03/10): entra com a data de fechamento da fatura (ou de vencimento, se o fechamento não aparecer), para não mudar meses já encerrados. A descrição mantém o número da parcela. As parcelas futuras continuam fora (limitação da seção 2).
- **Ano que não aparece** na data (fatura com "12/10"): vem do vencimento ou do período do documento, nunca do relógio do servidor.
- **Fator de vencimento do boleto:** o código de barras conta os dias desde 07/10/1997, e a contagem recomeçou em 22/02/2025. Vale a data mais próxima da data do envio.

**Avaliação da leitura (aceite de 95%)**

- O conjunto tem 30 documentos fictícios: comprovantes e notas, boletos e contas de consumo, faturas, extratos (PDF, CSV, OFX e XLSX) e contracheques, em PDF com texto, PDF digitalizado e foto. Empresas, pessoas e números são inventados.
- Cada documento tem um gabarito com os valores e as datas esperados: total e vencimento da conta, e a data e o valor de cada lançamento. O conjunto e os gabaritos entram no repositório antes das regras de leitura.
- Acerto é o valor ou a data exatamente igual. Linha esperada que não veio e linha a mais contam como erro.
- **Meta:** acertos ÷ (campos esperados + campos a mais) ≥ 95% no conjunto inteiro. O resultado sai também por documento e por formato (texto, tabela, digitalizado, foto).
- A avaliação é um teste comum: roda no CI, sem custo, e falha se a taxa cair.
- Limite conhecido: as regras conhecem os layouts que existem no conjunto e os parecidos. Em documentos reais de outros bancos e empresas, a taxa tende a ser menor, principalmente em fotos; o que não for lido aparece na revisão para completar.

**Testes**

1. `packages/documentos`: formato pelo conteúdo, CSV com vírgula e ponto e vírgula e acentuação do Windows, OFX, XLSX, PDF com e sem texto, código de barras e linha digitável (dígitos verificadores, fator antigo e novo), cada tipo de documento, categorias, máscaras, soma contra o total e cada regra de cruzamento ligada e desligada.
2. Banco: isolamento do Storage (B não lê, não grava nem apaga arquivo na pasta de A); a aprovação grava tudo ou nada.
3. Aceite "nenhum dado entra nos cálculos sem aprovação": com um documento em revisão, todos os números do motor ficam iguais aos de antes. Um teste também falha se `carregar.ts` ler a tabela `documentos`.
4. Aceite "fatura com itens importados não conta o mesmo gasto duas vezes": importar a fatura e depois o extrato com o pagamento dela dá gasto variável igual à soma dos itens, e o pagamento entra como transferência. Vale também para a fatura já cadastrada e já paga, e para a fixa paga no cartão.
5. Ponta a ponta, em computador e celular: enviar, revisar, corrigir, aprovar, descartar, reenviar o mesmo arquivo e tentar de novo após erro.

**Bibliotecas novas:** `unpdf` e `@napi-rs/canvas` (texto e imagem das páginas do PDF), `tesseract.js` com o português (OCR), `zxing-wasm` (código de barras), `sharp` (tratamento das fotos), `exceljs` (XLSX), `papaparse` (CSV) e `zod` (validação do que a tela envia). Para gerar o conjunto de teste: `pdf-lib` e `bwip-js`. Tudo roda no servidor, sem chamar serviço externo.

**Segurança:** a leitura usa a sessão de quem enviou, com o RLS de sempre; não precisa da chave de serviço. O arquivo fica no Storage privado, na pasta da pessoa, só até a aprovação ou o descarte (salvo se ela escolheu guardar), e a revisão o mostra por link temporário. Os registros levam o identificador, o formato, o status e a duração.

### Resultado da Etapa 5 (07/11/2026)

- **Leitura dos 30 documentos (aceite de 95%):** 558 de 558 valores e datas certos (100%), em todos os formatos: PDF com texto 342/342, foto 28/28, PDF digitalizado 24/24, OFX 64/64, CSV 70/70 e XLSX 30/30. O tipo de cada documento também foi reconhecido nos 30. A avaliação roda no `pnpm test` e no CI, sem custo, e falha abaixo de 95%. **Limite:** o conjunto foi feito por mim, e as regras conhecem esses layouts. Em documentos reais de outros bancos e empresas, principalmente fotos, a taxa tende a ser menor; o que não for lido aparece na revisão para completar.
- **Nada entra nos cálculos sem aprovação:** com o documento lido e em revisão, os dados do motor e todos os números do painel e do planejamento ficam iguais (integração e ponta a ponta, comparando todos os números marcados das duas telas). Um teste falha se `carregar.ts` ler a tabela `documentos` ou a extração.
- **Fatura sem contar o gasto duas vezes:** importar a fatura (a conta sai das contas avulsas do orçamento e os itens entram como gasto variável) e depois o extrato com o pagamento dela (a revisão propõe quitar a fatura; o pagamento entra como transferência) deixa o gasto dos meses igual à soma das compras. Vale também para a fatura já cadastrada e já paga e para o item de fixa paga no cartão. Desligando a marcação da fatura com itens, os dois testes de aceite falham.
- **Testes:** `packages/documentos` com 90 testes (leitura, regras de cada tipo, código de barras, cruzamento, aprovação e a avaliação do conjunto); 33 testes unitários do app; 88 de isolamento (7 novos do Storage e 2 da aprovação); 30 de integração (7 novos); 34 cenários ponta a ponta em computador e celular (6 novos: fatura e extrato, foto de boleto com reenvio e descarte, e arquivo ilegível).
- **Tempo de leitura medido:** PDF com texto em menos de meio segundo; foto ou digitalizado de 2 a 6 segundos (OCR e código de barras), no próprio servidor.

**Escolhas de implementação:**

| Item                                  | Escolha                                                                                                                                                                                                                                               |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Envio                                 | O navegador calcula o hash (SHA-256; sem Web Crypto, como no celular por http na rede de casa, com um cálculo próprio) e manda o arquivo direto para o Storage por um endereço assinado pelo servidor. O servidor confere o hash de novo antes de ler |
| Leitura                               | Logo depois do envio (`after` do Next), com a sessão de quem enviou, sem chave de serviço. Limite de 150 segundos; parado há mais de 3 minutos, aparece "Ler de novo"                                                                                 |
| Ler de novo                           | Pode trocar o tipo do documento (ex.: ler como fatura) e lê o mesmo arquivo outra vez                                                                                                                                                                 |
| Revisão                               | O cruzamento roda ao abrir a revisão, com os dados daquele momento. A tela manda as escolhas em JSON; o servidor valida com Zod, confere de novo as contas e rendas e monta com o motor o que cada pagamento tira da reserva                          |
| Gravação                              | Função `aprovar_documento` do banco: conta, pagamentos, recebimentos e lançamentos numa transação; um erro desfaz tudo. Aprovar mostra o aviso D3 se o valor da semana mudou                                                                          |
| Arquivo original                      | Apagado ao aprovar ou descartar, salvo a opção "Guardar o arquivo original" (perfis.guardar_original). A revisão mostra o arquivo por link de 10 minutos                                                                                              |
| Estorno, pagamento anterior e parcela | Como propostos acima                                                                                                                                                                                                                                  |
| Sinal no extrato em PDF               | Com a coluna de saldo, a diferença entre um saldo e o anterior confirma se a linha é entrada ou saída                                                                                                                                                 |
| Categorias                            | A escolhida pela pessoa para uma descrição parecida (últimos 500 lançamentos com categoria) e, sem ela, a lista de palavras. Contracheque vai para Salário e recibo de autônomo, para Trabalho autônomo                                               |
| Registros                             | Identificador, formato, tipo, quantidade de linhas e duração; nunca o conteúdo nem os valores                                                                                                                                                         |

**Lacunas novas, para decidir depois:**

- **Documentos reais.** A taxa medida vale para o conjunto fictício. Proposta: o Paulo envia, no computador dele, de 5 a 10 documentos reais (faturas, extratos e contas dos bancos e empresas que usa) e me conta o que não foi lido; eu acrescento os layouts.
- **Conta paga com o cartão de crédito sem estar marcada como "paga no cartão"** (ex.: a conta de luz paga no crédito): o item da fatura entra como gasto variável e a conta continua em aberto. Hoje só a fixa marcada "paga no cartão" é reconhecida no item da fatura. Proposta: sugerir quitar a conta também nesse caso, na Etapa 6.
- **Publicação (Etapa 7):** os arquivos de idioma do OCR e do leitor de código precisam ir junto no pacote do servidor da Vercel (`outputFileTracingIncludes`), e o tempo máximo da função precisa caber a leitura de PDF digitalizado de várias páginas.
- **Arquivo que não foi apagado:** se apagar o original falhar depois da aprovação, o documento já não aponta para ele, mas o arquivo fica no Storage. Entra na rotina de limpeza da Etapa 7, junto com a exclusão da conta.
- **Prévia do PDF no celular:** alguns navegadores de celular não mostram PDF dentro da página; a revisão tem o link "Abrir o PDF em outra aba".
- **Fotos em HEIC** (formato do iPhone) não são lidas; o iPhone costuma converter para JPG ao enviar pelo navegador, e a tela avisa quando não converte.

## 5. Decisões para aprovar

As cinco decisões da seção 8 da spec seguem a recomendação de lá: uso pessoal com estrutura para vários usuários, limite mensal de documentos, arquivo original apagado por padrão, só pessoa física e nome provisório No Azul.

| #   | Decisão                                        | Recomendação                                                     |
| --- | ---------------------------------------------- | ---------------------------------------------------------------- |
| D1  | Contagem de meses até o prazo (C1)             | Meses de calendário; o exemplo 3.6 fica como está                |
| D2  | Critério da simulação de 52 semanas (C2)       | Toda conta paga inteira pela reserva no vencimento               |
| D3  | Valor fixo na semana (C3)                      | Foto da segunda-feira; cadastros recalculam e mostram o motivo   |
| D4  | Fatura e fixas pagas no cartão (C4)            | Fatura na reserva e fora do orçamento; marcação `paga_no_cartao` |
| D5  | Ajustes no modelo de dados (C5 e C6)           | Todos os listados                                                |
| D6  | Arredondamentos e casos de borda (C7 e C8)     | Como proposto                                                    |
| D7  | Deploy                                         | Só local e CI até a Etapa 7 (revisto pelo Paulo em 05/11/2026)   |
| D8  | Leitura de documentos (decidida em 07/11/2026) | Local, sem IA e sem custo por documento (seção 4d)               |
