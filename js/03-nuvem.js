// 03-nuvem.js — Indicador de nuvem, saveCloud, provedores legados (Apps Script, Google Drive, OneDrive), conflito e loadData
"use strict";

  function updateCloudStatusPill() {
    const pill = $('#btn-cloud-status');
    const icon = $('#cloud-status-icon');
    const text = $('#cloud-status-text');
    
    if (cloudProvider === 'supabase') {
      const labels = {
        syncing: ['bg-sky-700 border-sky-500', '⏳', 'Sincronizando...'],
        success: ['bg-emerald-700 border-emerald-500', '☁️', ''],
        error: ['bg-rose-700 border-rose-500', '⚠️', 'Falha na sincronização'],
        idle: ['bg-emerald-700 border-emerald-500', '☁️', '']
      };
      const current = labels[supabaseSyncUiState] || labels.idle;
      pill.className = 'text-xs px-3 py-1.5 rounded-full text-white border font-medium truncate max-w-[260px] flex items-center gap-1 shadow-sm transition-all ' + current[0];
      icon.textContent = current[1];
      let lastSync = supabaseLastRemoteUpdatedAt || localStorage.getItem('nutri_last_successful_sync') || '';
      if (lastSync && !Number.isNaN(Date.parse(lastSync))) {
        const d = new Date(lastSync);
        const dateTime = d.toLocaleDateString('pt-BR') + ', ' + d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
        text.textContent = current[2] || ('Nuvem · ' + dateTime);
      } else {
        text.textContent = current[2] || (supabaseUser ? 'Nuvem conectada' : 'Nuvem');
      }
      pill.title = supabaseSyncUiState === 'error'
        ? 'A última sincronização falhou. Seus dados locais foram preservados. Clique para tentar novamente.'
        : 'Última atualização sincronizada com a nuvem. Clique para sincronizar agora.';
      return;
    }
    if (cloudProvider === 'apps-script') {
      pill.className = "text-xs px-3 py-1.5 rounded-full bg-emerald-700 text-white border border-emerald-500 font-medium truncate max-w-[210px] flex items-center gap-1 shadow-sm transition-all hover:bg-emerald-600";
      icon.textContent = "☁️"; text.textContent = "Google Drive (Apps Script)";
    } else if (cloudProvider === 'google') {
      pill.className = "text-xs px-3 py-1.5 rounded-full bg-sky-700 text-white border border-sky-500 font-medium truncate max-w-[210px] flex items-center gap-1 shadow-sm transition-all hover:bg-sky-600";
      icon.textContent = "☁️"; text.textContent = "Google Drive (/apps/dados)";
    } else if (cloudProvider === 'onedrive') {
      pill.className = "text-xs px-3 py-1.5 rounded-full bg-blue-700 text-white border border-blue-500 font-medium truncate max-w-[210px] flex items-center gap-1 shadow-sm transition-all hover:bg-blue-600";
      icon.textContent = "☁️"; text.textContent = "OneDrive (/apps/dados)";
    } else {
      pill.className = "text-xs px-3 py-1.5 rounded-full bg-amber-600 text-white border border-amber-500 font-medium truncate max-w-[210px] flex items-center gap-1 shadow-sm transition-all hover:bg-amber-500";
      icon.textContent = "💾"; text.textContent = "Armazenamento Local";
    }
  }

  function isAppsScriptHost() { return !!(window.google && google.script && google.script.run); }

  function callAppsScript(functionName, payload) {
    return new Promise((resolve, reject) => {
      if (!isAppsScriptHost()) return reject(new Error('Abra o diário pelo endereço publicado do Google Apps Script, não pelo arquivo HTML local.'));
      const runner = google.script.run.withSuccessHandler(resolve).withFailureHandler(err => reject(new Error(err && err.message ? err.message : 'Falha no Google Apps Script.')));
      if (payload === undefined) runner[functionName](); else runner[functionName](payload);
    });
  }

  async function connectAppsScript() {
    if (!isAppsScriptHost()) {
      document.getElementById('btn-tab-metas').click();
      const help = $('#google-oauth-help');
      if (help) { help.classList.remove('hidden'); help.innerHTML = '<strong>Falta publicar o diário no Google Apps Script.</strong> Crie um projeto em script.google.com, adicione o arquivo HTML e o código servidor fornecidos, implante como aplicativo da web e abra o URL terminado em /exec.'; }
      showToast('Para usar o Drive sem token manual, abra a versão publicada pelo Apps Script.');
      return;
    }
    try {
      showToast('Verificando autorização do Google Drive...', true);
      const result = await callAppsScript('nutriTestDriveAccess');
      if (!result || !result.ok) throw new Error((result && result.message) || 'Não foi possível validar o Drive.');
      cloudProvider = 'apps-script';
      localStorage.setItem('nutri_cloud_provider', cloudProvider);
      updateCloudStatusPill();
      const remote = await callAppsScript('nutriLoadDiary');
      if (remote && remote.data) {
        tempCloudDataToDownload = remote.data;
        $('#sync-recommendation-box').innerHTML = 'Encontramos um backup no Google Drive em <strong>/apps/dados/diario_nutricional_dados.json</strong>.<br>Escolha “Baixar da Nuvem” para substituir os dados locais ou “Enviar Dados Atuais” para manter os dados deste aparelho.';
        $('#modal-sync-conflict').showModal();
      } else {
        await saveCloud(true);
      }
    } catch (err) {
      showToast('Falha no acesso ao Drive: ' + (err.message || 'verifique a autorização do Google.'));
    }
  }

  async function saveCloud(force = false) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (supabaseUser && supabaseClient) {
      supabaseLocalDirty = true;
      localStorage.setItem(STORAGE_KEY + '_pending_sync', '1');
      scheduleSupabaseSave(force);
      return;
    }
    if (cloudProvider === 'apps-script') {
      try {
        const result = await callAppsScript('nutriSaveDiary', JSON.stringify(state));
        if (!result || !result.ok) throw new Error((result && result.message) || 'O Drive não confirmou a gravação.');
        if (force) showToast('Backup JSON salvo no Google Drive com sucesso.');
      } catch (err) {
        console.error('Erro no backup Apps Script:', err);
        showToast('Falha ao salvar no Google Drive: ' + (err.message || 'erro desconhecido') + '. Os dados continuam neste aparelho.');
      }
      return;
    }
    if (cloudProvider === 'local' || !cloudToken) {
      if (force) showToast('Backup salvo apenas neste dispositivo. Conecte uma nuvem para enviar o JSON.');
      return;
    }
    if (cloudProvider === 'google' && googleTokenExpiresAt && Date.now() > googleTokenExpiresAt - 60000) {
      cloudToken = '';
      localStorage.removeItem('nutri_cloud_token');
      showToast('A autorização do Google expirou. Toque em “Conectar Google Drive automaticamente” para renovar. Os dados continuam salvos neste aparelho.');
      return;
    }
    try {
      showToast('Sincronizando com a nuvem...', true);
      const fileName = 'diario_nutricional_dados.json';
      const fileContent = JSON.stringify(state, null, 2);
      let response;
      if (cloudProvider === 'onedrive') {
        // Confirma que o token é um access token válido e que a conta pode ser acessada.
        const me = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
          headers: { Authorization: `Bearer ${cloudToken}` }
        });
        if (!me.ok) throw new Error(`OneDrive: token/permissão inválido (HTTP ${me.status}). Use um access token válido com Files.ReadWrite.`);
        // Cria /apps e /apps/dados quando ainda não existem.
        let folder = await fetch('https://graph.microsoft.com/v1.0/me/drive/root:/apps/dados', { headers: { Authorization: `Bearer ${cloudToken}` } });
        if (folder.status === 404) {
          let apps = await fetch('https://graph.microsoft.com/v1.0/me/drive/root:/apps', { headers: { Authorization: `Bearer ${cloudToken}` } });
          if (apps.status === 404) {
            apps = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', { method:'POST', headers:{ Authorization:`Bearer ${cloudToken}`, 'Content-Type':'application/json' }, body:JSON.stringify({name:'apps',folder:{},'@microsoft.graph.conflictBehavior':'fail'}) });
          }
          if (!apps.ok) throw new Error(`Não foi possível acessar/criar a pasta apps (HTTP ${apps.status}).`);
          folder = await fetch('https://graph.microsoft.com/v1.0/me/drive/root:/apps/dados', { headers: { Authorization: `Bearer ${cloudToken}` } });
          if (folder.status === 404) {
            folder = await fetch('https://graph.microsoft.com/v1.0/me/drive/root:/apps:/children', { method:'POST', headers:{ Authorization:`Bearer ${cloudToken}`, 'Content-Type':'application/json' }, body:JSON.stringify({name:'dados',folder:{},'@microsoft.graph.conflictBehavior':'fail'}) });
          }
        }
        if (!folder.ok) throw new Error(`Não foi possível acessar/criar /apps/dados (HTTP ${folder.status}). Confira Files.ReadWrite e o token.`);
        response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/apps/dados/${fileName}:/content`, {
          method:'PUT', headers:{ Authorization:`Bearer ${cloudToken}`, 'Content-Type':'application/json' }, body:fileContent
        });
      } else if (cloudProvider === 'google') {
        const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and trashed=false&fields=files(id,name)`, { headers:{Authorization:`Bearer ${cloudToken}`} });
        if (!searchRes.ok) throw new Error(`Google Drive: token/permissão inválido (HTTP ${searchRes.status}).`);
        const searchJson = await searchRes.json();
        const fileId = searchJson.files?.[0]?.id;
        if (fileId) response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, { method:'PATCH', headers:{Authorization:`Bearer ${cloudToken}`,'Content-Type':'application/json'}, body:fileContent });
        else {
          const metadata={name:fileName,mimeType:'application/json'};
          const form=new FormData(); form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'})); form.append('file',new Blob([fileContent],{type:'application/json'}));
          response=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {method:'POST',headers:{Authorization:`Bearer ${cloudToken}`},body:form});
        }
      }
      if (!response || !response.ok) throw new Error(`A nuvem recusou o arquivo (HTTP ${response ? response.status : 'desconhecido'}).`);
      showToast(`Backup JSON enviado para ${cloudProvider === 'onedrive' ? 'OneDrive' : 'Google Drive'} com sucesso.`);
    } catch(e) {
      console.error('Erro ao salvar na nuvem:',e);
      showToast(e.message || 'Falha ao sincronizar. Confira o token OAuth e as permissões.');
    }
  }

  $('#btn-cloud-status').onclick = () => {
    if (cloudProvider === 'local') {
      document.getElementById('btn-tab-metas').click();
      showToast("Conecte o Google Drive ou OneDrive na aba Configurações.");
    } else {
      saveCloud(true);
    }
  };

  async function fetchCloudData() {
    if (cloudProvider === 'apps-script' && isAppsScriptHost()) {
      try { const result = await callAppsScript('nutriLoadDiary'); return result && result.data ? result.data : null; } catch(e) { console.error(e); return null; }
    }
    if (!cloudToken) return null;
    try {
      if (cloudProvider === 'google') {
        const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='diario_nutricional_dados.json' and trashed=false`, {
          headers: { 'Authorization': `Bearer ${cloudToken}` }
        });
        const searchJson = await searchRes.json();
        const fileId = searchJson.files?.[0]?.id;
        if (fileId) {
          const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { 'Authorization': `Bearer ${cloudToken}` }
          });
          if (fileRes.ok) return await fileRes.json();
        }
      } else if (cloudProvider === 'onedrive') {
        const fileRes = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/apps/dados/diario_nutricional_dados.json:/content`, {
          headers: { 'Authorization': `Bearer ${cloudToken}` }
        });
        if (fileRes.ok) return await fileRes.json();
      }
    } catch(e) {
      console.error("Erro ao buscar dados remotos:", e);
    }
    return null;
  }

  function getLatestDateStr(dataObj) {
    let latest = '';
    const checkArray = (arr, dateField) => {
      if (!arr || !Array.isArray(arr)) return;
      arr.forEach(item => { if (item[dateField] && item[dateField] > latest) latest = item[dateField]; });
    };
    if (dataObj) {
      checkArray(dataObj.registros, 'data');
      checkArray(dataObj.medidas, 'data');
      checkArray(dataObj.bio, 'data');
    }
    return latest;
  }

  function ensureGoogleIdentityLibrary() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (googleAuthLibraryPromise) return googleAuthLibraryPromise;
    googleAuthLibraryPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-google-identity="true"]');
      if (existing) {
        existing.addEventListener('load', resolve, {once:true});
        existing.addEventListener('error', () => reject(new Error('Não foi possível carregar o login do Google. Verifique a conexão.')), {once:true});
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true; script.defer = true; script.dataset.googleIdentity = 'true';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Não foi possível carregar o login do Google. Verifique a conexão.'));
      document.head.appendChild(script);
    });
    return googleAuthLibraryPromise;
  }

  async function connectGoogleOAuth() {
    const help = $('#google-oauth-help');
    const clientId = ($('#config-google-client-id').value || googleClientId).trim();
    if (location.protocol === 'file:') {
      help.classList.remove('hidden');
      help.innerHTML = '<strong>Login bloqueado neste modo.</strong> O arquivo está aberto diretamente no celular (file://). Para usar OAuth do Google, publique este HTML em um endereço HTTPS e cadastre essa origem no Google Cloud. Não é um problema da sua conta ou senha.';
      showToast('O login Google exige uma origem HTTPS autorizada.');
      return;
    }
    if (!clientId || !clientId.endsWith('.apps.googleusercontent.com')) {
      showToast('Informe o ID do cliente OAuth do tipo Aplicativo da Web.');
      return;
    }
    googleClientId = clientId;
    localStorage.setItem('nutri_google_client_id', googleClientId);
    help.classList.add('hidden');
    try {
      await ensureGoogleIdentityLibrary();
      if (!googleTokenClient) {
        googleTokenClient = google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly',
          callback: async (response) => {
            if (response.error || !response.access_token) {
              showToast('O Google não concedeu acesso: ' + (response.error_description || response.error || 'resposta sem token'));
              return;
            }
            cloudToken = response.access_token;
            googleTokenExpiresAt = Date.now() + (Number(response.expires_in || 3600) * 1000);
            await connectCloudWithToken('google', cloudToken);
          },
          error_callback: (err) => showToast('Falha no login Google: ' + (err.message || err.type || 'erro de autorização'))
        });
      }
      googleTokenClient.requestAccessToken({prompt: 'consent'});
    } catch (err) {
      showToast(err.message || 'Não foi possível iniciar o login Google.');
    }
  }

  async function connectCloudWithToken(provider, token) {
    if (!token) { showToast("Insira o Token OAuth no módulo Configurações."); return; }
    cloudProvider = provider;
    cloudToken = token.trim();
    showToast('Testando token e permissões...', true);
    try {
      const testUrl = provider === 'onedrive' ? 'https://graph.microsoft.com/v1.0/me/drive' : 'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)';
      const test = await fetch(testUrl, { headers: { Authorization: `Bearer ${cloudToken}` } });
      if (!test.ok) throw new Error(`Token recusado (HTTP ${test.status}). Verifique se é um access token válido, não refresh token nem client secret, e se tem permissão de escrita.`);
      localStorage.setItem('nutri_cloud_provider', cloudProvider);
      if (provider === 'google') {
        // Access tokens Google são temporários; não persistir o token no armazenamento local.
        localStorage.removeItem('nutri_cloud_token');
      } else {
        localStorage.setItem('nutri_cloud_token', cloudToken);
      }
      updateCloudStatusPill();
    } catch (err) {
      showToast(`Falha no teste OAuth: ${err.message || 'não foi possível validar o token'}`);
      return;
    }
    showToast('Token validado. Verificando arquivo de dados...', true);
    const cloudData = await fetchCloudData();

    if (cloudData) {
      tempCloudDataToDownload = cloudData;
      const localLatest = getLatestDateStr(state);
      const cloudLatest = getLatestDateStr(cloudData);
      
      $('#sync-recommendation-box').innerHTML = `
        📁 Encontramos <strong>diario_nutricional_dados.json</strong> em <strong>/apps/dados/</strong>.<br>
        • Última modificação na Nuvem: <strong>${fmtDataHoraBr(cloudLatest)}</strong><br>
        • Última modificação Local: <strong>${fmtDataHoraBr(localLatest)}</strong>
      `;
      $('#modal-sync-conflict').showModal();
    } else {
      showToast("Nenhum arquivo prévio em /apps/dados/. Enviando dados atuais...");
      saveCloud(true);
    }
  }

  window.resolveSyncConflict = function(action) {
    $('#modal-sync-conflict').close();
    if (action === 'download' && tempCloudDataToDownload) {
      state = tempCloudDataToDownload;
      if (!state.metas) state.metas = defaultMetas;
      localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
      if (supabaseUser) {
        supabaseLastRemoteUpdatedAt = tempRemoteUpdatedAt || supabaseLastRemoteUpdatedAt;
        supabaseLocalDirty = false; supabaseSyncUiState = 'success';
        localStorage.removeItem(STORAGE_KEY + '_pending_sync');
        updateCloudStatusPill();
      }
      refreshAll();
      if (supabaseUser) showToast('Dados baixados da nuvem.'); else saveCloud();
    } else if (supabaseUser && tempRemoteUpdatedAt) {
      supabaseLastRemoteUpdatedAt = tempRemoteUpdatedAt;
      syncSupabaseNow(true);
    } else {
      saveCloud(true);
    }
    tempCloudDataToDownload = null; tempRemoteUpdatedAt = null;
  };

  // V15 usa Supabase para a nuvem. Os controles antigos de OAuth/OneDrive
  // não existem mais nesta interface; só registrar handlers quando o elemento existir.
  const legacyGoogleButton = $('#btn-config-save-google');
  if (legacyGoogleButton) legacyGoogleButton.onclick = () => { if (isAppsScriptHost()) connectAppsScript(); else connectGoogleOAuth(); };
  const legacyOneDriveButton = $('#btn-config-save-onedrive');
  if (legacyOneDriveButton) legacyOneDriveButton.onclick = () => {
    const tokenField = $('#config-oauth-token');
    const t = tokenField ? tokenField.value : cloudToken;
    connectCloudWithToken('onedrive', t);
  };

  function loadData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        state = JSON.parse(saved);
        if (!state.metas) state.metas = defaultMetas;
      }
    } catch(e) {}
    updateCloudStatusPill();
  }
