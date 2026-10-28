// 99-main.js — Inicialização: sessão Supabase, carga de dados, bloqueio da tela e registro do service worker
"use strict";

  (async function initSupabaseSession(){
    if (!supabaseConfig.url || !supabaseConfig.key || !window.supabase) return;
    try {
      const client=readSupabaseForm();
      const {data:{session}}=await client.auth.getSession();
      if(session) await applySupabaseSession(session,true);
      client.auth.onAuthStateChange((event,session)=>{
        if(event==='SIGNED_OUT') {supabaseUser=null; updateCloudStatusPill(); lockApp();}
        else if(event==='PASSWORD_RECOVERY') { showRecoveryForm(); }
        else if(event==='SIGNED_IN' && session) setTimeout(()=>{ if(!supabaseUser || supabaseUser.id!==session.user.id) applySupabaseSession(session,true); },0);
      });
    } catch(err) { console.warn('Supabase session init:',err.message); }
  })();

  // RLS esperado: tabela diary_data com RLS habilitado e policies restritas a auth.uid() = user_id.
  loadData();
  refreshAll();
  lockApp();
  // Se a página foi aberta pelo link de recuperação, prioriza a tela de nova senha.
  if (location.hash.includes('type=recovery')) showRecoveryForm();


if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(err => console.warn('PWA: não foi possível registrar o service worker', err));
  });
}
