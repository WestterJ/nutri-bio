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
  function abrirTreino(id, copiar) {
    garantirEstadoV34();
    const t = id ? state.treinos.find(x => x.id === id) : null;
    $('#form-treino').reset();
    $('#tr-id').value = (t && !copiar) ? t.id : '';
    $('#tr-data').value = (t && !copiar) ? t.data : hojeLocal();
    $('#tr-tipo').value = t ? t.tipo : 'Musculação A';
    $('#tr-intens').value = t ? (t.intensidade || 'moderada') : 'moderada';
    $('#tr-min-musc').value = t ? t.minMusc : 40;
    $('#tr-cardio-tipo').value = t ? t.cardioTipo : 'Caminhada';
    $('#tr-min-cardio').value = t ? t.minCardio : 0;
    $('#tr-obs').value = t ? (copiar && t.obs ? (t.obs + ' (Cópia)').slice(0, 200) : (t.obs || '')) : '';
    trManualM = !!(t && t.manualMusc); trManualC = !!(t && t.manualCardio);
    if (t) { $('#tr-kcal-musc').value = t.kcalMusc; $('#tr-kcal-cardio').value = t.kcalCardio; $('#tr-kcal-info').textContent = (trManualM || trManualC) ? 'Há valores manuais (✎) neste treino.' : ''; atualizarTotalTreino(); } else recalcularKcalForm();
    $('#modal-treino-title').textContent = copiar ? 'Copiar treino (novo registro)' : (t ? 'Editar treino' : 'Registrar treino');
    modalTreino.showModal();
    if (copiar) showToast('Treino copiado para hoje. Ajuste e salve.');
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
  // ---------- V41: edição direta na tabela, botão Copiar e filtros (período e tipo de treino) ----------
  const TR_TIPOS = ['Musculação A', 'Musculação B', 'Musculação C', 'Musculação D', 'Musculação (geral)', 'Só cardio'];
  const TR_CARDIOS = ['Caminhada', 'Corrida / esteira', 'Bicicleta', 'Elíptico', 'Outro'];
  const TR_INTENS = [['leve', 'Leve'], ['moderada', 'Moderada'], ['intensa', 'Intensa']];

  function treinosFiltrados() {
    garantirEstadoV34();
    const per = $('#tr-filtro-periodo').value, tipo = $('#tr-filtro-tipo').value, hoje = hojeLocal();
    const dias = n => { const x = new Date(); x.setDate(x.getDate() - n + 1); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
    return state.treinos.filter(t => {
      if (tipo === '__cardio') { if (!temCardio(t)) return false; }
      else if (tipo !== 'todos' && t.tipo !== tipo) return false;
      if (per === 'hoje') return t.data === hoje;
      if (per === '7') return t.data >= dias(7) && t.data <= hoje;
      if (per === '30') return t.data >= dias(30) && t.data <= hoje;
      if (per === 'mes') return t.data.slice(0, 7) === hoje.slice(0, 7);
      if (per === 'ano') return t.data.slice(0, 4) === hoje.slice(0, 4);
      if (per === 'personalizado') {
        const ini = $('#tr-filtro-data-inicio').value, fim = $('#tr-filtro-data-fim').value;
        if (ini && t.data < ini) return false;
        if (fim && t.data > fim) return false;
      }
      return true;
    }).sort((a, b) => b.data.localeCompare(a.data));
  }
  $('#tr-filtro-periodo').addEventListener('change', e => { $('#tr-box-datas').classList.toggle('hidden', e.target.value !== 'personalizado'); renderTreinos(); });
  ['#tr-filtro-tipo', '#tr-filtro-data-inicio', '#tr-filtro-data-fim'].forEach(q => $(q).addEventListener('change', () => renderTreinos()));
  $('#tr-filtro-limpar').onclick = () => {
    $('#tr-filtro-periodo').value = 'todos'; $('#tr-filtro-tipo').value = 'todos';
    $('#tr-filtro-data-inicio').value = ''; $('#tr-filtro-data-fim').value = ''; $('#tr-box-datas').classList.add('hidden');
    renderTreinos();
  };

  // Valor exibido de cada célula editável (usado para restaurar o texto quando a edição é rejeitada ou não muda nada).
  function textoCelulaTreino(t, campo) {
    if (campo === 'data') return fmtDataBr(t.data);
    if (campo === 'obs') return t.obs || '';
    return fmtNum(t[campo]);
  }
  window.salvarCelulaTreino = function (id, campo, el) {
    garantirEstadoV34();
    const t = state.treinos.find(x => x.id === id); if (!t) return;
    const txt = String(el.tagName === 'SELECT' ? el.value : el.textContent).trim();
    const novo = { ...t };
    const num = () => Math.max(0, parseFloat(txt.replace(',', '.')) || 0);
    if (campo === 'data') {
      const m = txt.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : (/^\d{4}-\d{2}-\d{2}$/.test(txt) ? txt : '');
      const dt = iso ? new Date(iso + 'T00:00:00') : null;
      if (!dt || isNaN(dt) || dt.getDate() !== Number(iso.slice(8))) { showToast('Data inválida. Use dd/mm/aaaa.'); el.textContent = textoCelulaTreino(t, 'data'); return; }
      novo.data = iso;
    } else if (campo === 'tipo') {
      novo.tipo = txt;
      if (txt === 'Só cardio') novo.minMusc = 0; else if (!novo.minMusc) novo.minMusc = 40;
    } else if (campo === 'intensidade' || campo === 'cardioTipo') novo[campo] = txt;
    else if (campo === 'minMusc' || campo === 'minCardio') novo[campo] = Math.round(num());
    else if (campo === 'kcalMusc') { novo.kcalMusc = Math.round(num()); novo.manualMusc = true; }
    else if (campo === 'kcalCardio') { novo.kcalCardio = Math.round(num()); novo.manualCardio = true; }
    else if (campo === 'obs') novo.obs = txt.slice(0, 200);
    else return;
    // Mudou algo que entra na estimativa: recalcula os blocos que não foram informados manualmente.
    if (['tipo', 'intensidade', 'cardioTipo', 'minMusc', 'minCardio'].includes(campo)) {
      const k = kcalPorBloco(novo);
      if (!novo.manualMusc) novo.kcalMusc = k.musc;
      if (!novo.manualCardio) novo.kcalCardio = k.cardio;
    }
    novo.kcal = novo.kcalMusc + novo.kcalCardio;
    if (!novo.minMusc && !temCardio(novo)) { showToast('Informe o tempo de musculação ou de cardio.'); renderTreinos(); return; }
    if (JSON.stringify(novo) === JSON.stringify(t)) { if (el.tagName !== 'SELECT') el.textContent = textoCelulaTreino(t, campo); return; }
    Object.assign(t, novo);
    saveCloud(); renderTreinos();
  };
  // Enter confirma a edição da célula (Shift+Enter não é necessário: observações têm uma linha só).
  $('#tbody-treinos').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.isContentEditable) { e.preventDefault(); e.target.blur(); }
  });
  $('#tbody-treinos').addEventListener('click', e => {
    const b = e.target.closest('button[data-id]'); if (!b) return;
    const id = b.dataset.id;
    if (b.classList.contains('tr-edit')) abrirTreino(id);
    else if (b.classList.contains('tr-copy')) abrirTreino(id, true);
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

    const rows = treinosFiltrados();
    const totMin = rows.reduce((a, t) => a + t.minMusc + t.minCardio, 0), totKcal = rows.reduce((a, t) => a + t.kcal, 0);
    $('#tr-contador').textContent = `${rows.length} ${rows.length === 1 ? 'treino exibido' : 'treinos exibidos'} · ${fmtNum(totMin)} min · ${fmtNum(totKcal)} kcal`;

    const opts = (lista, atual) => (lista.includes(atual) ? lista : [...lista, atual]).map(o => `<option value="${esc(o)}"${o === atual ? ' selected' : ''}>${esc(o)}</option>`).join('');
    const selCls = 'bg-transparent border border-transparent hover:border-slate-300 focus:border-[#0a5cad] focus:bg-white rounded px-1.5 py-1 cursor-pointer outline-none text-sm';
    const sel = (t, campo, html) => `<select class="${selCls}" onchange="window.salvarCelulaTreino('${esc(t.id)}','${campo}',this)">${html}</select>`;
    const cel = (t, campo, txt, cls = '') => `<td class="p-3 editable-cell ${cls}" contenteditable="true" onblur="window.salvarCelulaTreino('${esc(t.id)}','${campo}',this)">${txt}</td>`;
    const vazio = ($('#tr-filtro-tipo').value !== 'todos' || $('#tr-filtro-periodo').value !== 'todos') && state.treinos.length ? 'Nenhum treino com esses filtros.' : 'Nenhum treino registrado.';
    $('#tbody-treinos').innerHTML = rows.length ? rows.map(t => {
      const intens = t.intensidade || 'moderada';
      const opIntens = TR_INTENS.map(([v, r]) => `<option value="${v}"${v === intens ? ' selected' : ''}>${r}</option>`).join('');
      return `<tr class="border-b border-slate-100 hover:bg-slate-50">`
        + cel(t, 'data', esc(fmtDataBr(t.data)), 'whitespace-nowrap')
        + `<td class="p-2">${sel(t, 'tipo', opts(TR_TIPOS, t.tipo))}</td>`
        + `<td class="p-2">${sel(t, 'intensidade', opIntens)}</td>`
        + cel(t, 'minMusc', fmtNum(t.minMusc), 'text-center')
        + `<td class="p-2">${sel(t, 'cardioTipo', opts(TR_CARDIOS, t.cardioTipo))}</td>`
        + cel(t, 'minCardio', fmtNum(t.minCardio), 'text-center' + (temCardio(t) && !t.minCardio ? ' bg-amber-50' : ''))
        + cel(t, 'kcalMusc', fmtNum(t.kcalMusc), 'text-center' + (t.manualMusc ? ' text-amber-700 font-semibold' : ''))
        + cel(t, 'kcalCardio', fmtNum(t.kcalCardio), 'text-center' + (t.manualCardio ? ' text-amber-700 font-semibold' : ''))
        + `<td class="p-3 whitespace-nowrap text-center font-bold text-slate-800" title="${(t.manualMusc || t.manualCardio) ? 'Contém valores manuais (✎)' : 'Estimado'}">${(t.manualMusc || t.manualCardio) ? '✎ ' : '~'}${fmtNum(t.kcal)}</td>`
        + cel(t, 'obs', esc(t.obs || ''), 'text-xs text-slate-500 italic min-w-[120px]')
        + `<td class="p-3 whitespace-nowrap"><button type="button" class="tr-copy text-xs bg-sky-50 hover:bg-sky-100 text-sky-700 px-2 py-1 rounded-md font-medium mr-1" data-id="${esc(t.id)}" title="Copiar para hoje">Copiar</button><button type="button" class="tr-edit text-sky-700 text-xs font-bold mr-2" data-id="${esc(t.id)}">Editar</button><button type="button" class="tr-del text-red-600 text-xs font-bold" data-id="${esc(t.id)}">Excluir</button></td></tr>`;
    }).join('') : `<tr><td colspan="11" class="p-6 text-center text-slate-500 text-sm">${vazio}</td></tr>`;
  }
