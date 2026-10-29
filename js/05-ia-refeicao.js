// 05-ia-refeicao.js — IA da refeição: Texto IA e Foto IA (Gemini via função Supabase)
"use strict";

  // A estimativa deve usar a API; não inventa uma refeição nem soma palavras-chave offline.
  const GEMINI_MODEL = 'gemini-3.8-flash';

  function lerArquivoComoDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Não foi possível ler a imagem.'));
      reader.onerror = () => reject(new Error('Falha ao ler a imagem.'));
      reader.readAsDataURL(file);
    });
  }

  async function prepararImagemParaIA(file) {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      throw new Error('Selecione uma imagem válida.');
    }

    // Reduz as fotos grandes para evitar requisições excessivas no celular.
    if (typeof createImageBitmap === 'function') {
      let bitmap;
      try {
        bitmap = await createImageBitmap(file);
        const maxDim = 1600;
        const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Não foi possível preparar a imagem.');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(bitmap, 0, 0, width, height);
        const blob = await new Promise((resolve, reject) => {
          canvas.toBlob(result => result ? resolve(result) : reject(new Error('Falha ao comprimir a imagem.')), 'image/jpeg', 0.86);
        });
        const dataURL = await lerArquivoComoDataURL(blob);
        return { mimeType: 'image/jpeg', data: dataURL.split(',')[1] };
      } catch (err) {
        // Alguns formatos de câmera não são decodificados pelo navegador.
        if (file.size > 12 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type.toLowerCase())) {
          throw new Error('Não consegui processar esse formato de imagem. Envie a foto como JPG, PNG ou WEBP.');
        }
      } finally {
        if (bitmap && typeof bitmap.close === 'function') bitmap.close();
      }
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type.toLowerCase())) {
      throw new Error('Formato não suportado neste navegador. Envie a foto como JPG, PNG ou WEBP.');
    }
    if (file.size > 12 * 1024 * 1024) {
      throw new Error('A imagem é muito grande. Reduza o tamanho ou envie uma foto em JPG/PNG/WEBP menor que 12 MB.');
    }
    const dataURL = await lerArquivoComoDataURL(file);
    return { mimeType: file.type.toLowerCase(), data: dataURL.split(',')[1] };
  }

  function somarCampo(itens, campo) {
    return itens.reduce((total, item) => total + Number(item[campo]), 0);
  }

  function validarItemNutricional(item) {
    if (!item || typeof item.alimento !== 'string' || !item.alimento.trim()) return false;
    const quantidade = Number(item.quantidade_g);
    const proteina = Number(item.proteinas_g);
    const carboidrato = Number(item.carboidratos_g);
    const gordura = Number(item.gorduras_g);
    return Number.isFinite(quantidade) && quantidade > 0 && quantidade <= 5000 &&
      Number.isFinite(proteina) && proteina >= 0 && proteina <= 1000 &&
      Number.isFinite(carboidrato) && carboidrato >= 0 && carboidrato <= 1000 &&
      Number.isFinite(gordura) && gordura >= 0 && gordura <= 1000;
  }

  // V42: UMA chamada por clique (sem novas tentativas automáticas), com tempo máximo, cancelamento,
  // contagem de segundos e log no Supabase (tabela ia_logs). Se falhar, o usuário decide clicar de novo.
  let iaCancelamento = null;
  const IA_TIMEOUT_REFEICAO_MS = 30000;
  // O raciocínio interno do Gemini é desligado no servidor (função dynamic-service, modo "refeicao").

  // Contagem em segundos reutilizável (refeição, bioimpedância, relatório). Devolve a função que para o relógio e informa os segundos.
  function iaRelogio(setTexto, base) {
    const inicio = Date.now();
    setTexto(`${base} 0 s`);
    const t = setInterval(() => setTexto(`${base} ${Math.round((Date.now() - inicio) / 1000)} s`), 1000);
    return () => { clearInterval(t); return (Date.now() - inicio) / 1000; };
  }
  const fmtSeg = seg => (Math.round(seg * 10) / 10).toString().replace('.', ',') + ' s';

  // Log de cada chamada de IA no Supabase (ia_logs). Nunca atrapalha o uso: falha em silêncio.
  let iaLogDesativado = false;
  // Cabeçalho Server-Timing da função: "pre;dur=120, gemini;dur=3500, modelo;desc=x, reserva;desc=timeout"
  // -> { pre_ms, gemini_ms, modelo, usou_reserva, motivo_reserva }
  function lerServerTiming(h) {
    const out = {};
    String(h || '').split(',').forEach(parte => {
      const t = parte.trim();
      let m = /^(pre|gemini);dur=([\d.]+)/.exec(t);
      if (m) { out[m[1] + '_ms'] = Math.round(Number(m[2])); return; }
      m = /^modelo;desc="?([^"\s;]+)/.exec(t);
      if (m) { out.modelo = m[1]; return; }
      m = /^reserva;desc="?([^"\s;]+)/.exec(t);
      if (m) { out.usou_reserva = true; out.motivo_reserva = m[1]; }
    });
    return out;
  }
  async function registrarLogIA(info) {
    if (iaLogDesativado || !supabaseClient || !supabaseUser) return;
    try {
      const { error } = await supabaseClient.from('ia_logs').insert({ user_id: supabaseUser.id, ...info });
      if (error) {
        if (/ia_logs|relation|schema cache|does not exist/i.test(String(error.message || ''))) iaLogDesativado = true;
        console.warn('Log de IA não gravado:', error.message);
      }
    } catch (err) { console.warn('Log de IA não gravado:', err); }
  }

  async function chamarNutriGeminiUmaVez(payload, timeoutMs, sinalExterno) {
    if (!supabaseClient || !supabaseConfig.url || !supabaseConfig.key) {
      throw new Error('A configuração do Supabase não está disponível. Recarregue o aplicativo e entre novamente.');
    }
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
    const accessToken = sessionData && sessionData.session && sessionData.session.access_token;
    if (sessionError || !accessToken) {
      const err = new Error('Sua sessão expirou. Entre novamente no aplicativo.');
      err.status = 401;
      throw err;
    }
    const endpoint = `${supabaseConfig.url.replace(/\/$/, '')}/functions/v1/dynamic-service`;
    const ctrl = new AbortController();
    let estourou = false;
    const timer = setTimeout(() => { estourou = true; ctrl.abort(); }, timeoutMs);
    const repassar = () => ctrl.abort();
    if (sinalExterno) sinalExterno.addEventListener('abort', repassar, { once: true });
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}`, 'apikey': supabaseConfig.key },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      const iaTiming = lerServerTiming(response.headers.get('server-timing'));
      if (!response.ok) {
        let detail = `Serviço de IA retornou HTTP ${response.status}.`;
        try {
          const errorBody = await response.clone().json();
          detail = errorBody?.error?.message || errorBody?.error || errorBody?.message || detail;
          if (typeof detail !== 'string') detail = JSON.stringify(detail);
        } catch (_) {}
        const error = new Error(detail);
        error.status = response.status;
        error.detail = detail;
        error.iaTiming = iaTiming;
        throw error;
      }
      response.iaTiming = iaTiming;
      return response;
    } catch (e) {
      if (e && e.name === 'AbortError') {
        if (estourou) throw Object.assign(new Error('A IA demorou mais que o limite.'), { status: 408, tempoEsgotado: true });
        throw Object.assign(new Error('Cancelado.'), { cancelado: true });
      }
      throw e;
    } finally {
      clearTimeout(timer);
      if (sinalExterno) sinalExterno.removeEventListener('abort', repassar);
    }
  }
  async function chamarNutriGemini(payload, opcoes = {}) {
    const tipo = opcoes.tipo || (payload && payload.modo === 'relatorio' ? 'relatorio' : 'outro');
    const timeoutMs = opcoes.timeoutMs || (tipo === 'relatorio' ? 90000 : IA_TIMEOUT_REFEICAO_MS);
    const sinal = opcoes.signal;
    const inicio = Date.now();
    let tamanhoKb = null;
    try { tamanhoKb = Math.round(JSON.stringify(payload).length / 1024); } catch (_) {}
    try {
      if (sinal && sinal.aborted) throw Object.assign(new Error('Cancelado.'), { cancelado: true });
      const resp = await chamarNutriGeminiUmaVez(payload, timeoutMs, sinal);
      registrarLogIA({ tipo, status: 'ok', http_status: resp.status, duracao_ms: Date.now() - inicio, tamanho_kb: tamanhoKb, ...(resp.iaTiming || {}) });
      return resp;
    } catch (e) {
      registrarLogIA({
        tipo, status: e && e.cancelado ? 'cancelado' : (e && e.tempoEsgotado ? 'timeout' : 'erro'),
        http_status: Number(e && e.status) || null, duracao_ms: Date.now() - inicio, tamanho_kb: tamanhoKb,
        erro: String((e && (e.detail || e.message)) || '').slice(0, 300),
        ...((e && e.iaTiming) || {})
      });
      throw e;
    }
  }

  // V40: reaproveita a estimativa de uma refeição idêntica já lançada (sem chamar a IA).
  const normalizarRefeicao = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  function buscarEstimativaNoHistorico(texto) {
    const alvo = normalizarRefeicao(texto);
    if (alvo.length < 4) return null;
    const editando = $('#reg-id') ? $('#reg-id').value : '';
    return [...state.registros]
      .filter(r => r.id !== editando && (Number(r.calorias) || 0) > 0 && normalizarRefeicao(r.alimentos) === alvo)
      .sort((a, b) => String(b.data).localeCompare(String(a.data)))[0] || null;
  }
  let iaForcarTexto = '';

  async function processarIAVision(fileOrText, isPhoto = false) {
    const loader = $('#ia-loading');
    const btnFoto = $('#btn-ia-foto');
    const btnTexto = $('#btn-ia-calcular');
    const texto = isPhoto ? '' : String(fileOrText || '').trim();

    if (!supabaseClient || !supabaseUser) {
      showToast('Entre na sua conta para usar a IA.');
      return;
    }
    if (!isPhoto && !texto) {
      showToast('Descreva os alimentos e, sempre que possível, informe as quantidades.');
      $('#reg-alimentos').focus();
      return;
    }
    if (isPhoto && (!fileOrText || !fileOrText.type)) {
      showToast('Selecione uma foto válida para analisar.');
      return;
    }

    if (!isPhoto && iaForcarTexto !== normalizarRefeicao(texto)) {
      const igual = buscarEstimativaNoHistorico(texto);
      if (igual) {
        $('#reg-calorias').value = Math.round(Number(igual.calorias) || 0);
        $('#reg-proteinas').value = Number(igual.proteinas) || 0;
        $('#reg-carboidratos').value = Number(igual.carboidratos) || 0;
        $('#reg-gorduras').value = Number(igual.gorduras) || 0;
        iaForcarTexto = normalizarRefeicao(texto);
        showToast(`Mesma refeição de ${fmtDataBr(igual.data)}: valores reaproveitados na hora, sem usar a IA. Clique em Texto IA de novo se quiser recalcular pela IA.`);
        return;
      }
    }
    iaForcarTexto = '';
    iaCancelamento = new AbortController();
    const btnCancelar = $('#btn-ia-cancelar');
    if (btnCancelar) btnCancelar.classList.remove('hidden');
    const textoBase = isPhoto ? 'Analisando a foto e estimando porções...' : 'Estimando porções e calculando os macronutrientes...';
    const pararRelogio = iaRelogio(t => { loader.textContent = t; }, textoBase);
    loader.classList.remove('hidden');
    btnFoto.disabled = true;
    btnTexto.disabled = true;
    btnFoto.classList.add('opacity-50');
    btnTexto.classList.add('opacity-50');

    try {
      const systemPrompt = [
        'Você estima macronutrientes de refeições, em português do Brasil. Responda apenas o JSON do esquema, de forma objetiva.',
        'Estime cada alimento separadamente e respeite as quantidades informadas; sem quantidade, use uma porção caseira plausível e registre a suposição em observacoes.',
        'Em foto, considere só o que é visível; não afirme peso exato, óleo, molhos ou ingredientes ocultos.',
        'quantidade_g é o peso comestível do item; proteinas_g, carboidratos_g e gorduras_g são os gramas de cada macro naquela porção, não o peso do alimento (ex.: 150 g de frango cozido sem pele ≈ 40–47 g de proteína; cru ≈ 32–36 g). Não calcule calorias.',
        'porcao é a medida caseira com o peso em gramas. observacoes é curta e traz incertezas e suposições.'
      ].join(' ');

      const userParts = [];
      if (isPhoto) {
        const image = await prepararImagemParaIA(fileOrText);
        userParts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
        userParts.push({ text: 'Analise a refeição visível nesta imagem. Liste cada componente visível, estime uma porção em gramas por item, indique o tamanho da porção caseira e estime os macronutrientes dessa quantidade. Se algum ingrediente ou tamanho de porção for incerto, diga isso em observacoes.' });
      } else {
        userParts.push({ text: `Estime os macronutrientes da refeição descrita a seguir: ${texto}. Respeite as quantidades informadas. Para itens sem quantidade, adote porções caseiras típicas e deixe isso claro nas observacoes.` });
      }

      const responseSchema = {
        type: 'OBJECT',
        properties: {
          observacoes: { type: 'STRING', description: 'Incertezas e suposições, em poucas frases.' },
          itens: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                alimento: { type: 'STRING', description: 'Nome do alimento ou componente.' },
                porcao: { type: 'STRING', description: 'Medida caseira estimada e peso aproximado em gramas.' },
                quantidade_g: { type: 'NUMBER', description: 'Peso comestível total estimado em gramas.' },
                proteinas_g: { type: 'NUMBER', description: 'Gramas de proteína contidas na porção.' },
                carboidratos_g: { type: 'NUMBER', description: 'Gramas de carboidratos contidos na porção.' },
                gorduras_g: { type: 'NUMBER', description: 'Gramas de gordura contidas na porção.' }
              },
              required: ['alimento', 'porcao', 'quantidade_g', 'proteinas_g', 'carboidratos_g', 'gorduras_g']
            }
          }
        },
        required: ['observacoes', 'itens']
      };

      const payload = {
        modo: 'refeicao', // a função usa o modo rápido: 1 tentativa, 25 s, sem raciocínio interno
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: userParts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0.2
        }
      };

      // A chave Gemini fica no servidor; o navegador envia somente a sessão autenticada e o payload.
      const resp = await chamarNutriGemini(payload, { signal: iaCancelamento.signal, tipo: isPhoto ? 'refeicao_foto' : 'refeicao_texto' });
      const segundos = pararRelogio();
      const viaReserva = resp.iaTiming && resp.iaTiming.usou_reserva ? ' (modelo reserva)' : '';

      const json = await resp.json();
      const parts = json && json.candidates && json.candidates[0] && json.candidates[0].content
        ? json.candidates[0].content.parts || [] : [];
      const respostaTexto = parts.find(part => part && typeof part.text === 'string')?.text;
      if (!respostaTexto) throw new Error('A resposta do Gemini veio vazia ou foi bloqueada.');

      let parsed;
      try {
        parsed = JSON.parse(respostaTexto.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim());
      } catch (err) {
        throw new Error('O Gemini retornou dados em formato inválido.');
      }
      if (!Array.isArray(parsed.itens)) throw new Error('A resposta não contém a lista de alimentos esperada.');
      const itens = parsed.itens.filter(validarItemNutricional).map(item => ({
        alimento: item.alimento.trim(),
        porcao: String(item.porcao || '').trim(),
        quantidade_g: Number(item.quantidade_g),
        proteinas_g: Number(item.proteinas_g),
        carboidratos_g: Number(item.carboidratos_g),
        gorduras_g: Number(item.gorduras_g)
      }));
      if (!itens.length) throw new Error('Não consegui identificar porções e macronutrientes válidos na resposta.');

      // Totais calculados pelo aplicativo a partir dos itens, evitando depender de um total global inconsistente da IA.
      const totalProteinas = somarCampo(itens, 'proteinas_g');
      const totalCarboidratos = somarCampo(itens, 'carboidratos_g');
      const totalGorduras = somarCampo(itens, 'gorduras_g');
      const totalCalorias = totalProteinas * 4 + totalCarboidratos * 4 + totalGorduras * 9;

      // Texto IA apenas calcula e preenche os campos nutricionais; não modifica
      // o texto original digitado em Alimentos / Descrição da Refeição.
      // A Foto IA continua preenchendo a descrição com os alimentos identificados.
      if (isPhoto) {
        $('#reg-alimentos').value = itens.map(item => {
          const porcao = item.porcao || `porção aproximada de ${Math.round(item.quantidade_g)} g`;
          return `${item.alimento} (${porcao})`;
        }).join('; ');
      }
      $('#reg-calorias').value = Math.round(totalCalorias);
      $('#reg-proteinas').value = Math.round(totalProteinas * 10) / 10;
      $('#reg-carboidratos').value = Math.round(totalCarboidratos * 10) / 10;
      $('#reg-gorduras').value = Math.round(totalGorduras * 10) / 10;

      const notaExistente = $('#reg-obs').value.trim()
        .replace(/(?:^|\n)Estimativa da IA:[^\n]*/g, '')
        .trim();
      const observacaoIA = String(parsed.observacoes || (isPhoto
        ? 'Porções estimadas visualmente; o peso e possíveis ingredientes ocultos não podem ser confirmados apenas pela foto.'
        : 'Porções estimadas quando a descrição não informou quantidades. Confira os tamanhos das porções.'))
        .replace(/\s+/g, ' ').trim();
      $('#reg-obs').value = [notaExistente, `Estimativa da IA: ${observacaoIA}`].filter(Boolean).join('\n');

      showToast(isPhoto
        ? `Foto analisada em ${fmtSeg(segundos)}${viaReserva}. Confira os alimentos e as porções antes de salvar.`
        : `Macros calculados em ${fmtSeg(segundos)}${viaReserva}. Confira as porções estimadas antes de salvar.`);
    } catch (e) {
      if (e && e.cancelado) { showToast('Análise cancelada. Seus dados continuam no formulário.'); return; }
      console.error('Falha ao analisar refeição com Gemini:', e);
      const status = Number(e && e.status);
      const detalhe = String((e && (e.detail || e.message)) || '').replace(/Gemini\\s+[^:]+:\\s*HTTP\\s+\\d+\\s*[—-]?\\s*/i, '').trim();
      if (status === 400) {
        showToast(`O Gemini rejeitou a solicitação (erro 400): ${detalhe || 'verifique a chave da API e tente descrever os alimentos de forma simples.'}`);
      } else if (status === 401 || status === 403) {
        showToast('Acesso à IA recusado. Entre novamente no aplicativo e confira a configuração da função no Supabase.');
      } else if (status === 404) {
        // Diagnóstico V26: exibe o detalhe original retornado pela API para identificar
        // se o 404 se refere ao nome do modelo, versão da API ou outro recurso.
        const detalhe404 = detalhe ? detalhe.slice(0, 220) : 'A API não retornou uma descrição adicional.';
        showToast(`Gemini HTTP 404 — ${detalhe404}`);
      } else if (status === 429 && /limite di[aá]rio/i.test(detalhe)) {
        showToast(detalhe);
      } else if (status === 429) {
        const quota = /quota|daily|per.day|limit: 0|billing/i.test(detalhe);
        showToast(quota
          ? 'A cota de uso do Gemini foi atingida. Aguarde a renovação da cota ou confira os limites do projeto no Google AI Studio.'
          : 'O Gemini recusou por limite temporário (erro 429). Seus dados continuam no formulário. Aguarde cerca de 1 minuto e tente novamente.');
      } else if (status === 503) {
        showToast('O Gemini está sobrecarregado (erro 503). Seus dados continuam no formulário. Tente de novo em instantes.');
      } else if (status === 500 || status === 502 || status === 504) {
        showToast(`O serviço do Gemini apresentou uma falha temporária (erro ${status}). Aguarde um pouco e tente novamente.`);
      } else if (status === 408) {
        showToast(`A IA não respondeu em ${Math.round(IA_TIMEOUT_REFEICAO_MS / 1000)} s. Seus dados continuam no formulário. Tente de novo ou descreva a refeição de forma mais curta.`);
      } else if (e && e.name === 'TypeError') {
        showToast('Não foi possível conectar ao Gemini. Verifique a internet, VPN ou bloqueios de rede e tente novamente.');
      } else if (e && e.message && /imagem|foto|formato|identificar|resposta veio vazia|lista de alimentos/i.test(e.message)) {
        showToast(e.message);
      } else if (e && e.message && /bloquead|safety|recusad/i.test(e.message)) {
        showToast('O Gemini não conseguiu responder a esta descrição. Reformule o texto com os alimentos e as quantidades de forma objetiva.');
      } else {
        showToast('Não foi possível concluir a análise. Nenhum alimento foi salvo automaticamente. Tente novamente; se persistir, abra o Console (F12) e envie o erro.');
      }
    } finally {
      pararRelogio();
      iaCancelamento = null;
      if (btnCancelar) btnCancelar.classList.add('hidden');
      loader.classList.add('hidden');
      btnFoto.disabled = false;
      btnTexto.disabled = false;
      btnFoto.classList.remove('opacity-50');
      btnTexto.classList.remove('opacity-50');
    }
  }

  $('#btn-ia-calcular').onclick = () => processarIAVision($('#reg-alimentos').value, false);
  $('#btn-ia-foto').onclick = () => $('#input-ia-foto').click();
  $('#input-ia-foto').onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    try {
      if (file) await processarIAVision(file, true);
    } finally {
      // Permite selecionar a mesma foto novamente depois de uma falha ou correção.
      e.target.value = '';
    }
  };

  // V40: cancelar a análise em andamento e esquecer o "recalcular" se o texto mudar.
  if ($('#btn-ia-cancelar')) $('#btn-ia-cancelar').onclick = () => { if (iaCancelamento) iaCancelamento.abort(); };
  $('#reg-alimentos').addEventListener('input', () => { iaForcarTexto = ''; });
