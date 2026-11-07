# Diário Nutricional — Arquitetura (V40)

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
| `05-ia-refeicao.js` | **Texto IA** e **Foto IA** no modal de registro; chamada à IA com tempo máximo, uma chamada por clique (V42), cancelamento e log `ia_logs`; reaproveitamento de refeição idêntica do histórico | `GEMINI_MODEL`, `chamarNutriGemini(payload, {signal, onStatus, timeoutMs, tentativas})`, `buscarEstimativaNoHistorico`, `processarIAVision` |
| `06-medidas.js` | Aba **Medidas** | `renderMedidas`, `salvarCelulaMedida`, `excluirMedida` |
| `07-bio.js` | Aba **Bioimpedância** e importação de PDF por IA | `renderBio`, `salvarCelulaBio`, `normalizarLeituraBio`, `renderBioIA` |
| `08-graficos.js` | Aba **Gráficos** | `renderGraficos` |
| `09-ia-analise.js` | **Análise de IA** (aba Relatório) e histórico `ia_analises` | `montarDadosAnalise`, `gerarAnaliseIA`, `salvarAnaliseIA`, `carregarHistoricoAnalises` |
| `10-relatorio.js` | Aba **Relatório** (atividade física, KPIs, tabelas, gráficos, impressão) | `renderRelAtividade`, `renderRelatorio` |
| `11-backup.js` | Configurações › **Backup**: restaurar, importar e exportar JSON | (handlers dos botões) |
| `12-metas.js` | Aba **Metas**: formulário, salvar, sugestão pelo objetivo | `carregarMetasForm` |
| `13-sync-supabase.js` | **Sincronização Supabase**: leitura, gravação condicional, conflito, polling 45 s, troca de usuário | `syncSupabaseNow`, `scheduleSupabaseSave`, `refreshFromSupabaseIfNeeded`, `conflitoSupabase`, `applySupabaseSession`, `activateUserStorage` |
| `14-treinos.js` | Aba **Treinos**: kcal por MET, modal, tabela, resumo | `garantirEstadoV34`, `kcalPorBloco`, `abrirTreino`, `renderTreinos` |
| `15-navegacao.js` | **Menu lateral** (recolher, gaveta no celular, botão flutuante), troca de abas e atualização geral | `tabs`, `abrirAba`, `fecharMenuMobile`, `ajustarAlturaCabecalho`, `refreshAll` |
| `16-auth.js` | **Tela de login**: e-mail/senha, Google, criar conta, recuperar senha | `lockApp`, `unlockApp`, `authClientFromGate`, `authFriendlyError` |
| `17-tema.js` | **Tema claro/escuro/automático** (botão ◐ no cabeçalho, escolha em `localStorage`), cores dos gráficos no tema escuro | `aplicarTema`, `corGraf` |
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

## Histórico de versões

| Versão | Mudanças |
|---|---|
| V39 | Código dividido em `css/` e `js/` (sem mudança de comportamento). |
| V39.1 | Contadores "Sem estimativa" e "Menos de 4 refeições" respeitam o período. |
| V40 | Menu lateral; relatório lista as refeições do período escolhido; sessões por semana com intervalo, média e semana atual; treino com kcal de cardio sem minutos aparece na tabela (e o formulário avisa); IA com até 3 tentativas, limite de tempo, botão Cancelar e reaproveitamento de refeição idêntica. |
| V41 | Aba Treinos: edição direta na tabela, botão Copiar, filtros de período e de tipo. |
| V42 | IA: uma chamada por clique (sem novas tentativas), timeout, contagem em segundos e Cancelar; log `ia_logs` (`SQL_IA_LOGS.sql`); função `dynamic-service` com modelo reserva. |
| V43 | Textos de apoio com contraste mínimo de 4,5:1 e fonte mínima de 12 px; atalhos de lançamento no modal de refeição (repetir refeição anterior e favoritas em `state.favoritos`). |
| V44 | Tema escuro (automático, claro ou escuro) com botão no cabeçalho; as regras `html.dark` ficam em `css/app.css` e só valem na tela, a impressão do relatório continua clara. |
| V45 | Cabeçalho no celular: o indicador da nuvem mostra "Nuvem" e, numa segunda linha, a data e a hora da última sincronização. |

## V46
- `js/00-config.js` define `self.APP_VERSION` (fonte única). É carregado antes de todos no `index.html` e via `importScripts` no `service-worker.js` (nome do cache = `diario-nutricional-` + versão em minúsculas). Mostrado em `#app-version` e no `<title>` por `99-main.js`.
- `01-utils.js`: `showToast(msg, isSync, ms)` aceita duração; `window.excluirComDesfazer(chave, id, rotulo, aposMudar)` remove o item de `state[chave]`, salva na nuvem e mostra o aviso com "Desfazer" (devolve o item na posição original). Usado por refeições, medidas, bioimpedância e treinos.
- `css/app.css` (final): regras V46 contra rolagem horizontal (`body { overflow-x: clip }`, indicador de nuvem encolhível, `canvas { max-width: 100% }`).
- Ícones: azul #003a70 com glifo branco; `apple-touch-icon.png` (180 px) é novo.

