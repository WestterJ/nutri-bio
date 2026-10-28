// 04-diario.js — Aba Diário: filtros, KPIs, tabela editável, modal de registro e salvamento
"use strict";

  // Refeição sem estimativa: tem alimentos descritos, mas sem calorias estimadas (mesmo critério da análise de IA).
  function semEstimativa(r) { return !(+r.calorias > 0) && String(r.alimentos || '').trim() !== ''; }

  // Dias (anteriores a hoje) com menos de 4 refeições lançadas.
  function refeicoesPorDia() { const c = {}; state.registros.forEach(r => { c[r.data] = (c[r.data] || 0) + 1; }); return c; }
  const diaIncompleto = (cont, data) => data < hojeLocal() && cont[data] < 4;
  // Próxima refeição do lançamento: segue Café da Manhã > Almoço > Lanche da Tarde > Jantar e escolhe a primeira que falta no dia.
  const ORDEM_REFEICOES = ['Café da Manhã', 'Almoço', 'Lanche da Tarde', 'Jantar'];
  function proximaRefeicao(data) {
    const feitas = new Set(state.registros.filter(r => r.data === data).map(r => r.refeicao));
    return ORDEM_REFEICOES.find(m => !feitas.has(m)) || 'Ceia';
  }

  // ignorarMarcadores = true: aplica só período e busca (usado nos contadores dos filtros).
  function getFilteredRegistros(ignorarMarcadores = false) {
    const tipo = $('#filtro-periodo').value;
    const busca = $('#busca-input').value.toLowerCase().trim();
    const hoje = hojeLocal();
    const anoAtual = new Date().getFullYear().toString();

    const soSemEstimativa = !ignorarMarcadores && $('#filtro-sem-estimativa').checked;
    const soPoucas = !ignorarMarcadores && $('#filtro-poucas-refeicoes').checked, cont = soPoucas ? refeicoesPorDia() : null;
    return state.registros.filter(r => {
      if (soSemEstimativa && !semEstimativa(r)) return false;
      if (soPoucas && !diaIncompleto(cont, r.data)) return false;
      if (busca) {
        const matchText = (r.alimentos + ' ' + r.refeicao + ' ' + r.obs + ' ' + r.data).toLowerCase();
        if (!matchText.includes(busca)) return false;
      }
      if (tipo === 'todos') return true;
      if (tipo === 'hoje') return r.data === hoje;
      if (tipo === 'semana') {
        const li = new Date(); li.setDate(li.getDate() - 6);
        const ini7 = `${li.getFullYear()}-${pad(li.getMonth()+1)}-${pad(li.getDate())}`;
        return r.data >= ini7 && r.data <= hoje;
      }
      if (tipo === 'mes') return r.data.slice(0, 7) === hoje.slice(0, 7);
      if (tipo === 'ano') return r.data.slice(0, 4) === anoAtual;
      if (tipo === 'personalizado') {
        const ini = $('#filtro-data-inicio').value;
        const fim = $('#filtro-data-fim').value;
        if (ini && r.data < ini) return false;
        if (fim && r.data > fim) return false;
      }
      return true;
    }).sort((a, b) => {
      const dateA = new Date(a.data).getTime();
      const dateB = new Date(b.data).getTime();
      if (dateA !== dateB) return dateB - dateA;
      const orderA = ordemRefeicao[a.refeicao] || 99; 
      const orderB = ordemRefeicao[b.refeicao] || 99;
      return orderA - orderB;
    });
  }

  $('#filtro-periodo').addEventListener('change', (e) => {
    const box = $('#box-datas-personalizadas');
    if (e.target.value === 'personalizado') box.classList.remove('hidden');
    else box.classList.add('hidden');
    refreshAll();
  });

  $('#busca-input').addEventListener('input', () => refreshAll());
  $('#filtro-sem-estimativa').addEventListener('change', () => refreshAll());
  $('#filtro-poucas-refeicoes').addEventListener('change', () => refreshAll());
  $('#filtro-data-inicio').addEventListener('change', () => refreshAll());
  $('#filtro-data-fim').addEventListener('change', () => refreshAll());

  function renderKPIs() {
    const filtered = getFilteredRegistros();
    const totalReg = filtered.length;
    const uniqueDates = new Set(filtered.map(r => r.data));
    const totalDays = Math.max(1, uniqueDates.size);

    const totalCal = filtered.reduce((acc, r) => acc + (Number(r.calorias) || 0), 0);
    const mediaCal = Math.round(totalCal / totalDays);
    const totalAgua = filtered.reduce((acc, r) => acc + (Number(r.agua) || 0), 0);
    const mediaAgua = Math.round(totalAgua / totalDays);
    const mediaPro = Math.round(filtered.reduce((acc, r) => acc + (Number(r.proteinas) || 0), 0) / totalDays);

    $('#kpi-cards').innerHTML = `
      <div class="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm border-l-4 border-l-[#003a70]">
        <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Lançamentos no Período</span>
        <div class="text-2xl font-bold text-slate-800 mt-1">${totalReg}</div>
        <span class="text-xs text-emerald-600 font-medium">Refeições registradas</span>
      </div>
      <div class="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm border-l-4 border-l-[#ffc20e]">
        <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Média Calorias / Dia</span>
        <div class="text-2xl font-bold text-slate-800 mt-1">${mediaCal} <span class="text-sm font-normal text-slate-500">kcal</span></div>
        <span class="text-xs text-amber-600 font-medium">Meta: ${state.metas.calorias} kcal/dia</span>
      </div>
      <div class="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm border-l-4 border-l-[#0a5cad]">
        <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Média Proteínas / Dia</span>
        <div class="text-2xl font-bold text-slate-800 mt-1">${mediaPro} <span class="text-sm font-normal text-slate-500">g</span></div>
        <span class="text-xs text-sky-700 font-medium">Meta: ${state.metas.proteinas} g/dia</span>
      </div>
      <div class="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm border-l-4 border-l-blue-600">
        <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Média Água / Dia</span>
        <div class="text-2xl font-bold text-slate-800 mt-1">${mediaAgua} <span class="text-sm font-normal text-slate-500">ml</span></div>
        <span class="text-xs text-blue-600 font-medium">Meta: ${state.metas.agua} ml/dia</span>
      </div>
    `;
    $('#contador-registros').textContent = `${totalReg} registros exibidos`;
  }

  window.salvarCelulaDiario = function(id, campo, val) {
    const r = state.registros.find(x => x.id === id);
    if (!r) return;
    const txt = String(val).trim();
    if (campo === 'data') {
      const m = txt.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : (/^\d{4}-\d{2}-\d{2}$/.test(txt) ? txt : '');
      const dt = iso ? new Date(iso + 'T00:00:00') : null;
      if (!dt || isNaN(dt) || dt.getDate() !== Number(iso.slice(8))) { showToast('Data inválida. Use dd/mm/aaaa.'); refreshAll(); return; }
      r.data = iso;
    } else if (['calorias','proteinas','carboidratos','gorduras','agua'].includes(campo)) r[campo] = Math.max(0, parseFloat(txt.replace(',', '.')) || 0);
    else r[campo] = txt;
    saveCloud(); refreshAll();
  };

  function renderTableDiario() {
    const tbody = $('#table-body');
    const filtered = getFilteredRegistros();
    // V39.1: contadores respeitam o período e a busca selecionados.
    { const doPeriodo = getFilteredRegistros(true), c = refeicoesPorDia();
      $('#contador-sem-estimativa').textContent = doPeriodo.filter(semEstimativa).length;
      $('#contador-poucas-refeicoes').textContent = new Set(doPeriodo.map(r => r.data).filter(d => diaIncompleto(c, d))).size; }

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center py-12 text-slate-400">${$('#filtro-poucas-refeicoes').checked ? 'Nenhum dia com menos de 4 refeições neste período. 🎉' : $('#filtro-sem-estimativa').checked ? 'Nenhuma refeição sem estimativa neste período. 🎉' : 'Nenhum registro encontrado no período.'}</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(r => `
      <tr class="hover:bg-slate-50 transition group">
        <td class="p-3 font-medium text-slate-700 whitespace-nowrap editable-cell" contenteditable="true" onblur="window.salvarCelulaDiario('${r.id}', 'data', this.textContent)">${fmtDataBr(r.data)}</td>
        <td class="p-3 font-semibold text-emerald-700 whitespace-nowrap">
          <select class="bg-transparent border border-transparent hover:border-slate-300 focus:border-[#0a5cad] focus:bg-white rounded px-1.5 py-1 text-emerald-700 font-semibold cursor-pointer outline-none" onchange="window.salvarCelulaDiario('${r.id}', 'refeicao', this.value)">
            ${refeicoesPadrao.map(ref => `<option value="${ref}" ${r.refeicao === ref ? 'selected' : ''}>${ref}</option>`).join('')}
          </select>
        </td>
        <td class="p-3 text-slate-600 max-w-xs editable-cell" contenteditable="true" onblur="window.salvarCelulaDiario('${r.id}', 'alimentos', this.textContent)">${esc(r.alimentos)}</td>
        <td class="p-3 text-center font-bold text-slate-700 editable-cell" contenteditable="true" onblur="window.salvarCelulaDiario('${r.id}', 'calorias', this.textContent)">${fmtNum(r.calorias)}</td>
        <td class="p-3 text-center text-sky-700 font-medium editable-cell" contenteditable="true" onblur="window.salvarCelulaDiario('${r.id}', 'proteinas', this.textContent)">${fmtNum(r.proteinas)}</td>
        <td class="p-3 text-center text-amber-700 font-medium editable-cell" contenteditable="true" onblur="window.salvarCelulaDiario('${r.id}', 'carboidratos', this.textContent)">${fmtNum(r.carboidratos)}</td>
        <td class="p-3 text-center text-rose-700 font-medium editable-cell" contenteditable="true" onblur="window.salvarCelulaDiario('${r.id}', 'gorduras', this.textContent)">${fmtNum(r.gorduras)}</td>
        <td class="p-3 text-center text-blue-600 editable-cell" contenteditable="true" onblur="window.salvarCelulaDiario('${r.id}', 'agua', this.textContent)">${fmtNum(r.agua)}</td>
        <td class="p-3 text-slate-500 text-xs italic editable-cell" contenteditable="true" onblur="window.salvarCelulaDiario('${r.id}', 'obs', this.textContent)">${esc(r.obs || '-')}</td>
        <td class="p-3 text-center whitespace-nowrap">
          <button class="text-xs bg-sky-50 hover:bg-sky-100 text-sky-700 px-2 py-1 rounded-md font-medium transition mr-1" onclick="window.copiarRegistro('${r.id}')" title="Copiar p/ Hoje">Copiar</button>
          <button class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-md font-medium transition mr-1" onclick="window.editarRegistro('${r.id}')">Editar</button>
          <button class="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded-md font-medium transition" onclick="window.excluirRegistro('${r.id}')">Excluir</button>
        </td>
      </tr>
    `).join('');
  }

  const modalReg = $('#modal-registro');
  window.abrirModalNovo = function() {
    $('#modal-title').textContent = 'Novo Registro Alimentar';
    $('#reg-id').value = '';
    $('#reg-data').value = hojeLocal();
    $('#reg-refeicao').value = proximaRefeicao($('#reg-data').value);
    modalReg.dataset.auto = '1';
    $('#reg-alimentos').value = ''; $('#reg-calorias').value = '';
    $('#reg-proteinas').value = ''; $('#reg-carboidratos').value = '';
    $('#reg-gorduras').value = ''; $('#reg-agua').value = ''; $('#reg-obs').value = '';
    modalReg.showModal();
  };

  window.editarRegistro = function(id) {
    const r = state.registros.find(x => x.id === id);
    if (!r) return;
    $('#modal-title').textContent = 'Editar Registro Alimentar';
    $('#reg-id').value = r.id; 
    $('#reg-data').value = r.data || '';
    $('#reg-refeicao').value = r.refeicao || 'Almoço'; 
    $('#reg-alimentos').value = r.alimentos || '';
    $('#reg-calorias').value = r.calorias ?? ''; 
    $('#reg-proteinas').value = r.proteinas ?? '';
    $('#reg-carboidratos').value = r.carboidratos ?? ''; 
    $('#reg-gorduras').value = r.gorduras ?? '';
    $('#reg-agua').value = r.agua ?? ''; 
    $('#reg-obs').value = r.obs || '';
    modalReg.showModal();
  };

  window.copiarRegistro = function(id) {
    const r = state.registros.find(x => x.id === id);
    if (!r) return;
    $('#modal-title').textContent = 'Copiar Registro (Nova Refeição)';
    $('#reg-id').value = ''; 
    $('#reg-data').value = hojeLocal();
    $('#reg-refeicao').value = r.refeicao || 'Almoço';
    $('#reg-alimentos').value = r.alimentos || '';
    $('#reg-calorias').value = r.calorias ?? ''; 
    $('#reg-proteinas').value = r.proteinas ?? '';
    $('#reg-carboidratos').value = r.carboidratos ?? ''; 
    $('#reg-gorduras').value = r.gorduras ?? '';
    $('#reg-agua').value = r.agua ?? ''; 
    $('#reg-obs').value = (r.obs ? r.obs + " (Cópia)" : "");
    modalReg.showModal();
    showToast("Refeição copiada!");
  };

  window.excluirRegistro = function(id) {
    customConfirm('Excluir Lançamento', 'Deseja excluir este registro?', () => {
      state.registros = state.registros.filter(x => x.id !== id);
      saveCloud(); refreshAll(); showToast("Registro excluído.");
    });
  };

  $('#modal-close').onclick = () => modalReg.close();
  $('#modal-cancel').onclick = () => modalReg.close();
  $('#btn-novo-registro').onclick = () => abrirModalNovo();
  // Novo lançamento: ao trocar a data, sugere a refeição que falta naquele dia (até o usuário escolher manualmente).
  $('#reg-data').addEventListener('change', () => { if (modalReg.dataset.auto === '1' && !$('#reg-id').value) $('#reg-refeicao').value = proximaRefeicao($('#reg-data').value); });
  $('#reg-refeicao').addEventListener('change', () => { delete modalReg.dataset.auto; });
  modalReg.addEventListener('close', () => { delete modalReg.dataset.auto; });

  $('#form-registro').onsubmit = e => {
    e.preventDefault();
    const id = $('#reg-id').value;
    const payload = {
      id: id || ('r_' + Date.now()), data: $('#reg-data').value,
      refeicao: $('#reg-refeicao').value, alimentos: $('#reg-alimentos').value.trim(),
      calorias: parseFloat($('#reg-calorias').value) || 0, proteinas: parseFloat($('#reg-proteinas').value) || 0,
      carboidratos: parseFloat($('#reg-carboidratos').value) || 0, gorduras: parseFloat($('#reg-gorduras').value) || 0,
      agua: parseFloat($('#reg-agua').value) || 0, obs: $('#reg-obs').value.trim()
    };
    if (id) {
      const idx = state.registros.findIndex(x => x.id === id);
      if (idx >= 0) state.registros[idx] = payload;
    } else { state.registros.push(payload); }
    modalReg.close(); saveCloud(); refreshAll(); showToast("Registro salvo!");
  };
