// 09-ia-analise.js — Análise de IA da alimentação por período e histórico (tabela ia_analises)
"use strict";

  // --- V36: análise de IA da alimentação ---
  const IA_ANALISE_PROMPT = 'Você é um assistente de nutrição que analisa um diário alimentar em português do Brasil. Os números já foram calculados pelo aplicativo: use-os como estão e não refaça contas. Considere o objetivo (manutenção, perda de peso, ganho de massa ou recomposição), as metas, os treinos e a evolução da bioimpedância. Seja específico e prático: cite números e alimentos reais do diário. Se houver poucos dias com registro (menos de 5) ou refeições sem estimativa, diga que a análise é limitada e priorize melhorar o registro. Não faça diagnóstico nem prescreva dietas restritivas; não sugira déficit calórico maior que cerca de 20% do gasto nem ingestão abaixo da TMB; para condições de saúde ou mudanças importantes, recomende nutricionista ou médico. Tom respeitoso e neutro, sem culpar. No máximo 4 itens por lista, frases curtas.';
  const IA_ANALISE_SCHEMA = { type: 'OBJECT', properties: { resumo: { type: 'STRING' }, qualidade_dados: { type: 'STRING' }, pontos_fortes: { type: 'ARRAY', items: { type: 'STRING' } }, pontos_atencao: { type: 'ARRAY', items: { type: 'STRING' } }, sugestoes: { type: 'ARRAY', items: { type: 'STRING' } }, meta_da_semana: { type: 'STRING' } }, required: ['resumo', 'qualidade_dados', 'pontos_fortes', 'pontos_atencao', 'sugestoes', 'meta_da_semana'] };
  function montarDadosAnalise(dias) {
    garantirEstadoV34();
    const ds = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const hojeS = hojeLocal(), ini = new Date(); ini.setDate(ini.getDate() - dias + 1); const iniS = ds(ini);
    const regs = state.registros.filter(r => r.data >= iniS && r.data <= hojeS);
    const dia = {};
    regs.forEach(r => { const d = dia[r.data] = dia[r.data] || { kcal: 0, prot: 0, carb: 0, gord: 0, agua: 0 }; d.kcal += +r.calorias || 0; d.prot += +r.proteinas || 0; d.carb += +r.carboidratos || 0; d.gord += +r.gorduras || 0; d.agua += +r.agua || 0; });
    const lista = Object.values(dia), comKcal = lista.filter(d => d.kcal > 0), m = state.metas;
    const med = (arr, k) => arr.length ? Math.round(arr.reduce((a, d) => a + d[k], 0) / arr.length) : 0;
    const pct = (arr, f) => arr.length ? Math.round(100 * arr.filter(f).length / arr.length) : 0;
    const refs = {};
    regs.filter(r => +r.calorias > 0).forEach(r => { const o = refs[r.refeicao] = refs[r.refeicao] || { n: 0, kcal: 0 }; o.n++; o.kcal += +r.calorias; });
    const porRefeicao = Object.fromEntries(Object.entries(refs).map(([k, o]) => [k, { registros: o.n, kcal_media: Math.round(o.kcal / o.n) }]));
    const amostra = [...regs].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 30).map(r => `${r.data} ${r.refeicao}: ${String(r.alimentos || '').slice(0, 110)} (${Math.round(+r.calorias || 0)} kcal, P${Math.round(+r.proteinas || 0)})`);
    const ts = state.treinos.filter(t => t.data >= iniS && t.data <= hojeS);
    const bios = [...state.bio].filter(b => +b.peso > 0 && +b.pgc > 0).sort((a, b) => String(a.data).localeCompare(String(b.data)));
    const fb = b => b ? { data: String(b.data).slice(0, 10), peso: +b.peso, massa_gorda: +b.massaGord, massa_musc: +b.massaMusc, pgc: +b.pgc } : null;
    const noPer = bios.filter(b => String(b.data).slice(0, 10) >= iniS);
    return {
      periodo_dias: dias, objetivo: m.objetivo, metas: { kcal: m.calorias, proteina_g: m.proteinas, carbo_g: m.carboidratos, gordura_g: m.gorduras, agua_ml: m.agua, peso_alvo_kg: m.peso },
      dias_com_registro: lista.length, dias_com_calorias: comKcal.length, refeicoes_total: regs.length,
      refeicoes_sem_estimativa: regs.filter(r => !(+r.calorias > 0) && String(r.alimentos || '').trim()).length,
      medias_por_dia: { kcal: med(comKcal, 'kcal'), proteina_g: med(comKcal, 'prot'), carbo_g: med(comKcal, 'carb'), gordura_g: med(comKcal, 'gord'), agua_ml: med(lista, 'agua') },
      aderencia_pct_dias: { kcal_dentro_de_10pct_da_meta: pct(comKcal, d => Math.abs(d.kcal - m.calorias) <= 0.1 * m.calorias), proteina_ao_menos_90pct: pct(comKcal, d => d.prot >= 0.9 * m.proteinas), agua_ao_menos_90pct: pct(lista, d => d.agua >= 0.9 * m.agua) },
      por_refeicao: porRefeicao,
      treinos: { sessoes: ts.length, por_semana: Math.round(10 * ts.length / (dias / 7)) / 10, minutos: ts.reduce((a, t) => a + t.minMusc + t.minCardio, 0), kcal_estimadas: ts.reduce((a, t) => a + t.kcal, 0) },
      bioimpedancia: { primeira_no_periodo: fb(noPer[0]), ultima: fb(bios[bios.length - 1]) },
      refeicoes_recentes: amostra
    };
  }
  function iaStatus(msg) { const el = $('#ia-analise-status'); el.textContent = msg || ''; el.classList.toggle('hidden', !msg); }
  function renderAnaliseIA(a, dados, quando) {
    const lista = (t, arr, cor) => Array.isArray(arr) && arr.length ? `<div><div class="text-xs font-bold ${cor} mb-1">${t}</div><ul class="list-disc pl-5 text-sm text-slate-700 space-y-1">${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
    const aviso = dados.refeicoes_sem_estimativa ? `<p class="text-xs bg-amber-50 border border-amber-200 rounded-lg p-2 text-amber-900">${dados.refeicoes_sem_estimativa} refeição(ões) sem calorias estimadas ficaram de fora das médias. Reabra-as e refaça a estimativa para uma análise mais fiel.</p>` : '';
    $('#ia-analise-resultado').innerHTML = `<div class="text-xs text-slate-500">Últimos ${dados.periodo_dias} dias · ${dados.dias_com_calorias} dia(s) com calorias · gerado em ${esc(new Date(quando || Date.now()).toLocaleString('pt-BR'))}</div>
      <p class="text-sm text-slate-800">${esc(a.resumo)}</p>${aviso}
      ${a.qualidade_dados ? `<p class="text-xs text-slate-500">${esc(a.qualidade_dados)}</p>` : ''}
      ${lista('Pontos fortes', a.pontos_fortes, 'text-emerald-700')}${lista('Pontos de atenção', a.pontos_atencao, 'text-amber-700')}${lista('Sugestões', a.sugestoes, 'text-sky-700')}
      ${a.meta_da_semana ? `<div class="bg-sky-50 border border-sky-200 rounded-lg p-3 text-sm"><b>Meta da semana:</b> ${esc(a.meta_da_semana)}</div>` : ''}`;
  }
  async function gerarAnaliseIA() {
    if (!supabaseClient || !supabaseUser) { showToast('Entre na sua conta para usar a IA.'); return; }
    const dados = montarDadosAnalise(Number($('#ia-periodo').value) || 30);
    if (!dados.dias_com_calorias) { showToast('Não há refeições com calorias estimadas neste período.'); return; }
    const btn = $('#btn-ia-analise'); btn.disabled = true; const pararRelogio = iaRelogio(iaStatus, 'Analisando o período com IA (pode levar até 1–2 min)...');
    try {
      const resp = await chamarNutriGemini({ modo: 'relatorio', systemInstruction: { parts: [{ text: IA_ANALISE_PROMPT }] }, contents: [{ role: 'user', parts: [{ text: 'Dados do diário (JSON):\n' + JSON.stringify(dados) }] }], generationConfig: { responseMimeType: 'application/json', responseSchema: IA_ANALISE_SCHEMA } }, { tipo: 'relatorio' });
      pararRelogio();
      const json = await resp.json();
      const txt = json?.candidates?.[0]?.content?.parts?.find(p => typeof p?.text === 'string')?.text;
      if (!txt) throw new Error('A IA não retornou conteúdo.');
      const a = JSON.parse(txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim());
      renderAnaliseIA(a, dados); iaStatus('');
      salvarAnaliseIA(a, dados);
    } catch (err) { iaStatus(''); showToast('Falha na análise: ' + (err.message || 'erro desconhecido')); }
    finally { pararRelogio(); btn.disabled = false; }
  }
  $('#btn-ia-analise').onclick = gerarAnaliseIA;

  // --- V37: histórico das análises de IA no Supabase (tabela ia_analises) ---
  let iaHistorico = [];
  async function salvarAnaliseIA(a, dados) {
    try {
      const { error } = await supabaseClient.from('ia_analises').insert({ user_id: supabaseUser.id, periodo_dias: dados.periodo_dias, resultado: a, dados, modelo: GEMINI_MODEL });
      if (error) throw error;
      carregarHistoricoAnalises();
    } catch (err) { console.error('Erro ao salvar análise:', err); showToast('A análise foi exibida, mas não foi salva no histórico: ' + (err.message || 'erro desconhecido')); }
  }
  async function carregarHistoricoAnalises() {
    const box = $('#ia-historico'); if (!box) return;
    if (!supabaseClient || !supabaseUser) { box.innerHTML = '<p class="text-xs text-slate-400">Entre na sua conta para ver o histórico.</p>'; return; }
    const { data, error } = await supabaseClient.from('ia_analises').select('id,created_at,periodo_dias,resultado,dados').eq('user_id', supabaseUser.id).order('created_at', { ascending: false }).limit(50);
    if (error) { box.innerHTML = '<p class="text-xs text-red-600">Não foi possível carregar o histórico (a tabela ia_analises existe no Supabase?).</p>'; return; }
    iaHistorico = data || [];
    if (!iaHistorico.length) { box.innerHTML = '<p class="text-xs text-slate-400">Nenhuma análise salva ainda.</p>'; return; }
    box.innerHTML = iaHistorico.map(h => `<div class="flex items-start gap-2 border border-slate-200 rounded-lg p-2">
      <button type="button" class="flex-1 text-left" onclick="window.abrirAnaliseIA('${h.id}')">
        <div class="text-xs font-semibold text-sky-800">${esc(new Date(h.created_at).toLocaleString('pt-BR'))} · últimos ${h.periodo_dias} dias</div>
        <div class="text-xs text-slate-600 line-clamp-2">${esc(h.resultado && h.resultado.resumo || '')}</div></button>
      <button type="button" class="text-xs text-red-600 px-2 py-1" aria-label="Excluir análise" onclick="window.excluirAnaliseIA('${h.id}')">🗑️</button></div>`).join('');
  }
  window.abrirAnaliseIA = id => {
    const h = iaHistorico.find(x => x.id === id); if (!h) return;
    renderAnaliseIA(h.resultado, h.dados, h.created_at);
    $('#ia-analise-resultado').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  window.excluirAnaliseIA = async id => {
    if (!confirm('Excluir esta análise do histórico?')) return;
    const { error } = await supabaseClient.from('ia_analises').delete().eq('id', id).eq('user_id', supabaseUser.id);
    if (error) { showToast('Falha ao excluir: ' + error.message); return; }
    carregarHistoricoAnalises();
  };
