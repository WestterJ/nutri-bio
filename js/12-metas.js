// 12-metas.js — Aba Metas: formulário, salvar e sugestão de metas pelo objetivo
"use strict";

  function carregarMetasForm() {
    $('#meta-peso').value = state.metas.peso || 78.8;
    $('#meta-calorias').value = state.metas.calorias;
    $('#meta-proteinas').value = state.metas.proteinas;
    $('#meta-carboidratos').value = state.metas.carboidratos;
    $('#meta-gorduras').value = state.metas.gorduras;
    $('#meta-agua').value = state.metas.agua;
    $('#meta-objetivo').value = state.metas.objetivo || 'manutencao'; $('#sugestao-metas').classList.add('hidden');
    const oauthTokenField = $('#config-oauth-token');
    if (oauthTokenField) oauthTokenField.value = cloudToken;
    const googleClientField = $('#config-google-client-id');
    if (googleClientField) googleClientField.value = googleClientId;
    if ($('#config-supabase-url')) $('#config-supabase-url').value = supabaseConfig.url;
    if ($('#config-supabase-key')) $('#config-supabase-key').value = supabaseConfig.key;
    if (location.protocol === 'file:') {
      const help = $('#google-oauth-help');
      if (help) { help.classList.remove('hidden'); help.innerHTML = '<strong>Limitação do arquivo local:</strong> o login OAuth do Google não funciona com este HTML aberto diretamente pelo gerenciador de arquivos. Publique-o em HTTPS e cadastre a origem autorizada no Google Cloud.'; }
    }
  }
  
  $('#form-metas').onsubmit = e => {
    e.preventDefault();
    state.metas = {
      peso: parseFloat($('#meta-peso').value)||78.8,
      calorias: parseFloat($('#meta-calorias').value)||2000,
      proteinas: parseFloat($('#meta-proteinas').value)||160,
      carboidratos: parseFloat($('#meta-carboidratos').value)||200,
      gorduras: parseFloat($('#meta-gorduras').value)||65,
      agua: parseFloat($('#meta-agua').value)||3000,
      objetivo: $('#meta-objetivo').value || 'manutencao'
    };
    saveCloud(); showToast("Metas salvas!"); renderKPIs();
  };


  $('#btn-sugerir-metas').onclick = () => {
    garantirEstadoV34();
    const box = $('#sugestao-metas'); box.classList.remove('hidden');
    const bio = [...state.bio].filter(x => Number(x.tmb) > 0).sort((a, c) => String(c.data).localeCompare(String(a.data)))[0];
    if (!bio) { box.textContent = 'Registre uma bioimpedância com TMB para gerar a sugestão.'; return; }
    const l = new Date(); l.setDate(l.getDate() - 27);
    const ini = `${l.getFullYear()}-${pad(l.getMonth() + 1)}-${pad(l.getDate())}`;
    const porSemana = state.treinos.filter(t => t.data >= ini).length / 4;
    const fator = porSemana >= 6 ? 1.725 : porSemana >= 4 ? 1.55 : porSemana >= 2 ? 1.375 : 1.2;
    const gasto = Number(bio.tmb) * fator, obj = $('#meta-objetivo').value, peso = pesoReferencia();
    const ajuste = { manutencao: 1, perda: 0.85, ganho: 1.08, recomposicao: 0.95 }[obj] || 1;
    const cal = Math.round(Math.max(gasto * ajuste, Number(bio.tmb)) / 10) * 10; // nunca abaixo da TMB
    const prot = Math.round(peso * (obj === 'manutencao' ? 1.6 : 2)), gord = Math.round(peso * 0.8);
    const carb = Math.max(0, Math.round((cal - prot * 4 - gord * 9) / 4));
    box.innerHTML = `Gasto estimado ≈ <b>${fmtNum(Math.round(gasto))} kcal</b> (TMB ${fmtNum(bio.tmb)} × ${fator}; ${fmtNum(Math.round(porSemana * 10) / 10)} treinos/semana).<br>Sugestão: <b>${cal} kcal</b> · proteína ${prot} g · carboidratos ${carb} g · gorduras ${gord} g.<br><button type="button" id="btn-aplicar-sugestao" class="mt-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold">Aplicar no formulário</button> <span class="text-slate-500">São estimativas; confirme com seu nutricionista. Depois toque em Salvar Metas.</span>`;
    $('#btn-aplicar-sugestao').onclick = () => { $('#meta-calorias').value = cal; $('#meta-proteinas').value = prot; $('#meta-carboidratos').value = carb; $('#meta-gorduras').value = gord; showToast('Valores aplicados. Toque em Salvar Metas.'); };
  };
