// 19c-score-diario.js — V53: score (0 a 100) das refeições lançadas no Diário, com a mesma conta do Cardápio.
// Aparece na tabela do Diário, no formulário (recalculado ao digitar e quando Texto IA/Foto IA preenchem) e como média nos cartões do topo.
"use strict";
(function () {
  const COR = { 'Ótima': 'bg-emerald-100 text-emerald-800 border-emerald-300', 'Boa': 'bg-sky-100 text-sky-800 border-sky-300', 'Regular': 'bg-amber-100 text-amber-800 border-amber-300', 'Fraca': 'bg-red-100 text-red-800 border-red-300' };
  const slotsBase = () => {
    const on = (state.cardapio && state.cardapio.cfg && state.cardapio.cfg.slotsOn) || { cafe: true, almoco: true, lancheT: true, jantar: true };
    const lista = ['cafe', 'lancheM', 'almoco', 'lancheT', 'jantar'].filter(id => on[id]);
    return lista.length ? lista : undefined;
  };
  window.scoreRegistro = function (r) {
    const M = window.CardapioMotor; if (!M || !r) return null;
    try { return M.pontuarRegistro(r, state.metas || {}, (state.metas && state.metas.objetivo) || 'manutencao', slotsBase()); } catch (e) { console.warn('Score não calculado:', e); return null; }
  };
  window.scoreFaixa = s => window.CardapioMotor ? window.CardapioMotor.faixa(s) : '';
  window.scoreBadge = function (res) {
    if (!res) return '<span class="text-xs text-slate-400" title="Sem calorias estimadas, ou tipo de refeição sem score (Ceia)">—</span>';
    const f = window.scoreFaixa(res.score);
    return `<span class="inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap ${COR[f]}" title="${esc(res.motivos.join(' '))}">${res.score} · ${f}</span>`;
  };
  window.atualizarScoreRegistro = function () {
    const box = document.getElementById('reg-score'); if (!box) return;
    const n = id => parseFloat(document.getElementById(id).value) || 0;
    const r = { refeicao: $('#reg-refeicao').value, alimentos: $('#reg-alimentos').value, calorias: n('reg-calorias'), proteinas: n('reg-proteinas'), carboidratos: n('reg-carboidratos'), gorduras: n('reg-gorduras') };
    const res = window.scoreRegistro(r);
    if (!res) { box.innerHTML = `<span class="text-xs text-slate-500">${r.refeicao === 'Ceia' ? 'O score não se aplica à Ceia.' : 'O score aparece quando houver calorias estimadas (digite ou use Texto IA / Foto IA).'}</span>`; return; }
    const p = res.partes;
    box.innerHTML = `<div class="flex flex-wrap items-center gap-2"><b class="text-sm text-slate-800">Score da refeição</b>${window.scoreBadge(res)}<span class="text-[11px] text-slate-500">Calorias ${p.calorias}/35 · Proteína ${p.proteina}/30 · Qualidade ${p.qualidade}/20 · Plano ${p.plano}/15</span></div>
      <details class="text-xs text-slate-600 mt-1"><summary class="cursor-pointer font-semibold">Por quê?</summary><div class="mt-1 space-y-0.5">${res.motivos.map(x => `<div>• ${esc(x)}</div>`).join('')}</div></details>`;
  };
  ['#reg-refeicao', '#reg-alimentos', '#reg-calorias', '#reg-proteinas', '#reg-carboidratos', '#reg-gorduras'].forEach(s => {
    const e = document.querySelector(s); if (!e) return;
    e.addEventListener('input', window.atualizarScoreRegistro); e.addEventListener('change', window.atualizarScoreRegistro);
  });
  const dlg = document.getElementById('modal-registro');
  if (dlg) new MutationObserver(() => { if (dlg.open) window.atualizarScoreRegistro(); }).observe(dlg, { attributes: true, attributeFilter: ['open'] });
})();
