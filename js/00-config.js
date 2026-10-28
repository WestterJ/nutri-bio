// 00-config.js — Versão única do app e carga da configuração pública do Supabase. Ao mudar a versão, mude também CACHE_NAME em service-worker.js.
      // Fonte única da versão: ao mudar aqui, mude também CACHE_NAME em service-worker.js e a nota no LEIA-ME.txt.
      window.APP_VERSION = 'V10.7';
      // V10: URL e chave PÚBLICA do Supabase vêm de supabase-config.js (ninguém digita); a chave do Gemini nunca fica no navegador.
      try {
        var cfg = window.PLANEJADOR_SUPABASE;
        if (cfg) { localStorage.setItem('tce_sb_url', cfg.url); localStorage.setItem('tce_sb_key', cfg.publishableKey); }
        localStorage.removeItem('tce_gemini_key');
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf('tce_user_snapshot_') === 0) {
            var arr = JSON.parse(localStorage.getItem(k) || '[]');
            var limpo = arr.filter(function (p) { return !(p && p[0] === 'tce_gemini_key'); });
            if (limpo.length !== arr.length) localStorage.setItem(k, JSON.stringify(limpo));
          }
        }
      } catch (e) {}
