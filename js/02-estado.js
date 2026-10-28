// 02-estado.js — Estado global (state), metas padrão, chaves de armazenamento e variáveis de sincronização
"use strict";

  const initialRegistros = [];

  const initialMedidas = [];

  const initialBio = [];

  const defaultMetas = { peso: 78.8, calorias: 2000, proteinas: 160, carboidratos: 200, gorduras: 65, agua: 3000 };
  let state = { registros: [...initialRegistros], medidas: [...initialMedidas], bio: [...initialBio], metas: {...defaultMetas} };

  const STORAGE_KEY_BASE = 'nutrigesti_cloud_api_v10';
  let STORAGE_KEY = STORAGE_KEY_BASE;
  let userLocalHasData = false;
  let passwordRecoveryMode = location.hash.includes('type=recovery');
  let activeLocalUserId = null;
  const initialStateSnapshot = JSON.parse(JSON.stringify(state));
  let cloudProvider = localStorage.getItem('nutri_cloud_provider') || 'local';
  let cloudToken = localStorage.getItem('nutri_cloud_token') || '';
  let googleTokenClient = null;
  let googleTokenExpiresAt = 0;
  let googleAuthLibraryPromise = null;
  let googleClientId = localStorage.getItem('nutri_google_client_id') || '';
  let tempCloudDataToDownload = null;
  let supabaseClient = null;
  let supabaseUser = null;
  const sharedSupabaseConfig = window.NUTRI_SUPABASE_CONFIG || {};
  let supabaseConfig = { url: sharedSupabaseConfig.url || '', key: sharedSupabaseConfig.key || '' };
  let supabaseSaveTimer = null;
  let supabaseSaveInFlight = false;
  let supabaseSaveQueued = false;
  let supabaseLocalDirty = false;
  let supabaseLastRemoteUpdatedAt = null;
  let supabaseRemoteCheckInFlight = false;
  let supabaseSyncUiState = 'idle'; // idle | syncing | success | error

  const ordemRefeicao = { "Café da Manhã": 1, "Lanche da Manhã": 2, "Almoço": 3, "Lanche da Tarde": 4, "Pré-Treino": 5, "Pós-Treino": 6, "Jantar": 7, "Ceia": 8 };
  const refeicoesPadrao = Object.keys(ordemRefeicao);
