# Arquitetura — Planejador de Estudos V10.7

O app é uma página estática (GitHub Pages) + Supabase. Não há build nem bundler: o `index.html` carrega arquivos JS comuns, na ordem abaixo.

## Estrutura de arquivos

```
index.html              estrutura da tela (HTML) e ordem de carga dos scripts
service-worker.js       cache offline (PWA) — lista todos os arquivos em APP_SHELL
supabase-config.js      URL e chave PÚBLICA do Supabase
manifest.webmanifest    manifesto do PWA
icons/                  ícones do PWA
css/estilos.css         todos os estilos (cartões, menu lateral, tabela, login…)
js/                     lógica, dividida por área (tabela abaixo)
```

## Ordem de carga (importa!)

Os scripts são clássicos (não `type="module"`) e **compartilham o mesmo escopo global**: uma função de um arquivo pode ser chamada por outro e o HTML usa `onclick="…"`. Por isso:

- Funções (`function x(){}`) podem ser chamadas de qualquer arquivo **depois** que todos carregarem (ou seja, dentro de funções, eventos e do `12-iniciar.js`).
- Código solto no topo de um arquivo (fora de função) só pode usar o que já foi definido nos arquivos **anteriores** da lista.
- `12-iniciar.js` roda por último e monta a tela; novos arquivos de lógica entram **antes** dele.

| # | Arquivo | O que contém |
|---|---|---|
| 1 | `js/00-config.js` | Versão única (`APP_VERSION`) e carga da chave pública do Supabase. **Único lugar onde se muda a versão** (junto com `CACHE_NAME` em `service-worker.js`). |
| 2 | `js/01-base.js` | Dados iniciais em memória (`userProgress`, `studySessions`), toasts e caixas de diálogo, contagem regressiva, modo escuro, troca de abas, configurações de prioridade. |
| 3 | `js/02-sugestoes.js` | Utilitários de data e sessão, trilhas de estudo e a sugestão do próximo estudo. |
| 4 | `js/03-utilitarios.js` | Horas em HH:mm, exclusões duráveis (tombstones), diagnóstico/limpeza de tópicos e menu lateral retrátil. |
| 5 | `js/04-inicio.js` | Trilhas cadastráveis, subtítulo do concurso, painéis recolhíveis da Home (últimos estudos, sugestões, revisões), progresso por prioridade, cronograma e KPIs. |
| 6 | `js/05-registro.js` | Aba **Registro**: formulário de estudo, tabela editável do histórico de sessões, edição e exclusão. |
| 7 | `js/06-edital.js` | Aba **Edital Verticalizado**: filtros e renderização. |
| 8 | `js/07-concursos.js` | Concursos (criar/trocar, `contests`, `activeContest`), prioridades, disciplinas, pesos e personalização. |
| 9 | `js/08-importacao-ia.js` | Cadastro manual do edital, importação por planilha/PDF e análise do edital por IA (Edge Function). |
| 10 | `js/09-sincronizacao.js` | Supabase: login, mesclagem por ID entre aparelhos, sincronização e salvamento na nuvem. |
| 11 | `js/10-dados-backup.js` | `saveData`, cabeçalho do concurso, configurações do Supabase, reset e backup (exportar/importar). |
| 12 | `js/11-datas-anotacoes.js` | Modal de anotações e **Datas Importantes** (checklist por concurso). |
| 13 | `js/12-iniciar.js` | Chamadas finais que montam a tela. **Deve ser o último arquivo de lógica** antes de `auth.js`. |
| 14 | `js/auth.js` | Tela de login, cadastro, recuperação de senha, Google OAuth e botão de instalar o PWA (função autocontida, sem globais). |
| 15 | `js/pwa.js` | Registro do service worker. |

## Funções principais por arquivo

**`01-base.js`** (17 funções): `preencherVersao`, `nivelToast`, `showToast`, `abrirCaixa`, `showCustomDialog`, `showModalDialog`, `closeDialog`, `updateCountdown`, `toggleDarkMode`, `switchTab`, `getPrioritySettings`, `getDisciplineSettings`, `getPriorityLabel`, `applyPriorityColors` …

**`02-sugestoes.js`** (14 funções): `parseBRDate`, `getSessionsNewestFirst`, `localTodayISO`, `dateToInputValue`, `dateToBR`, `isRevisionSession`, `sessionMatchesTopic`, `getStudyTracks`, `getSuggestionMode`, `updateSuggestionModeHelp`, `saveSuggestionMode`, `getStudySuggestionCandidates`, `getNextStudyRecommendation`, `applyStudyRecommendation`

