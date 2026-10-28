// 13-sync-supabase.js — Sincronização Supabase: leitura, gravação condicional, conflitos, polling e sessão do usuário
"use strict";

  // --- Supabase: login por e-mail/senha e sincronização automática protegida por RLS ---
  function readSupabaseForm() {
    const url = String(sharedSupabaseConfig.url || '').trim().replace(/\/$/, '');
    const key = String(sharedSupabaseConfig.key || '').trim();
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) throw new Error('Informe o Project URL válido do Supabase (https://....supabase.co).');
    if (!key) throw new Error('Informe a chave pública publishable/anon do Supabase. Nunca use service_role.');
    supabaseConfig = {url, key};
    if (!window.supabase || !window.supabase.createClient) throw new Error('Biblioteca Supabase não carregou. Verifique a internet e recarregue a página.');
    if (!supabaseClient || supabaseClient.supabaseUrl !== url) {
      supabaseClient = window.supabase.createClient(url, key, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    }
    return supabaseClient;
  }

  async function supabaseReadRemote() {
    if (!supabaseClient || !supabaseUser) throw new Error('Entre na sua conta Supabase primeiro.');
    const {data,error} = await supabaseClient.from('diary_data').select('data,updated_at').eq('user_id',supabaseUser.id).maybeSingle();
    if (error) throw error;
    return data || null;
  }

  let tempRemoteUpdatedAt = null;
  async function conflitoSupabase(remote) {
    try { remote = remote || await supabaseReadRemote(); } catch (_) { remote = null; }
    supabaseSyncUiState = 'error'; supabaseLocalDirty = true;
    localStorage.setItem(STORAGE_KEY + '_pending_sync', '1');
    updateCloudStatusPill();
    if (!remote || !remote.data) { showToast('Conflito de sincronização. Tente novamente.'); return; }
    tempCloudDataToDownload = remote.data;
    tempRemoteUpdatedAt = remote.updated_at || null;
    $('#sync-recommendation-box').innerHTML = `⚠️ A nuvem foi atualizada em outro aparelho.<br>• Nuvem: <strong>${esc(new Date(remote.updated_at).toLocaleString('pt-BR'))}</strong><br>Baixe a nuvem (descarta o que ainda não foi enviado deste aparelho) ou envie os dados locais (sobrescreve a nuvem).`;
    const dlg = $('#modal-sync-conflict'); if (!dlg.open) dlg.showModal();
  }

  async function syncSupabaseNow(showMessage=true) {
    if (!supabaseClient || !supabaseUser) { if(showMessage) showToast('Entre no Supabase antes de sincronizar.'); return; }
    if (supabaseSaveInFlight) { supabaseSaveQueued = true; return; }
    supabaseSaveInFlight = true;
    supabaseSyncUiState = 'syncing';
    updateCloudStatusPill();
    try {
      if (showMessage) showToast('Sincronizando com Supabase...', true);
      // Envia uma fotografia consistente do estado; alterações feitas durante o envio
      // ficam marcadas e são enviadas em seguida, evitando perder a última edição.
      const snapshot = JSON.parse(JSON.stringify(state));
      // Antes de gravar, verifica se outro aparelho atualizou a nuvem desde a última leitura.
      const remoteBeforeSave = await supabaseReadRemote();
      const remoteBeforeTime = remoteBeforeSave && remoteBeforeSave.updated_at ? remoteBeforeSave.updated_at : null;
      if (remoteBeforeSave && remoteBeforeSave.data && remoteBeforeTime && supabaseLastRemoteUpdatedAt && Date.parse(remoteBeforeTime) > Date.parse(supabaseLastRemoteUpdatedAt)) {
        conflitoSupabase(remoteBeforeSave);
        return;
      }
      const savedAt = new Date().toISOString();
      let error;
      if (supabaseLastRemoteUpdatedAt && remoteBeforeSave) {
        // Gravação condicional: só atualiza se a nuvem ainda está na versão que lemos.
        const res = await supabaseClient.from('diary_data').update({data:snapshot,updated_at:savedAt}).eq('user_id',supabaseUser.id).eq('updated_at',supabaseLastRemoteUpdatedAt).select('user_id');
        error = res.error;
        if (!error && (!res.data || res.data.length === 0)) { conflitoSupabase(null); return; }
      } else {
        ({error} = await supabaseClient.from('diary_data').upsert({user_id:supabaseUser.id,data:snapshot,updated_at:savedAt},{onConflict:'user_id'}));
      }
      if (error) throw error;
      supabaseLastRemoteUpdatedAt = savedAt;
      localStorage.setItem('nutri_last_successful_sync', savedAt);
      localStorage.removeItem(STORAGE_KEY + '_pending_sync');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      cloudProvider = 'supabase';
      localStorage.setItem('nutri_cloud_provider','supabase');
      const unchanged = JSON.stringify(state) === JSON.stringify(snapshot);
      supabaseLocalDirty = !unchanged;
      supabaseSyncUiState = 'success';
      updateCloudStatusPill();
      if (showMessage) showToast(unchanged ? 'Dados sincronizados com a nuvem.' : 'Alterações salvas; enviando as edições mais recentes...');
      if (!unchanged) supabaseSaveQueued = true;
    } catch(err) {
      console.error('Supabase sync error:',err);
      supabaseSyncUiState = 'error';
      if (supabaseUser) localStorage.setItem(STORAGE_KEY + '_pending_sync', '1');
      updateCloudStatusPill();
      showToast('Falha na sincronização: '+(err.message || 'verifique URL, chave, tabela e permissões RLS')+'. Os dados permanecem neste aparelho.');
    } finally {
      supabaseSaveInFlight = false;
      if (supabaseSaveQueued && supabaseUser && supabaseClient) {
        supabaseSaveQueued = false;
        scheduleSupabaseSave(false);
      }
    }
  }

  function scheduleSupabaseSave(force=false) {
    if (supabaseSaveTimer) clearTimeout(supabaseSaveTimer);
    supabaseSaveTimer = setTimeout(() => syncSupabaseNow(!!force), force ? 0 : 1200);
  }

  // Atualiza a cópia local quando a nuvem mudou em outro dispositivo.
  // Nunca substitui edições locais ainda não enviadas.
  async function refreshFromSupabaseIfNeeded(showMessage=false) {
    if (!supabaseClient || !supabaseUser || supabaseRemoteCheckInFlight || supabaseLocalDirty || supabaseSaveInFlight) return;
    supabaseRemoteCheckInFlight = true;
    try {
      const remote = await supabaseReadRemote();
      if (!remote || !remote.data) return;
      const remoteTime = remote.updated_at || null;
      if (remoteTime && supabaseLastRemoteUpdatedAt && Date.parse(remoteTime) <= Date.parse(supabaseLastRemoteUpdatedAt)) return;
      const remoteJson = JSON.stringify(remote.data);
      const localJson = JSON.stringify(state);
      if (remoteJson !== localJson) {
        state = remote.data;
        if (!state.metas) state.metas = defaultMetas;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        refreshAll();
        if (showMessage) showToast('Dados atualizados a partir do Supabase.');
      }
      supabaseLastRemoteUpdatedAt = remoteTime || new Date().toISOString();
    } catch(err) {
      console.warn('Verificação automática Supabase:', err.message || err);
    } finally { supabaseRemoteCheckInFlight = false; }
  }

  window.addEventListener('focus', () => refreshFromSupabaseIfNeeded(true));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshFromSupabaseIfNeeded(true); });
  // Polling leve para manter celular e computador atualizados sem exigir botão manual.
  setInterval(() => { if (!document.hidden) refreshFromSupabaseIfNeeded(false); }, 45000);

  function activateUserStorage(user) {
    const userId = user && user.id;
    if (!userId) return;
    const userKey = STORAGE_KEY_BASE + '_user_' + userId;
    const existing = localStorage.getItem(userKey);
    const previousKnownUser = localStorage.getItem('nutri_active_user_id');
    userLocalHasData = false;
    if (existing) {
      try { state = JSON.parse(existing); if (!state.metas) state.metas = defaultMetas; userLocalHasData = true; }
      catch (_) { state = JSON.parse(JSON.stringify(initialStateSnapshot)); }
    } else if (previousKnownUser === userId && localStorage.getItem(STORAGE_KEY_BASE)) {
      // Migra dados locais antigos somente se o marcador indicar a mesma conta.
      try { state = JSON.parse(localStorage.getItem(STORAGE_KEY_BASE)); if (!state.metas) state.metas = defaultMetas; userLocalHasData = true; localStorage.setItem(userKey, JSON.stringify(state)); }
      catch (_) { state = JSON.parse(JSON.stringify(initialStateSnapshot)); }
    } else {
      // Nunca reutiliza automaticamente os dados locais de outra conta.
      state = JSON.parse(JSON.stringify(initialStateSnapshot));
    }
    STORAGE_KEY = userKey;
    activeLocalUserId = userId;
    localStorage.setItem('nutri_active_user_id', userId);
    refreshAll();
  }

  async function applySupabaseSession(session, initial=false) {
    const nextUser = session && session.user ? session.user : null;
    if (!nextUser) { supabaseUser = null; updateCloudStatusPill(); lockApp(); return; }
    if (passwordRecoveryMode) { supabaseUser = nextUser; updateCloudStatusPill(); lockApp(); return; }
    if (!supabaseUser || supabaseUser.id !== nextUser.id) activateUserStorage(nextUser);
    supabaseUser = nextUser;
    supabaseSyncUiState = 'idle';
    cloudProvider = 'supabase';
    localStorage.setItem('nutri_cloud_provider','supabase');
    updateCloudStatusPill();
    try {
      const remote = await supabaseReadRemote();
      if (remote && remote.data) {
        const hasPendingLocalChanges = localStorage.getItem(STORAGE_KEY + '_pending_sync') === '1';
        const localSnapshot = JSON.stringify(state);
        const remoteSnapshot = JSON.stringify(remote.data);
        // Com alterações pendentes, preserva como referência a última sincronização bem-sucedida,
        // para detectar se a nuvem mudou desde então antes de permitir novo envio.
        if (hasPendingLocalChanges) {
          supabaseLastRemoteUpdatedAt = localStorage.getItem('nutri_last_successful_sync') || null;
        } else {
          supabaseLastRemoteUpdatedAt = remote.updated_at || null;
        }
        // Se havia alterações locais pendentes, não as descarta silenciosamente no login.
        if (hasPendingLocalChanges && localSnapshot !== remoteSnapshot) {
          supabaseLocalDirty = true;
          userLocalHasData = true;
          refreshAll();
          showToast('Há alterações locais ainda não sincronizadas. Seus dados deste aparelho foram preservados; revise antes de enviar para a nuvem.');
        } else {
          supabaseLocalDirty = false;
          state = remote.data;
          if (!state.metas) state.metas = defaultMetas;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          localStorage.removeItem(STORAGE_KEY + '_pending_sync');
          userLocalHasData = true;
          refreshAll();
          if (initial) showToast('Dados mais recentes da nuvem carregados neste dispositivo.');
        }
      } else if (userLocalHasData) {
        supabaseLastRemoteUpdatedAt = null;
        // Não sobrescreve a nuvem vazia nem envia dados locais sem autorização.
        showToast('Esta conta ainda não tem dados no Supabase. Os dados locais foram preservados. Use “Sincronizar” se quiser enviá-los à nuvem.');
      } else {
        supabaseLastRemoteUpdatedAt = null;
        await syncSupabaseNow(false);
        showToast('Conta conectada. Seus dados serão salvos nesta conta Supabase.');
      }
      if (!passwordRecoveryMode) unlockApp();
    } catch(err) { showToast('Login realizado, mas não foi possível ler os dados: '+(err.message || 'verifique a tabela/RLS')); if (!passwordRecoveryMode) unlockApp(); }
  }

  $('#btn-supabase-save-config').onclick = () => {
    try { readSupabaseForm(); showToast('Configuração Supabase salva neste dispositivo.'); }
    catch(err) { showToast(err.message); }
  };
  $('#btn-supabase-signup').onclick = async () => {
    try {
      const client=readSupabaseForm(); const email=$('#config-supabase-email').value.trim(); const password=$('#config-supabase-password').value;
      if(!email || !password) throw new Error('Informe e-mail e senha.');
      const {data,error}=await client.auth.signUp({email,password}); if(error) throw error;
      if(data.session) await applySupabaseSession(data.session,true);
      else showToast('Conta criada. Confira seu e-mail para confirmar o cadastro e depois entre.');
    } catch(err) { showToast('Não foi possível criar a conta: '+err.message); }
  };
  $('#btn-supabase-login').onclick = async () => {
    try {
      const client=readSupabaseForm(); const email=$('#config-supabase-email').value.trim(); const password=$('#config-supabase-password').value;
      if(!email || !password) throw new Error('Informe e-mail e senha.');
      const {data,error}=await client.auth.signInWithPassword({email,password}); if(error) throw error;
      await applySupabaseSession(data.session,true);
    } catch(err) { showToast('Falha no login: '+err.message); }
  };
  $('#btn-supabase-sync').onclick = () => syncSupabaseNow(true);
  $('#btn-supabase-logout').onclick = async () => {
    try { if(supabaseClient) await supabaseClient.auth.signOut(); supabaseUser=null; cloudProvider='local'; localStorage.setItem('nutri_cloud_provider','local'); updateCloudStatusPill(); lockApp(); setAuthMessage('Você saiu da conta. Entre novamente para acessar seus registros.','info'); }
    catch(err) { showToast('Erro ao sair: '+err.message); }
  };
