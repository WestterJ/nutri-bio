// 10-relatorio.js — Aba Relatório: atividade física, KPIs, tabelas e gráficos do relatório
"use strict";

  // --- V35: relatório de atividade física ---
  function renderRelAtividade() {
    garantirEstadoV34();
    const dec = x => (Math.round(x * 10) / 10).toLocaleString('pt-BR');
    const ds = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const sel = $('#relatorio-periodo').value, dias = sel === 'todos' ? NaN : parseInt(sel, 10);
    const hoje = new Date(), hojeS = ds(hoje);
    const ini = new Date(); if (!isNaN(dias)) ini.setDate(ini.getDate() - dias);
    const iniS = isNaN(dias) ? '0000-00-00' : ds(ini);
    const ts = state.treinos.filter(t => t.data >= iniS && t.data <= hojeS);
    const box = $('#rel-atividade');
    if (!ts.length) { box.innerHTML = '<p class="text-sm text-slate-500">Nenhum treino registrado no período.</p>'; return; }
    const soma = f => ts.reduce((a, t) => a + f(t), 0);
    const n = ts.length, kcal = soma(t => t.kcal), minTot = soma(t => t.minMusc + t.minCardio), minCard = soma(t => t.minCardio);
    const primeira = ts.reduce((m, t) => t.data < m ? t.data : m, ts[0].data);
    const diasPer = isNaN(dias) ? Math.round((new Date(hojeS + 'T00:00:00') - new Date(primeira + 'T00:00:00')) / 864e5) + 1 : dias;
    const semanas = Math.max(1, diasPer / 7);
    const hm = m => m >= 60 ? `${Math.floor(m / 60)}h${pad(m % 60)}` : `${m} min`;
    const card = (t, v, s) => `<div class="bg-slate-50 p-3 rounded-lg border text-center"><span class="text-xs text-slate-500">${t}</span><div class="text-lg font-bold">${v}</div><div class="text-[11px] text-slate-500">${s}</div></div>`;
    const kpis = card('Sessões', n, `${new Set(ts.map(t => t.data)).size} dias treinados`) + card('Sessões / semana', dec(n / semanas), 'média do período') + card('Tempo total', hm(minTot), `cardio: ${hm(minCard)}`) + card('Kcal / sessão', fmtNum(Math.round(kcal / n)), 'média') + card('Kcal / semana', fmtNum(Math.round(kcal / semanas)), 'média');
    const seg = x => { const d = new Date(x + 'T00:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ds(d); };
    const nSem = Math.min(12, Math.ceil(diasPer / 7) + 1), cont = {};
    ts.forEach(t => { const k = seg(t.data); cont[k] = (cont[k] || 0) + 1; });
    const lista = [];
    for (let k = nSem - 1; k >= 0; k--) { const d = new Date(); d.setDate(d.getDate() - 7 * k); lista.push(seg(ds(d))); }
    const maxS = Math.max(1, ...lista.map(k => cont[k] || 0));
    // V40: barras horizontais com o intervalo da semana, semana atual destacada e linha da média.
    const mediaS = lista.reduce((a, k) => a + (cont[k] || 0), 0) / lista.length;
    const fimSem = k => { const d = new Date(k + 'T00:00:00'); d.setDate(d.getDate() + 6); return ds(d); };
    const semAtual = seg(hojeS);
    const barras = [...lista].reverse().map(k => { const v = cont[k] || 0, atual = k === semAtual;
      return `<div class="flex items-center gap-2 text-xs"><span class="w-28 whitespace-nowrap ${atual ? 'font-bold text-slate-800' : 'text-slate-500'}">${esc(fmtDataBr(k).slice(0, 5))}–${esc(fmtDataBr(fimSem(k)).slice(0, 5))}${atual ? ' ●' : ''}</span><div class="flex-1 bg-slate-100 rounded h-4 relative"><div class="h-4 rounded ${atual ? 'bg-[#ffc20e]' : 'bg-sky-600'}" style="width:${v / maxS * 100}%"></div><div class="absolute top-[-2px] bottom-[-2px] border-l-2 border-dashed border-slate-500" style="left:${mediaS / maxS * 100}%" title="média"></div></div><span class="w-6 text-right font-semibold">${v}</span></div>`; }).join('');
    const porTipo = {}; ts.forEach(t => { porTipo[t.tipo] = (porTipo[t.tipo] || 0) + 1; });
    const tipos = Object.entries(porTipo).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${esc(k)}: <strong>${v}</strong>`).join(' · ');
    const comCardio = ts.filter(t => t.minCardio > 0 || t.kcalCardio > 0).length, manuais = ts.filter(t => t.manualMusc || t.manualCardio).length;
    const agrupar = len => { const g = {}; ts.forEach(t => { const k = t.data.slice(0, len); (g[k] = g[k] || []).push(t); }); return Object.entries(g).sort((a, b) => b[0].localeCompare(a[0])); };
    const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const linha = (rot, arr, sem) => { const k = arr.reduce((a, t) => a + t.kcal, 0), m = arr.reduce((a, t) => a + t.minMusc + t.minCardio, 0); return `<tr><td class="p-2 border font-medium">${rot}</td><td class="p-2 border text-center">${arr.length}</td><td class="p-2 border text-center">${dec(arr.length / sem)}</td><td class="p-2 border text-center">${hm(m)}</td><td class="p-2 border text-center">${fmtNum(k)}</td><td class="p-2 border text-center">${fmtNum(Math.round(k / arr.length))}</td></tr>`; };
    const cab = r => `<table class="w-full text-left text-xs border-collapse"><thead class="bg-slate-100"><tr><th class="p-2 border">${r}</th><th class="p-2 border text-center">Sessões</th><th class="p-2 border text-center">Por semana</th><th class="p-2 border text-center">Tempo</th><th class="p-2 border text-center">Kcal</th><th class="p-2 border text-center">Kcal/sessão</th></tr></thead><tbody>`;
    const meses = agrupar(7).slice(0, 12).map(([k, arr]) => { const [y, m] = k.split('-').map(Number); const dm = (y === hoje.getFullYear() && m === hoje.getMonth() + 1) ? hoje.getDate() : new Date(y, m, 0).getDate(); return linha(`${MES[m - 1]}/${y}`, arr, Math.max(1, dm / 7)); }).join('');
    const anos = (isNaN(dias) || dias >= 365) ? agrupar(4).map(([y, arr]) => { const fim = Number(y) === hoje.getFullYear() ? Math.round((new Date(hojeS + 'T00:00:00') - new Date(y + '-01-01T00:00:00')) / 864e5) + 1 : (Number(y) % 4 === 0 ? 366 : 365); return linha(y, arr, Math.max(1, fim / 7)); }).join('') : '';
    box.innerHTML = `<div class="grid grid-cols-2 sm:grid-cols-5 gap-3">${kpis}</div>
      <p class="text-sm text-slate-600">Sessões por tipo: ${tipos}. Sessões com cardio: <strong>${comCardio}</strong>.</p>
      <div><div class="text-xs font-semibold text-slate-600 mb-1">Sessões por semana (últimas ${nSem} semanas, mais recente no topo) · <span class="font-normal text-slate-500">tracejado = média de ${dec(mediaS)}/semana · ● semana atual</span></div><div class="space-y-1" style="-webkit-print-color-adjust:exact;print-color-adjust:exact">${barras}</div></div>
      <div class="overflow-x-auto">${cab('Mês')}${meses}</tbody></table></div>
      ${anos ? `<div class="overflow-x-auto">${cab('Ano')}${anos}</tbody></table></div>` : ''}
      <p class="text-[11px] text-slate-500">Calorias estimadas por MET × peso, sem contar o repouso (margem de 20–30%).${manuais ? ` ${manuais} sessão(ões) com valores informados manualmente.` : ''}</p>`;
  }

  function renderRelatorio() {
    renderRelAtividade();
    renderGraficos(); // Assegura que os gráficos globais estão instanciados
    $('#rel-data-geracao').textContent = new Date().toLocaleDateString('pt-BR');
    const dias = $('#relatorio-periodo').value === 'todos' ? NaN : parseInt($('#relatorio-periodo').value, 10);
    // V40: mesmo critério do bloco de atividade física (datas AAAA-MM-DD, início e fim inclusivos, até hoje).
    const iniRel = new Date(); if (!isNaN(dias)) iniRel.setDate(iniRel.getDate() - dias);
    const iniRelS = isNaN(dias) ? '0000-00-00' : `${iniRel.getFullYear()}-${pad(iniRel.getMonth() + 1)}-${pad(iniRel.getDate())}`;
    const hojeRelS = hojeLocal();
    const filtered = state.registros.filter(r => r.data && r.data >= iniRelS && r.data <= hojeRelS);
    const count = filtered.length;
    const uniqueDays = new Set(filtered.map(r => r.data)).size || 1;
    const medCal = count ? Math.round(filtered.reduce((a,b) => a + (Number(b.calorias)||0),0)/uniqueDays) : 0;
    const medPro = count ? Math.round(filtered.reduce((a,b) => a + (Number(b.proteinas)||0),0)/uniqueDays) : 0;
    const medCarb = count ? Math.round(filtered.reduce((a,b) => a + (Number(b.carboidratos)||0),0)/uniqueDays) : 0;
    const medAgua = count ? Math.round(filtered.reduce((a,b) => a + (Number(b.agua)||0),0)/uniqueDays) : 0;

    $('#rel-kpis').innerHTML = `
      <div class="bg-slate-50 p-3 rounded-lg border text-center"><span class="text-xs text-slate-500">Calorias / Dia</span><div class="text-lg font-bold">${medCal} kcal</div></div>
      <div class="bg-slate-50 p-3 rounded-lg border text-center"><span class="text-xs text-slate-500">Proteínas / Dia</span><div class="text-lg font-bold text-sky-700">${medPro} g</div></div>
      <div class="bg-slate-50 p-3 rounded-lg border text-center"><span class="text-xs text-slate-500">Carboidratos / Dia</span><div class="text-lg font-bold text-amber-700">${medCarb} g</div></div>
      <div class="bg-slate-50 p-3 rounded-lg border text-center"><span class="text-xs text-slate-500">Água / Dia</span><div class="text-lg font-bold text-blue-700">${medAgua} ml</div></div>
    `;

    $('#rel-resumo-texto').innerHTML = `
      No período analisado, foram registradas <strong>${count} refeições</strong> em <strong>${uniqueDays} dias</strong>. 
      Média diária de consumo: <strong>${medCal} kcal</strong>, com <strong>${medPro}g</strong> de proteínas e <strong>${medAgua} ml</strong> de água. Meta de Peso Alvo: <strong>${state.metas.peso} kg</strong>.
    `;

    // V40: lista as refeições do período escolhido (antes: só as 15 mais recentes de todo o histórico),
    // do dia mais recente para o mais antigo e, dentro do dia, na ordem das refeições.
    const LIMITE_REF = 120;
    const ordemRef = ['Café da Manhã', 'Lanche da Manhã', 'Pré-Treino', 'Almoço', 'Pós-Treino', 'Lanche da Tarde', 'Jantar', 'Ceia'];
    const posRef = r => { const i = ordemRef.indexOf(r.refeicao); return i < 0 ? 99 : i; };
    const todasRef = [...filtered].sort((a, b) => b.data.localeCompare(a.data) || posRef(a) - posRef(b));
    const sortedRef = todasRef.slice(0, LIMITE_REF);
    const rotPeriodo = isNaN(dias) ? 'todo o período' : `últimos ${dias} dias (${fmtDataBr(iniRelS)} a ${fmtDataBr(hojeRelS)})`;
    $('#rel-titulo-refeicoes').textContent = `Refeições do Período — ${rotPeriodo}`;
    $('#rel-nota-refeicoes').textContent = todasRef.length > LIMITE_REF
      ? `Exibindo as ${LIMITE_REF} refeições mais recentes de ${todasRef.length} no período. Para ver todas, escolha um período menor.`
      : `${todasRef.length} refeição(ões) no período.`;
    $('#rel-tabela-refeicoes').innerHTML = sortedRef.length ? sortedRef.map(r => `
      <tr>
        <td class="p-2 border whitespace-nowrap">${fmtDataBr(r.data)}</td>
        <td class="p-2 border font-medium text-emerald-800">${esc(r.refeicao)}</td>
        <td class="p-2 border">${esc(r.alimentos)}</td>
        <td class="p-2 border text-center font-bold">${fmtNum(r.calorias)}</td>
        <td class="p-2 border text-center text-sky-700">${fmtNum(r.proteinas)}</td>
        <td class="p-2 border text-center text-amber-700">${fmtNum(r.carboidratos)}</td>
        <td class="p-2 border text-center text-rose-700">${fmtNum(r.gorduras)}</td>
      </tr>
    `).join('') : `<tr><td colspan="7" class="p-3 text-center text-slate-400">Nenhuma refeição registrada no período.</td></tr>`;

    const sortedBio = [...state.bio].sort((a,b) => new Date(b.data) - new Date(a.data));
    $('#rel-tabela-bio').innerHTML = sortedBio.length ? sortedBio.map(b => `
      <tr>
        <td class="p-2 border whitespace-nowrap">${fmtDataBr(b.data.split("T")[0])}</td>
        <td class="p-2 border text-center font-bold">${fmtNum(b.peso)} kg</td>
        <td class="p-2 border text-center">${fmtNum(b.massaMusc)} kg</td>
        <td class="p-2 border text-center">${fmtNum(b.massaGord)} kg</td>
        <td class="p-2 border text-center">${fmtNum(b.pgc)}%</td>
        <td class="p-2 border text-center">${fmtNum(b.gordVisc)}</td>
        <td class="p-2 border text-center">${fmtNum(b.tmb)} kcal</td>
      </tr>
    `).join('') : `<tr><td colspan="7" class="p-3 text-center text-slate-400">Nenhuma bioimpedância.</td></tr>`;

    // O canvas principal fica dentro de uma aba oculta e pode ter tamanho 0x0.
    // Os gráficos do relatório são renderizados diretamente em canvases próprios.
    $('#relatorio-preview-box').innerHTML = $('#relatorio-imprimivel').innerHTML;
    const bioOrdRel = [...state.bio].sort((a,b) => new Date(a.data) - new Date(b.data));
    const labelsRel = bioOrdRel.map(b => fmtDataBr(String(b.data || '').split('T')[0]));
    const mesesRel = {};
    filtered.forEach(r => { if (!r.data) return; const k=r.data.slice(0,7); if(!mesesRel[k]) mesesRel[k]={cal:[],prot:[]}; mesesRel[k].cal.push(Number(r.calorias)||0); mesesRel[k].prot.push(Number(r.proteinas)||0); });
    const mesesRelKeys = Object.keys(mesesRel).sort();
    const pesoData = bioOrdRel.map(b => Number(b.peso)||0);
    const calData = mesesRelKeys.map(k => Math.round(mesesRel[k].cal.reduce((a,b)=>a+b,0)/(mesesRel[k].cal.length||1)));
    const relConfigs = [
      {id:'rel-chart-peso-container', type:'line', labels:labelsRel, datasets:[{label:'Peso (kg)',data:pesoData,borderColor:'#003a70',tension:.2}]},
      {id:'rel-chart-calorias-container', type:'bar', labels:mesesRelKeys.map(k=>{const [y,m]=k.split('-');return `${m}/${y}`;}), datasets:[{label:'Calorias (kcal)',data:calData,backgroundColor:'#ffc20e'}]}
    ];
    relConfigs.forEach(cfg => {
      const containers = [$('#'+cfg.id), $('#relatorio-preview-box #'+cfg.id)];
      containers.forEach((container, idx) => {
        if (!container) return;
        container.innerHTML='';
        if (idx===0) return; // área imprimível: recebe só a imagem estática do gráfico visível (abaixo)
        const canvas=document.createElement('canvas'); canvas.style.width='100%'; canvas.style.height='180px';
        container.appendChild(canvas);
        new Chart(canvas.getContext('2d'), {type:cfg.type,data:{labels:cfg.labels,datasets:cfg.datasets.map(d=>({...d,data:[...d.data]}))},options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:true}},scales:{y:{beginAtZero:false}}}});
        // V35.1: imagem estática para a impressão, sem depender do evento beforeprint (que não dispara no Android)
        const gerarImagem = () => {
          const alvo = document.getElementById(cfg.id);
          if (!alvo || !canvas.isConnected || !canvas.width) return;
          let img = alvo.querySelector('img.rel-img-fixa');
          if (!img) { img = document.createElement('img'); img.className = 'rel-img-fixa'; img.alt = 'Gráfico do relatório'; alvo.appendChild(img); }
          img.src = canvas.toDataURL('image/png');
        };
        gerarImagem(); setTimeout(gerarImagem, 250);
      });
    });
  }

  $('#relatorio-periodo').onchange = renderRelatorio;
