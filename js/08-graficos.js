// 08-graficos.js — Aba Gráficos (Chart.js)
"use strict";

  let pesoChart = null, musculoChart = null, calChart = null, tmbChart = null;
  function renderGraficos() {
    const bioOrd = [...state.bio].sort((a,b) => new Date(a.data) - new Date(b.data));
    const labelsBio = bioOrd.map(b => fmtDataBr(b.data.split("T")[0]));

    if (pesoChart) pesoChart.destroy();
    pesoChart = new Chart($('#chart-peso').getContext('2d'), {
      type: 'line',
      data: {
        labels: labelsBio,
        datasets: [
          { label: 'Peso (kg)', data: bioOrd.map(b => b.peso), borderColor: corGraf('#003a70'), tension: 0.2 },
          { label: 'Gordura (kg)', data: bioOrd.map(b => b.massaGord), borderColor: corGraf('#d13a46'), tension: 0.2 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    if (musculoChart) musculoChart.destroy();
    musculoChart = new Chart($('#chart-musculo').getContext('2d'), {
      type: 'line',
      data: {
        labels: labelsBio,
        datasets: [
          { label: 'Massa Muscular (kg)', data: bioOrd.map(b => b.massaMusc), borderColor: corGraf('#2e9e4f'), tension: 0.2 },
          { label: 'Água (L)', data: bioOrd.map(b => b.agua), borderColor: corGraf('#0a5cad'), tension: 0.2 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    const mesesMap = {};
    state.registros.forEach(r => {
      if (!r.data) return;
      const m = r.data.slice(0, 7);
      if (!mesesMap[m]) mesesMap[m] = { cal: [], prot: [] };
      mesesMap[m].cal.push(Number(r.calorias) || 0);
      mesesMap[m].prot.push(Number(r.proteinas) || 0);
    });
    const mesesKeys = Object.keys(mesesMap).sort();
    const medCal = mesesKeys.map(mk => Math.round(mesesMap[mk].cal.reduce((a,b)=>a+b,0)/mesesMap[mk].cal.length));
    const medProt = mesesKeys.map(mk => Math.round(mesesMap[mk].prot.reduce((a,b)=>a+b,0)/mesesMap[mk].prot.length));

    if (calChart) calChart.destroy();
    calChart = new Chart($('#chart-calorias').getContext('2d'), {
      type: 'bar',
      data: {
        labels: mesesKeys.map(mk => { const [a,m]=mk.split("-"); return `${m}/${a}`; }),
        datasets: [
          { label: 'Calorias (kcal)', data: medCal, backgroundColor: corGraf('#ffc20e') },
          { label: 'Proteínas (g)', data: medProt, backgroundColor: corGraf('#2e9e4f') }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    if (tmbChart) tmbChart.destroy();
    tmbChart = new Chart($('#chart-tmb').getContext('2d'), {
      type: 'line',
      data: {
        labels: labelsBio,
        datasets: [{ label: 'TMB (kcal)', data: bioOrd.map(b => b.tmb), borderColor: corGraf('#e0a800'), fill: true, backgroundColor: corGraf('#fff8e6'), tension: 0.2 }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
