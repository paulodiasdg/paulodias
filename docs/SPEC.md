# No Azul: especificação do sistema de controle financeiro

Nov 4, 2026 · @Paulo Dias

## 1. Visão do produto

O No Azul (nome provisório) lê documentos financeiros e responde toda semana a uma pergunta: quanto a pessoa precisa guardar para pagar as contas e cumprir as metas.

**Problema.** Quem controla o dinheiro por planilha ou aplicativo de banco vê o que já gastou, mas não sabe quanto separar agora para não faltar depois. Lançar comprovantes à mão também faz a maioria desistir do controle.

**Público.** Pessoas físicas e profissionais autônomos com renda fixa ou variável. Cada usuário tem dados próprios e privados. A primeira versão atende finanças pessoais, sem separar conta de pessoa jurídica.

**Promessa do produto.**

- Envie um comprovante, fatura, boleto, extrato ou contracheque e confira os dados extraídos antes de salvar.
- Veja no painel o resumo de gastos da semana e o valor a reservar, separado entre contas e metas.
- Defina uma meta e receba o plano: quanto guardar por semana, se cabe no orçamento e quando ela termina.
- Acompanhe um índice de saúde financeira de 0 a 100 com a explicação de cada ponto.

**Fora da primeira versão.**

- Conexão automática com bancos via Open Finance
- Pagamento de contas pelo sistema
- Investimentos, imposto de renda e contabilidade de empresa
- Contas compartilhadas entre casais ou famílias
- Aplicativo nativo para celular; a versão web precisa funcionar bem na tela do celular

## 2. Funcionalidades e telas

O sistema tem seis telas, e o painel abre sempre com o valor a reservar na semana atual.

| Tela | O que a pessoa vê | O que a pessoa faz |
| --- | --- | --- |
| Painel | Reserva da semana, gastos contra o limite, próximas contas, metas e saúde financeira | Registrar reserva, marcar conta como paga, navegar entre semanas |
| Lançamentos | Gastos e receitas por mês, com busca e filtro por categoria | Criar, editar, excluir e exportar em CSV |
| Contas e fixas | Rendas recorrentes, despesas fixas e contas avulsas com vencimento | Cadastrar, pagar, confirmar recebimento, desfazer pagamento |
| Metas | Progresso, aporte semanal, situação do prazo e previsão de término | Criar meta, definir prioridade, registrar aporte |
| Documentos | Fila de arquivos, dados extraídos e histórico de leituras | Enviar, corrigir, aprovar ou descartar |
| Planejamento | Agenda de reservas de 8 semanas, projeção de 6 meses e comparação 50/30/20 | Definir teto de gastos, pedir análise por IA |

**Painel, de cima para baixo.**

1. Valor a reservar na semana, com a divisão entre contas e cada meta.
2. Alertas: conta vencida, meta sem verba e gasto acima do ritmo.
3. Gastos da semana contra o limite, por categoria, com comparação das últimas 6 semanas.
4. Contas dos próximos 14 dias.
5. Progresso das metas.
6. Índice de saúde financeira, com os pontos de cada componente.
7. Divisão do mês: fixas, contas avulsas, metas, gastos variáveis e folga.

**Primeiro acesso.** Um passo a passo pede renda, despesas fixas e a primeira meta. Um modo de exemplo mostra o painel preenchido, com aviso claro, e não salva nada.

## 3. Motor de cálculo

Toda regra financeira fica em um módulo de funções puras, sem acesso a banco ou tela, e recebe a data atual como parâmetro. Valores são guardados em centavos inteiros. A semana vai de segunda a domingo.

### 3.1 Reserva semanal para contas

O sistema calcula o menor valor semanal constante que evita saldo negativo na reserva nas próximas 8 semanas.

```latex
r = \max\left(0,\ \max_{k=1..8} \frac{\sum_{i=1}^{k} O_i - B}{k}\right)
```

- Oᵢ é a soma das contas em aberto que vencem na semana i. Contas vencidas entram na semana 1.
- B é o saldo guardado para contas no início da semana.
- r é arredondado para cima, em reais inteiros.
- A semana k que define o máximo é a data mais apertada, mostrada na tela: “assim nada vence descoberto até 15/11”.

