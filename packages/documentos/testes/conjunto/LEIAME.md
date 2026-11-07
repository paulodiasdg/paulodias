# Conjunto de teste da leitura de documentos

30 documentos fictícios, com o gabarito de cada um em `gabaritos.json`. Empresas, pessoas, CPFs,
CNPJs e números de conta são inventados.

| Faixa | Tipo                 | Formatos                                    |
| ----- | -------------------- | ------------------------------------------- |
| 01–06 | Comprovantes e notas | PDF com texto, foto, PDF digitalizado       |
| 07–12 | Boletos e contas     | PDF com texto, foto, PDF digitalizado       |
| 13–18 | Faturas de cartão    | PDF com texto, foto, PDF digitalizado       |
| 19–25 | Extratos             | OFX (1.0 e 2), CSV (dois jeitos), XLSX, PDF |
| 26–30 | Contracheques e RPA  | PDF com texto, foto, PDF digitalizado       |

- O gabarito sai dos mesmos dados que geram cada documento (`doc-*.ts`), e o código do gerador
  não usa nada de `src/`: as regras de leitura não influenciam o que se espera delas.
- O conjunto e os gabaritos entraram no repositório antes das regras de leitura (seção 4d do
  `docs/PLANO.md`).
- Para gerar de novo: `pnpm --filter @no-azul/documentos conjunto:gerar`. O ruído das fotos e dos
  digitalizados muda a cada geração; os valores e as datas, não.
