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

// V46: versão exibida vem de js/00-config.js (fonte única)
try { document.title = 'Diário Nutricional ' + APP_VERSION; const v = document.getElementById('app-version'); if (v) v.textContent = 'Versão ' + APP_VERSION; const sv = document.getElementById('sidebar-versao'); if (sv) sv.textContent = 'Versão ' + APP_VERSION; } catch (_) {}

// V47: no celular as tabelas viram cartões; cada célula recebe o nome da coluna (data-label) a partir do <thead>.
(function () {
  function rotular(tbody) {
    const ths = [...tbody.closest('table').querySelectorAll('thead th')].map(t => t.textContent.trim());
    tbody.querySelectorAll('tr').forEach(tr => [...tr.children].forEach((td, i) => {
      if (td.colSpan > 1 || !ths[i] || ths[i] === 'Ações') return;
      if (td.dataset.label !== ths[i]) td.dataset.label = ths[i];
    }));
  }
  ['table-body', 'table-bio-body', 'tbody-treinos'].forEach(id => {
    const tb = document.getElementById(id); if (!tb) return;
    new MutationObserver(() => rotular(tb)).observe(tb, { childList: true });
    rotular(tb);
  });
})();