**O valor não pode mudar durante a semana.** Para isso, B usa o saldo do início da semana: desconta o que foi guardado na semana e devolve o que saiu da reserva para pagar contas na semana. Sem essa regra, registrar a reserva faria o sistema pedir um novo valor em seguida.

**Ao pagar uma conta**, sai da reserva o menor valor entre a conta e o saldo. Desfazer o pagamento devolve esse valor.

### 3.2 Orçamento do mês

```latex
\text{Livre} = \text{Renda} - \text{Fixas} - \text{Contas avulsas}
```

- A renda soma cada recorrente, pelo valor recebido ou pelo previsto, e as receitas avulsas.
- A estimativa de gastos variáveis usa o teto definido pela pessoa. Sem teto, usa a média dos últimos 3 meses com dados. Sem histórico, usa 30% da renda.
- Gasto variável é toda despesa sem vínculo com conta ou despesa fixa.

### 3.3 Plano das metas

```latex
\text{Aporte mensal necessário} = \frac{\text{Alvo} - \text{Guardado}}{\max(1,\ \text{dias até o prazo} / 30{,}4375)}
```

1. A verba das metas é Livre menos a estimativa de gastos variáveis, com mínimo zero.
2. As metas são ordenadas por prioridade e, no empate, pelo prazo mais próximo.
3. Cada meta recebe o menor valor entre o necessário e a verba restante.
4. O aporte semanal é o valor mensal × 12 ÷ 52, arredondado para cima em reais inteiros.
5. Meta com verba parcial mostra o aporte possível, a nova data prevista e quanto falta por mês.

O cálculo da semana usa o valor guardado no início da semana, pelo mesmo motivo da regra 3.1.

### 3.4 Limite de gastos

```latex
\text{Limite mensal} = \min(\text{Teto},\ \text{Livre} - \text{Metas alocadas})
```

O limite semanal é o mensal × 7 ÷ dias do mês, com mínimo zero. Sem teto, vale só o segundo termo. O painel também mostra quanto ainda pode ser gasto por dia até o fim do mês.

### 3.5 Índice de saúde financeira

O índice vai de 0 a 100 e soma cinco componentes. Entre os limites de cada linha, a pontuação é proporcional. Sem renda cadastrada, o sistema não mostra índice.

| Componente | Medida | Peso | Nota máxima | Nota zero |
| --- | --- | --- | --- | --- |
| Compromisso da renda | (Fixas + avulsas) ÷ renda | 25 | até 50% | 80% ou mais |
| Capacidade de poupar | (Livre − variáveis estimados) ÷ renda | 25 | 20% ou mais | 0% ou menos |
| Reserva de emergência | Guardado ÷ (fixas + variáveis estimados) | 20 | 6 meses | 0 meses |
| Contas em dia | 1 − (vencido ÷ compromissos do mês) | 15 | nada vencido | vencido igual ou maior que os compromissos |
| Ritmo de gastos | Gasto ÷ (limite × fração do mês decorrida) | 15 | até 100% | 150% ou mais |

Faixas: 80 a 100 saudável, 60 a 79 estável, 40 a 59 atenção, abaixo de 40 crítico. Os pesos e limites são uma proposta do produto, não um padrão oficial, e ficam em um arquivo de configuração.

### 3.6 Exemplo para os testes

Cenário fictício: renda de R$ 7.700, fixas de R$ 3.000, conta avulsa de R$ 380, teto de R$ 2.200 e R$ 800 na reserva de contas.

| Semana | Contas da semana (R$) | Acumulado (R$) | (Acumulado − 800) ÷ k (R$) |
| --- | --- | --- | --- |
| 1 | 520 | 520 | −280,00 |
| 2 | 2.130 | 2.650 | 925,00 |
| 3 | 730 | 3.380 | 860,00 |
| 4 | 0 | 3.380 | 645,00 |
| 5 | 0 | 3.380 | 516,00 |
| 6 | 520 | 3.900 | 516,67 |
| 7 | 2.130 | 6.030 | 747,14 |
| 8 | 350 | 6.380 | 697,50 |

**Resultado esperado para contas:** R$ 925 por semana, definido pela semana 2.

**Metas.** Livre = R$ 4.320 e verba das metas = R$ 2.120.

