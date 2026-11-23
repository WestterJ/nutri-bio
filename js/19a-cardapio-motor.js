// 19a-cardapio-motor.js — V51: motor do "Cardápio da semana" (sem tela, sem IA, sem rede).
// Monta 7 dias de refeições a partir de (1) as opções do plano da nutricionista (12/12/2025), com macros ESTIMADOS por ingrediente,
// (2) as refeições que você mais registra no diário e (3) o seu objetivo e as metas. Cada refeição recebe um score de 0 a 100.
"use strict";
(function (root) {
  // ---------- utilidades ----------
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9% ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const pad2 = n => String(n).padStart(2, '0');
  const dataStr = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const parseData = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const somaDias = (s, n) => { const d = parseData(s); d.setDate(d.getDate() + n); return dataStr(d); };
  const dow = s => parseData(s).getDay(); // 0 = domingo
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ---------- refeições do dia ----------
  // kcal/prot = parcela da meta diária (normalizada entre as refeições ativas do dia).
  const SLOTS = [
    { id: 'cafe',   nome: 'Café da Manhã',   hora: '07:00', kcal: 0.22, prot: 0.22 },
    { id: 'lancheM', nome: 'Lanche da Manhã', hora: '10:00', kcal: 0.06, prot: 0.03 },
    { id: 'almoco', nome: 'Almoço',          hora: '12:30', kcal: 0.30, prot: 0.30 },
    { id: 'lancheT', nome: 'Lanche da Tarde', hora: '15:30', kcal: 0.12, prot: 0.15 },
    { id: 'pre',    nome: 'Pré-Treino',      hora: '18:00', kcal: 0.08, prot: 0.04 }, // 18h: horário do plano da nutricionista
    { id: 'jantar', nome: 'Jantar',          hora: '20:00', kcal: 0.22, prot: 0.26 }
  ];
  const SLOT_POR_ID = Object.fromEntries(SLOTS.map(s => [s.id, s]));
  const SLOT_POR_REFEICAO = { 'Café da Manhã': 'cafe', 'Lanche da Manhã': 'lancheM', 'Almoço': 'almoco', 'Lanche da Tarde': 'lancheT', 'Pré-Treino': 'pre', 'Pós-Treino': 'jantar', 'Jantar': 'jantar' };
  // Tolerância de calorias por objetivo (fração abaixo / acima do esperado da refeição sem perder pontos).
  const TOL = { ganho: { baixo: 0.20, alto: 0.35 }, perda: { baixo: 0.30, alto: 0.10 }, manutencao: { baixo: 0.15, alto: 0.15 }, recomposicao: { baixo: 0.18, alto: 0.18 } };

  // ---------- ingredientes do plano (valores aproximados por porção, estilo tabela TACO; descrição = medida do plano) ----------
  // [descrição, kcal, proteína g, carboidrato g, gordura g, vermelha?]
  const ING = {
    paoFrances: ['Meio pão francês', 75, 2.4, 14.5, 0.9], paoForma: ['1 fatia de pão de forma sem açúcar', 65, 2.1, 12, 0.9],
    paoFranc1: ['1 pão francês', 150, 4.8, 29, 1.8], paoInt: ['1 fatia de pão integral', 62, 2.6, 11, 1], paoInt2: ['2 fatias de pão integral', 124, 5.2, 22, 2],
    tapioca: ['Tapioca (2 col. sopa de goma, 30 g) com 1 col. sobremesa de chia', 124, 0.8, 27, 1.5], tapioca3: ['Tapioca (3 col. sopa de goma) com 1 col. sopa de chia', 199, 1.7, 41, 3.1],
    peta: ['Peta (4 unidades médias)', 100, 1, 18, 2.5],
    ovos2: ['2 ovos', 144, 12.6, 0.8, 10], ovos3: ['3 ovos cozidos', 216, 18.9, 1.2, 15], frango2: ['2 col. sopa de frango desfiado', 66, 12.4, 0, 1.5],
    queijoFresco: ['1 fatia de queijo fresco (30 g)', 80, 5.4, 1, 6], mucarela: ['1 fatia de muçarela', 60, 4.3, 0.5, 4.5], requeijao: ['1 col. sobremesa de requeijão light', 22, 1.2, 1, 1.5],
    fruta: ['1 porção de fruta', 60, 0.8, 15, 0.2], farelo1: ['1 col. sopa de farelo de aveia', 25, 1.7, 6.6, 0.7], farelo2: ['2 col. sopa de farelo de aveia', 50, 3.4, 13.2, 1.4],
    cafe: ['Café ou chá sem açúcar', 2, 0.1, 0, 0], coalhada: ['1 xícara de coalhada triplo zero', 70, 8, 8, 0], iogurte: ['1 pote de iogurte desnatado natural', 80, 6, 10, 0.5],
    whey15: ['Meia dose de whey isolado (15 g)', 55, 13.5, 0.5, 0.2], mix: ['1 col. sopa de mix funcional', 62, 2.6, 3.5, 4.8],
    omelete: ['Omelete de 2 ovos com vegetais à vontade', 180, 13.6, 4, 14], leiteCacau: ['100 mL de leite desnatado com 1 col. chá de cacau 50%', 43, 4, 6, 0.5],
    pateFrango: ['Patê de frango (3 col. sopa de frango, requeijão light e cenoura)', 130, 19.5, 2, 4], pateAtum: ['Patê de atum (3 col. sopa de atum ralado, requeijão light e cenoura)', 125, 19, 2, 4.5],
    reqZero: ['1 col. sopa de requeijão zero lactose light', 30, 1.6, 1.4, 2],
    shakeIog: ['Shake: iogurte desnatado zero lactose, 2 col. sopa de farelo de aveia, fruta e 15 g de whey isolado', 245, 23.7, 38.7, 2.3],
    shakeLeite: ['Shake: 200 mL de leite desnatado zero lactose, 2 col. sopa de farelo de aveia, fruta e 15 g de whey isolado', 235, 24.5, 38.7, 2],
    pre1: ['1 porção de fruta com 80 g de iogurte desnatado zero lactose e 1 col. sobremesa de aveia em flocos finos', 125, 4.6, 24.1, 0.9], geleia: ['1 col. sopa de geleia de frutas 100% fruta', 40, 0.1, 10, 0],
    salada: ['Salada crua e cozida (meio prato)', 40, 2.5, 8, 0.3], legumes: ['Legumes cozidos com 1 col. sobremesa de azeite', 110, 1.5, 8, 8.3],
    arroz: ['Arroz (2 col. de servir rasas, 100 g)', 128, 2.6, 27, 0.5], mandioca: ['Mandioca cozida (100 g)', 125, 0.6, 30, 0.3], batata: ['Batata inglesa cozida (1 pequena, 120 g)', 92, 2.4, 21, 0.1],
    batataDoce: ['Batata-doce cozida (3 fatias, 120 g)', 92, 1.4, 22, 0.1], macarrao: ['Macarrão cozido (1 pegador, 80 g)', 125, 4.3, 25, 0.6], milho: ['Milho refogado (4 col. sopa, 100 g)', 110, 3.2, 19, 2.5],
    bife: ['Bife magro grelhado (120 g)', 263, 43, 0, 8.8, 1], file: ['Filé de frango grelhado (120 g)', 191, 38, 0, 3], lombo: ['Lombo suíno magro (100 g)', 200, 32, 0, 7.5],
    peixe: ['Filé de peixe grelhado (120 g)', 154, 30, 0, 3], almondega: ['3 almôndegas médias (120 g)', 230, 22, 8, 12, 1], moida: ['Carne moída magra (5 col. sopa, 120 g)', 230, 30, 0, 12, 1],
    coxa: ['Coxa e sobrecoxa assadas sem pele (150 g)', 270, 33, 0, 14.7], panela: ['Carne de panela magra (120 g)', 240, 34, 0, 10.5, 1],
    feijao: ['Feijão carioca (1 concha média, 86 g)', 65, 4.1, 11.8, 0.4], graoBico: ['Grão-de-bico (meia concha, 45 g)', 74, 3.9, 12, 1.1], lentilha: ['Lentilha (meia concha, 60 g)', 70, 5, 12, 0.4],
    espetinho: ['1 espetinho magro assado', 170, 26, 0, 7, 1], coalho: ['1 espetinho de queijo coalho', 150, 10, 1, 11], mand1: ['1 col. de servir de mandioca cozida', 75, 0.4, 18, 0.2],
    frango3: ['3 col. sopa de frango desfiado', 99, 18.6, 0, 2.3], vegs: ['Tomate, cenoura e brócolis', 30, 1.5, 6, 0.3],
    panqueca: ['Panqueca de aveia salgada', 150, 9, 8, 7.8], recFrango: ['Recheio de 4 col. sopa de frango desfiado', 132, 24.8, 0, 3], recCarne: ['Recheio de 4 col. sopa de carne moída', 152, 20, 0, 7.5, 1],
    macSalada: ['1 col. de servir cheia de macarrão cozido', 94, 3.2, 19, 0.5], saladaCrua: ['1 prato de sobremesa de salada crua', 40, 2.5, 8, 0.3], rap10: ['1 rap 10', 130, 3.5, 24, 2.5],
    atum4: ['4 col. sopa de atum ralado em água', 94, 20, 0, 0.8], frango4: ['4 col. sopa de frango desfiado', 132, 24.8, 0, 3], carne4: ['4 col. sopa de carne desfiada', 160, 24, 0, 7, 1]
  };
  const macrosDe = keys => keys.reduce((a, k) => { const i = ING[k]; if (!i) throw new Error('ingrediente desconhecido: ' + k); a.kcal += i[1]; a.prot += i[2]; a.carb += i[3]; a.gord += i[4]; a.vermelha = a.vermelha || !!i[5]; a.texto.push(i[0]); return a; }, { kcal: 0, prot: 0, carb: 0, gord: 0, vermelha: false, texto: [] });

  // ---------- catálogo: opções do plano da nutricionista ----------
  function montarPlano() {
    const lista = { cafe: [], lancheM: [], almoco: [], lancheT: [], pre: [], jantar: [] };
    const add = (slot, id, fonte, keys) => { const m = macrosDe(keys); lista[slot].push({ ck: 'p:' + id, slot, origem: 'plano', fonte, alimentos: m.texto.join(' + '), kcal: Math.round(m.kcal), prot: Math.round(m.prot), carb: Math.round(m.carb), gord: Math.round(m.gord), vermelha: m.vermelha, freq: 0 }); };
    // Café: opção 1 (pão/tapioca/peta + ovos ou frango + queijo + fruta com farelo + café/chá), opção 2 (coalhada/iogurte) e opção 3 (omelete)
    const paes = ['paoFrances', 'paoForma', 'tapioca', 'peta'], prots = ['ovos2', 'frango2'], queijos = ['queijoFresco', 'mucarela', 'requeijao'];
    paes.forEach(p => prots.forEach(r => queijos.forEach(q => add('cafe', `cafe1-${p}-${r}-${q}`, 'Plano: café, opção 1', [p, r, q, 'fruta', 'farelo1', 'cafe']))));
    ['coalhada', 'iogurte'].forEach(b => add('cafe', 'cafe2-' + b, 'Plano: café, opção 2', [b, 'fruta', 'farelo1', 'whey15', 'mix']));
    add('cafe', 'cafe3', 'Plano: café, opção 3', ['omelete', 'queijoFresco', 'fruta', 'farelo1', 'leiteCacau']);
    add('lancheM', 'lm1', 'Plano: lanche da manhã', ['fruta', 'mix']);
    // Lanche da tarde: opção 1 = opções do café (entra por empréstimo), 2 = sanduíche natural, 3 = shake proteico
    [['paoInt2', 'integral'], ['paoFranc1', 'frances']].forEach(([p, n]) => [['pateFrango', 'frango'], ['pateAtum', 'atum']].forEach(([pt, m]) => add('lancheT', `lt2-${n}-${m}`, 'Plano: lanche da tarde, opção 2', [p, pt, 'reqZero'])));
    add('lancheT', 'lt3-iog', 'Plano: lanche da tarde, opção 3', ['shakeIog']); add('lancheT', 'lt3-leite', 'Plano: lanche da tarde, opção 3', ['shakeLeite']);
    add('pre', 'pre1', 'Plano: pré-treino (18h)', ['pre1']); add('pre', 'pre2', 'Plano: pré-treino (18h)', ['paoInt', 'queijoFresco', 'geleia']);
    // Almoço: salada + legumes com azeite + 1 carboidrato + 1 proteína + 1 leguminosa
    const carbs = ['arroz', 'mandioca', 'batata', 'batataDoce', 'macarrao', 'milho'], proteinas = ['bife', 'file', 'ovos3', 'lombo', 'peixe', 'almondega', 'moida', 'coxa', 'panela'], legum = ['feijao', 'graoBico', 'lentilha'];
    carbs.forEach(c => proteinas.forEach(p => legum.forEach(l => add('almoco', `al-${c}-${p}-${l}`, 'Plano: almoço', ['salada', 'legumes', c, p, l]))));
    // Jantar: opção 1 = igual ao almoço (empréstimo); 2 espetinho; 3 omelete; 4 panqueca/tapioca com recheio; 5 salada de macarrão ou rap
    add('jantar', 'ja2', 'Plano: jantar, opção 2', ['espetinho', 'coalho', 'mand1', 'salada']);
    add('jantar', 'ja3', 'Plano: jantar, opção 3', ['omelete', 'frango3', 'vegs', 'salada']);
    [['panqueca', 'panq'], ['tapioca3', 'tap']].forEach(([b, n]) => [['recFrango', 'fr'], ['recCarne', 'ca']].forEach(([r, m]) => add('jantar', `ja4-${n}-${m}`, 'Plano: jantar, opção 4', [b, r, 'salada'])));
    [['macSalada', 'mac'], ['rap10', 'rap']].forEach(([b, n]) => [['frango4', 'fr'], ['atum4', 'at'], ['carne4', 'ca']].forEach(([r, m]) => add('jantar', `ja5-${n}-${m}`, 'Plano: jantar, opção 5', [b, 'saladaCrua', r])));
    return lista;
  }
  let _plano = null; const PLANO = () => _plano || (_plano = montarPlano());

  // ---------- qualidade e aderência (palavras-chave) ----------
  const RX = {
    frito: /\b(frit[oa]s?|empanad[oa]s?|pastel|pasteis|coxinha|quibe|kibe|nuggets?|salgad[oa]s?|torresmo|milanesa|pao de queijo|batata frita)\b/,
    ultra: /\b(presunto|peito de peru|salsicha|mortadela|linguica|bacon|salame|embutid[oa]s?|refrigerante|suco industrializado|suco de uva|macarrao instantaneo|biscoito recheado|achocolatado|ketchup|catchup|maionese|nutella)\b/,
    doce: /\b(bolo|brigadeiro|doce|sorvete|diplomata|pudim|biscoito|bolacha|donut|churros|mousse|pacoca|chocolate|acucar)\b/,
    veg: /\b(salada|legumes?|verduras?|brocolis|couve|alface|tomate|cenoura|abobrinha|chuchu|vagem|rucula|repolho|pepino|abobora|berinjela)\b/,
    fruta: /\b(frutas?|banana|maca|mamao|manga|morango|uva|laranja|kiwi|abacaxi|pera|goiaba|ameixa|melancia|melao|abacate)\b/,
    vermelha: /\b(patinho|alcatra|contra ?file|file mignon|bife|carne bovina|carne moida|carne de panela|picanha|fraldinha|costela|coxao|maminha|almondegas?|acem|cupim|lagarto|musculo|espetinho)\b/
  };
  const GRUPOS_PLANO = [/\bovos?\b|omelete/, /frango|peru/, /peixe|tilapia|merluza|atum/, /patinho|lombo|file|bife|carne magra/, /iogurte|coalhada|whey|leite desnatado/, /aveia|farelo/, /queijo fresco|queijo|ricota|requeijao/, /feij|lentilha|grao de bico/, /salada|legume|verdura|brocolis|couve/, /fruta|banana|maca|mamao|manga|morango|kiwi/, /arroz|mandioca|batata doce|batata|macarrao/, /pao integral|tapioca|integral|chia|linhaca|mix funcional/];
  function analisarTexto(texto) {
    const t = norm(texto);
    const tDoce = t.replace(/batata doce|sem acucar|sem adicao de acucar|zero acucar|cacau|chocolate em po|colher de sobremesa|col sobremesa|prato de sobremesa/g, ' ');
    const flags = [];
    if (RX.frito.test(t)) flags.push({ cod: 'frito', pts: -10, txt: 'Tem fritura ou salgado (o plano pede evitar frituras)' });
    if (RX.ultra.test(t)) flags.push({ cod: 'ultra', pts: -6, txt: 'Tem alimento processado/ultraprocessado' });
    if (RX.doce.test(tDoce)) flags.push({ cod: 'doce', pts: -6, txt: 'Tem doce ou açúcar adicionado' });
    const bonus = []; if (RX.veg.test(t)) bonus.push({ cod: 'veg', pts: 4, txt: 'Inclui vegetais' }); if (RX.fruta.test(t)) bonus.push({ cod: 'fruta', pts: 4, txt: 'Inclui fruta' });
    const grupos = GRUPOS_PLANO.reduce((n, rx) => n + (rx.test(t) ? 1 : 0), 0);
    return { flags, bonus, grupos, vermelha: RX.vermelha.test(t), texto: t };
  }

  // ---------- pontuação ----------
  function alvosDoDia(metas, ativos) {
    const sk = ativos.reduce((s, id) => s + SLOT_POR_ID[id].kcal, 0), sp = ativos.reduce((s, id) => s + SLOT_POR_ID[id].prot, 0);
    const kcal = num(metas.calorias) || 2000, prot = num(metas.proteinas) || 160;
    return Object.fromEntries(ativos.map(id => [id, { kcal: Math.round(kcal * SLOT_POR_ID[id].kcal / sk), prot: Math.round(prot * SLOT_POR_ID[id].prot / sp) }]));
  }
  // m: { slot, alimentos, kcal, prot, carb, gord, origem } ; ctx: { objetivo, alvos: { slotId: {kcal, prot} } }
  function pontuar(m, ctx) {
    const alvo = (ctx.alvos && ctx.alvos[m.slot]) || { kcal: 450, prot: 30 };
    const an = m._an || analisarTexto(m.alimentos);
    const kcal = num(m.kcal), prot = num(m.prot), tol = TOL[ctx.objetivo] || TOL.manutencao;
    const rel = alvo.kcal ? (kcal - alvo.kcal) / alvo.kcal : 0;
    const desvio = rel < 0 ? Math.max(0, -rel - tol.baixo) : Math.max(0, rel - tol.alto);
    const ptsK = 35 * Math.max(0, 1 - desvio / 0.45);
    const ratio = alvo.prot ? prot / alvo.prot : 1;
    const ptsP = 30 * (ratio >= 0.9 ? 1 : Math.max(0, (ratio - 0.3) / 0.6));
    let q = 12; an.bonus.forEach(b => { q += b.pts; }); an.flags.forEach(f => { q += f.pts; });
    if (kcal > 0 && num(m.gord) * 9 / kcal > 0.45) q -= 4;
    q = Math.max(0, Math.min(20, q));
    const ptsA = m.origem === 'plano' ? 15 : Math.min(15, an.grupos * 3);
    const score = Math.round(ptsK + ptsP + q + ptsA);
    const motivos = [];
    motivos.push(desvio === 0 ? `Calorias adequadas para ${(SLOT_POR_ID[m.slot] || {}).nome || 'a refeição'}: ${Math.round(kcal)} (alvo ≈ ${alvo.kcal}).` : `Calorias ${rel > 0 ? 'acima' : 'abaixo'} do esperado: ${Math.round(kcal)} (alvo ≈ ${alvo.kcal}).`);
    motivos.push(ratio >= 0.9 ? `Proteína boa: ${Math.round(prot)} g (alvo ≈ ${alvo.prot} g).` : `Proteína baixa: ${Math.round(prot)} g (alvo ≈ ${alvo.prot} g).`);
    an.flags.forEach(f => motivos.push(f.txt + '.')); an.bonus.forEach(b => motivos.push(b.txt + '.'));
    if (kcal > 0 && num(m.gord) * 9 / kcal > 0.45) motivos.push('Gordura alta (mais de 45% das calorias).');
    motivos.push(m.origem === 'plano' ? 'Segue as opções do plano da nutricionista.' : (an.grupos >= 3 ? 'Parecida com o que o plano orienta.' : 'Pouco parecida com as opções do plano.'));
    return { score, partes: { calorias: Math.round(ptsK), proteina: Math.round(ptsP), qualidade: Math.round(q), plano: Math.round(ptsA) }, motivos, vermelha: an.vermelha };
  }
  const faixa = s => s >= 80 ? 'Ótima' : s >= 60 ? 'Boa' : s >= 40 ? 'Regular' : 'Fraca';

  // ---------- candidatos ----------
  function candidatosHistorico(registros, hoje, dias) {
    const ini = somaDias(hoje, -(dias || 120)), mapa = new Map();
    (registros || []).forEach(r => {
      const slot = SLOT_POR_REFEICAO[r.refeicao]; if (!slot || !r.alimentos || String(r.data) < ini) return;
      const kcal = num(r.calorias); if (kcal < 40 || kcal > 1400) return;
      const k = 'h:' + norm(r.alimentos).slice(0, 160); if (!norm(r.alimentos)) return;
      const c = mapa.get(k);
      if (c) { c.freq++; if (String(r.data) > c._ult) { c._ult = String(r.data); Object.assign(c, { kcal, prot: num(r.proteinas), carb: num(r.carboidratos), gord: num(r.gorduras) }); } }
      else mapa.set(k, { ck: k, slot, origem: 'historico', alimentos: String(r.alimentos).trim(), kcal, prot: num(r.proteinas), carb: num(r.carboidratos), gord: num(r.gorduras), freq: 1, _ult: String(r.data) });
    });
    const por = { cafe: [], lancheM: [], almoco: [], lancheT: [], pre: [], jantar: [] };
    mapa.forEach(c => { c.fonte = c.freq > 1 ? `Do seu diário (${c.freq} vezes)` : 'Do seu diário'; por[c.slot].push(c); });
    return por;
  }
  function montarPools(registros, hoje) {
    const P = PLANO(), H = candidatosHistorico(registros, hoje);
    const uniq = (...ls) => { const v = new Set(), out = []; ls.flat().forEach(c => { if (!v.has(c.ck)) { v.add(c.ck); out.push(c); } }); return out; };
    const pools = {
      cafe: uniq(P.cafe, H.cafe), lancheM: uniq(P.lancheM, H.lancheM, H.lancheT.filter(c => c.kcal <= 300)),
      almoco: uniq(P.almoco, H.almoco), lancheT: uniq(P.lancheT, P.cafe, H.lancheT, H.cafe.filter(c => c.kcal <= 550)),
      pre: uniq(P.pre, H.pre, H.lancheM, H.lancheT.filter(c => c.kcal <= 300)), jantar: uniq(P.jantar, P.almoco, H.jantar, H.almoco)
    };
    Object.values(pools).forEach(l => l.forEach(c => { c._an = analisarTexto(c.alimentos); c.vermelha = c.vermelha || c._an.vermelha; }));
    return pools;
  }

  // ---------- geração ----------
  const BONUS_HIST = 12, MAX_USO = 2; // prefere o que você já come quando a nota é parecida
  function gerarSemana(e) {
    const rnd = mulberry32(e.seed || 1), metas = e.metas || {}, objetivo = e.objetivo || 'manutencao';
    const pools = e.pools || montarPools(e.registros, e.hoje), dias = e.dias || 7;
    const slotsOn = Object.assign({ cafe: true, lancheM: false, almoco: true, lancheT: true, jantar: true }, e.slotsOn || {});
    const treino = new Set(e.treinoDow || []), horarios = Object.assign({}, ...SLOTS.map(s => ({ [s.id]: s.hora })), e.horarios || {});
    const mantidas = new Map(); // refeições travadas/editadas do plano anterior
    if (e.existente && e.existente.inicio === e.inicio) (e.existente.dias || []).forEach(d => (d.refeicoes || []).forEach(m => { if (m.travada || m.origem === 'manual') mantidas.set(d.data + '|' + m.slot, m); }));
    const uso = new Map(); let vermelhas = 0; const anterior = {};
    const marcarUso = c => { uso.set(c.ck, (uso.get(c.ck) || 0) + 1); if (c.vermelha) vermelhas++; };
    let escolhidas = {};
    const vDia = exceto => Object.keys(escolhidas).reduce((n, s2) => { if (s2 === exceto) return n; const x = escolhidas[s2], r = x && (x.fixa || x.c); return n + (r && r.vermelha ? 1 : 0); }, 0);
    const temFrito = c => c._an.flags.some(f => f.cod === 'frito'); // o plano pede evitar frituras: só entram se não houver alternativa
    const permitido = (c, slot, usadosNoDia, folga) => !(uso.get(c.ck) >= MAX_USO + folga) && !(c.vermelha && vermelhas + vDia(slot) >= 2) && !usadosNoDia.has(c.ck) && !(anterior[slot] === c.ck && folga < 1) && !(temFrito(c) && folga < 3);
    const out = { inicio: e.inicio, geradoEm: e.agora || new Date().toISOString(), objetivo, dias: [] };
    for (let i = 0; i < dias; i++) {
      const data = somaDias(e.inicio, i), ativos = SLOTS.filter(s => slotsOn[s.id] || (s.id === 'pre' && treino.has(dow(data)))).map(s => s.id);
      const alvos = alvosDoDia(metas, ativos), ctx = { objetivo, alvos }, dia = { data, refeicoes: [] }, usadosNoDia = new Set();
      escolhidas = {};
      const pontuarC = (c, slot) => pontuar({ slot, alimentos: c.alimentos, kcal: c.kcal, prot: c.prot, carb: c.carb, gord: c.gord, origem: c.origem, _an: c._an }, ctx);
      ativos.forEach(slot => {
        const fixa = mantidas.get(data + '|' + slot);
        if (fixa) { escolhidas[slot] = { fixa }; if (fixa.ck) { uso.set(fixa.ck, (uso.get(fixa.ck) || 0) + 1); } usadosNoDia.add(fixa.ck); return; }
        let folga = 0, pick = null;
        while (!pick && folga < 4) {
          const ranq = pools[slot].filter(c => permitido(c, slot, usadosNoDia, folga)).map(c => { const p = pontuarC(c, slot); return { c, p, adj: p.score + (c.origem === 'historico' ? BONUS_HIST + Math.min(4, c.freq - 1) : 0) + rnd() * 10 }; }).sort((a, b) => b.adj - a.adj);
          if (ranq.length) pick = ranq[0]; else folga++;
        }
        if (pick) { escolhidas[slot] = pick; usadosNoDia.add(pick.c.ck); }
      });
      // Ajuste do dia: tenta trocar refeições para chegar perto da meta de calorias e proteína sem perder qualidade
      const totais = () => { let k = 0, p = 0; ativos.forEach(s => { const x = escolhidas[s]; if (!x) return; const r = x.fixa || x.c; k += num(r.kcal); p += num(r.prot); }); return { k, p }; };
      const penal = () => { const t = totais(), mk = num(metas.calorias) || 2000, mp = num(metas.proteinas) || 160, dk = (t.k - mk) / mk; const dkAdj = dk > 0 ? dk * (objetivo === 'perda' ? 1.5 : 1) : -dk * (objetivo === 'ganho' ? 1.5 : 1);  return Math.max(0, dkAdj - 0.06) + 1.5 * Math.max(0, 0.9 - t.p / mp); };
      for (let passo = 0; passo < 2; passo++) {
        ativos.forEach(slot => {
          const atual = escolhidas[slot]; if (!atual || atual.fixa) return;
          const base = atual.p.score + (atual.c.origem === 'historico' ? BONUS_HIST : 0) - 300 * penal();
          let melhor = { v: base, x: atual };
          pools[slot].map(c => ({ c, p: pontuarC(c, slot) })).sort((a, b) => b.p.score - a.p.score).slice(0, 14).forEach(x => {
            if (x.c.ck === atual.c.ck || usadosNoDia.has(x.c.ck) || (x.c.vermelha && !atual.c.vermelha && vermelhas + vDia(slot) >= 2) || temFrito(x.c) || (uso.get(x.c.ck) || 0) >= MAX_USO) return;
            escolhidas[slot] = x; const v = x.p.score + (x.c.origem === 'historico' ? BONUS_HIST : 0) - 300 * penal() + rnd() * 3;
            if (v > melhor.v + 1) melhor = { v, x };
          });
          escolhidas[slot] = atual;
          if (melhor.x !== atual) { usadosNoDia.delete(atual.c.ck); usadosNoDia.add(melhor.x.c.ck); escolhidas[slot] = melhor.x; }
        });
      }
      ativos.forEach(slot => {
        const x = escolhidas[slot]; if (!x) return;
        if (x.fixa) { dia.refeicoes.push(Object.assign({}, x.fixa, { score: undefined })); anterior[slot] = x.fixa.ck; if (x.fixa.vermelha) vermelhas++; return; }
        marcarUso(x.c); anterior[slot] = x.c.ck;
        dia.refeicoes.push({ id: `${data}-${slot}`, slot, hora: horarios[slot], alimentos: x.c.alimentos, kcal: Math.round(x.c.kcal), prot: Math.round(x.c.prot), carb: Math.round(x.c.carb), gord: Math.round(x.c.gord), origem: x.c.origem, fonte: x.c.fonte, ck: x.c.ck, vermelha: !!x.c.vermelha, travada: false });
      });
      // pontuação final de cada refeição (inclusive as mantidas)
      dia.refeicoes.forEach(m => { const p = pontuar(m, ctx); m.score = p.score; m.partes = p.partes; m.motivos = p.motivos; m.vermelha = p.vermelha || !!m.vermelha; });
      dia.refeicoes.sort((a, b) => String(a.hora).localeCompare(String(b.hora)));
      out.dias.push(dia);
    }
    return out;
  }

  // ---------- resumos ----------
  function resumoDia(dia, metas, objetivo) {
    const t = dia.refeicoes.reduce((a, m) => { a.kcal += num(m.kcal); a.prot += num(m.prot); a.carb += num(m.carb); a.gord += num(m.gord); a.n++; a.soma += num(m.score); return a; }, { kcal: 0, prot: 0, carb: 0, gord: 0, n: 0, soma: 0 });
    const mk = num(metas.calorias) || 2000, mp = num(metas.proteinas) || 160, tol = TOL[objetivo] || TOL.manutencao;
    const rel = (t.kcal - mk) / mk, desv = rel < 0 ? Math.max(0, -rel - tol.baixo / 2) : Math.max(0, rel - tol.alto / 2);
    const fitK = Math.max(0, 1 - desv / 0.4), fitP = t.prot / mp >= 0.9 ? 1 : Math.max(0, (t.prot / mp - 0.4) / 0.5);
    const media = t.n ? t.soma / t.n : 0;
    return { kcal: Math.round(t.kcal), prot: Math.round(t.prot), carb: Math.round(t.carb), gord: Math.round(t.gord), pctK: Math.round(100 * t.kcal / mk), pctP: Math.round(100 * t.prot / mp), score: Math.round(0.5 * media + 25 * fitK + 25 * fitP), mediaRefeicoes: Math.round(media) };
  }
  function resumoSemana(plano, metas) {
    const rs = plano.dias.map(d => resumoDia(d, metas, plano.objetivo));
    const n = rs.length || 1, soma = k => rs.reduce((s, r) => s + r[k], 0);
    const refs = plano.dias.flatMap(d => d.refeicoes);
    return { scoreMedio: Math.round(soma('score') / n), kcalMedia: Math.round(soma('kcal') / n), protMedia: Math.round(soma('prot') / n), diasProt90: rs.filter(r => r.pctP >= 90).length, diasKcalOk: rs.filter(r => Math.abs(r.pctK - 100) <= 10).length,
      vermelhas: refs.filter(m => m.vermelha).length, fritos: refs.filter(m => analisarTexto(m.alimentos).flags.some(f => f.cod === 'frito')).length, refeicoes: refs.length, dias: n };
  }
  function alternativas(slot, ctx, excluirCk, n, rnd) {
    return montarPoolsCache.pools[slot].filter(c => c.ck !== excluirCk).map(c => { const p = pontuar({ slot, alimentos: c.alimentos, kcal: c.kcal, prot: c.prot, carb: c.carb, gord: c.gord, origem: c.origem, _an: c._an }, ctx); return { c, p, adj: p.score + (c.origem === 'historico' ? BONUS_HIST : 0) + (rnd ? rnd() * 12 : 0) }; }).sort((a, b) => b.adj - a.adj).slice(0, n || 8);
  }
  const montarPoolsCache = { pools: null };
  function prepararPools(registros, hoje) { montarPoolsCache.pools = montarPools(registros, hoje); return montarPoolsCache.pools; }

  root.CardapioMotor = { SLOTS, SLOT_POR_ID, SLOT_POR_REFEICAO, TOL, norm, dataStr, parseData, somaDias, dow, mulberry32, analisarTexto, alvosDoDia, pontuar, faixa, candidatosHistorico, montarPools, prepararPools, gerarSemana, resumoDia, resumoSemana, alternativas, plano: PLANO };
})(typeof window !== 'undefined' ? window : globalThis);
