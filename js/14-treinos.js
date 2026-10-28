// 14-treinos.js — Aba Treinos: estimativa de kcal (MET), modal, tabela e resumo
"use strict";

  // --- V34: treinos e objetivo ---
  function garantirEstadoV34() {
    if (!state.metas) state.metas = { ...defaultMetas };
    if (!state.metas.objetivo) state.metas.objetivo = 'manutencao';
    if (!Array.isArray(state.treinos)) state.treinos = [];
    state.treinos = state.treinos.filter(t => t && /^\d{4}-\d{2}-\d{2}$/.test(String(t.data)));
    state.treinos.forEach(t => {
      t.minMusc = Number(t.minMusc) || 0; t.minCardio = Number(t.minCardio) || 0; t.kcal = Number(t.kcal) || 0;
      t.tipo = String(t.tipo || 'Treino'); t.cardioTipo = String(t.cardioTipo || 'Outro'); t.id = String(t.id || ('t' + Math.random().toString(36).slice(2)));
      if (t.kcalMusc === undefined || t.kcalCardio === undefined) { // treinos da V34 (kcal único): divide pela proporção estimada
        const k = kcalPorBloco(t), tot = k.musc + k.cardio;
        t.kcalMusc = tot ? Math.round(t.kcal * k.musc / tot) : (t.minMusc ? t.kcal : 0);
        t.kcalCardio = t.kcal - t.kcalMusc;
        t.manualMusc = t.manualCardio = !!t.manual;
      }
      t.kcalMusc = Number(t.kcalMusc) || 0; t.kcalCardio = Number(t.kcalCardio) || 0; t.kcal = t.kcalMusc + t.kcalCardio;
    });
  }
  // V40: há cardio quando houver tempo OU kcal de cardio (ex.: kcal informada manualmente sem os minutos).
  const temCardio = t => (Number(t.minCardio) || 0) > 0 || (Number(t.kcalCardio) || 0) > 0;
  function pesoReferencia() {
    const b = [...(state.bio || [])].filter(x => Number(x.peso) > 0).sort((a, c) => String(c.data).localeCompare(String(a.data)))[0];
    return b ? Number(b.peso) : Number(state.metas.peso) || 80;
  }
  function kcalPorBloco(t) {
    const MUSC = { leve: 3.5, moderada: 5, intensa: 6 };
    const CARD = { 'Caminhada': 3.8, 'Corrida / esteira': 9, 'Bicicleta': 7, 'Elíptico': 5, 'Outro': 5 };
    const m = (MUSC[t.intensidade] || 5) - 1, c = (CARD[t.cardioTipo] || 5) - 1, p = pesoReferencia(); // MET líquido: tira o repouso
    return { musc: Math.round(p * m * (Number(t.minMusc) || 0) / 60), cardio: Math.round(p * c * (Number(t.minCardio) || 0) / 60) };
  }
  const modalTreino = $('#modal-treino');
  let trManualM = false, trManualC = false;
  const lerFormTreino = () => ({ tipo: $('#tr-tipo').value, intensidade: $('#tr-intens').value, minMusc: Number($('#tr-min-musc').value) || 0, cardioTipo: $('#tr-cardio-tipo').value, minCardio: Number($('#tr-min-cardio').value) || 0 });
  function atualizarTotalTreino() { $('#tr-kcal-total').textContent = fmtNum((Number($('#tr-kcal-musc').value) || 0) + (Number($('#tr-kcal-cardio').value) || 0)); }
  function recalcularKcalForm() {
    const k = kcalPorBloco(lerFormTreino());
    if (!trManualM) $('#tr-kcal-musc').value = k.musc;
    if (!trManualC) $('#tr-kcal-cardio').value = k.cardio;
    $('#tr-kcal-info').textContent = `Estimativa com ${fmtNum(pesoReferencia())} kg (margem de 20–30%). Editar um campo o marca como manual.`;
    atualizarTotalTreino();
  }
  ['#tr-intens', '#tr-min-musc', '#tr-cardio-tipo', '#tr-min-cardio'].forEach(q => $(q).addEventListener('input', recalcularKcalForm));
  $('#tr-tipo').addEventListener('change', () => {
    if ($('#tr-tipo').value === 'Só cardio') $('#tr-min-musc').value = 0; else if (!Number($('#tr-min-musc').value)) $('#tr-min-musc').value = 40;
    recalcularKcalForm();
  });
  $('#tr-kcal-musc').addEventListener('input', () => { trManualM = true; atualizarTotalTreino(); });
  $('#tr-kcal-cardio').addEventListener('input', () => { trManualC = true; atualizarTotalTreino(); });
  $('#btn-tr-recalc').onclick = () => { trManualM = false; trManualC = false; recalcularKcalForm(); };
  function abrirTreino(id) {
    garantirEstadoV34();
    const t = id ? state.treinos.find(x => x.id === id) : null;
    $('#form-treino').reset();
    $('#tr-id').value = t ? t.id : '';
    $('#tr-data').value = t ? t.data : hojeLocal();
    $('#tr-tipo').value = t ? t.tipo : 'Musculação A';
    $('#tr-intens').value = t ? (t.intensidade || 'moderada') : 'moderada';
    $('#tr-min-musc').value = t ? t.minMusc : 40;
    $('#tr-cardio-tipo').value = t ? t.cardioTipo : 'Caminhada';
    $('#tr-min-cardio').value = t ? t.minCardio : 0;
    $('#tr-obs').value = t ? (t.obs || '') : '';
    trManualM = !!(t && t.manualMusc); trManualC = !!(t && t.manualCardio);
    if (t) { $('#tr-kcal-musc').value = t.kcalMusc; $('#tr-kcal-cardio').value = t.kcalCardio; $('#tr-kcal-info').textContent = (trManualM || trManualC) ? 'Há valores manuais (✎) neste treino.' : ''; atualizarTotalTreino(); } else recalcularKcalForm();
    $('#modal-treino-title').textContent = t ? 'Editar treino' : 'Registrar treino';
    modalTreino.showModal();
  }
  $('#btn-novo-treino').onclick = () => abrirTreino();
  $('#modal-treino-close').onclick = $('#modal-treino-cancel').onclick = () => modalTreino.close();
  $('#form-treino').onsubmit = e => {
    e.preventDefault(); garantirEstadoV34();
    const f = lerFormTreino();
    if (f.minMusc + f.minCardio <= 0) { showToast('Informe o tempo de musculação ou de cardio.'); return; }
    const id = $('#tr-id').value || ('t' + Date.now());
    const reg = { id, data: $('#tr-data').value, ...f, kcalMusc: Math.max(0, Math.round(Number($('#tr-kcal-musc').value) || 0)), kcalCardio: Math.max(0, Math.round(Number($('#tr-kcal-cardio').value) || 0)), manualMusc: trManualM, manualCardio: trManualC, obs: $('#tr-obs').value.trim().slice(0, 200) };
    reg.kcal = reg.kcalMusc + reg.kcalCardio;
    const gravar = () => {
      const i = state.treinos.findIndex(x => x.id === id);
      if (i >= 0) state.treinos[i] = reg; else state.treinos.push(reg);
      saveCloud(); renderTreinos(); modalTreino.close(); showToast('Treino salvo!');
    };
    // V40: kcal de cardio sem minutos deixa o tempo total incompleto — avisa antes de salvar.
    if (reg.kcalCardio > 0 && !reg.minCardio) {
      customConfirm('Cardio sem tempo', `Você informou ${fmtNum(reg.kcalCardio)} kcal de ${reg.cardioTipo.toLowerCase()}, mas não os minutos. O tempo total ficará sem o cardio. Salvar assim mesmo?`, gravar, 'Salvar assim', 'bg-amber-500 hover:bg-amber-600 text-slate-900');
      return;
    }
    gravar();
  };
  $('#tbody-treinos').addEventListener('click', e => {
    const b = e.target.closest('button[data-id]'); if (!b) return;
    const id = b.dataset.id;
    if (b.classList.contains('tr-edit')) abrirTreino(id);
    else customConfirm('Excluir treino', 'Excluir este treino?', () => { state.treinos = state.treinos.filter(t => t.id !== id); saveCloud(); renderTreinos(); showToast('Treino excluído.'); }, 'Excluir');
  });
  function renderTreinos() {
    garantirEstadoV34();
    const hoje = hojeLocal();
    const desde = d => { const x = new Date(); x.setDate(x.getDate() - d + 1); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
    const resumo = d => { const l = desde(d), s = state.treinos.filter(t => t.data >= l && t.data <= hoje); return { n: s.length, min: s.reduce((a, t) => a + t.minMusc + t.minCardio, 0), kcal: s.reduce((a, t) => a + t.kcal, 0) }; };
    const r7 = resumo(7), r30 = resumo(30);
    const card = (t, v, s) => `<div class="bg-white border border-slate-200 rounded-xl p-3 shadow-sm"><div class="text-[11px] text-slate-500 uppercase font-semibold">${t}</div><div class="text-xl font-bold text-slate-800">${v}</div><div class="text-[11px] text-slate-500">${s}</div></div>`;
    $('#treinos-resumo').innerHTML = card('Sessões (7 dias)', r7.n, `${fmtNum(r7.min)} min`) + card('Kcal (7 dias)', fmtNum(r7.kcal), 'estimadas') + card('Sessões (30 dias)', r30.n, `${fmtNum(r30.min)} min`) + card('Kcal por sessão', r30.n ? fmtNum(Math.round(r30.kcal / r30.n)) : '–', 'média de 30 dias');
    const rows = [...state.treinos].sort((a, b) => b.data.localeCompare(a.data));
    $('#tbody-treinos').innerHTML = rows.length ? rows.map(t => `<tr class="border-b border-slate-100"><td class="p-3 whitespace-nowrap">${esc(fmtDataBr(t.data))}</td><td class="p-3">${esc(t.tipo === 'Só cardio' && temCardio(t) ? t.cardioTipo : t.tipo)}${temCardio(t) && t.tipo !== 'Só cardio' ? ' + ' + esc(t.cardioTipo) : ''}${temCardio(t) && !t.minCardio ? ' <span class="text-[11px] text-amber-700 font-semibold">(tempo do cardio não informado)</span>' : ''}${t.obs ? `<div class="text-[11px] text-slate-500">${esc(t.obs)}</div>` : ''}</td><td class="p-3 whitespace-nowrap">${fmtNum(t.minMusc + t.minCardio)} min${t.minMusc && t.minCardio ? `<div class="text-[11px] text-slate-500">musc ${fmtNum(t.minMusc)} · cardio ${fmtNum(t.minCardio)}</div>` : ''}</td><td class="p-3 whitespace-nowrap font-semibold">${(t.manualMusc || t.manualCardio) ? '✎ ' : '~'}${fmtNum(t.kcal)}${t.kcalMusc && t.kcalCardio ? `<div class="text-[11px] font-normal text-slate-500">musc ${fmtNum(t.kcalMusc)} · cardio ${fmtNum(t.kcalCardio)}</div>` : ''}</td><td class="p-3 whitespace-nowrap"><button type="button" class="tr-edit text-sky-700 text-xs font-bold mr-2" data-id="${esc(t.id)}">Editar</button><button type="button" class="tr-del text-red-600 text-xs font-bold" data-id="${esc(t.id)}">Excluir</button></td></tr>`).join('') : '<tr><td colspan="5" class="p-6 text-center text-slate-500 text-sm">Nenhum treino registrado.</td></tr>';
  }