| Meta (prioridade) | Falta (R$) | Meses | Necessário por mês (R$) | Alocado por mês (R$) | Aporte semanal (R$) |
| --- | --- | --- | --- | --- | --- |
| Reserva de emergência (1) | 22.200 | 18 | 1.233,33 | 1.233,33 | 285 |
| Viagem (2) | 4.500 | 8 | 562,50 | 562,50 | 130 |
| Notebook (3) | 6.800 | 10 | 680,00 | 324,17 | 75 |

**Reserva total da semana:** R$ 925 + R$ 490 = R$ 1.415. O notebook aparece como meta sem verba completa.

**Limite de gastos:** R$ 2.200 no mês, ou R$ 513,33 por semana em um mês de 30 dias.

**Saúde financeira:** com R$ 7.800 na reserva de emergência, nada vencido e gasto em 110% do ritmo, o índice é 82 (25 + 25 + 5 + 15 + 12).

## 4. Leitura de documentos

A IA propõe os dados e a pessoa confirma: nada extraído de um documento entra nos cálculos sem revisão.

### 4.1 Documentos e resultado

| Documento | Formatos | Resultado proposto |
| --- | --- | --- |
| Comprovante ou nota fiscal | Foto, PDF | Uma despesa |
| Boleto ou conta de consumo | Foto, PDF | Uma conta a pagar com vencimento |
| Fatura de cartão | PDF, foto | Uma conta a pagar e os itens como despesas |
| Extrato bancário | PDF, CSV, OFX, XLSX | Várias despesas, receitas e transferências |
| Contracheque | PDF, foto | Uma receita pelo valor líquido |

### 4.2 Etapas do processamento

1. **Recebimento.** Valida tipo e tamanho, calcula o hash do arquivo e avisa se ele já foi enviado.
2. **Preparação.** CSV, OFX e XLSX são lidos direto. PDF com texto usa o texto extraído. PDF digitalizado e foto vão como imagem.
3. **Extração.** A API do Claude devolve JSON validado por um esquema. Extratos longos são divididos em partes.
4. **Validação.** Confere datas, valores e categorias, e compara a soma dos itens com o total do documento.
5. **Cruzamento.** Marca possíveis duplicatas e contas em aberto com valor e data compatíveis.
6. **Revisão.** A pessoa corrige, marca ou desmarca cada linha e aprova.
7. **Gravação.** Salva tudo em uma única transação e recalcula o painel.

### 4.3 Formato da extração

```json
{
  "tipo": "fatura_cartao",
  "emissor": "Banco Exemplo",
  "confianca": 0.93,
  "conta": { "nome": "Fatura do cartão", "valor_centavos": 184250, "vencimento": "2026-11-20" },
  "lancamentos": [
    { "data": "2026-10-12", "descricao": "Mercado", "valor_centavos": 28790, "tipo": "despesa", "categoria": "alimentacao", "confianca": 0.97 }
  ],
  "avisos": ["Total da fatura difere em R$ 3,20 da soma dos itens"]
}
```

### 4.4 Regras para evitar erro no cálculo

- **Fatura de cartão.** Se os itens forem importados, o pagamento da fatura vira transferência e não conta como novo gasto.
- **Pagamento em extrato.** Se o valor for igual e a data estiver a até 5 dias do vencimento, o sistema sugere quitar a conta correspondente.
- **Duplicata.** Valor igual, data a até 1 dia e descrição parecida deixam a linha desmarcada, com aviso.
- **Baixa confiança.** Campo abaixo de 0,8 fica destacado para conferência.
- **Falha na leitura.** O documento continua na fila, e a pessoa pode tentar de novo ou lançar à mão.

### 4.5 Privacidade

- O texto do documento é tratado como dado, e qualquer instrução escrita nele é ignorada.
- A extração não devolve CPF, número de conta, número completo de cartão nem código de barras.
- A pessoa escolhe se guarda o arquivo original. O padrão é apagar após a aprovação e manter só os dados confirmados.
- A tela de envio informa que o conteúdo será processado por um serviço de IA.

## 5. Modelo de dados

São nove tabelas, todas ligadas ao usuário e com valores em centavos inteiros. Exclusão de conta do usuário apaga tudo em cascata.

