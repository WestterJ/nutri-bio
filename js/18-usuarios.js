// 18-usuarios.js — V49: aba "Usuários" (somente administrador): consumo de IA (consultas, tokens aproximados) por usuário,
// tipo de uso e modelo, mais as últimas chamadas. Os dados vêm das funções nutri_* do SQL_USUARIOS_IA_V49.sql (a decisão de
// quem é administrador e quem pode usar IA é do banco; aqui o navegador só mostra o resultado, e a Edge Function barra no servidor).
// V50: o administrador libera/bloqueia a IA por usuário. Sem a migração V50 no banco, a IA continua liberada como antes.
"use strict";

window.NutriUsuarios = (function () {
  const st = { isAdmin: false, ai: false, ready: false, users: [], usage: [], recent: [], err: '', seq: 0, last: 0, busy: false };
  const CACHE = uid => 'nutri_acesso_' + uid;
  const faltaFuncao = e => !!e && (e.code === 'PGRST202' || e.code === '42883' || /could not find|does not exist/i.test(String(e.message || '')));
  const errMsg = e => (e && e.message) ? e.message : String(e || 'erro desconhecido');
  const fmtInt = n => (Number(n) || 0).toLocaleString('pt-BR');
  const fmtTok = n => {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' mi';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace('.', ',') + ' mil';
    return String(n);
  };
  const fmtData = v => { const d = v ? new Date(v) : null; return d && !isNaN(d.getTime()) ? d.toLocaleDateString('pt-BR') : '—'; };
  const fmtDataHora = v => { const d = v ? new Date(v) : null; return d && !isNaN(d.getTime()) ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'; };
  const TIPOS = { refeicao_texto: 'Refeição (texto)', refeicao_foto: 'Refeição (foto)', bio: 'Bioimpedância', relatorio: 'Análise do relatório', outro: 'Outros' };
  const nomeTipo = t => TIPOS[t] || String(t || 'Outros');

  function aplicar() {
    document.body.classList.toggle('is-admin', st.isAdmin);
    document.body.classList.toggle('ia-allowed', st.ai);
    if (!st.isAdmin) {
      const v = $('#view-usuarios');
      if (v && !v.classList.contains('hidden')) abrirAba('btn-tab-diario');
    }
  }

  function reset() { st.seq++; st.last = 0; st.isAdmin = false; st.ai = false; st.ready = false; st.users = []; st.usage = []; st.recent = []; st.err = ''; aplicar(); }

  // Pergunta ao banco se esta conta é administradora (no máx. a cada 30 s, salvo force).
  async function refresh(force) {
    const agora = Date.now();
    if (!force && agora - st.last < 30000) return;
    if (typeof supabaseClient === 'undefined' || !supabaseClient || !supabaseUser) { reset(); return; }
    const meu = ++st.seq; st.last = agora;
    try {
      const r = await supabaseClient.rpc('nutri_my_access');
      if (meu !== st.seq) return;
      if (r.error && faltaFuncao(r.error)) { // migração V50 ainda não aplicada: IA liberada como antes; administrador pela V49
        const a = await supabaseClient.rpc('nutri_is_admin');
        if (meu !== st.seq) return;
        st.isAdmin = !a.error && a.data === true; st.ai = true;
      } else if (r.error) throw r.error;
      else { const x = Array.isArray(r.data) ? r.data[0] : r.data; st.isAdmin = !!(x && x.r_is_admin); st.ai = !!(x && x.r_ai); }
      st.ready = true;
      try { localStorage.setItem(CACHE(supabaseUser.id), JSON.stringify({ a: st.isAdmin, i: st.ai })); } catch (_) {}
    } catch (e) {
      if (meu !== st.seq) return;
      console.warn('Não foi possível consultar as permissões:', e);
      let c = null; try { c = JSON.parse(localStorage.getItem(CACHE(supabaseUser.id)) || 'null'); } catch (_) {}
      st.isAdmin = !!(c && c.a); st.ai = !!(c && c.i); // sem rede: usa a última resposta conhecida (sem ela, fica fechado)
    }
    aplicar();
  }

  async function carregar() {
    if (!st.isAdmin) return;
    const box = $('#usr-kpis'); if (!box) return;
    $('#usr-aviso').classList.add('hidden');
    $('#usr-por-usuario').innerHTML = '<p class="text-xs text-slate-500">Carregando…</p>';
    const per = $('#usr-periodo').value;
    const dias = per ? Number(per) : null;
    const [u, s, r] = await Promise.all([
      supabaseClient.rpc('nutri_all_users'),
      supabaseClient.rpc('nutri_ia_usage_summary', { p_days: dias }),
      supabaseClient.rpc('nutri_ia_usage_recent', { p_limit: 50 })
    ]).catch(e => [{ error: e }, { error: e }, { error: e }]);
    const erro = u.error || s.error || r.error;
    if (erro) {
      st.users = []; st.usage = []; st.recent = [];
      const av = $('#usr-aviso');
      av.textContent = 'Não foi possível carregar (' + errMsg(erro) + '). Se for a primeira vez, rode SQL_USUARIOS_IA_V49.sql no Supabase.';
      av.classList.remove('hidden');
    } else { st.users = u.data || []; st.usage = s.data || []; st.recent = r.data || []; }
    render();
  }

  function somar(linhas) {
    return linhas.reduce((a, x) => {
      a.q += Number(x.r_queries) || 0; a.f += Number(x.r_failed) || 0; a.i += Number(x.r_prompt) || 0;
      a.o += Number(x.r_output) || 0; a.t += Number(x.r_total) || 0; a.e += Number(x.r_estimated) || 0; return a;
    }, { q: 0, f: 0, i: 0, o: 0, t: 0, e: 0 });
  }
  function agrupar(chaveFn) {
    const m = new Map();
    st.usage.forEach(x => { const k = chaveFn(x); const a = m.get(k) || []; a.push(x); m.set(k, a); });
    return m;
  }
  const tabela = (cab, linhas, minW) => '<div class="overflow-x-auto"><table class="w-full text-left text-sm' + (minW === 0 ? '' : ' min-w-[420px]') + '"><thead><tr class="text-xs uppercase text-slate-500">'
    + cab.map(c => '<th class="py-2 pr-3 font-semibold">' + esc(c) + '</th>').join('') + '</tr></thead><tbody class="divide-y divide-slate-100">'
    + linhas.map(l => '<tr>' + l.map(c => '<td class="py-2 pr-3 align-top">' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  const tok = (a) => '~' + fmtTok(a.t) + (a.e ? ' *' : '');

  function render() {
    const tot = somar(st.usage);
    const comIA = st.users.filter(u => u.r_is_admin || u.r_ai_allowed).length;
    $('#usr-resumo').textContent = st.users.length + ' usuário(s) · ' + comIA + ' com IA liberada · ' + fmtInt(tot.q) + ' chamada(s) de IA no período';
    $('#usr-kpis').innerHTML = [
      ['Chamadas', fmtInt(tot.q), tot.f ? fmtInt(tot.f) + ' com falha' : 'sem falhas'],
      ['Tokens (aprox.)', '~' + fmtTok(tot.t) + (tot.e ? ' *' : ''), 'entrada + saída'],
      ['Entrada', '~' + fmtTok(tot.i), 'texto/imagem enviados'],
      ['Saída', '~' + fmtTok(tot.o), 'resposta da IA']
    ].map(k => '<div class="bg-slate-50 p-3 rounded-lg border text-center"><span class="text-xs text-slate-500">' + k[0] + '</span><div class="text-lg font-bold">' + k[1] + '</div><div class="text-xs text-slate-600">' + k[2] + '</div></div>').join('');

    // Por usuário (inclui quem nunca usou IA)
    const porUser = agrupar(x => String(x.r_user_id || ''));
    const linhasU = st.users.map(u => {
      const a = somar(porUser.get(String(u.r_user_id)) || []);
      return { u, a };
    }).sort((x, y) => (y.a.t - x.a.t) || String(x.u.r_email).localeCompare(String(y.u.r_email)));
    $('#usr-por-usuario').innerHTML = linhasU.length
      ? '<div class="space-y-2">' + linhasU.map(({ u, a }) =>
          '<div class="border border-slate-200 rounded-lg p-3 space-y-1">'
          + '<div class="font-semibold break-all">' + esc(u.r_email || '(sem e-mail)') + (u.r_is_admin ? ' <small class="font-normal text-slate-500">· admin</small>' : '') + '</div>'
          + '<div class="text-xs text-slate-500">cadastro ' + esc(fmtData(u.r_created_at)) + ' · último acesso ' + esc(fmtData(u.r_last_sign_in)) + '</div>'
          + '<div class="flex flex-wrap gap-x-5 gap-y-1 text-sm"><span><b>' + fmtInt(a.q) + '</b> chamada' + (a.q === 1 ? '' : 's') + '</span><span><b>' + fmtInt(a.f) + '</b> falha' + (a.f === 1 ? '' : 's') + '</span><span><b>' + esc(tok(a)) + '</b> tokens</span></div>'
          + (u.r_is_admin ? '<div class="text-xs text-slate-500">Administrador · acesso total à IA</div>'
            : '<div class="flex items-center gap-2 pt-1"><label class="text-xs font-semibold text-slate-600" for="ia-' + esc(u.r_user_id) + '">IA</label>'
              + '<select id="ia-' + esc(u.r_user_id) + '" class="usr-ia text-xs px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 min-h-[44px] sm:min-h-0" data-user="' + esc(u.r_user_id) + '" data-email="' + esc(u.r_email || '') + '">'
              + '<option value="0"' + (u.r_ai_allowed ? '' : ' selected') + '>Sem IA</option><option value="1"' + (u.r_ai_allowed ? ' selected' : '') + '>IA liberada</option></select></div>')
          + '</div>').join('') + '</div>'
      : '<p class="text-xs text-slate-500">Nenhum usuário.</p>';

    const porTipo = [...agrupar(x => x.r_tipo || 'outro').entries()].map(([k, v]) => [k, somar(v)]).sort((a, b) => b[1].t - a[1].t);
    $('#usr-por-tipo').innerHTML = porTipo.length ? tabela(['Tipo', 'Chamadas', 'Tokens'], porTipo.map(([k, a]) => [esc(nomeTipo(k)), fmtInt(a.q), '<b>' + esc(tok(a)) + '</b>'])) : '<p class="text-xs text-slate-500">Sem chamadas no período.</p>';
    const porModelo = [...agrupar(x => x.r_model || 'não informado').entries()].map(([k, v]) => [k, somar(v)]).sort((a, b) => b[1].t - a[1].t);
    $('#usr-por-modelo').innerHTML = porModelo.length ? tabela(['Modelo', 'Chamadas', 'Tokens'], porModelo.map(([k, a]) => [esc(k), fmtInt(a.q), '<b>' + esc(tok(a)) + '</b>'])) : '<p class="text-xs text-slate-500">Sem chamadas no período.</p>';

    $('#usr-recentes').innerHTML = st.recent.length
      ? tabela(['Quando', 'Usuário', 'Tipo · modelo', 'Tokens', 'Situação'], st.recent.map(x => [
          esc(fmtDataHora(x.r_created_at)), esc(x.r_email || '(conta excluída)'),
          esc(nomeTipo(x.r_tipo)) + '<br><small class="text-slate-500">' + esc(x.r_model || 'não informado') + '</small>',
          '~' + fmtInt(x.r_total) + (x.r_estimated ? ' *' : ''),
          x.r_status === 'ok' ? 'OK' : '<span class="text-red-600" title="' + esc(x.r_error || '') + '">' + esc(x.r_status) + '</span>']))
      : '<p class="text-xs text-slate-500">Nenhuma chamada registrada ainda.</p>';
  }

  async function aoMudarIA(ev) {
    const sel = ev.target.closest('select.usr-ia');
    if (!sel || !st.isAdmin || st.busy) return;
    const liberar = sel.value === '1';
    st.busy = true; sel.disabled = true;
    try {
      const { error } = await supabaseClient.rpc('nutri_set_ai', { p_user: sel.dataset.user, p_allowed: liberar });
      if (error) throw error;
      showToast((liberar ? 'IA liberada para ' : 'IA bloqueada para ') + sel.dataset.email + '.');
    } catch (e) {
      showToast('Não foi possível salvar a permissão: ' + (faltaFuncao(e) ? 'rode SQL_ACESSO_IA_V50.sql no Supabase.' : errMsg(e)));
    } finally { st.busy = false; }
    await carregar();
  }
  $('#usr-por-usuario').addEventListener('change', aoMudarIA);
  $('#usr-periodo').addEventListener('change', carregar);
  $('#usr-atualizar').addEventListener('click', () => carregar());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(false); });
  // Antes de consultar o banco, usa a última resposta conhecida desta conta (evita os botões de IA piscarem ao abrir o app).
  try { const uid = localStorage.getItem('nutri_active_user_id'); const c = uid && JSON.parse(localStorage.getItem(CACHE(uid)) || 'null'); if (c) { st.isAdmin = !!c.a; st.ai = !!c.i; } } catch (_) {}
  aplicar();
  // Enquanto o banco não respondeu, não bloqueia no navegador (o servidor decide); depois da resposta, vale o resultado.
  const canUseAI = () => st.ai || !st.ready;
  return { refresh, reset, carregar, canUseAI };
})();
