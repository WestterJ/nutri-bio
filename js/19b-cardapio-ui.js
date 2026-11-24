// 19b-cardapio-ui.js — aba "Cardápio da semana" (V51; V52: itens e quantidades, pré-treino opcional, remover/adicionar refeição).
"use strict";

window.CardapioUI = (function () {
  const M = window.CardapioMotor;
  const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const OBJ = { ganho: 'Ganho de massa', perda: 'Perda de peso', manutencao: 'Manutenção', recomposicao: 'Recomposição corporal' };
  const fmt = n => Math.round(Number(n) || 0).toLocaleString('pt-BR');
  const dataBR = s => { const d = M.parseData(s); return `${DOW[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };
  let diaSel = 0, trocando = null, ed = null;

  // ---------- configuração e estado ----------
  function cfgPadrao() {
    const hoje = hojeLocal(), ini = M.somaDias(hoje, -56), cont = [0, 0, 0, 0, 0, 0, 0];
    (state.treinos || []).forEach(t => { if (String(t.data) >= ini && String(t.data) <= hoje) cont[M.dow(t.data)]++; });
    const ordem = [1, 2, 3, 4, 5, 6, 0].sort((a, b) => cont[b] - cont[a] || [1, 2, 3, 4, 5, 6, 0].indexOf(a) - [1, 2, 3, 4, 5, 6, 0].indexOf(b));
    return {
      objetivo: (state.metas && state.metas.objetivo) || 'manutencao', periodo: 'hoje',
      slotsOn: { cafe: true, lancheM: false, almoco: true, lancheT: true, jantar: true, pre: true },
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
  function ctxDoDia(dia, extraSlot) {
    const p = plano(), ativos = dia.refeicoes.map(m => m.slot);
    if (extraSlot && !ativos.includes(extraSlot)) ativos.push(extraSlot);
    return { objetivo: p.objetivo, alvos: M.alvosDoDia(state.metas || {}, ativos.length ? ativos : ['almoco']) };
  }
  function recalcular(m, dia) {
    const r = M.pontuar(m, ctxDoDia(dia));
    m.score = r.score; m.partes = r.partes; m.motivos = r.motivos; m.vermelha = r.vermelha || (m.origem === 'plano' && !!m.vermelha) || !!(m.itens && M.macrosItens(m.itens).vermelha);
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
      + `<div class="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50"><label class="flex items-center gap-2 flex-1 text-sm"><input type="checkbox" data-slot="pre" ${c.slotsOn.pre !== false ? 'checked' : ''} class="h-5 w-5"> <span>Pré-Treino <small class="text-slate-500">(só nos dias de treino marcados acima)</small></span></label><input type="time" data-hora="pre" value="${esc(c.horarios.pre || '18:00')}" class="text-sm border border-slate-300 rounded-lg px-2 py-1 min-h-[40px]"></div>`;
  }

  function cartaoRefeicao(m) {
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
      </div>
      <div class="text-right"><button type="button" data-act="remover" data-id="${esc(m.id)}" class="text-xs text-red-700 underline min-h-[44px] px-2">Remover refeição</button></div></article>`;
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
    $('#cd-dia').innerHTML = dia.refeicoes.map(m => cartaoRefeicao(m)).join('')
      + `<button type="button" data-add-dia="${diaSel}" class="cd-btn w-full">+ Adicionar refeição neste dia</button>`
      + `<div class="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2"><div class="flex items-center justify-between"><b class="text-sm">Total do dia</b>${badge(r.score)}</div>
        <div class="text-xs"><div class="flex justify-between"><span>${fmt(r.kcal)} kcal</span><span>${r.pctK}% da meta</span></div>${barra(r.pctK, 'bg-amber-400')}</div>
        <div class="text-xs"><div class="flex justify-between"><span>${fmt(r.prot)} g de proteína</span><span>${r.pctP}% da meta</span></div>${barra(r.pctP, 'bg-sky-500')}</div>
        <div class="text-[11px] text-slate-500">Carboidratos ${fmt(r.carb)} g · Gorduras ${fmt(r.gord)} g · média das refeições ${r.mediaRefeicoes}. O score do dia mistura a média das refeições (50%), as calorias (25%) e a proteína (25%).</div></div>`;
  }

  // ---------- gerar ----------
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

  // ---------- trocar / adicionar ----------
  function listarAlternativas(embaralhar) {
    const p = plano(); if (!p || !trocando) return;
    M.prepararPools(state.registros, hojeLocal());
    const rnd = embaralhar ? M.mulberry32(Date.now() & 0x7fffffff) : null;
    let dia, slot, excl = null, verm;
    if (trocando.modo === 'adicionar') { dia = p.dias[trocando.idxDia]; slot = $('#cd-trocar-slot').value; trocando.slot = slot; verm = p.dias.reduce((n, d) => n + d.refeicoes.filter(x => x.vermelha).length, 0); }
    else { const a = achar(trocando.id); if (!a) return; dia = a.dia; slot = a.m.slot; excl = a.m.ck; verm = p.dias.reduce((n, d) => n + d.refeicoes.filter(x => x.vermelha && x.id !== trocando.id).length, 0); }
    const alts = M.alternativas(slot, ctxDoDia(dia, trocando.modo === 'adicionar' ? slot : null), excl, 8, rnd);
    trocando.alts = alts;
    $('#cd-trocar-lista').innerHTML = alts.map((x, i) => `<button type="button" data-alt="${i}" class="w-full text-left border border-slate-200 rounded-xl p-3 space-y-1 hover:bg-slate-50 min-h-[44px]"><div class="flex items-start justify-between gap-2"><span class="text-[11px] text-slate-500">${esc(x.c.fonte || '')}</span>${badge(x.p.score)}</div><div class="text-sm text-slate-800 break-words">${esc(x.c.alimentos)}</div><div class="text-xs text-slate-600">${fmt(x.c.kcal)} kcal · P ${fmt(x.c.prot)} g · C ${fmt(x.c.carb)} g · G ${fmt(x.c.gord)} g${x.c.vermelha && verm >= 2 ? ' · <span class="text-amber-700">já há 2 carnes vermelhas na semana</span>' : ''}</div></button>`).join('') || '<p class="text-sm text-slate-500">Sem alternativas para esta refeição.</p>';
  }
  function abrirTrocar(id) {
    const a = achar(id); if (!a) return;
    trocando = { modo: 'trocar', id };
    $('#cd-trocar-titulo').textContent = `Trocar ${slotNome(a.m.slot)} · ${dataBR(a.dia.data)}`;
    $('#cd-trocar-slot-box').classList.add('hidden'); $('#cd-trocar-ajuda').textContent = 'As melhores opções para esta refeição, ordenadas pelo score. Toque em uma para trocar.';
    listarAlternativas(false); $('#modal-cd-trocar').showModal();
  }
  function abrirAdicionar(idxDia) {
    const p = plano(), dia = p && p.dias[idxDia]; if (!dia) return;
    const faltam = M.SLOTS.filter(s => !dia.refeicoes.some(m => m.slot === s.id));
    if (!faltam.length) { showToast('Este dia já tem todas as refeições.'); return; }
    trocando = { modo: 'adicionar', idxDia };
    $('#cd-trocar-slot').innerHTML = faltam.map(s => `<option value="${s.id}">${esc(s.nome)}</option>`).join('');
    $('#cd-trocar-slot-box').classList.remove('hidden'); $('#cd-trocar-titulo').textContent = `Adicionar refeição · ${dataBR(dia.data)}`;
    $('#cd-trocar-ajuda').textContent = 'Escolha a refeição e toque em uma opção. A refeição adicionada fica travada (não muda ao gerar de novo).';
    listarAlternativas(false); $('#modal-cd-trocar').showModal();
  }
  function aplicarEscolha(i) {
    const x = trocando && trocando.alts && trocando.alts[i]; if (!x) return;
    const copia = { alimentos: x.c.alimentos, itens: x.c.itens ? x.c.itens.map(it => ({ id: it.id, q: it.q })) : undefined, kcal: Math.round(x.c.kcal), prot: Math.round(x.c.prot), carb: Math.round(x.c.carb), gord: Math.round(x.c.gord), origem: x.c.origem, fonte: x.c.fonte, ck: x.c.ck, vermelha: !!x.c.vermelha, registrada: false };
    if (trocando.modo === 'adicionar') {
      const p = plano(), dia = p.dias[trocando.idxDia], slot = trocando.slot, c = cfg();
      dia.refeicoes.push(Object.assign({ id: `${dia.data}-${slot}`, slot, hora: c.horarios[slot] || (M.SLOT_POR_ID[slot] || {}).hora }, copia, { travada: true }));
      p.removidas = (p.removidas || []).filter(k => k !== dia.data + '|' + slot);
      recalcularDia(dia); $('#modal-cd-trocar').close(); saveCloud(); render(); showToast('Refeição adicionada.');
      return;
    }
    const a = achar(trocando.id); if (!a) return;
    Object.assign(a.m, copia, { travada: false });
    recalcular(a.m, a.dia); $('#modal-cd-trocar').close(); saveCloud(); render(); showToast('Refeição trocada.');
  }

  // ---------- remover ----------
  function remover(id) {
    const a = achar(id); if (!a) return; const p = plano(), pos = a.dia.refeicoes.indexOf(a.m), chave = a.dia.data + '|' + a.m.slot, antes = (p.removidas || []).includes(chave);
    a.dia.refeicoes.splice(pos, 1); p.removidas = p.removidas || []; if (!antes) p.removidas.push(chave);
    recalcularDia(a.dia); saveCloud(); render();
    showToastDesfazer('Refeição removida.', () => {
      if (a.dia.refeicoes.some(m => m.slot === a.m.slot)) return;
      a.dia.refeicoes.push(a.m); if (!antes) p.removidas = p.removidas.filter(k => k !== chave);
      recalcularDia(a.dia); saveCloud(); render(); showToast('Refeição de volta.');
    });
  }

  // ---------- editar (itens e quantidades ou manual) ----------
  function popularAdd() {
    $('#cd-ed-add').innerHTML = Object.keys(M.GRUPOS).map(g => `<optgroup label="${esc(M.GRUPOS[g])}">${Object.keys(M.CAT).filter(id => M.CAT[id][1] === g).map(id => { const c = M.catInfo(id); return `<option value="${id}">${esc(c.nome)} · ${esc(c.un)}</option>`; }).join('')}</optgroup>`).join('');
  }
  function abrirEditar(id) {
    const a = achar(id); if (!a) return; const m = a.m;
    ed = { id, modo: (m.itens && m.itens.length) ? 'itens' : 'manual', itens: (m.itens || []).filter(it => M.CAT[it.id]).map(it => ({ id: it.id, q: it.q })) };
    $('#cd-ed-titulo').textContent = `Editar ${slotNome(m.slot)} · ${dataBR(a.dia.data)}`;
    $('#cd-ed-hora').value = m.hora || ''; $('#cd-ed-alimentos').value = m.alimentos || '';
    $('#cd-ed-kcal').value = m.kcal; $('#cd-ed-prot').value = m.prot; $('#cd-ed-carb').value = m.carb; $('#cd-ed-gord').value = m.gord;
    popularAdd(); renderEditor(); $('#modal-cd-editar').showModal();
  }
  function renderItens() {
    $('#cd-ed-itens').innerHTML = ed.itens.length ? ed.itens.map((it, i) => { const c = M.catInfo(it.id); return `<div class="cd-item" data-i="${i}"><div class="min-w-0 text-sm"><div class="font-semibold break-words">${esc(c.nome)}</div><div class="text-[11px] text-slate-500"><span class="cd-k">${fmt(M.macrosItens([it]).kcal)}</span> kcal</div></div><div class="flex items-center gap-1"><input type="number" inputmode="decimal" min="0" step="${c.passo}" value="${it.q}" data-q="${i}" class="w-20 px-2 py-2 border border-slate-300 rounded-lg text-sm min-h-[44px]" aria-label="Quantidade de ${esc(c.nome)}"><span class="text-xs text-slate-600">${esc(c.un)}</span></div><button type="button" data-rm="${i}" class="cd-btn px-3" aria-label="Remover ${esc(c.nome)}">✕</button></div>`; }).join('') : '<p class="text-sm text-slate-500">Nenhum item. Escolha um alimento abaixo e toque em “+ Adicionar”, ou use o modo Manual.</p>';
  }
  function renderEditor() {
    const itens = ed.modo === 'itens';
    $('#cd-ed-painel-itens').classList.toggle('hidden', !itens); $('#cd-ed-painel-manual').classList.toggle('hidden', itens);
    $('#cd-ed-modo-itens').setAttribute('aria-pressed', String(itens)); $('#cd-ed-modo-manual').setAttribute('aria-pressed', String(!itens));
    if (itens) renderItens();
    atualizarTotais();
  }
  function valores() {
    if (ed.modo === 'itens') { const m = M.macrosItens(ed.itens.filter(it => Number(it.q) > 0)); return { alimentos: M.textoItens(ed.itens), kcal: Math.round(m.kcal), prot: Math.round(m.prot), carb: Math.round(m.carb), gord: Math.round(m.gord) }; }
    return { alimentos: $('#cd-ed-alimentos').value.trim(), kcal: Number($('#cd-ed-kcal').value) || 0, prot: Number($('#cd-ed-prot').value) || 0, carb: Number($('#cd-ed-carb').value) || 0, gord: Number($('#cd-ed-gord').value) || 0 };
  }
  function lerEdicao(a) { const v = valores(); return { id: a.m.id, slot: a.m.slot, hora: $('#cd-ed-hora').value || a.m.hora, alimentos: v.alimentos, kcal: v.kcal, prot: v.prot, carb: v.carb, gord: v.gord, origem: 'manual' }; }
  function atualizarTotais() {
    const a = ed && achar(ed.id); if (!a) return; const v = lerEdicao(a);
    $('#cd-ed-total').innerHTML = `Total: <b>${fmt(v.kcal)}</b> kcal · P <b>${fmt(v.prot)}</b> g · C <b>${fmt(v.carb)}</b> g · G <b>${fmt(v.gord)}</b> g`;
    const r = M.pontuar(v, ctxDoDia(a.dia));
    $('#cd-ed-previa').innerHTML = `${badge(r.score)} <span class="text-xs text-slate-500">Calorias ${r.partes.calorias}/35 · Proteína ${r.partes.proteina}/30 · Qualidade ${r.partes.qualidade}/20 · Plano ${r.partes.plano}/15</span><div class="text-xs text-slate-600 mt-1 space-y-0.5">${r.motivos.map(x => `<div>• ${esc(x)}</div>`).join('')}</div>`;
  }
  function trocarModo(novo) {
    if (!ed || ed.modo === novo) return;
    if (novo === 'manual') { const v = valores(); $('#cd-ed-alimentos').value = v.alimentos; $('#cd-ed-kcal').value = v.kcal; $('#cd-ed-prot').value = v.prot; $('#cd-ed-carb').value = v.carb; $('#cd-ed-gord').value = v.gord; }
    ed.modo = novo; renderEditor();
  }
  function salvarEdicao() {
    const a = ed && achar(ed.id); if (!a) return;
    const v = lerEdicao(a);
    if (ed.modo === 'itens' && !ed.itens.some(it => Number(it.q) > 0)) { showToast('Adicione pelo menos um item com quantidade maior que zero.'); return; }
    if (!v.alimentos) { showToast('Descreva os alimentos da refeição.'); return; }
    const itens = ed.modo === 'itens' ? ed.itens.filter(it => Number(it.q) > 0).map(it => ({ id: it.id, q: Number(it.q) })) : undefined;
    Object.assign(a.m, { hora: v.hora, alimentos: v.alimentos, itens, kcal: v.kcal, prot: v.prot, carb: v.carb, gord: v.gord, origem: 'manual', fonte: 'Editada por você', ck: undefined, registrada: false });
    a.m.vermelha = ed.modo === 'itens' ? M.macrosItens(itens).vermelha : M.analisarTexto(v.alimentos).vermelha; a.m.travada = true; // editada fica travada para não se perder ao gerar de novo
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
    $('#cd-dia').addEventListener('click', e => {
      const add = e.target.closest('[data-add-dia]'); if (add) { abrirAdicionar(Number(add.dataset.addDia)); return; }
      const b = e.target.closest('[data-act]'); if (!b) return; const id = b.dataset.id;
      ({ trocar: () => abrirTrocar(id), editar: () => abrirEditar(id), travar: () => travar(id), registrar: () => registrar(id), remover: () => remover(id) })[b.dataset.act]();
    });
    $('#cd-trocar-lista').addEventListener('click', e => { const b = e.target.closest('[data-alt]'); if (b) aplicarEscolha(Number(b.dataset.alt)); });
    $('#cd-trocar-slot').addEventListener('change', () => listarAlternativas(false));
    $('#cd-trocar-embaralhar').addEventListener('click', () => listarAlternativas(true));
    $('#cd-trocar-fechar').addEventListener('click', () => $('#modal-cd-trocar').close());
    ['#cd-ed-hora', '#cd-ed-alimentos', '#cd-ed-kcal', '#cd-ed-prot', '#cd-ed-carb', '#cd-ed-gord'].forEach(s => $(s).addEventListener('input', atualizarTotais));
    $('#cd-ed-modo-itens').addEventListener('click', () => trocarModo('itens')); $('#cd-ed-modo-manual').addEventListener('click', () => trocarModo('manual'));
    $('#cd-ed-add-btn').addEventListener('click', () => { const id = $('#cd-ed-add').value; if (!M.CAT[id]) return; const ja = ed.itens.find(it => it.id === id); if (ja) ja.q = Math.round((Number(ja.q) + M.catInfo(id).padrao) * 100) / 100; else ed.itens.push({ id, q: M.catInfo(id).padrao }); renderEditor(); });
    $('#cd-ed-itens').addEventListener('input', e => { const i = e.target.dataset.q; if (i === undefined) return; ed.itens[Number(i)].q = Number(e.target.value) || 0; const k = e.target.closest('.cd-item').querySelector('.cd-k'); if (k) k.textContent = fmt(M.macrosItens([ed.itens[Number(i)]]).kcal); atualizarTotais(); });
    $('#cd-ed-itens').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (!b) return; ed.itens.splice(Number(b.dataset.rm), 1); renderEditor(); });
    $('#cd-ed-salvar').addEventListener('click', salvarEdicao);
    $('#cd-ed-cancelar').addEventListener('click', () => $('#modal-cd-editar').close());
  }
  ligar();
  function abrir() { M.prepararPools(state.registros || [], hojeLocal()); render(); }
  return { abrir, render, gerar };
})();
