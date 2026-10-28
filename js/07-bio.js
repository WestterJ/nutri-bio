// 07-bio.js — Aba Bioimpedância: tabela, modal e importação de PDF por IA
"use strict";

  window.salvarCelulaBio = function(id, campo, val) {
    const b = state.bio.find(x => x.id === id);
    if (!b) return;
    if (campo === 'data') b.data = val;
    else b[campo] = parseFloat(val) || 0;
    saveCloud(); renderBio();
  };

  function renderBio() {
    const tbody = $('#table-bio-body');
    const sorted = [...state.bio].sort((a,b) => new Date(b.data) - new Date(a.data));
    tbody.innerHTML = sorted.map(b => `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-3 whitespace-nowrap editable-cell" contenteditable="true" onblur="window.salvarCelulaBio('${b.id}', 'data', this.textContent)">${fmtDataHoraBr(b.data)}</td>
        <td class="p-3 text-center font-bold editable-cell" contenteditable="true" onblur="window.salvarCelulaBio('${b.id}', 'peso', this.textContent)">${fmtNum(b.peso)}</td>
        <td class="p-3 text-center editable-cell" contenteditable="true" onblur="window.salvarCelulaBio('${b.id}', 'massaMusc', this.textContent)">${fmtNum(b.massaMusc)}</td>
        <td class="p-3 text-center editable-cell" contenteditable="true" onblur="window.salvarCelulaBio('${b.id}', 'massaGord', this.textContent)">${fmtNum(b.massaGord)}</td>
        <td class="p-3 text-center editable-cell" contenteditable="true" onblur="window.salvarCelulaBio('${b.id}', 'agua', this.textContent)">${fmtNum(b.agua)}</td>
        <td class="p-3 text-center editable-cell" contenteditable="true" onblur="window.salvarCelulaBio('${b.id}', 'proteina', this.textContent)">${fmtNum(b.proteina)}</td>
        <td class="p-3 text-center editable-cell" contenteditable="true" onblur="window.salvarCelulaBio('${b.id}', 'minerais', this.textContent)">${fmtNum(b.minerais)}</td>
        <td class="p-3 text-center editable-cell" contenteditable="true" onblur="window.salvarCelulaBio('${b.id}', 'imc', this.textContent)">${fmtNum(b.imc)}</td>
        <td class="p-3 text-center editable-cell" contenteditable="true" onblur="window.salvarCelulaBio('${b.id}', 'pgc', this.textContent)">${fmtNum(b.pgc)}</td>
        <td class="p-3 text-center editable-cell" contenteditable="true" onblur="window.salvarCelulaBio('${b.id}', 'gordVisc', this.textContent)">${fmtNum(b.gordVisc)}</td>
        <td class="p-3 text-center editable-cell" contenteditable="true" onblur="window.salvarCelulaBio('${b.id}', 'tmb', this.textContent)">${fmtNum(b.tmb)}</td>
        <td class="p-3 text-center editable-cell" contenteditable="true" onblur="window.salvarCelulaBio('${b.id}', 'pontos', this.textContent)">${fmtNum(b.pontos)}</td>
        <td class="p-3 text-center"><button class="text-xs bg-red-50 text-red-600 px-2 py-1 rounded" onclick="window.excluirBio('${b.id}')">Excluir</button></td>
      </tr>
    `).join('');
  }

  const modalBio = $('#modal-bio');
  $('#btn-nova-bio').onclick = () => {
    $('#bio-id').value = ''; $('#bio-data').value = agoraLocalInput();
    $('#bio-peso').value = ''; $('#bio-massa-musc').value = ''; $('#bio-massa-gord').value = '';
    modalBio.showModal();
  };
  window.excluirBio = id => {
    state.bio = state.bio.filter(x => x.id !== id);
    saveCloud(); renderBio(); showToast("Bioimpedância excluída.");
  };
  $('#modal-bio-close').onclick = () => modalBio.close();
  $('#modal-bio-cancel').onclick = () => modalBio.close();

  // V33: importação de bioimpedância a partir de PDF (leitura por IA)
  const BIO_CAMPOS = ['peso','massaMusc','massaGord','agua','proteina','minerais','imc','pgc','gordVisc','tmb','pontos'];
  const BIO_IA_PROMPT = 'Você extrai dados de laudos de bioimpedância (InBody e similares) em PDF, em português do Brasil. Devolva somente o JSON do esquema. Crie um item por avaliação (data) distinta; se houver tabela de histórico, inclua cada linha com sua data. Use apenas valores impressos no documento; não calcule nem invente. Campo ausente = 0. Unidades: peso, massas, proteína e minerais em kg; água corporal total em litros; pgc em %; tmb em kcal. massaMusc = massa muscular esquelética (kg); massaGord = massa de gordura corporal (kg); pgc = percentual de gordura corporal; gordVisc = nível de gordura visceral; pontos = pontuação InBody. Ignore e não inclua nome, data de nascimento e outros dados pessoais. Se o PDF não for um laudo de bioimpedância, devolva registros vazio e explique em observacoes.';
  let bioIaLeituras = [];
  function bioIaStatus(msg) { const el = $('#bio-ia-status'); el.textContent = msg || ''; el.classList.toggle('hidden', !msg); }
  function resetBioIA() {
    bioIaLeituras = []; $('#bio-pdf').value = ''; bioIaStatus('');
    $('#bio-ia-lista').classList.add('hidden'); $('#bio-ia-lista').innerHTML = '';
    $('#btn-bio-ia-importar').classList.add('hidden');
  }
  modalBio.addEventListener('close', resetBioIA);

  function normalizarLeituraBio(r) {
    if (!r || typeof r !== 'object') return null;
    const m = String(r.data || '').trim().match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/);
    if (!m) return null;
    const out = { data: `${m[1]}T${m[2] || '00:00'}` };
    for (const c of BIO_CAMPOS) {
      const v = Number(r[c] ?? 0);
      if (!Number.isFinite(v) || v < 0 || v > (c === 'tmb' ? 10000 : 1000)) return null;
      out[c] = v;
    }
    return out.peso > 0 ? out : null;
  }

  function renderBioIA(obs, descartadas) {
    $('#bio-ia-lista').innerHTML = bioIaLeituras.map((b, i) => `<label class="flex items-center gap-2 text-xs bg-white border rounded-lg px-2 py-1.5"><input type="checkbox" class="bio-ia-chk" data-i="${i}" checked><span>${esc(fmtDataHoraBr(b.data))} · ${fmtNum(b.peso)} kg · gordura ${fmtNum(b.massaGord)} kg · PGC ${fmtNum(b.pgc)}% · músculo ${fmtNum(b.massaMusc)} kg · TMB ${fmtNum(b.tmb)}</span></label>`).join('');
    $('#bio-ia-lista').classList.remove('hidden');
    $('#btn-bio-ia-importar').classList.remove('hidden');
    bioIaStatus(`${bioIaLeituras.length} avaliação(ões) encontrada(s). Confira os valores antes de importar.` + (descartadas ? ` ${descartadas} descartada(s) por falta de data ou peso.` : '') + (obs ? ` Obs. da IA: ${obs}` : ''));
  }

  $('#btn-bio-ia').onclick = async () => {
    const file = $('#bio-pdf').files[0];
    if (!supabaseClient || !supabaseUser) { showToast('Entre na sua conta para usar a IA.'); return; }
    if (!file || file.type !== 'application/pdf') { showToast('Selecione um arquivo PDF.'); return; }
    if (file.size > 6.5 * 1024 * 1024) { showToast('PDF muito grande (máximo 6,5 MB).'); return; }
    const btn = $('#btn-bio-ia'); btn.disabled = true; bioIaStatus('Lendo o PDF com IA... pode levar até 1–2 minutos.');
    $('#bio-ia-lista').classList.add('hidden'); $('#btn-bio-ia-importar').classList.add('hidden');
    try {
      const dataURL = await lerArquivoComoDataURL(file);
      const props = { data: { type: 'STRING', description: 'Data e hora do exame: AAAA-MM-DDTHH:mm (sem hora: só AAAA-MM-DD).' } };
      BIO_CAMPOS.forEach(c => props[c] = { type: 'NUMBER' });
      const payload = {
        systemInstruction: { parts: [{ text: BIO_IA_PROMPT }] },
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'application/pdf', data: dataURL.split(',')[1] } }, { text: 'Extraia todas as avaliações de bioimpedância deste PDF.' }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 1800, responseSchema: { type: 'OBJECT', properties: { observacoes: { type: 'STRING' }, registros: { type: 'ARRAY', items: { type: 'OBJECT', properties: props, required: ['data', 'peso'] } } }, required: ['observacoes', 'registros'] } }
      };
      const resp = await chamarNutriGemini(payload, { timeoutMs: 90000, onStatus: bioIaStatus });
      const json = await resp.json();
      const txt = json?.candidates?.[0]?.content?.parts?.find(p => typeof p?.text === 'string')?.text;
      if (!txt) throw new Error('A IA não retornou conteúdo.');
      const parsed = JSON.parse(txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim());
      const todas = Array.isArray(parsed.registros) ? parsed.registros : [];
      bioIaLeituras = todas.map(normalizarLeituraBio).filter(Boolean);
      if (!bioIaLeituras.length) throw new Error(parsed.observacoes || 'Não encontrei avaliações válidas (data e peso) neste PDF.');
      renderBioIA(parsed.observacoes, todas.length - bioIaLeituras.length);
    } catch (err) {
      bioIaStatus('');
      showToast('Falha na leitura do PDF: ' + (err.message || 'erro desconhecido'));
    } finally { btn.disabled = false; }
  };

  $('#btn-bio-ia-importar').onclick = () => {
    const sel = [...document.querySelectorAll('.bio-ia-chk:checked')].map(c => bioIaLeituras[Number(c.dataset.i)]).filter(Boolean);
    if (!sel.length) { showToast('Selecione ao menos uma avaliação.'); return; }
    let novas = 0, duplicadas = 0;
    sel.forEach((b, i) => {
      if (state.bio.some(x => String(x.data).slice(0, 10) === b.data.slice(0, 10) && Number(x.peso) === b.peso)) { duplicadas++; return; }
      state.bio.push({ id: 'b' + Date.now() + '_' + i, ...b }); novas++;
    });
    if (novas) { saveCloud(); renderBio(); }
    modalBio.close();
    showToast(`${novas} avaliação(ões) importada(s)` + (duplicadas ? `; ${duplicadas} já existia(m).` : '.'));
  };
  $('#form-bio').onsubmit = e => {
    e.preventDefault();
    state.bio.push({
      id: 'b' + Date.now(), data: $('#bio-data').value,
      peso: parseFloat($('#bio-peso').value)||0, massaMusc: parseFloat($('#bio-massa-musc').value)||0,
      massaGord: parseFloat($('#bio-massa-gord').value)||0, agua: parseFloat($('#bio-agua').value)||0,
      proteina: parseFloat($('#bio-proteina').value)||0, minerais: parseFloat($('#bio-minerais').value)||0,
      imc: parseFloat($('#bio-imc').value)||0, pgc: parseFloat($('#bio-pgc').value)||0,
      gordVisc: parseFloat($('#bio-gord-visc').value)||0, tmb: parseFloat($('#bio-tmb').value)||0,
      pontos: parseFloat($('#bio-pontos').value)||0
    });
    saveCloud(); modalBio.close(); renderBio(); showToast("Bioimpedância salva!");
  };
