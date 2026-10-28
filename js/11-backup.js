// 11-backup.js — Backup: restaurar padrão, importar e exportar JSON
"use strict";

  $('#btn-resetar').onclick = () => {
    customConfirm('Restaurar Padrões', 'Isso apagará todos os dados e retornará ao padrão. Continuar?', () => {
      state = { registros: [...initialRegistros], medidas: [...initialMedidas], bio: [...initialBio], metas: {...defaultMetas} };
      saveCloud(); refreshAll(); showToast("Restaurado.");
    });
  };

  $('#btn-importar-json').onclick = () => { $('#file-input-json').click(); };
  $('#file-input-json').onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const parsed = JSON.parse(evt.target.result);
        const idOk = x => x && (x.id == null || /^[\w-]+$/.test(String(x.id)));
        const lista = k => parsed[k] === undefined || (Array.isArray(parsed[k]) && parsed[k].every(idOk));
        const ok = parsed && Array.isArray(parsed.registros) && parsed.registros.every(r => idOk(r) && /^\d{4}-\d{2}-\d{2}$/.test(String(r.data || ''))) && lista('medidas') && lista('bio') && lista('treinos');
        if (!ok) { showToast('Arquivo inválido: confira registros, medidas, bio e datas (AAAA-MM-DD).'); return; }
        customConfirm('Importar backup', `Substituir os dados atuais por ${parsed.registros.length} registros do arquivo?`, () => {
          state = { registros: parsed.registros, medidas: parsed.medidas || [], bio: parsed.bio || [], treinos: parsed.treinos || [], metas: parsed.metas || defaultMetas };
          saveCloud(); refreshAll(); showToast('Backup importado!');
        }, 'Importar', 'bg-blue-700 hover:bg-blue-800 text-white');
      } catch(err) { showToast("Erro no arquivo."); }
      e.target.value = '';
    };
    reader.readAsText(f);
  };
  
  $('#btn-exportar-json').onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `diario_nutricional_${hojeLocal()}.json`;
    a.click(); URL.revokeObjectURL(url);
    showToast("Exportado.");
  };
