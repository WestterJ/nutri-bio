// 17-tema.js — Tema claro, escuro ou automático (segue o aparelho)
"use strict";

  const TEMA_KEY = 'nutri_tema';
  const TEMAS = ['auto', 'claro', 'escuro'];
  const TEMA_INFO = { auto: ['◐', 'Tema: automático'], claro: ['☀️', 'Tema: claro'], escuro: ['🌙', 'Tema: escuro'] };
  const mqTemaEscuro = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const temaEscolhido = () => { try { const t = localStorage.getItem(TEMA_KEY); return TEMAS.includes(t) ? t : 'auto'; } catch (e) { return 'auto'; } };
  const temaEscuroAtivo = () => document.documentElement.classList.contains('dark');
  // Cores dos gráficos: tons claros no tema escuro para manter contraste.
  const CORES_GRAF_ESCURO = { '#003a70': '#7cc0f5', '#0a5cad': '#5aa9ff', '#d13a46': '#f87171', '#2e9e4f': '#4ade80', '#e0a800': '#fbbf24', '#fff8e6': 'rgba(251,191,36,.18)' };
  function corGraf(c) { return temaEscuroAtivo() ? (CORES_GRAF_ESCURO[c] || c) : c; }

  function aplicarTema(redesenhar) {
    const t = temaEscolhido();
    const escuro = t === 'escuro' || (t === 'auto' && !!(mqTemaEscuro && mqTemaEscuro.matches));
    document.documentElement.classList.toggle('dark', escuro);
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', escuro ? '#0b1220' : '#0f766e');
    const b = $('#btn-tema');
    if (b) { b.textContent = TEMA_INFO[t][0]; b.title = TEMA_INFO[t][1]; b.setAttribute('aria-label', TEMA_INFO[t][1] + '. Toque para alternar.'); }
    if (window.Chart) { Chart.defaults.color = escuro ? '#cbd5e1' : '#475569'; Chart.defaults.borderColor = escuro ? 'rgba(148,163,184,.25)' : 'rgba(0,0,0,.1)'; }
    if (redesenhar) { try { if (typeof renderGraficos === 'function' && $('#chart-peso')) renderGraficos(); } catch (e) { /* gráficos serão redesenhados ao abrir a aba */ } }
  }
  $('#btn-tema').onclick = () => {
    const prox = TEMAS[(TEMAS.indexOf(temaEscolhido()) + 1) % TEMAS.length];
    try { localStorage.setItem(TEMA_KEY, prox); } catch (e) { /* sem armazenamento: vale só nesta sessão */ }
    aplicarTema(true); showToast(TEMA_INFO[prox][1] + '.');
  };
  if (mqTemaEscuro && mqTemaEscuro.addEventListener) mqTemaEscuro.addEventListener('change', () => { if (temaEscolhido() === 'auto') aplicarTema(true); });
  aplicarTema(false);
