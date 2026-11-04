// 02a-merge.js — V48: mesclagem de dados em 3 vias (base × este aparelho × nuvem), por registro.
// "Base" = cópia do estado na última sincronização bem-sucedida. Com ela dá para saber, para cada registro,
// quem mexeu: só este aparelho, só a nuvem, ou os dois — e se alguém EXCLUIU (sem precisar de marcadores de exclusão).
"use strict";

  function mergeJson(x) { return JSON.stringify(x === undefined ? null : x); }

  function mergeChaveItem(x) {
    if (x && typeof x === 'object' && x.id !== undefined && x.id !== null) return 'id:' + x.id;
    return 'j:' + mergeJson(x); // itens sem id (ex.: favoritos antigos) são comparados pelo conteúdo
  }

  // Lista de registros: une por id; exclusões e edições feitas só de um lado são respeitadas.
  function mergeLista(chave, B, L, R, info) {
    const mapa = a => { const m = new Map(); (Array.isArray(a) ? a : []).forEach(x => m.set(mergeChaveItem(x), x)); return m; };
    const mB = mapa(B), mL = mapa(L), mR = mapa(R);
    const chaves = [...mL.keys(), ...[...mR.keys()].filter(k => !mL.has(k))];
    const saida = [];
    chaves.forEach(k => {
      const temB = mB.has(k), temL = mL.has(k), temR = mR.has(k);
      const b = mB.get(k), l = mL.get(k), r = mR.get(k);
      if (temL && temR) {
        if (mergeJson(l) === mergeJson(r)) saida.push(l);
        else if (temB && mergeJson(l) === mergeJson(b)) { saida.push(r); info.editadosNuvem++; }
        else if (temB && mergeJson(r) === mergeJson(b)) { saida.push(l); }
        else { saida.push(l); info.conflitos.push({ chave, id: k }); }          // os dois editaram: vale este aparelho
      } else if (temL) {
        if (!temB) saida.push(l);                                                // novo neste aparelho
        else if (mergeJson(l) === mergeJson(b)) info.excluidosNuvem++;           // a nuvem excluiu e aqui ninguém mexeu
        else { saida.push(l); info.conflitos.push({ chave, id: k }); }           // aqui editou o que a nuvem excluiu: mantém
      } else {
        if (!temB) { saida.push(r); info.novosNuvem++; }                         // novo na nuvem
        else if (mergeJson(r) === mergeJson(b)) { /* excluído aqui: continua excluído */ }
        else { saida.push(r); info.conflitos.push({ chave, id: k }); }           // a nuvem editou o que aqui excluiu: mantém
      }
    });
    return saida;
  }

  // Objeto simples (ex.: metas): decide campo a campo.
  function mergeObjeto(chave, B, L, R, info) {
    B = B && typeof B === 'object' ? B : {}; L = L && typeof L === 'object' ? L : {}; R = R && typeof R === 'object' ? R : {};
    const saida = {};
    new Set([...Object.keys(L), ...Object.keys(R)]).forEach(k => {
      const l = L[k], r = R[k], b = B[k];
      let v;
      if (mergeJson(l) === mergeJson(r)) v = l;
      else if (mergeJson(l) === mergeJson(b)) { v = r; info.editadosNuvem++; }
      else { v = l; if (mergeJson(r) !== mergeJson(b)) info.conflitos.push({ chave: chave + '.' + k, id: k }); }
      if (v !== undefined) saida[k] = v;
    });
    return saida;
  }

  // Resultado: { merged, info:{ novosNuvem, editadosNuvem, excluidosNuvem, conflitos[] } }. Nunca altera os argumentos.
  function mergeTresVias(base, local, remoto) {
    const cp = x => JSON.parse(JSON.stringify(x || {}));
    const B = cp(base), L = cp(local), R = cp(remoto);
    const info = { novosNuvem: 0, editadosNuvem: 0, excluidosNuvem: 0, conflitos: [] };
    const merged = {};
    new Set([...Object.keys(L), ...Object.keys(R)]).forEach(k => {
      const l = L[k], r = R[k], b = B[k];
      if (Array.isArray(l) || Array.isArray(r)) merged[k] = mergeLista(k, b, l, r, info);
      else if ((l && typeof l === 'object') || (r && typeof r === 'object')) merged[k] = mergeObjeto(k, b, l, r, info);
      else if (mergeJson(l) === mergeJson(r)) merged[k] = l;
      else if (mergeJson(l) === mergeJson(b)) { merged[k] = r; info.editadosNuvem++; }
      else merged[k] = l;
    });
    return { merged, info };
  }

  // Base da última sincronização (por conta, porque STORAGE_KEY inclui o usuário).
  function salvarBaseSync(obj) {
    try { localStorage.setItem(STORAGE_KEY + '_base', JSON.stringify(obj)); } catch (e) { console.warn('Base de sincronização não salva:', e); }
  }
  function lerBaseSync() {
    try { const s = localStorage.getItem(STORAGE_KEY + '_base'); return s ? JSON.parse(s) : null; } catch (_) { return null; }
  }
  // Cópia de segurança do que existia antes de uma mesclagem (só a última), para o caso de algo sair diferente do esperado.
  function guardarAntesDeMesclar(local, remoto) {
    try { localStorage.setItem(STORAGE_KEY + '_pre_merge', JSON.stringify({ quando: new Date().toISOString(), local, remoto })); } catch (e) { console.warn('Cópia pré-mesclagem não salva:', e); }
  }
  function resumoMesclagem(info) {
    const p = [];
    if (info.novosNuvem) p.push(info.novosNuvem + ' novo(s) da nuvem');
    if (info.editadosNuvem) p.push(info.editadosNuvem + ' edição(ões) da nuvem');
    if (info.excluidosNuvem) p.push(info.excluidosNuvem + ' exclusão(ões) da nuvem');
    if (info.conflitos.length) p.push(info.conflitos.length + ' alterado(s) nos dois aparelhos (mantida a versão deste)');
    return p.length ? p.join(', ') : 'sem diferenças de conteúdo';
  }
