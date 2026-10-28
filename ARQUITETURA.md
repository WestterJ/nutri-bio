# Diário Nutricional — Arquitetura (V39)

A partir da V39, o código que ficava todo no `index.html` está dividido em arquivos.
**Não houve mudança de comportamento** em relação à V38: o conteúdo de cada função foi movido sem alteração.

## Estrutura de pastas

```
index.html            Só a marcação (telas, abas, modais). Sem CSS nem JS do app.
css/app.css           Estilos próprios (impressão, tela de login, células editáveis, scrollbar).
supabase-config.js    URL e chave pública do Supabase.
service-worker.js     Cache do PWA (lista todos os arquivos abaixo).
manifest.webmanifest  Manifesto do PWA (não mudou).
icons/                Ícones 192 e 512.
js/                   Lógica, carregada em ordem numérica (ver abaixo).
```

## Mapa do JavaScript

| Arquivo | Área da tela / função | Principais funções |
|---|---|---|
| `01-utils.js` | Base: `$`, `esc`, `fmtNum`, `pad`, `hojeLocal`, `fmtDataBr`, `fmtDataHoraBr`; aviso (toast); imagens para impressão; modal de confirmação | `showToast`, `posicionarToast`, `customConfirm` |
| `02-estado.js` | Estado global e variáveis de sincronização | `state`, `defaultMetas`, `STORAGE_KEY`, `supabase*` (flags), `ordemRefeicao` |
| `03-nuvem.js` | Indicador de nuvem no topo, gravação local/nuvem, provedores legados (Apps Script, Google Drive, OneDrive), modal de conflito | `updateCloudStatusPill`, `saveCloud`, `resolveSyncConflict`, `loadData` |
| `04-diario.js` | Aba **Diário**: filtros, KPIs, tabela editável, modal de registro e salvar | `getFilteredRegistros`, `renderKPIs`, `renderTableDiario`, `proximaRefeicao`, `salvarCelulaDiario`, `abrirModalNovo`, `editarRegistro`, `copiarRegistro`, `excluirRegistro` |
| `05-ia-refeicao.js` | **Texto IA** e **Foto IA** no modal de registro | `GEMINI_MODEL`, `chamarNutriGemini`, `processarIAVision`, `prepararImagemParaIA` |
| `06-medidas.js` | Aba **Medidas** | `renderMedidas`, `salvarCelulaMedida`, `excluirMedida` |
| `07-bio.js` | Aba **Bioimpedância** e importação de PDF por IA | `renderBio`, `salvarCelulaBio`, `normalizarLeituraBio`, `renderBioIA` |
| `08-graficos.js` | Aba **Gráficos** | `renderGraficos` |
| `09-ia-analise.js` | **Análise de IA** (aba Relatório) e histórico `ia_analises` | `montarDadosAnalise`, `gerarAnaliseIA`, `salvarAnaliseIA`, `carregarHistoricoAnalises` |
| `10-relatorio.js` | Aba **Relatório** (atividade física, KPIs, tabelas, gráficos, impressão) | `renderRelAtividade`, `renderRelatorio` |
| `11-backup.js` | Configurações › **Backup**: restaurar, importar e exportar JSON | (handlers dos botões) |
| `12-metas.js` | Aba **Metas**: formulário, salvar, sugestão pelo objetivo | `carregarMetasForm` |
| `13-sync-supabase.js` | **Sincronização Supabase**: leitura, gravação condicional, conflito, polling 45 s, troca de usuário | `syncSupabaseNow`, `scheduleSupabaseSave`, `refreshFromSupabaseIfNeeded`, `conflitoSupabase`, `applySupabaseSession`, `activateUserStorage` |
| `14-treinos.js` | Aba **Treinos**: kcal por MET, modal, tabela, resumo | `garantirEstadoV34`, `kcalPorBloco`, `abrirTreino`, `renderTreinos` |
| `15-navegacao.js` | Troca de abas e atualização geral | `tabs`, `refreshAll` |
| `16-auth.js` | **Tela de login**: e-mail/senha, Google, criar conta, recuperar senha | `lockApp`, `unlockApp`, `authClientFromGate`, `authFriendlyError` |
| `99-main.js` | Inicialização: sessão Supabase, `loadData`, `refreshAll`, `lockApp`, registro do service worker | — |

## Regras para manutenção

1. **Escopo compartilhado.** Os arquivos são scripts clássicos (sem `type="module"`). Variáveis `const`/`let` e funções de nível superior ficam visíveis para todos os arquivos. Por isso:
   - não declare o mesmo nome em dois arquivos (gera erro e o app para de carregar);
   - código que **executa ao carregar** só pode usar o que foi declarado em arquivos **anteriores**. Chamadas dentro de funções e eventos podem usar qualquer arquivo.
2. **Nova função ou aba:** coloque no arquivo da área. Se for uma área nova, crie `js/NN-nome.js`, inclua o `<script>` no `index.html` antes do `99-main.js` e acrescente o caminho em `APP_SHELL` no `service-worker.js`.
3. **A cada versão publicada:** atualize `<title>` e "Versão Vxx" no `index.html` e `CACHE_NAME` no `service-worker.js`.
4. **Funções usadas em `onclick="window.…"`** dentro do HTML gerado (tabelas) precisam continuar como `window.nome = function…`.
5. **Dados:** a estrutura de `state` (`registros`, `medidas`, `bio`, `treinos`, `metas`) é gravada em `diary_data.data` no Supabase. Mudanças nela afetam backup, sincronização e importação.

## Como pedir ajustes (economiza contexto)

Indique o arquivo ou a área: "Em `04-diario.js`, …" ou "Na aba Treinos, …". Envie só os arquivos envolvidos e, se publicar, o `service-worker.js` com o novo `CACHE_NAME`.