**`03-utilitarios.js`** (18 funções): `fmtHM`, `fmtHoras`, `getTombstones`, `setTombstones`, `addTombstones`, `unionTombstones`, `getLegacyIdSet`, `diagnoseTopics`, `renderTopicDiagnostics`, `cleanupLegacyTopics`, `adjustProgressForSession`, `setHeaderHeightVar`, `syncSidebarToggle`, `toggleSidebar` …

**`04-inicio.js`** (26 funções): `getStudyTrackOptions`, `saveStudyTracks`, `trackOptionsHtml`, `populateRegTrackSelect`, `refreshTrackViews`, `renderStudyTracksManager`, `addStudyTrack`, `renameStudyTrack`, `deleteStudyTrack`, `contestSubtitleText`, `refreshContestSubtitle`, `isPristineLocalState`, `onboardingHtml`, `getPanelSummaryText` …

**`05-registro.js`** (17 funções): `initRegistrationForm`, `updateRegTopics`, `handleStudySessionSubmit`, `getInlineSessionEditorMarkup`, `populateInlineTopicSelect`, `saveInlineSession`, `sessionTopicLabel`, `renderSessionsList`, `fillSessionTopicSelect`, `onSessionTableChange`, `applySessionPatch`, `onSessionTableClick`, `updateEditSessionTopics`, `editSession` …

**`06-edital.js`** (3 funções): `initEditalFilters`, `updateEditalTopicsFilter`, `renderEditalVerticalizado`

**`07-concursos.js`** (16 funções): `contestKey`, `renderContestSelector`, `saveCurrentContestSnapshot`, `restoreSnapshotToMemory`, `changeContest`, `saveContestSettings`, `addContest`, `renderPrioritySettings`, `savePrioritySettings`, `recalculateDisciplineWeightsByPriority`, `renderCustomization`, `updateWeightShares`, `disciplinePriorityChanged`, `addDisciplineToContest` …

**`08-importacao-ia.js`** (15 funções): `extractPdfText`, `normalizeSyllabusKey`, `getSyllabusPriority`, `parseSpreadsheetNumber`, `clearManualSyllabusForm`, `editSyllabusItem`, `saveManualSyllabusItem`, `deleteSyllabusItem`, `refreshSyllabusViews`, `renderSyllabusManager`, `downloadSyllabusTemplate`, `importManualSyllabusFile`, `chamarIAServidor`, `analyzeEditalAI` …

**`09-sincronizacao.js`** (32 funções): `collectContestSnapshots`, `buildCurrentCloudPayload`, `mergeNoteValues`, `mergeRecordValue`, `mergeRecordLists`, `mergeSettingsObjects`, `mergeContestSnapshot`, `mergeContestSnapshots`, `upsertCloudPayloadSafely`, `persistSnapshotMapToLocal`, `adoptMergedCloudPayloadLocally`, `saveSupabaseSettings`, `initializeSupabase`, `formatSavedAt` …

**`10-dados-backup.js`** (6 funções): `updateContestHeader`, `loadSupabaseSettings`, `confirmReset`, `exportData`, `applyImportedBackup`, `importData`

**`11-datas-anotacoes.js`** (12 funções): `openModal`, `closeModal`, `saveModalNote`, `getImportantDates`, `saveImportantDates`, `dayDiffFromToday`, `fmtBRDateISO`, `daysChip`, `dateRowHtml`, `renderImportantDates`, `addImportantDate`, `renderDashboard`

## Onde mexer em cada pedido

| Quero mudar… | Arquivo |
|---|---|
| Aba Registro / tabela de sessões | `js/05-registro.js` (+ trecho `#tab-registro` no `index.html`) |
| Formato das horas (HH:mm) | `js/03-utilitarios.js` (`fmtHM`, `fmtHoras`) |
| Menu lateral | `js/03-utilitarios.js` + `css/estilos.css` |
| Painéis da Home / sugestões | `js/04-inicio.js`, `js/02-sugestoes.js` |
| Datas Importantes | `js/11-datas-anotacoes.js` |
| Edital, importação, IA | `js/06-edital.js`, `js/08-importacao-ia.js` |
| Concursos, prioridades, disciplinas | `js/07-concursos.js` |
| Sincronização, login, mesclagem | `js/09-sincronizacao.js`, `js/auth.js` |
| Backup (exportar/importar) | `js/10-dados-backup.js` |
| Aparência | `css/estilos.css` |

## Ao publicar uma nova versão

1. Mude `window.APP_VERSION` em `js/00-config.js`.
2. Mude `CACHE_NAME` em `service-worker.js` (senão os aparelhos continuam com o cache antigo).
3. Se criar um arquivo novo, inclua-o em `index.html` (na ordem certa) **e** em `APP_SHELL` no `service-worker.js`.
4. Em correções pontuais, basta enviar só os arquivos alterados.
