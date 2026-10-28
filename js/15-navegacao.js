// 15-navegacao.js — Menu lateral (V40), navegação entre abas e refreshAll
"use strict";

  const tabs = {
    'btn-tab-diario': 'view-diario', 'btn-tab-metas-nutri': 'view-metas-nutri', 'btn-tab-medidas': 'view-medidas',
    'btn-tab-bio': 'view-bio', 'btn-tab-treinos': 'view-treinos', 'btn-tab-graficos': 'view-graficos',
    'btn-tab-relatorio': 'view-relatorio', 'btn-tab-metas': 'view-metas'
  };

  function abrirAba(btnId) {
    Object.keys(tabs).forEach(b => {
      const ativo = b === btnId;
      $('#' + b).classList.toggle('active', ativo);
      if (ativo) $('#' + b).setAttribute('aria-current', 'page'); else $('#' + b).removeAttribute('aria-current');
      $('#' + tabs[b]).classList.toggle('hidden', !ativo);
    });
    fecharMenuMobile();
    window.scrollTo({ top: 0 });
    if (btnId === 'btn-tab-graficos') renderGraficos();
    if (btnId === 'btn-tab-relatorio') { renderGraficos(); renderRelatorio(); carregarHistoricoAnalises(); }
    if (btnId === 'btn-tab-metas-nutri') carregarMetasForm();
    if (btnId === 'btn-tab-treinos') renderTreinos();
  }
  Object.keys(tabs).forEach(btnId => { $('#' + btnId).onclick = () => abrirAba(btnId); });

  // Menu recolhível (desktop): a escolha fica salva neste aparelho.
  function sincronizarBotaoRecolher() {
    const rec = document.body.classList.contains('sidebar-collapsed');
    const b = $('#sidebar-toggle');
    b.setAttribute('aria-expanded', String(!rec));
    b.title = rec ? 'Expandir menu' : 'Recolher menu';
    b.querySelector('.nav-ico').textContent = rec ? '»' : '«';
    b.querySelector('.nav-label').textContent = rec ? 'Expandir menu' : 'Recolher menu';
  }
  $('#sidebar-toggle').onclick = () => {
    const rec = document.body.classList.toggle('sidebar-collapsed');
    try { localStorage.setItem('nutri_ui_sidebar', rec ? 'collapsed' : 'expanded'); } catch (_) {}
    sincronizarBotaoRecolher();
  };
  sincronizarBotaoRecolher();

  // Celular: o menu vira gaveta.
  function fecharMenuMobile() { document.body.classList.remove('sidebar-open'); $('#btn-menu-mobile').setAttribute('aria-expanded', 'false'); }
  $('#btn-menu-mobile').onclick = () => {
    const aberto = document.body.classList.toggle('sidebar-open');
    $('#btn-menu-mobile').setAttribute('aria-expanded', String(aberto));
  };
  $('#sidebar-backdrop').onclick = fecharMenuMobile;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('sidebar-open')) fecharMenuMobile(); });

  // Altura do cabeçalho para posicionar o menu fixo logo abaixo dele.
  function ajustarAlturaCabecalho() { const h = document.querySelector('.app-header'); if (h) document.documentElement.style.setProperty('--hdr-h', h.offsetHeight + 'px'); }
  window.addEventListener('resize', ajustarAlturaCabecalho);
  ajustarAlturaCabecalho();

  // "Novo lançamento" no menu e no botão flutuante: vai para o Diário e abre o formulário.
  const novoLancamento = () => { abrirAba('btn-tab-diario'); abrirModalNovo(); };
  $('#sidebar-novo').onclick = novoLancamento;
  $('#fab-novo').onclick = novoLancamento;

  function refreshAll() {
    garantirEstadoV34();
    renderTreinos();
    renderKPIs();
    renderTableDiario();
    renderMedidas();
    renderBio();
    renderGraficos();
    updateCloudStatusPill();
    ajustarAlturaCabecalho();
  }