| Tabela | Campos principais | Observação |
| --- | --- | --- |
| `perfis` | id, nome, teto\_variavel\_centavos | Um por usuário |
| `categorias` | id, nome, grupo (essencial, livre, receita, transferencia) | Lista padrão, com categorias próprias |
| `recorrencias` | id, tipo (renda, fixa), nome, valor, dia, inicio, categoria\_id, ativa, renda\_variavel | Dia 31 usa o último dia dos meses menores |
| `ocorrencias` | id, recorrencia\_id, competencia (AAAA-MM), valor, status, pago\_em, valor\_da\_reserva, lancamento\_id | Registro único por recorrência e mês |
| `contas_avulsas` | id, nome, valor, vencimento, categoria\_id, quita\_itens, pago\_em, valor\_da\_reserva, lancamento\_id, documento\_id | quita\_itens evita contar a fatura duas vezes |
| `lancamentos` | id, data, descricao, valor, tipo (despesa, receita, transferencia), categoria\_id, vinculo, documento\_id, origem | Índice por usuário e data |
| `metas` | id, nome, alvo, guardado, prazo, prioridade (1 a 3), tipo (comum, emergencia), concluida\_em | Uma reserva de emergência por usuário |
| `movimentos_reserva` | id, data, tipo (aporte, saque, ajuste), destino (contas, meta), meta\_id, valor, origem\_id | Saldos e metas são derivados desta tabela |
| `documentos` | id, nome, hash, tipo, status, extracao\_json, modelo\_usado, arquivo\_chave, criado\_em, aprovado\_em | Status: recebido, processando, em\_revisao, aprovado, erro, descartado |

**Regras de integridade.**

- Pagar uma conta grava o pagamento, o lançamento e o movimento da reserva na mesma transação.
- Saldos nunca são editados diretamente. Correções entram como movimento do tipo ajuste.
- O hash do arquivo é único por usuário, salvo quando a pessoa confirma o reenvio.
- `extracao_json` não guarda dados que a extração foi instruída a omitir, como CPF e número de conta.

## 6. Arquitetura, stack e segurança

A recomendação é uma aplicação web única em TypeScript, com banco gerenciado e o motor de cálculo isolado em um pacote próprio.

&#91;embedded content: arquitetura · 6 partes\]

O documento passa pela API do Claude e volta para revisão; o motor só recebe do banco os dados aprovados.

| Camada | Escolha recomendada | Motivo |
| --- | --- | --- |
| Interface e servidor | Next.js com TypeScript | Mesma linguagem no motor, na tela e na API |
| Estilo e gráficos | Tailwind CSS e Recharts | Velocidade para construir o painel responsivo |
| Banco, login e arquivos | Supabase (PostgreSQL, Auth, Storage) | Isolamento por usuário com Row Level Security |
| Leitura de documentos | API do Claude com saída validada por Zod | Lê imagens e texto e devolve dados estruturados |
| Processamento em segundo plano | Fila de tarefas (Inngest ou Trigger.dev) | Extratos longos não devem depender de uma requisição aberta |
| Testes | Vitest e Playwright | Regras financeiras e fluxos de tela cobertos |
| Hospedagem | Vercel e Supabase | Pouca operação na primeira versão |

**Organização sugerida do repositório.**

```text
apps/web/            telas, rotas e ações do servidor
packages/motor/      cálculos puros e testes
packages/documentos/ preparação, extração e cruzamento
supabase/            migrações e políticas de acesso
CLAUDE.md            regras do projeto para o Claude Code
```

**Segurança mínima antes de abrir para outras pessoas.**

- Row Level Security em todas as tabelas, com teste automatizado de acesso entre usuários.
- Chave da API e chave de serviço do banco somente no servidor.
- Arquivos em armazenamento privado, com links temporários.
- Limite de envios e de tamanho por usuário, para conter abuso e custo.
- Registros sem conteúdo de documentos nem valores financeiros.
- Autenticação em dois fatores disponível.

**LGPD.** Antes do lançamento público, o sistema precisa de política de privacidade, exportação dos dados e exclusão da conta pelo próprio usuário. Vale revisar esses pontos e o envio de dados a fornecedores com um advogado.

**Aviso no produto.** O sistema organiza e calcula, mas não substitui consultoria financeira, e a tela de planejamento deve deixar isso claro.

