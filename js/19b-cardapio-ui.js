// 19b-cardapio-ui.js — V51: aba "Cardápio da semana" (gerar, trocar, editar, travar e registrar refeições; score por refeição).
"use strict";

window.CardapioUI = (function () {
  const M = window.CardapioMotor;
  const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const OBJ = { ganho: 'Ganho de massa', perda: 'Perda de peso', manutencao: 'Manutenção', recomposicao: 'Recomposição corporal' };
  const fmt = n => Math.round(Number(n) || 0).toLocaleString('pt-BR');
  const dataBR = s => { const d = M.parseData(s); return `${DOW[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };
  let diaSel = 0, trocando = null, editando = null;

  // ---------- configuração e estado ----------
  function cfgPadrao() {
    const hoje = hojeLocal(), ini = M.somaDias(hoje, -56), cont = [0, 0, 0, 0, 0, 0, 0];
    (state.treinos || []).forEach(t => { if (String(t.data) >= ini && String(t.data) <= hoje) cont[M.dow(t.data)]++; });
    const ordem = [1, 2, 3, 4, 5, 6, 0].sort((a, b) => cont[b] - cont[a] || [1, 2, 3, 4, 5, 6, 0].indexOf(a) - [1, 2, 3, 4, 5, 6, 0].indexOf(b));
    return {
      objetivo: (state.metas && state.metas.objetivo) || 'manutencao', periodo: 'hoje',
      slotsOn: { cafe: true, lancheM: false, almoco: true, lancheT: true, jantar: true },
      treinoDow: ordem.slice(0, 3).filter(d => cont[d] > 0).sort((a, b) => a - b),
      horarios: Object.fromEntries(M.SLOTS.map(s => [s.id, s.hora]))
    };
  }
  function cfg() {
    if (!state.cardapio || typeof state.cardapio !== 'object') state.cardapio = {};
    const pad = cfgPadrao(), atual = state.cardapio.cfg || {};
    state.cardapio.cfg = Object.assign(pad, atual, { slotsOn: Object.assign(pad.slotsOn, atual.slotsOn || {}), horarios: Object.assign(pad.horarios, atual.horarios || {}) });
    if (!Array.isArray(state.cardapio.cfg.treinoDow)) state.cardapio.cfg.treinoDow = pad.treinoDow;
    return state.cardapio.cfg;
  }
  const plano = () => (state.cardapio && state.cardapio.plano) || null;
  function inicioDaSemana(c) {
    const hoje = hojeLocal();
    if (c.periodo !== 'proxima') return hoje;
    const d = M.dow(hoje); return M.somaDias(hoje, ((8 - d) % 7) || 7); // próxima segunda-feira
  }
  function ctxDoDia(dia) {
    const p = plano(), ativos = dia.refeicoes.map(m => m.slot);
    return { objetivo: p.objetivo, alvos: M.alvosDoDia(state.metas || {}, ativos.length ? ativos : ['almoco']) };
  }
  function recalcular(m, dia) {
    const r = M.pontuar(m, ctxDoDia(dia));
    m.score = r.score; m.partes = r.partes; m.motivos = r.motivos; m.vermelha = r.vermelha || (m.origem === 'plano' && !!m.vermelha);
  }
  function recalcularDia(dia) { dia.refeicoes.forEach(m => recalcular(m, dia)); dia.refeicoes.sort((a, b) => String(a.hora).localeCompare(String(b.hora))); }
  function achar(id) { const p = plano(); if (!p) return null; for (const dia of p.dias) { const m = dia.refeicoes.find(x => x.id === id); if (m) return { dia, m }; } return null; }

  // ---------- apresentação ----------
  const COR = { 'Ótima': 'bg-emerald-100 text-emerald-800 border-emerald-300', 'Boa': 'bg-sky-100 text-sky-800 border-sky-300', 'Regular': 'bg-amber-100 text-amber-800 border-amber-300', 'Fraca': 'bg-red-100 text-red-800 border-red-300' };
  const badge = s => `<span class="inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-xs font-bold ${COR[M.faixa(s)]}" title="Score ${s} de 100">${s} · ${M.faixa(s)}</span>`;
  const chip = (txt, cls = '') => `<span class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 ${cls}">${txt}</span>`;
  const slotNome = id => (M.SLOT_POR_ID[id] || {}).nome || id;

  function renderAjustes() {
    const c = cfg(), m = state.metas || {};
    $('#cd-alvos').innerHTML = `Metas do dia: <b>${fmt(m.calorias || 2000)} kcal</b> e <b>${fmt(m.proteinas || 160)} g de proteína</b> (ajustáveis em Metas).`;
    const dif = c.objetivo !== 'perda' && c.objetivo !== 'recomposicao';
    const av = $('#cd-aviso');
    av.classList.toggle('hidden', !dif);
    av.textContent = dif ? `O plano da nutricionista (12/12/2025) é de emagrecimento com preservação de massa muscular. O objetivo usado aqui é “${OBJ[c.objetivo] || c.objetivo}” (vem das suas Metas). Se não for o que você quer, escolha outro em Ajustes.` : '';
    $('#cd-objetivo').value = c.objetivo; $('#cd-periodo').value = c.periodo;
    $('#cd-treino').innerHTML = [1, 2, 3, 4, 5, 6, 0].map(d => `<button type="button" data-dow="${d}" aria-pressed="${c.treinoDow.includes(d)}" class="cd-chip px-3 py-2 rounded-full border text-sm font-semibold min-h-[44px] sm:min-h-0 ${c.treinoDow.includes(d) ? 'bg-[#003a70] text-white border-[#003a70]' : 'bg-white text-slate-700 border-slate-300'}">${DOW[d]}</button>`).join('');
    $('#cd-slots').innerHTML = M.SLOTS.filter(s => s.id !== 'pre').map(s => `<div class="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2"><label class="flex items-center gap-2 flex-1 text-sm"><input type="checkbox" data-slot="${s.id}" ${c.slotsOn[s.id] ? 'checked' : ''} class="h-5 w-5"> ${esc(s.nome)}</label><input type="time" data-hora="${s.id}" value="${esc(c.horarios[s.id] || s.hora)}" class="text-sm border border-slate-300 rounded-lg px-2 py-1 min-h-[40px]"></div>`).join('')
      + `<div class="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50"><span class="flex-1 text-sm">Pré-Treino <small class="text-slate-500">(só nos dias de treino)</small></span><input type="time" data-hora="pre" value="${esc(c.horarios.pre || '18:00')}" class="text-sm border border-slate-300 rounded-lg px-2 py-1 min-h-[40px]"></div>`;
  }

  function cartaoRefeicao(m, dia) {
    const ds = dia.data;
    return `<article class="border border-slate-200 rounded-xl p-3 space-y-2 bg-white ${m.travada ? 'ring-2 ring-amber-300' : ''}" data-mid="${esc(m.id)}">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0"><div class="text-sm font-bold text-slate-800">${esc(m.hora || '')} · ${esc(slotNome(m.slot))} ${m.travada ? '<span title="Travada: não muda ao gerar de novo">🔒</span>' : ''}${m.registrada ? '<span class="text-emerald-700 text-xs font-semibold"> · registrada ✓</span>' : ''}</div>
          <div class="text-[11px] text-slate-500">${esc(m.origem === 'manual' ? 'Editada por você' : (m.fonte || ''))}</div></div>
        <div class="shrink-0">${badge(m.score)}</div>
      </div>
      <p class="text-sm text-slate-700 whitespace-pre-line break-words">${esc(m.alimentos)}</p>
      <div class="flex flex-wrap gap-1.5">${chip('<b>' + fmt(m.kcal) + '</b> kcal')}${chip('P <b>' + fmt(m.prot) + '</b> g', 'text-blue-800')}${chip('C <b>' + fmt(m.carb) + '</b> g', 'text-amber-800')}${chip('G <b>' + fmt(m.gord) + '</b> g', 'text-rose-800')}${m.vermelha ? chip('carne vermelha') : ''}</div>
      <details class="text-xs text-slate-600"><summary class="cursor-pointer font-semibold">Por que ${m.score}?</summary>
        <div class="mt-1 space-y-0.5"><div class="text-slate-500">Calorias ${m.partes.calorias}/35 · Proteína ${m.partes.proteina}/30 · Qualidade ${m.partes.qualidade}/20 · Plano ${m.partes.plano}/15</div>${m.motivos.map(x => `<div>• ${esc(x)}</div>`).join('')}</div></details>
      <div class="grid grid-cols-4 gap-2 pt-1">
        <button type="button" data-act="trocar" data-id="${esc(m.id)}" class="cd-btn">Trocar</button>
        <button type="button" data-act="editar" data-id="${esc(m.id)}" class="cd-btn">Editar</button>
        <button type="button" data-act="travar" data-id="${esc(m.id)}" class="cd-btn">${m.travada ? 'Destravar' : 'Travar'}</button>
        <button type="button" data-act="registrar" data-id="${esc(m.id)}" class="cd-btn cd-btn-ok">Registrar</button>
      </div></article>`;
  }

  function render() {
    renderAjustes();
    const p = plano(), res = $('#cd-resultado'), vazio = $('#cd-vazio');
    if (!p || !p.dias || !p.dias.length) { res.classList.add('hidden'); vazio.classList.remove('hidden'); return; }
    vazio.classList.add('hidden'); res.classList.remove('hidden');
    if (diaSel >= p.dias.length) diaSel = 0;
    const metas = state.metas || {}, sem = M.resumoSemana(p, metas);
    const ok = (c, t) => `<span class="${c ? 'text-emerald-700' : 'text-amber-700'}">${c ? '✓' : '!'} ${t}</span>`;
    $('#cd-semana').innerHTML = `<div class="flex flex-wrap items-center justify-between gap-2"><div><div class="text-xs text-slate-500">Semana de ${esc(dataBR(p.dias[0].data))} a ${esc(dataBR(p.dias[p.dias.length - 1].data))} · objetivo: ${esc(OBJ[p.objetivo] || p.objetivo)}</div>
        <div class="text-sm font-bold text-slate-800">Score médio ${badge(sem.scoreMedio)}</div></div>
        <div class="text-xs text-slate-600 text-right">Média por dia: <b>${fmt(sem.kcalMedia)}</b> kcal (meta ${fmt(metas.calorias || 2000)}) · <b>${fmt(sem.protMedia)}</b> g de proteína (meta ${fmt(metas.proteinas || 160)})</div></div>
      <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs pt-1">${ok(sem.vermelhas <= 2, 'Carne vermelha: ' + sem.vermelhas + ' (máx. 2 na semana)')}${ok(sem.fritos === 0, 'Frituras: ' + sem.fritos)}${ok(sem.diasProt90 >= Math.ceil(sem.dias * 0.7), 'Dias com proteína ≥ 90% da meta: ' + sem.diasProt90 + '/' + sem.dias)}${ok(sem.diasKcalOk >= Math.ceil(sem.dias * 0.7), 'Dias com calorias a ±10% da meta: ' + sem.diasKcalOk + '/' + sem.dias)}</div>`;
    $('#cd-dias').innerHTML = p.dias.map((d, i) => { const r = M.resumoDia(d, metas, p.objetivo); return `<button type="button" data-dia="${i}" aria-pressed="${i === diaSel}" class="cd-dia shrink-0 px-3 py-2 rounded-xl border text-sm font-semibold min-h-[44px] ${i === diaSel ? 'bg-[#003a70] text-white border-[#003a70]' : 'bg-white text-slate-700 border-slate-300'}">${esc(dataBR(d.data))}<span class="block text-[11px] font-normal opacity-80">score ${r.score}</span></button>`; }).join('');
    const dia = p.dias[diaSel], r = M.resumoDia(dia, metas, p.objetivo);
    const barra = (pct, cor) => `<div class="h-2 rounded bg-slate-200 overflow-hidden"><div class="h-2 ${cor}" style="width:${Math.min(100, pct)}%"></div></div>`;
    $('#cd-dia').innerHTML = dia.refeicoes.map(m => cartaoRefeicao(m, dia)).join('')
      + `<div class="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2"><div class="flex items-center justify-between"><b class="text-sm">Total do dia</b>${badge(r.score)}</div>
        <div class="text-xs"><div class="flex justify-between"><span>${fmt(r.kcal)} kcal</span><span>${r.pctK}% da meta</span></div>${barra(r.pctK, 'bg-amber-400')}</div>
        <div class="text-xs"><div class="flex justify-between"><span>${fmt(r.prot)} g de proteína</span><span>${r.pctP}% da meta</span></div>${barra(r.pctP, 'bg-sky-500')}</div>
        <div class="text-[11px] text-slate-500">Carboidratos ${fmt(r.carb)} g · Gorduras ${fmt(r.gord)} g · média das refeições ${r.mediaRefeicoes}. O score do dia mistura a média das refeições (50%), as calorias (25%) e a proteína (25%).</div></div>`;
  }

  // ---------- ações ----------
  function gerar(forcar) {
    const c = cfg(), inicio = inicioDaSemana(c), existente = plano();
    const mantem = existente && existente.inicio === inicio ? existente.dias.reduce((n, d) => n + d.refeicoes.filter(m => m.travada || m.origem === 'manual').length, 0) : 0;
    const temEdicao = existente && existente.inicio !== inicio && existente.dias.some(d => d.refeicoes.some(m => m.travada || m.origem === 'manual' || m.registrada));
    if (temEdicao && !forcar) { customConfirm('Substituir o cardápio?', 'O cardápio atual tem refeições editadas, travadas ou registradas e é de outra semana. Gerar um novo substitui tudo.', () => gerar(true), 'Gerar novo', 'bg-sky-700 hover:bg-sky-800 text-white'); return; }
    const novo = M.gerarSemana({ inicio, dias: 7, objetivo: c.objetivo, metas: state.metas, registros: state.registros, hoje: hojeLocal(), slotsOn: c.slotsOn, treinoDow: c.treinoDow, horarios: c.horarios, seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) & 0x7fffffff, existente });
    novo.configUsada = { slotsOn: c.slotsOn, treinoDow: c.treinoDow };
    state.cardapio.plano = novo; diaSel = 0; M.prepararPools(state.registros, hojeLocal());
    saveCloud(); render();
    showToast(mantem ? `Cardápio gerado. ${mantem} refeição(ões) travada(s) ou editada(s) foram mantidas.` : 'Cardápio da semana gerado.');
  }

  function abrirTrocar(id, embaralhar) {
    const a = achar(id); if (!a) return;
    if (!trocando || trocando.id !== id) trocando = { id }; M.prepararPools(state.registros, hojeLocal());
    const ctx = ctxDoDia(a.dia), rnd = embaralhar ? M.mulberry32(Date.now() & 0x7fffffff) : null;
    const alts = M.alternativas(a.m.slot, ctx, a.m.ck, 8, rnd), verm = plano().dias.reduce((n, d) => n + d.refeicoes.filter(x => x.vermelha && x.id !== id).length, 0);
    trocando.alts = alts;
    $('#cd-trocar-titulo').textContent = `Trocar ${slotNome(a.m.slot)} · ${dataBR(a.dia.data)}`;
    $('#cd-trocar-lista').innerHTML = alts.map((x, i) => `<button type="button" data-alt="${i}" class="w-full text-left border border-slate-200 rounded-xl p-3 space-y-1 hover:bg-slate-50 min-h-[44px]"><div class="flex items-start justify-between gap-2"><span class="text-[11px] text-slate-500">${esc(x.c.fonte || '')}</span>${badge(x.p.score)}</div><div class="text-sm text-slate-800 break-words">${esc(x.c.alimentos)}</div><div class="text-xs text-slate-600">${fmt(x.c.kcal)} kcal · P ${fmt(x.c.prot)} g · C ${fmt(x.c.carb)} g · G ${fmt(x.c.gord)} g${x.c.vermelha && verm >= 2 ? ' · <span class="text-amber-700">já há 2 carnes vermelhas na semana</span>' : ''}</div></button>`).join('') || '<p class="text-sm text-slate-500">Sem alternativas para esta refeição.</p>';
    if (!$('#modal-cd-trocar').open) $('#modal-cd-trocar').showModal();
  }
  function aplicarTroca(i) {
    const a = trocando && achar(trocando.id), x = trocando && trocando.alts && trocando.alts[i]; if (!a || !x) return;
    Object.assign(a.m, { alimentos: x.c.alimentos, kcal: Math.round(x.c.kcal), prot: Math.round(x.c.prot), carb: Math.round(x.c.carb), gord: Math.round(x.c.gord), origem: x.c.origem, fonte: x.c.fonte, ck: x.c.ck, vermelha: !!x.c.vermelha, travada: false, registrada: false });
    recalcular(a.m, a.dia); $('#modal-cd-trocar').close(); saveCloud(); render(); showToast('Refeição trocada.');
  }

  function abrirEditar(id) {
    const a = achar(id); if (!a) return; editando = id; const m = a.m;
    $('#cd-ed-titulo').textContent = `Editar ${slotNome(m.slot)} · ${dataBR(a.dia.data)}`;
    $('#cd-ed-hora').value = m.hora || ''; $('#cd-ed-alimentos').value = m.alimentos || '';
    $('#cd-ed-kcal').value = m.kcal; $('#cd-ed-prot').value = m.prot; $('#cd-ed-carb').value = m.carb; $('#cd-ed-gord').value = m.gord;
    previaEdicao(); $('#modal-cd-editar').showModal();
  }
  function lerEdicao(a) {
    return { id: a.m.id, slot: a.m.slot, hora: $('#cd-ed-hora').value || a.m.hora, alimentos: $('#cd-ed-alimentos').value.trim(), kcal: Number($('#cd-ed-kcal').value) || 0, prot: Number($('#cd-ed-prot').value) || 0, carb: Number($('#cd-ed-carb').value) || 0, gord: Number($('#cd-ed-gord').value) || 0, origem: 'manual' };
  }
  function previaEdicao() {
    const a = editando && achar(editando); if (!a) return;
    const r = M.pontuar(lerEdicao(a), ctxDoDia(a.dia));
    $('#cd-ed-previa').innerHTML = `${badge(r.score)} <span class="text-xs text-slate-500">Calorias ${r.partes.calorias}/35 · Proteína ${r.partes.proteina}/30 · Qualidade ${r.partes.qualidade}/20 · Plano ${r.partes.plano}/15</span><div class="text-xs text-slate-600 mt-1 space-y-0.5">${r.motivos.map(x => `<div>• ${esc(x)}</div>`).join('')}</div>`;
  }
  function salvarEdicao() {
    const a = editando && achar(editando); if (!a) return;
    const v = lerEdicao(a); if (!v.alimentos) { showToast('Descreva os alimentos da refeição.'); return; }
    Object.assign(a.m, { hora: v.hora, alimentos: v.alimentos, kcal: v.kcal, prot: v.prot, carb: v.carb, gord: v.gord, origem: 'manual', fonte: 'Editada por você', ck: undefined, registrada: false });
    a.m.vermelha = M.analisarTexto(v.alimentos).vermelha; a.m.travada = true; // editada fica travada para não se perder ao gerar de novo
    recalcularDia(a.dia); $('#modal-cd-editar').close(); saveCloud(); render(); showToast('Refeição atualizada (travada para não mudar ao gerar de novo).');
  }

  function travar(id) { const a = achar(id); if (!a) return; a.m.travada = !a.m.travada; saveCloud(); render(); }
  function registrar(id) {
    const a = achar(id); if (!a) return; const m = a.m;
    const fazer = () => {
      const reg = { id: 'r_' + Date.now() + Math.random().toString(36).slice(2, 5), data: a.dia.data, refeicao: slotNome(m.slot), alimentos: m.alimentos, calorias: m.kcal, proteinas: m.prot, carboidratos: m.carb, gorduras: m.gord, agua: 0, obs: 'Do cardápio da semana' };
      state.registros.push(reg); m.registrada = true; saveCloud(); refreshAll(); render(); showToast('Refeição registrada no Diário.');
    };
    if (m.registrada) { showToast('Esta refeição já foi registrada.'); return; }
    if (a.dia.data > hojeLocal()) customConfirm('Registrar refeição futura?', `Esta refeição é de ${dataBR(a.dia.data)}. Registrar agora conta nas médias do Diário.`, fazer, 'Registrar', 'bg-emerald-600 hover:bg-emerald-700 text-white');
    else fazer();
  }

  // ---------- eventos ----------
  function ligar() {
    $('#cd-gerar').addEventListener('click', () => gerar(false));
    $('#cd-objetivo').addEventListener('change', e => { cfg().objetivo = e.target.value; saveCloud(); renderAjustes(); });
    $('#cd-periodo').addEventListener('change', e => { cfg().periodo = e.target.value; saveCloud(); });
    $('#cd-treino').addEventListener('click', e => { const b = e.target.closest('[data-dow]'); if (!b) return; const c = cfg(), d = Number(b.dataset.dow); c.treinoDow = c.treinoDow.includes(d) ? c.treinoDow.filter(x => x !== d) : [...c.treinoDow, d].sort((x, y) => x - y); saveCloud(); renderAjustes(); });
    $('#cd-slots').addEventListener('change', e => { const c = cfg(); if (e.target.dataset.slot) c.slotsOn[e.target.dataset.slot] = e.target.checked; if (e.target.dataset.hora) c.horarios[e.target.dataset.hora] = e.target.value || c.horarios[e.target.dataset.hora]; saveCloud(); });
    $('#cd-dias').addEventListener('click', e => { const b = e.target.closest('[data-dia]'); if (!b) return; diaSel = Number(b.dataset.dia); render(); });
    $('#cd-dia').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b) return; const id = b.dataset.id; ({ trocar: () => abrirTrocar(id), editar: () => abrirEditar(id), travar: () => travar(id), registrar: () => registrar(id) })[b.dataset.act](); });
    $('#cd-trocar-lista').addEventListener('click', e => { const b = e.target.closest('[data-alt]'); if (b) aplicarTroca(Number(b.dataset.alt)); });
    $('#cd-trocar-embaralhar').addEventListener('click', () => trocando && abrirTrocar(trocando.id, true));
    $('#cd-trocar-fechar').addEventListener('click', () => $('#modal-cd-trocar').close());
    ['#cd-ed-hora', '#cd-ed-alimentos', '#cd-ed-kcal', '#cd-ed-prot', '#cd-ed-carb', '#cd-ed-gord'].forEach(s => $(s).addEventListener('input', previaEdicao));
    $('#cd-ed-salvar').addEventListener('click', salvarEdicao);
    $('#cd-ed-cancelar').addEventListener('click', () => $('#modal-cd-editar').close());
  }
  ligar();
  function abrir() { M.prepararPools(state.registros || [], hojeLocal()); render(); }
  return { abrir, render, gerar };
})();
