// 15-navegacao.js — Navegação entre abas e refreshAll
"use strict";

  const tabs = {
    'btn-tab-diario': 'view-diario', 'btn-tab-metas-nutri': 'view-metas-nutri', 'btn-tab-medidas': 'view-medidas',
    'btn-tab-bio': 'view-bio', 'btn-tab-treinos': 'view-treinos', 'btn-tab-graficos': 'view-graficos',
    'btn-tab-relatorio': 'view-relatorio', 'btn-tab-metas': 'view-metas'
  };

  Object.keys(tabs).forEach(btnId => {
    $('#' + btnId).onclick = () => {
      Object.keys(tabs).forEach(b => {
        $('#' + b).className = "bg-white/10 hover:bg-white/20 text-white text-xs md:text-sm font-semibold px-3 py-2 rounded-lg transition shadow-sm";
        $('#' + tabs[b]).classList.add('hidden');
      });
      if (btnId === 'btn-tab-relatorio') {
        $('#' + btnId).className = "bg-[#ffc20e] text-slate-900 font-bold text-xs md:text-sm px-3 py-2 rounded-lg transition shadow-sm";
      } else {
        $('#' + btnId).className = "bg-[#0a5cad] text-white text-xs md:text-sm font-semibold px-3 py-2 rounded-lg transition shadow-sm";
      }
      $('#' + tabs[btnId]).classList.remove('hidden');

      if (btnId === 'btn-tab-graficos') renderGraficos();
      if (btnId === 'btn-tab-relatorio') { renderGraficos(); renderRelatorio(); carregarHistoricoAnalises(); }
      if (btnId === 'btn-tab-metas-nutri') carregarMetasForm();
      if (btnId === 'btn-tab-treinos') renderTreinos();
    };
  });

  function refreshAll() {
    garantirEstadoV34();
    renderTreinos();
    renderKPIs();
    renderTableDiario();
    renderMedidas();
    renderBio();
    renderGraficos();
    updateCloudStatusPill();
  }
