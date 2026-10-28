// 16-auth.js — Tela de login: e-mail/senha, Google, criação de conta e recuperação de senha
"use strict";

  // --- V22: portão de autenticação, recuperação de senha e sessão persistente ---
  const authMessage = $('#auth-message');
  function setAuthMessage(message, kind='info') {
    if (!authMessage) return;
    authMessage.textContent = message;
    authMessage.className = 'text-sm rounded-lg p-3 ' + (kind==='error' ? 'bg-red-50 text-red-800' : kind==='success' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-700');
  }
  function lockApp() {
    document.body.classList.add('auth-locked');
    const gate=$('#auth-gate'); if(gate) gate.setAttribute('aria-hidden','false');
  }
  function unlockApp() {
    document.body.classList.remove('auth-locked');
    const gate=$('#auth-gate'); if(gate) gate.setAttribute('aria-hidden','true');
    ajustarAlturaCabecalho(); // V40: menu lateral logo abaixo do cabeçalho
  }
  function showRecoveryForm() {
    passwordRecoveryMode = true;
    $('#auth-normal-fields').classList.add('hidden');
    $('#auth-recovery-fields').classList.remove('hidden');
    lockApp();
    setAuthMessage('Link de recuperação validado. Defina uma nova senha.','success');
  }
  function showLoginForm() {
    $('#auth-recovery-fields').classList.add('hidden');
    $('#auth-normal-fields').classList.remove('hidden');
    setAuthMessage('Informe seus dados para entrar. A sessão poderá permanecer ativa neste dispositivo.');
  }
  function authClientFromGate() {
    const url=String(sharedSupabaseConfig.url || '').trim().replace(/\/$/,'');
    const key=String(sharedSupabaseConfig.key || '').trim();
    if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) throw new Error('Informe a URL válida do projeto Supabase.');
    if(!key || /service_role/i.test(key)) throw new Error('Informe somente a chave pública publishable/anon. Nunca use service_role.');
    if(!window.supabase || !window.supabase.createClient) throw new Error('A biblioteca Supabase não carregou. Verifique a conexão e recarregue a página.');
    supabaseConfig={url,key};
    if(!supabaseClient || supabaseClient.supabaseUrl!==url) {
      supabaseClient=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      supabaseClient.auth.onAuthStateChange((event,session)=>{
        if(event==='SIGNED_OUT') { supabaseUser=null; lockApp(); updateCloudStatusPill(); }
        else if(event==='PASSWORD_RECOVERY') showRecoveryForm();
        else if(event==='SIGNED_IN' && session) setTimeout(()=>{ if(!supabaseUser || supabaseUser.id!==session.user.id) applySupabaseSession(session,true); },0);
      });
    }
    return supabaseClient;
  }
  function setAuthBusy(busy) { ['auth-login','auth-google','auth-signup','auth-forgot','auth-update-password'].forEach(id=>{const el=$('#'+id); if(el) el.disabled=busy;}); }
  const hasCentralSupabaseConfig = Boolean(sharedSupabaseConfig.url && sharedSupabaseConfig.key && !/COLE_A_CHAVE|SUA_CHAVE|SUBSTITUA/i.test(sharedSupabaseConfig.key));
  if (hasCentralSupabaseConfig) {
    
    const help=$('#supabase-help'); if(help) help.textContent='Configuração centralizada ativa via supabase-config.js. Para alterar a conexão, edite esse arquivo no repositório. Use e-mail/senha ou Google para entrar em cada dispositivo.';
  } else {
    const help=$('#supabase-help'); if(help) help.textContent='A configuração centralizada não está completa. Confira a URL e a chave pública em supabase-config.js no repositório.';
  }
  $('#auth-email').value=localStorage.getItem('nutri_supabase_email') || '';
  $('#auth-google').onclick=async()=>{
    setAuthBusy(true);
    try {
      const client=authClientFromGate();
      const redirectTo=window.location.origin+window.location.pathname;
      const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo, queryParams:{access_type:'offline',prompt:'select_account'}}});
      if(error) throw error;
    } catch(err) {
      setAuthMessage('Não foi possível iniciar o login com Google. Confira se o provedor Google está habilitado no Supabase e se o endereço de retorno está autorizado. '+authFriendlyError(err),'error');
      setAuthBusy(false);
    }
  };
  $('#auth-login').onclick=async()=>{
    setAuthBusy(true);
    try {
      const client=authClientFromGate(); const email=$('#auth-email').value.trim(); const password=$('#auth-password').value;
      if(!email || !password) throw new Error('Informe seu e-mail e senha.');
      localStorage.setItem('nutri_supabase_email',email);
      const {data,error}=await client.auth.signInWithPassword({email,password}); if(error) throw error;
      await applySupabaseSession(data.session,true); $('#auth-password').value='';
      setAuthMessage('Login realizado com sucesso.','success');
    } catch(err) { lockApp(); setAuthMessage(authFriendlyError(err),'error'); }
    finally { setAuthBusy(false); }
  };
  $('#auth-signup').onclick=async()=>{
    setAuthBusy(true);
    try {
      const client=authClientFromGate(); const email=$('#auth-email').value.trim(); const password=$('#auth-password').value;
      if(!email || !password) throw new Error('Informe e-mail e senha para criar a conta.');
      if(password.length<8) throw new Error('Use uma senha com pelo menos 8 caracteres.');
      const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin+window.location.pathname}}); if(error) throw error;
      if(data.session) { await applySupabaseSession(data.session,true); setAuthMessage('Conta criada e acesso liberado.','success'); }
      else setAuthMessage('Cadastro iniciado. Confirme o e-mail recebido e depois entre por esta tela.','success');
    } catch(err) { setAuthMessage(authFriendlyError(err),'error'); }
    finally { setAuthBusy(false); }
  };
  $('#auth-forgot').onclick=async()=>{
    try {
      const client=authClientFromGate(); const email=$('#auth-email').value.trim();
      if(!email) throw new Error('Digite seu e-mail antes de pedir a recuperação da senha.');
      const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+window.location.pathname}); if(error) throw error;
      setAuthMessage('Se o e-mail estiver cadastrado, o Supabase enviará um link de recuperação. Confira também a caixa de spam.','success');
    } catch(err) { setAuthMessage(authFriendlyError(err),'error'); }
  };
  $('#auth-update-password').onclick=async()=>{
    try {
      const client=authClientFromGate(); const password=$('#auth-new-password').value;
      if(!password || password.length<8) throw new Error('Informe uma nova senha com pelo menos 8 caracteres.');
      const {error}=await client.auth.updateUser({password}); if(error) throw error;
      $('#auth-new-password').value=''; passwordRecoveryMode=false; showLoginForm();
      setAuthMessage('Senha alterada com sucesso. Você já pode entrar com a nova senha.','success');
      try { await client.auth.signOut(); } catch(_) {}
      try { history.replaceState(null,document.title,location.pathname+location.search); } catch(_) {}
    } catch(err) { setAuthMessage(authFriendlyError(err),'error'); }
  };
  $('#auth-back-login').onclick=showLoginForm;
  $('#auth-password').addEventListener('keydown',e=>{if(e.key==='Enter') $('#auth-login').click();});
  function authFriendlyError(err) {
    const msg=(err && err.message) ? err.message : String(err || 'erro desconhecido');
    if(/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos. Confira os dados e tente novamente.';
    if(/email not confirmed/i.test(msg)) return 'Seu e-mail ainda não foi confirmado. Abra a mensagem enviada pelo Supabase e confirme o cadastro.';
    if(/rate limit/i.test(msg)) return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
    if(/failed to fetch|network|load failed/i.test(msg)) return 'Não foi possível conectar ao Supabase. Verifique a internet e a URL do projeto.';
    return msg;
  }