## V47
- Cartões no celular: as tabelas de Diário, Bio e Treinos têm a classe `tabela-cards` (+ `--diario`, `--bio`, `--treinos`). Até 700 px o CSS (final de `css/app.css`) transforma cada `<tr>` em um cartão em grade de 6 colunas; os rótulos vêm de `data-label`.
- `js/99-main.js` (final): `MutationObserver` em `#table-body`, `#table-bio-body` e `#tbody-treinos` copia o texto de cada `<th>` para o `data-label` do `<td>` da mesma posição (não precisa mexer nos renderizadores). Células com `colspan` e a coluna "Ações" ficam sem rótulo.
- Barra inferior: `<nav id="bottom-bar">` no `index.html`; atalhos com `data-aba="btn-tab-..."`; `15-navegacao.js` liga os cliques, marca `.active` em `abrirAba` e usa `#bb-novo` (novo lançamento) e `#bb-mais` (abre o menu lateral). O `#fab-novo` fica oculto até 900 px.
- Safe-area: `viewport-fit=cover`; `.app-header` ganha `border-top: env(safe-area-inset-top)`; a barra inferior e o `body` usam `env(safe-area-inset-bottom)`.
- Cabeçalho: o grupo da direita (tema + nuvem) é `shrink-0`; quem encolhe é o título.

## V47.1
- Gaveta do menu (≤ 900 px): `height: 100vh; height: 100dvh` + `overflow-y: auto` + padding de safe-area; `.sidebar-foot` visível; `#sidebar-toggle` vira "Fechar menu" no celular (`mqMobile` em `15-navegacao.js`).
- Logo do cabeçalho e do login: `<img src="icons/icon-192.png">`; favicon `rel="icon"`; `17-tema.js` mantém `theme-color` em `#003a70`.

## V48 — sincronização com mesclagem
- `js/02a-merge.js`: `mergeTresVias(base, local, remoto)` (puro): listas por `id` (itens sem id, como favoritos antigos, por conteúdo), objetos (metas) campo a campo. Regras: só-um-lado vence; os dois editaram → vale o local; exclusão de um lado propaga se o outro não editou. `salvarBaseSync/lerBaseSync` (`<STORAGE_KEY>_base`), `guardarAntesDeMesclar` (`<STORAGE_KEY>_pre_merge`), `resumoMesclagem`.
- `13-sync-supabase.js`: `mesclarComNuvem(remote)` é chamada quando a nuvem é mais nova que a última leitura ou o `update` condicional afeta 0 linhas; mescla, reagenda o envio (máx. 3 tentativas seguidas, depois cai em `conflitoSupabase` e a janela antiga). A base é gravada após envio bem-sucedido, após receber dados da nuvem (polling/login) e ao escolher "Baixar" na janela. No login com pendências locais, mescla em vez de só avisar.
- Sem alteração no banco: `diary_data(user_id, data jsonb, updated_at)`.

## V49
- Filtros padrão: `#filtro-periodo` = `30d` (novo, em `04-diario.js`) e `#relatorio-periodo` = `90`.
- `05-ia-refeicao.js`: `lerUsoTokens(resp)` lê `usageMetadata`/`modelVersion` de um clone da resposta; `registrarLogIA` grava `tokens_entrada/saida/total` em `ia_logs` e, se a coluna não existir, repete o insert sem tokens (`iaTokensDesativado`) em vez de desligar o log.
- `js/18-usuarios.js` (`window.NutriUsuarios`): `refresh(force)` chama `nutri_is_admin()` (login/volta ao app); `carregar()` chama `nutri_all_users`, `nutri_ia_usage_summary(p_days)` e `nutri_ia_usage_recent`. `body.is-admin` mostra os itens `.admin-only`. `13-sync-supabase.js` chama `refresh(true)` no login e `reset()` no logout.
- `SQL_USUARIOS_IA_V49.sql`: colunas de tokens em `ia_logs`, `nutri_app_admins` (RLS sem policy), funções `security definer` `nutri_*` com `grant` só a `authenticated`. Tokens antigos (nulos) são estimados no servidor.

## V50 — permissão de IA por usuário
- `SQL_ACESSO_IA_V50.sql`: `nutri_ai_access(user_id, allowed)` (RLS sem policy), `nutri_can_use_ai()`, `nutri_my_access()`, `nutri_set_ai()`, e `nutri_all_users()` recriada com `r_ai_allowed`. Semeia `allowed = true` para as contas existentes.
- `dynamic-service/index.ts`: antes de chamar o Gemini, para modos diferentes de `edital`/`agenda`, chama `nutri_can_use_ai` com o token do usuário; `false` → 403; erro do banco → 503; função inexistente → comportamento antigo.
- `18-usuarios.js`: `refresh()` usa `nutri_my_access` (cache em `nutri_acesso_<uid>`; fallback se a função não existir); `body.ia-allowed` mostra os `.ia-only`; `canUseAI()`; select "Sem IA / IA liberada" chama `nutri_set_ai`. `05-ia-refeicao.js` recusa a chamada no navegador se a permissão já foi negada.