## 7. Etapas de desenvolvimento

A ordem começa pelo motor de cálculo, porque ele é a parte mais crítica e a mais fácil de provar com testes. Cada etapa só termina quando seu critério de aceite passa.

1. **Base do projeto.** Repositório, `CLAUDE.md`, banco, migrações, login e testes rodando na integração contínua.
   - Aceite: um usuário entra no sistema e um teste automatizado prova que ele não lê dados de outro.
2. **Motor de cálculo.** Reserva, orçamento, metas, limite e saúde financeira, sem nenhuma tela.
   - Aceite: o cenário da seção 3.6 reproduz todos os valores esperados.
   - Aceite: em uma simulação de 52 semanas, o saldo da reserva de contas nunca fica negativo.
   - Aceite: registrar a reserva não muda o valor pedido naquela semana.
3. **Cadastros e lançamentos.** Renda, despesas fixas, contas avulsas, metas e lançamentos manuais.
   - Aceite: pagar e desfazer o pagamento devolve lançamentos e saldos ao estado anterior.
4. **Painel e planejamento.** Telas com dados reais, navegação por semana, agenda de 8 semanas e projeção de 6 meses.
   - Aceite: todo número do painel confere com o motor, em computador e celular.
5. **Leitura de documentos.** Envio, extração, revisão, duplicidades e cruzamento com contas em aberto.
   - Aceite: em um conjunto de 30 documentos de teste anonimizados, 95% dos valores e datas são extraídos corretamente.
   - Aceite: nenhum dado entra nos cálculos sem aprovação.
   - Aceite: fatura com itens importados não conta o mesmo gasto duas vezes.
6. **Análise por IA e acabamento.** Resumo mensal, alertas, primeiro acesso, modo de exemplo e exportação.
   - Aceite: a análise usa apenas números calculados pelo motor, e uma pessoa nova configura tudo em menos de 10 minutos.
7. **Preparação para o público.** Revisão de segurança, LGPD, limites de uso, monitoramento e cópias de segurança.
   - Aceite: a lista de segurança da seção 6 está completa e a restauração de uma cópia foi testada.

As metas de 95% e 10 minutos são propostas iniciais e podem ser ajustadas após os primeiros testes.

## 8. Decisões em aberto e início no Claude Code

Cinco decisões são suas; o restante desta especificação já pode ser desenvolvido com as opções recomendadas.

| Decisão | Recomendação | O que muda |
| --- | --- | --- |
| Uso pessoal ou produto para vender? | Começar pessoal, com estrutura pronta para vários usuários | Produto exige planos, cobrança e suporte |
| Quem paga o custo da IA? | Limite mensal de documentos por usuário | Define o preço e o controle de uso |
| Guardar o arquivo original? | Não por padrão; a pessoa pode optar por guardar | Guardar aumenta custo e responsabilidade |
| Separar pessoa física e empresa? | Fora da primeira versão | Separar muda o modelo de dados desde cedo |
| Nome e identidade visual | Manter No Azul como nome provisório | Verificar a disponibilidade da marca e do domínio antes do lançamento |

### Como começar

1. Exporte este documento em Markdown e salve no repositório como `docs/SPEC.md`.
2. Abra o repositório vazio no Claude Code.
3. Envie o prompt abaixo.

```text
Leia docs/SPEC.md por inteiro. Vamos desenvolver o No Azul em etapas, conforme a seção 7.

Antes de escrever código:
1. Aponte contradições ou lacunas na especificação.
2. Proponha o plano da Etapa 1 e da Etapa 2.
3. Crie um CLAUDE.md com a stack, os comandos e estas regras:
   - cálculos financeiros ficam em packages/motor, como funções puras;
   - valores monetários usam centavos inteiros, nunca ponto flutuante;
   - a data atual é sempre passada como parâmetro para o motor;
   - toda regra financeira nova vem com teste;
   - toda tabela tem Row Level Security e teste de isolamento entre usuários;
   - dados de documento nunca entram nos cálculos sem aprovação do usuário;
   - interface e mensagens em português do Brasil.

Depois que eu aprovar o plano, comece pela Etapa 1. Não avance de etapa sem cumprir os critérios de aceite e me mostrar o resultado dos testes.
```
