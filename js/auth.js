// auth.js — Login, cadastro, recuperação de senha, Google OAuth e botão de instalar o PWA (IIFE autocontida).
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  let wiredClient = null;
  let manualAuthInProgress = false;
  let currentAuthUidHandled = null;
  let recoveryMode = /type=recovery/i.test(location.hash) || new URLSearchParams(location.search).get('type') === 'recovery';
  let installPromptEvent = null;
  const GLOBAL_KEYS = new Set(['tce_sb_url','tce_sb_key','tce_sb_email','tce_current_auth_uid','tce_last_auth_uid']);

  function message(text, kind='info') {
    const el=$('auth-message'); if(!el) return;
    el.textContent=text;
    el.className='auth-message'+(kind==='error'?' error':kind==='success'?' success':'');
  }
  function lock() { document.body.classList.add('auth-locked'); $('auth-gate').setAttribute('aria-hidden','false'); }
  function unlock() { if(recoveryMode) return; document.body.classList.remove('auth-locked'); $('auth-gate').setAttribute('aria-hidden','true'); }
  function showRecovery() {
    recoveryMode=true; lock();
    $('auth-normal-fields').classList.add('hidden'); $('auth-recovery-fields').classList.remove('hidden');
    message('Link de recuperação reconhecido. Defina sua nova senha.','success');
  }
  function showLogin() {
    recoveryMode=false;
    $('auth-recovery-fields').classList.add('hidden'); $('auth-normal-fields').classList.remove('hidden');
    lock(); message('Informe os dados para entrar. Você também pode continuar com Google.');
    try { history.replaceState(null,document.title,location.pathname+location.search); } catch(_) {}
  }
  function canonicalRedirectUrl() { return location.origin + location.pathname; }
  function getCredentials(source='gate') {
    const isGate=source==='gate';
    const url=((isGate ? $('auth-supabase-url').value : $('sb-url').value)||localStorage.getItem('tce_sb_url')||'').trim().replace(/\/$/,'');
    const key=((isGate ? $('auth-supabase-key').value : $('sb-key').value)||localStorage.getItem('tce_sb_key')||'').trim();
    const email=((isGate ? $('auth-email').value : $('sb-email').value)||localStorage.getItem('tce_sb_email')||'').trim();
    const password=(isGate ? $('auth-password').value : $('sb-password').value)||'';
    if(location.protocol==='file:') throw new Error('O login OAuth/PWA precisa ser aberto por HTTPS ou localhost. Publique os arquivos no Netlify ou GitHub Pages.');
    if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) throw new Error('Informe a URL do projeto Supabase no formato https://seuprojeto.supabase.co.');
    if(!key || /service_role|secret/i.test(key)) throw new Error('Informe somente a chave pública publishable/anon do Supabase.');
    if(!window.supabase || !window.supabase.createClient) throw new Error('A biblioteca Supabase não carregou. Confira a internet e recarregue a página.');
    localStorage.setItem('tce_sb_url',url); localStorage.setItem('tce_sb_key',key);
    if(email) localStorage.setItem('tce_sb_email',email);
    $('sb-url').value=url; $('sb-key').value=key; $('sb-email').value=email;
    if(isGate) { $('auth-supabase-url').value=url; $('auth-supabase-key').value=key; }
    if(!initializeSupabase()) throw new Error('Não foi possível iniciar a conexão Supabase. Confira a URL e a chave pública.');
    attachPlannerAuthListener(sbClient);
    return {client:sbClient,url,key,email,password};
  }

  function collectAppStorage() {
    const arr=[];
    for(let i=0;i<localStorage.length;i++) {
      const k=localStorage.key(i);
      if(!k || !k.startsWith('tce_') || GLOBAL_KEYS.has(k) || k.startsWith('tce_user_snapshot_')) continue;
      arr.push([k,localStorage.getItem(k)]);
    }
    return arr;
  }
  function saveUserSnapshot(uid) {
    if(!uid) return;
    try { localStorage.setItem('tce_user_snapshot_'+uid, JSON.stringify(collectAppStorage())); }
    catch(e) { console.warn('Não foi possível guardar cópia local separada da conta:',e); }
  }
  function clearAccountAppKeys() {
    const toRemove=[];
    for(let i=0;i<localStorage.length;i++) {
      const k=localStorage.key(i);
      if(k && k.startsWith('tce_') && !GLOBAL_KEYS.has(k) && !k.startsWith('tce_user_snapshot_')) toRemove.push(k);
    }
    toRemove.forEach(k=>localStorage.removeItem(k));
  }
  function resetForFreshAccount() {
    clearAccountAppKeys();
    activeContest=DEFAULT_CONTEST_ID;
    contests={[DEFAULT_CONTEST_ID]:{name:DEFAULT_CONTEST_NAME,board:'',date:''}};
    masterEditalData=[]; userProgress=[]; studySessions=[];
    localStorage.setItem('tce_active_contest',activeContest);
    localStorage.setItem('tce_contests',JSON.stringify(contests));
    localStorage.setItem('tce_master_edital',JSON.stringify(masterEditalData));
    localStorage.setItem('tce_go_pro_data',JSON.stringify(userProgress));
    localStorage.setItem('tce_go_pro_sessions','[]');
    localStorage.setItem('tce_contest_data_'+activeContest,JSON.stringify({masterEditalData,userProgress,studySessions}));
  }
  function restoreUserSnapshot(uid) {
    let snap=null;
    try { snap=JSON.parse(localStorage.getItem('tce_user_snapshot_'+uid)||'null'); } catch(_) {}
    if(!Array.isArray(snap)) return false;
    clearAccountAppKeys();
    snap.forEach(([k,v])=>{ if(typeof k==='string' && k.startsWith('tce_') && !GLOBAL_KEYS.has(k) && !k.startsWith('tce_user_snapshot_')) localStorage.setItem(k,String(v)); });
    return true;
  }
  function reloadPlannerState() {
    try { contests=JSON.parse(localStorage.getItem('tce_contests')||'{}')||{}; } catch(_) { contests={}; }
    activeContest=localStorage.getItem('tce_active_contest')||Object.keys(contests)[0]||DEFAULT_CONTEST_ID;
    if(!contests[activeContest]) contests[activeContest]={name:activeContest===DEFAULT_CONTEST_ID?DEFAULT_CONTEST_NAME:'Novo concurso',board:'',date:''};
    let snapshot=null; try { snapshot=JSON.parse(localStorage.getItem('tce_contest_data_'+activeContest)||'null'); } catch(_) {}
    if(snapshot && Array.isArray(snapshot.masterEditalData)) masterEditalData=snapshot.masterEditalData;
    else { try { masterEditalData=JSON.parse(localStorage.getItem('tce_master_edital'))||[]; } catch(_) {} }
    if(snapshot && Array.isArray(snapshot.userProgress)) userProgress=snapshot.userProgress;
    else { try { userProgress=JSON.parse(localStorage.getItem('tce_go_pro_data'))||JSON.parse(JSON.stringify(masterEditalData)); } catch(_) { userProgress=JSON.parse(JSON.stringify(masterEditalData)); } }
    if(snapshot && Array.isArray(snapshot.studySessions)) studySessions=snapshot.studySessions;
    else { try { studySessions=JSON.parse(localStorage.getItem('tce_go_pro_sessions'))||[]; } catch(_) { studySessions=[]; } }
    try { renderContestSelector(); } catch(_) {}
    try { if(contests[activeContest]) { $('contest-name').value=contests[activeContest].name||''; $('contest-board').value=contests[activeContest].board||''; $('contest-date').value=contests[activeContest].date||''; } } catch(_) {}
    try { initCronogramaFilters(); initRegistrationForm(); initEditalFilters(); updateContestHeader(); applyPriorityColors(); renderSessionsList(); renderRecentRotation(); renderPriorityDisciplineProgress(); renderDashboard(); } catch(e) { console.warn('A interface será atualizada após carregar os dados da conta:',e); }
  }

  async function activateSession(session, source='resume') {
    if(!session || !session.user) return;
    const uid=session.user.id;
    const currentUid=localStorage.getItem('tce_current_auth_uid');
    const lastUid=localStorage.getItem('tce_last_auth_uid');
    const priorUid=currentUid||lastUid;
    const changed=!!priorUid && priorUid!==uid;
    const firstAccount=!priorUid;
    if(changed) {
      if(currentUid) saveUserSnapshot(currentUid);
      if(!restoreUserSnapshot(uid)) resetForFreshAccount();
      reloadPlannerState();
    }
    localStorage.setItem('tce_current_auth_uid',uid);
    localStorage.setItem('tce_last_auth_uid',uid);
    currentAuthUidHandled=uid;
    sbUser=session.user;
    if(session.user.email) { $('auth-email').value=session.user.email; $('sb-email').value=session.user.email; localStorage.setItem('tce_sb_email',session.user.email); }
    if(recoveryMode) { showRecovery(); return; }
    unlock();
    message('Autenticado como '+(session.user.email||'usuário')+'.','success');
    updateCloudStatus('Conectado: '+(session.user.email||'Google/Supabase'));
    if(changed||firstAccount) {
      try { await resolveInitialCloudSync(); } catch(e) { message('Login concluído, mas não foi possível consultar os dados na nuvem: '+(e.message||e),'error'); }
    }
    // A cada abertura/recarga, sincroniza a sessão atual automaticamente, mesmo quando
    // o Supabase recuperou a mesma conta. A mesclagem preserva registros locais e remotos.
    if(startupSyncUid!==uid && !recoveryMode) {
      startupSyncUid=uid;
      try {
        if(!sbClient) initializeSupabase();
        await syncLatestChangesToCloud();
        await refreshCloudTimestampFromServer();
        startCloudTimestampPolling();
      } catch(e) {
        console.warn('A sincronização automática inicial falhou; os dados locais foram mantidos:',e);
        updateCloudStatus('Conectado; sincronização inicial pendente');
      }
    }
  }
  function lockAfterSignOut() {
    if(cloudStatusPollTimer) { clearInterval(cloudStatusPollTimer); cloudStatusPollTimer=null; }
    startupSyncUid=null;
    const uid=(sbUser&&sbUser.id)||localStorage.getItem('tce_current_auth_uid');
    if(uid) { saveUserSnapshot(uid); localStorage.setItem('tce_last_auth_uid',uid); }
    localStorage.removeItem('tce_current_auth_uid');
    sbUser=null; lock(); message('Você saiu da conta. Entre novamente para acessar o Planejador.');
    try { $('auth-password').value=''; $('sb-password').value=''; } catch(_) {}
    updateCloudStatus('Sessão encerrada; dados locais preservados');
  }

  window.attachPlannerAuthListener = function(client) {
    if(!client || !client.auth || wiredClient===client) return;
    wiredClient=client;
    client.auth.onAuthStateChange((event,session)=>{
      if(event==='PASSWORD_RECOVERY') { recoveryMode=true; showRecovery(); return; }
      if(event==='SIGNED_OUT') { lockAfterSignOut(); return; }
      if(session && ['INITIAL_SESSION','SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event)) {
        if(manualAuthInProgress) { if(session) { sbUser=session.user; if(!recoveryMode) unlock(); } return; }
        if(event==='TOKEN_REFRESHED' || event==='USER_UPDATED') { sbUser=session.user; if(!recoveryMode) unlock(); return; }
        setTimeout(()=>activateSession(session,'event'),0);
      }
    });
  };

  async function ensureClient() { return getCredentials('gate').client; }
  function setBusy(busy) { ['auth-login','auth-google','auth-signup','auth-forgot','auth-update-password'].forEach(id=>{const el=$(id);if(el)el.disabled=busy;}); }

  $('auth-login').addEventListener('click',async()=>{
    setBusy(true); manualAuthInProgress=true;
    try {
      const c=await ensureClient(); const email=$('auth-email').value.trim(); const password=$('auth-password').value;
      if(!email || !password) throw new Error('Informe seu e-mail e senha.');
      localStorage.setItem('tce_sb_email',email);
      const {data,error}=await c.auth.signInWithPassword({email,password}); if(error) throw error;
      await activateSession(data.session,'manual');
      $('auth-password').value=''; message('Login realizado com sucesso.','success');
    } catch(e) { lock(); message(friendlyError(e),'error'); }
    finally { manualAuthInProgress=false; setBusy(false); }
  });
  $('auth-google').addEventListener('click',async()=>{
    setBusy(true);
    try {
      const c=await ensureClient();
      const redirectTo=canonicalRedirectUrl();
      const {error}=await c.auth.signInWithOAuth({provider:'google',options:{redirectTo,queryParams:{prompt:'select_account'}}});
      if(error) throw error;
      message('Redirecionando para o Google…');
    } catch(e) { message('Não foi possível iniciar o Google OAuth. Verifique o provedor Google e a URL de retorno autorizada no Supabase. '+friendlyError(e),'error'); setBusy(false); }
  });
  $('auth-signup').addEventListener('click',async()=>{
    setBusy(true); manualAuthInProgress=true;
    try {
      const c=await ensureClient(); const email=$('auth-email').value.trim(); const password=$('auth-password').value;
      if(!email || !password) throw new Error('Informe e-mail e senha para criar a conta.');
      if(password.length<6) throw new Error('Use uma senha de pelo menos 6 caracteres.');
      const {data,error}=await c.auth.signUp({email,password,options:{emailRedirectTo:canonicalRedirectUrl()}}); if(error) throw error;
      if(data.session) { await activateSession(data.session,'signup'); message('Conta criada e acesso liberado.','success'); }
      else message('Cadastro iniciado. Confirme o e-mail recebido e depois entre por esta tela.','success');
    } catch(e) { message(friendlyError(e),'error'); }
    finally { manualAuthInProgress=false; setBusy(false); }
  });
  $('auth-forgot').addEventListener('click',async()=>{
    try {
      const c=await ensureClient(); const email=$('auth-email').value.trim();
      if(!email) throw new Error('Digite seu e-mail antes de pedir a recuperação da senha.');
      const {error}=await c.auth.resetPasswordForEmail(email,{redirectTo:canonicalRedirectUrl()}); if(error) throw error;
      message('Se o e-mail estiver cadastrado, o Supabase enviará um link de recuperação. Confira também a caixa de spam.','success');
    } catch(e) { message(friendlyError(e),'error'); }
  });
  $('auth-update-password').addEventListener('click',async()=>{
    try {
      const c=await ensureClient(); const password=$('auth-new-password').value;
      if(!password || password.length<8) throw new Error('Informe uma nova senha com pelo menos 8 caracteres.');
      const {error}=await c.auth.updateUser({password}); if(error) throw error;
      try { await c.auth.signOut(); } catch(_) {}
      $('auth-new-password').value=''; showLogin(); message('Senha alterada. Entre com sua nova senha.','success');
    } catch(e) { message(friendlyError(e),'error'); }
  });
  $('auth-back-login').addEventListener('click',showLogin);
  $('auth-password').addEventListener('keydown',e=>{if(e.key==='Enter') $('auth-login').click();});

  function friendlyError(e) {
    const m=(e&&e.message)?e.message:String(e||'erro desconhecido');
    if(/invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos. Confira os dados e tente novamente.';
    if(/email not confirmed/i.test(m)) return 'Seu e-mail ainda não foi confirmado. Abra a mensagem enviada pelo Supabase.';
    if(/provider is not enabled|unsupported provider/i.test(m)) return 'O provedor Google não está habilitado em Supabase → Authentication → Sign In / Providers.';
    if(/redirect|url configuration/i.test(m)) return 'A URL deste app não está autorizada em Authentication → URL Configuration → Redirect URLs.';
    if(/failed to fetch|network|load failed/i.test(m)) return 'Não foi possível conectar ao Supabase. Verifique a internet, a URL e a chave pública.';
    if(/rate limit/i.test(m)) return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
    return m;
  }

  // Mantém compatibilidade com os botões da tela Configurações/Conexão tradicional.
  window.signInSupabase = async function() {
    setBusy(true); manualAuthInProgress=true;
    try {
      const vals=getCredentials('settings');
      if(!vals.email || !vals.password) throw new Error('Informe e-mail e senha.');
      const {data,error}=await vals.client.auth.signInWithPassword({email:vals.email,password:vals.password}); if(error) throw error;
      await activateSession(data.session,'manual'); $('sb-password').value=''; $('auth-password').value='';
      message('Login realizado com sucesso.','success');
    } catch(e) { showCustomDialog('Não foi possível entrar',friendlyError(e)); message(friendlyError(e),'error'); }
    finally { manualAuthInProgress=false; setBusy(false); }
  };
  window.signUpSupabase = async function() {
    setBusy(true); manualAuthInProgress=true;
    try {
      const vals=getCredentials('settings');
      if(!vals.email || vals.password.length<6) throw new Error('Informe e-mail e uma senha com pelo menos 6 caracteres.');
      const {data,error}=await vals.client.auth.signUp({email:vals.email,password:vals.password,options:{emailRedirectTo:canonicalRedirectUrl()}}); if(error) throw error;
      if(data.session) await activateSession(data.session,'signup');
      else showCustomDialog('Verifique seu e-mail','O cadastro foi solicitado. Confirme o e-mail se a verificação estiver habilitada e depois entre.');
    } catch(e) { showCustomDialog('Erro ao criar conta',friendlyError(e)); }
    finally { manualAuthInProgress=false; setBusy(false); }
  };
  window.signInWithGoogleSupabase = async function() {
    try {
      const vals=getCredentials('settings');
      const {error}=await vals.client.auth.signInWithOAuth({provider:'google',options:{redirectTo:canonicalRedirectUrl(),queryParams:{prompt:'select_account'}}});
      if(error) throw error;
    } catch(e) { if(document.body.classList.contains('auth-locked')) message(friendlyError(e),'error'); else showCustomDialog('Não foi possível iniciar o Google OAuth',friendlyError(e)); }
  };
  window.signOutSupabase = async function() {
    const uid=(sbUser&&sbUser.id)||localStorage.getItem('tce_current_auth_uid');
    if(uid) saveUserSnapshot(uid);
    try { if(sbClient) await sbClient.auth.signOut(); } catch(e) { console.warn(e); }
    lockAfterSignOut();
  };

  // Load settings into the gate and connect session events if credentials were already saved in this browser.
  $('auth-supabase-url').value=localStorage.getItem('tce_sb_url') || $('sb-url').value || ((window.PLANEJADOR_SUPABASE||{}).url||'');
  $('auth-supabase-key').value=localStorage.getItem('tce_sb_key') || $('sb-key').value || '';
  $('auth-email').value=localStorage.getItem('tce_sb_email') || $('sb-email').value || '';
  if(localStorage.getItem('tce_sb_url') && localStorage.getItem('tce_sb_key')) {
    try {
      initializeSupabase(); attachPlannerAuthListener(sbClient);
      sbClient.auth.getSession().then(({data,error})=>{
        if(error) { message('Não foi possível recuperar a sessão: '+friendlyError(error),'error'); return; }
        if(data && data.session) activateSession(data.session,'resume');
        else lock();
      }).catch(e=>message(friendlyError(e),'error'));
    } catch(e) { lock(); }
  } else lock();
  if(recoveryMode) showRecovery();

  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault(); installPromptEvent=event; const btn=$('pwa-install'); if(btn) btn.hidden=false;
  });
  $('pwa-install').addEventListener('click',async()=>{
    if(!installPromptEvent) { message('Use o menu do navegador e escolha “Instalar Planejador de Estudos” ou “Adicionar à tela inicial”.'); return; }
    installPromptEvent.prompt(); await installPromptEvent.userChoice; installPromptEvent=null; $('pwa-install').hidden=true;
  });
})();
