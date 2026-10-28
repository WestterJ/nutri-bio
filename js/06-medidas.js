// 06-medidas.js — Aba Medidas: tabela, modal e salvamento
"use strict";

  window.salvarCelulaMedida = function(id, campo, val) {
    const m = state.medidas.find(x => x.id === id);
    if (!m) return;
    if (campo === 'data') m.data = val;
    else if (['obs','braco','perna'].includes(campo)) m[campo] = val;
    else m[campo] = parseFloat(val) || 0;
    saveCloud(); renderMedidas();
  };

  function renderMedidas() {
    const tbody = $('#table-medidas-body');
    const sorted = [...state.medidas].sort((a,b) => new Date(b.data) - new Date(a.data));
    tbody.innerHTML = sorted.map(m => `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-3 editable-cell" contenteditable="true" onblur="window.salvarCelulaMedida('${m.id}', 'data', this.textContent)">${fmtDataBr(m.data)}</td>
        <td class="p-3 text-center font-bold editable-cell" contenteditable="true" onblur="window.salvarCelulaMedida('${m.id}', 'peso', this.textContent)">${fmtNum(m.peso)}</td>
        <td class="p-3 text-center editable-cell" contenteditable="true" onblur="window.salvarCelulaMedida('${m.id}', 'cintura', this.textContent)">${fmtNum(m.cintura)}</td>
        <td class="p-3 text-center editable-cell" contenteditable="true" onblur="window.salvarCelulaMedida('${m.id}', 'abdomen', this.textContent)">${fmtNum(m.abdomen)}</td>
        <td class="p-3 text-center editable-cell" contenteditable="true" onblur="window.salvarCelulaMedida('${m.id}', 'quadril', this.textContent)">${fmtNum(m.quadril)}</td>
        <td class="p-3 text-center editable-cell" contenteditable="true" onblur="window.salvarCelulaMedida('${m.id}', 'braco', this.textContent)">${esc(m.braco||'-')}</td>
        <td class="p-3 text-center editable-cell" contenteditable="true" onblur="window.salvarCelulaMedida('${m.id}', 'perna', this.textContent)">${esc(m.perna||'-')}</td>
        <td class="p-3 text-xs editable-cell" contenteditable="true" onblur="window.salvarCelulaMedida('${m.id}', 'obs', this.textContent)">${esc(m.obs||'-')}</td>
        <td class="p-3 text-center"><button class="text-xs bg-red-50 text-red-600 px-2 py-1 rounded" onclick="window.excluirMedida('${m.id}')">Excluir</button></td>
      </tr>
    `).join('');
  }

  const modalMed = $('#modal-medidas');
  $('#btn-nova-medida').onclick = () => {
    $('#med-id').value = ''; $('#med-data').value = hojeLocal();
    $('#med-peso').value = ''; $('#med-cintura').value = ''; $('#med-abdomen').value = '';
    $('#med-quadril').value = ''; $('#med-braco').value = ''; $('#med-perna').value = '';
    $('#med-obs').value = ''; modalMed.showModal();
  };
  window.excluirMedida = id => {
    state.medidas = state.medidas.filter(x => x.id !== id);
    saveCloud(); renderMedidas(); showToast("Medida excluída.");
  };
  $('#modal-medidas-close').onclick = () => modalMed.close();
  $('#modal-medidas-cancel').onclick = () => modalMed.close();
  $('#form-medidas').onsubmit = e => {
    e.preventDefault();
    const id = $('#med-id').value;
    const payload = {
      id: id || ('m' + Date.now()), data: $('#med-data').value,
      peso: parseFloat($('#med-peso').value)||0, cintura: parseFloat($('#med-cintura').value)||0,
      abdomen: parseFloat($('#med-abdomen').value)||0, quadril: parseFloat($('#med-quadril').value)||0,
      braco: $('#med-braco').value.trim(), perna: $('#med-perna').value.trim(), obs: $('#med-obs').value.trim()
    };
    state.medidas.push(payload);
    saveCloud(); modalMed.close(); renderMedidas(); showToast("Medida salva!");
  };
