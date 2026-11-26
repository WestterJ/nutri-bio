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

  // ---------- catálogo de alimentos padronizados (valores aproximados, estilo tabela TACO) ----------
  // id: [nome, grupo, unidade, passo, quantidade padrão, kcal, prot, carb, gord, referência da quantidade (100 = por 100 g/mL; 1 = por unidade), vermelha?]
  const GRUPOS = { prot: 'Carnes, peixes e ovos', lat: 'Laticínios e whey', carb: 'Carboidratos', leg: 'Leguminosas', veg: 'Frutas e vegetais', ext: 'Gorduras, sementes e extras', out: 'Outros (vida real)' };
  const CAT = {
    frango: ['Frango grelhado (peito)', 'prot', 'g', 10, 120, 159, 32, 0, 2.5, 100], patinho: ['Patinho grelhado', 'prot', 'g', 10, 120, 219, 35.9, 0, 7.3, 100, 1],
    contra: ['Contrafilé grelhado', 'prot', 'g', 10, 120, 278, 32, 0, 16, 100, 1], moida: ['Carne moída refogada', 'prot', 'g', 10, 100, 192, 25, 0, 10, 100, 1],
    panela: ['Carne de panela magra', 'prot', 'g', 10, 120, 200, 28.3, 0, 8.8, 100, 1], lombo: ['Lombo suíno assado', 'prot', 'g', 10, 100, 200, 32, 0, 7.5, 100],
    peixe: ['Peixe grelhado (tilápia)', 'prot', 'g', 10, 120, 128, 25, 0, 2.5, 100], coxa: ['Coxa e sobrecoxa assadas sem pele', 'prot', 'g', 10, 150, 180, 22, 0, 9.8, 100],
    atum: ['Atum em água', 'prot', 'g', 10, 80, 118, 25, 0, 1, 100], frangoDesf: ['Frango desfiado', 'prot', 'col. sopa', 1, 2, 33, 6.2, 0, 0.75, 1],
    carneDesf: ['Carne desfiada', 'prot', 'col. sopa', 1, 4, 40, 6, 0, 1.75, 1, 1], espetinho: ['Espetinho de carne magra', 'prot', 'un', 1, 1, 170, 26, 0, 7, 1, 1],
    almondega: ['Almôndega média', 'prot', 'un', 1, 3, 77, 7.3, 2.7, 4, 1, 1], ovo: ['Ovo', 'prot', 'un', 1, 2, 72, 6.3, 0.4, 5, 1],
    queijoFresco: ['Queijo fresco (fatia de 30 g)', 'lat', 'fatia', 1, 1, 80, 5.4, 1, 6, 1], mucarela: ['Muçarela', 'lat', 'fatia', 1, 1, 60, 4.3, 0.5, 4.5, 1],
    coalho: ['Queijo coalho (espetinho)', 'lat', 'un', 1, 1, 150, 10, 1, 11, 1], requeijao: ['Requeijão light', 'lat', 'col. sobremesa', 1, 1, 22, 1.2, 1, 1.5, 1],
    reqZero: ['Requeijão zero lactose light', 'lat', 'col. sopa', 1, 1, 30, 1.6, 1.4, 2, 1], iogDesn: ['Iogurte desnatado natural', 'lat', 'pote', 0.5, 1, 80, 6, 10, 0.5, 1],
    iogGrego: ['Iogurte grego (100 g)', 'lat', 'pote', 0.5, 1, 100, 8, 6, 5, 1], coalhada: ['Coalhada triplo zero', 'lat', 'xícara', 0.5, 1, 70, 8, 8, 0, 1],
    leite: ['Leite desnatado', 'lat', 'mL', 50, 200, 35, 3.4, 5, 0.1, 100], whey: ['Whey isolado (scoop de 30 g)', 'lat', 'scoop', 0.5, 0.5, 110, 27, 1, 0.4, 1],
    arroz: ['Arroz cozido (branco ou integral)', 'carb', 'g', 10, 100, 128, 2.6, 27, 0.5, 100], mandioca: ['Mandioca cozida', 'carb', 'g', 10, 100, 125, 0.6, 30, 0.3, 100],
    batata: ['Batata inglesa cozida', 'carb', 'g', 10, 120, 77, 2, 17.5, 0.1, 100], batataDoce: ['Batata-doce cozida', 'carb', 'g', 10, 120, 77, 1.2, 18.3, 0.1, 100],
    macarrao: ['Macarrão cozido', 'carb', 'g', 10, 80, 156, 5.4, 31, 0.8, 100], milho: ['Milho refogado', 'carb', 'g', 10, 100, 110, 3.2, 19, 2.5, 100],
    paoFrances: ['Pão francês', 'carb', 'un', 0.5, 1, 150, 4.8, 29, 1.8, 1], paoForma: ['Pão de forma sem açúcar', 'carb', 'fatia', 1, 1, 65, 2.1, 12, 0.9, 1], paoInt: ['Pão integral', 'carb', 'fatia', 1, 1, 62, 2.6, 11, 1, 1],
    tapiocaGoma: ['Goma de tapioca', 'carb', 'col. sopa', 1, 2, 50, 0, 12.4, 0, 1], peta: ['Peta', 'carb', 'un', 1, 4, 25, 0.25, 4.5, 0.6, 1], rap10: ['Rap 10', 'carb', 'un', 1, 1, 130, 3.5, 24, 2.5, 1],
    aveiaFlocos: ['Aveia em flocos finos', 'carb', 'col. sopa', 1, 1, 39, 1.4, 6.7, 0.8, 1], farelo: ['Farelo de aveia', 'carb', 'col. sopa', 1, 1, 25, 1.7, 6.6, 0.7, 1], panqueca: ['Panqueca de aveia salgada', 'carb', 'un', 1, 1, 150, 9, 8, 7.8, 1],
    feijao: ['Feijão carioca cozido', 'leg', 'g', 10, 86, 76, 4.8, 13.7, 0.5, 100], grao: ['Grão-de-bico cozido', 'leg', 'g', 10, 45, 164, 8.7, 27, 2.4, 100], lentilha: ['Lentilha cozida', 'leg', 'g', 10, 60, 116, 8.3, 20, 0.7, 100],
    fruta: ['Fruta (1 porção)', 'veg', 'porção', 0.5, 1, 60, 0.8, 15, 0.2, 1], banana: ['Banana', 'veg', 'un', 0.5, 1, 60, 0.8, 15.5, 0.2, 1], maca: ['Maçã pequena', 'veg', 'un', 0.5, 1, 55, 0.2, 14.8, 0.2, 1],
    salada: ['Salada crua e cozida', 'veg', 'g', 10, 150, 27, 1.7, 5.3, 0.2, 100], legumes: ['Legumes cozidos', 'veg', 'g', 10, 150, 27, 1, 5.3, 0.2, 100],
    azeiteSob: ['Azeite extra virgem', 'ext', 'col. sobremesa', 1, 1, 70, 0, 0, 8, 1], azeiteCha: ['Fio de azeite', 'ext', 'col. chá', 1, 1, 36, 0, 0, 4, 1], mix: ['Mix funcional', 'ext', 'col. sopa', 1, 1, 62, 2.6, 3.5, 4.8, 1],
    chia: ['Chia', 'ext', 'col. sopa', 0.5, 1, 49, 1.7, 4.2, 3.1, 1], cacau: ['Cacau em pó 50%', 'ext', 'col. chá', 1, 1, 8, 0.6, 1, 0.4, 1], geleia: ['Geleia 100% fruta', 'ext', 'col. sopa', 1, 1, 40, 0.1, 10, 0, 1],
    pastaAmend: ['Pasta de amendoim', 'ext', 'col. sopa', 1, 1, 90, 3.8, 3, 7.5, 1], cafe: ['Café ou chá sem açúcar', 'ext', 'xícara', 1, 1, 2, 0.1, 0, 0, 1], acucar: ['Açúcar', 'ext', 'col. chá', 1, 1, 20, 0, 5, 0, 1],
    coxinha: ['Coxinha', 'out', 'un', 1, 1, 250, 9, 28, 11, 1], pastel: ['Pastel frito', 'out', 'un', 1, 1, 300, 9, 30, 16, 1], paoQueijo: ['Pão de queijo', 'out', 'un', 1, 1, 85, 2, 8, 5, 1],
    brigadeiro: ['Brigadeiro', 'out', 'un', 1, 1, 90, 1, 12, 4, 1], bolo: ['Bolo simples', 'out', 'fatia', 1, 1, 190, 3, 30, 6, 1], refri: ['Refrigerante', 'out', 'lata', 1, 1, 140, 0, 35, 0, 1]
  };
  const fmtQ = q => String(Math.round(q * 100) / 100).replace('.', ',');
  const catInfo = id => { const c = CAT[id]; if (!c) throw new Error('alimento desconhecido: ' + id); return { id, nome: c[0], grupo: c[1], un: c[2], passo: c[3], padrao: c[4], k: c[5], p: c[6], c: c[7], g: c[8], ref: c[9], vermelha: !!c[10] }; };
  // itens: [{ id, q }] → macros somados e texto "Nome (q un)"
  function macrosItens(itens) {
    return (itens || []).reduce((a, it) => { const c = CAT[it.id]; if (!c) return a; const f = num(it.q) / c[9]; a.kcal += c[5] * f; a.prot += c[6] * f; a.carb += c[7] * f; a.gord += c[8] * f; if (c[10] && num(it.q) > 0) a.vermelha = true; return a; }, { kcal: 0, prot: 0, carb: 0, gord: 0, vermelha: false });
  }
  const textoItens = itens => (itens || []).filter(it => CAT[it.id] && num(it.q) > 0).map(it => `${CAT[it.id][0]} (${fmtQ(num(it.q))} ${CAT[it.id][2]})`).join(' + ');

  // ---------- ingredientes do plano: [descrição na medida do plano, itens padronizados] ----------
  const I = (id, q) => ({ id, q });
  const ING = {
    paoFrances: ['Meio pão francês', [I('paoFrances', 0.5)]], paoForma: ['1 fatia de pão de forma sem açúcar', [I('paoForma', 1)]], paoFranc1: ['1 pão francês', [I('paoFrances', 1)]],
    paoInt: ['1 fatia de pão integral', [I('paoInt', 1)]], paoInt2: ['2 fatias de pão integral', [I('paoInt', 2)]],
    tapioca: ['Tapioca (2 col. sopa de goma, 30 g) com 1 col. sobremesa de chia', [I('tapiocaGoma', 2), I('chia', 0.5)]], tapioca3: ['Tapioca (3 col. sopa de goma) com 1 col. sopa de chia', [I('tapiocaGoma', 3), I('chia', 1)]],
    peta: ['Peta (4 unidades médias)', [I('peta', 4)]], ovos2: ['2 ovos', [I('ovo', 2)]], ovos3: ['3 ovos cozidos', [I('ovo', 3)]], frango2: ['2 col. sopa de frango desfiado', [I('frangoDesf', 2)]],
    queijoFresco: ['1 fatia de queijo fresco (30 g)', [I('queijoFresco', 1)]], mucarela: ['1 fatia de muçarela', [I('mucarela', 1)]], requeijao: ['1 col. sobremesa de requeijão light', [I('requeijao', 1)]],
    fruta: ['1 porção de fruta', [I('fruta', 1)]], farelo1: ['1 col. sopa de farelo de aveia', [I('farelo', 1)]], farelo2: ['2 col. sopa de farelo de aveia', [I('farelo', 2)]],
    cafe: ['Café ou chá sem açúcar', [I('cafe', 1)]], coalhada: ['1 xícara de coalhada triplo zero', [I('coalhada', 1)]], iogurte: ['1 pote de iogurte desnatado natural', [I('iogDesn', 1)]],
    whey15: ['Meia dose de whey isolado (15 g)', [I('whey', 0.5)]], mix: ['1 col. sopa de mix funcional', [I('mix', 1)]],
    omelete: ['Omelete de 2 ovos com vegetais à vontade', [I('ovo', 2), I('legumes', 50), I('azeiteCha', 1)]], leiteCacau: ['100 mL de leite desnatado com 1 col. chá de cacau 50%', [I('leite', 100), I('cacau', 1)]],
    pateFrango: ['Patê de frango (3 col. sopa de frango, requeijão light e cenoura)', [I('frangoDesf', 3), I('requeijao', 1), I('legumes', 20)]], pateAtum: ['Patê de atum (atum ralado, requeijão light e cenoura)', [I('atum', 60), I('requeijao', 1), I('legumes', 20)]],
    reqZero: ['1 col. sopa de requeijão zero lactose light', [I('reqZero', 1)]],
    shakeIog: ['Shake: iogurte desnatado zero lactose, 2 col. sopa de farelo de aveia, fruta e 15 g de whey isolado', [I('iogDesn', 1), I('farelo', 2), I('fruta', 1), I('whey', 0.5)]],
    shakeLeite: ['Shake: 200 mL de leite desnatado zero lactose, 2 col. sopa de farelo de aveia, fruta e 15 g de whey isolado', [I('leite', 200), I('farelo', 2), I('fruta', 1), I('whey', 0.5)]],
    pre1: ['1 porção de fruta com 80 g de iogurte desnatado zero lactose e 1 col. sobremesa de aveia em flocos finos', [I('fruta', 1), I('iogDesn', 0.5), I('aveiaFlocos', 0.7)]], geleia: ['1 col. sopa de geleia de frutas 100% fruta', [I('geleia', 1)]],
    salada: ['Salada crua e cozida (meio prato)', [I('salada', 150)]], legumes: ['Legumes cozidos com 1 col. sobremesa de azeite', [I('legumes', 150), I('azeiteSob', 1)]],
    arroz: ['Arroz (2 col. de servir rasas, 100 g)', [I('arroz', 100)]], mandioca: ['Mandioca cozida (100 g)', [I('mandioca', 100)]], batata: ['Batata inglesa cozida (1 pequena, 120 g)', [I('batata', 120)]],
    batataDoce: ['Batata-doce cozida (3 fatias, 120 g)', [I('batataDoce', 120)]], macarrao: ['Macarrão cozido (1 pegador, 80 g)', [I('macarrao', 80)]], milho: ['Milho refogado (4 col. sopa, 100 g)', [I('milho', 100)]],
    bife: ['Bife magro grelhado (120 g)', [I('patinho', 120)]], file: ['Filé de frango grelhado (120 g)', [I('frango', 120)]], lombo: ['Lombo suíno magro (100 g)', [I('lombo', 100)]],
    peixe: ['Filé de peixe grelhado (120 g)', [I('peixe', 120)]], almondega: ['3 almôndegas médias (120 g)', [I('almondega', 3)]], moida: ['Carne moída magra (5 col. sopa, 120 g)', [I('moida', 120)]],
    coxa: ['Coxa e sobrecoxa assadas sem pele (150 g)', [I('coxa', 150)]], panela: ['Carne de panela magra (120 g)', [I('panela', 120)]],
    feijao: ['Feijão carioca (1 concha média, 86 g)', [I('feijao', 86)]], graoBico: ['Grão-de-bico (meia concha, 45 g)', [I('grao', 45)]], lentilha: ['Lentilha (meia concha, 60 g)', [I('lentilha', 60)]],
    espetinho: ['1 espetinho magro assado', [I('espetinho', 1)]], coalho: ['1 espetinho de queijo coalho', [I('coalho', 1)]], mand1: ['1 col. de servir de mandioca cozida', [I('mandioca', 60)]],
    frango3: ['3 col. sopa de frango desfiado', [I('frangoDesf', 3)]], vegs: ['Tomate, cenoura e brócolis', [I('legumes', 100)]],
    panqueca: ['Panqueca de aveia salgada', [I('panqueca', 1)]], recFrango: ['Recheio de 4 col. sopa de frango desfiado', [I('frangoDesf', 4)]], recCarne: ['Recheio de 4 col. sopa de carne moída', [I('carneDesf', 4)]],
    macSalada: ['1 col. de servir cheia de macarrão cozido', [I('macarrao', 60)]], saladaCrua: ['1 prato de sobremesa de salada crua', [I('salada', 100)]], rap10: ['1 rap 10', [I('rap10', 1)]],
    atum4: ['4 col. sopa de atum ralado em água', [I('atum', 80)]], frango4: ['4 col. sopa de frango desfiado', [I('frangoDesf', 4)]], carne4: ['4 col. sopa de carne desfiada', [I('carneDesf', 4)]]
  };
  const macrosDe = keys => {
    const itens = [];
    const texto = keys.map(k => { const i = ING[k]; if (!i) throw new Error('ingrediente desconhecido: ' + k); i[1].forEach(it => { const ja = itens.find(x => x.id === it.id); if (ja) ja.q += it.q; else itens.push({ id: it.id, q: it.q }); }); return i[0]; });
    const m = macrosItens(itens);
    return Object.assign(m, { texto, itens });
  };

  // ---------- catálogo: opções do plano da nutricionista ----------
  function montarPlano() {
    const lista = { cafe: [], lancheM: [], almoco: [], lancheT: [], pre: [], jantar: [] };
    const add = (slot, id, fonte, keys) => { const m = macrosDe(keys); lista[slot].push({ ck: 'p:' + id, slot, origem: 'plano', fonte, alimentos: m.texto.join(' + '), itens: m.itens, kcal: Math.round(m.kcal), prot: Math.round(m.prot), carb: Math.round(m.carb), gord: Math.round(m.gord), vermelha: m.vermelha, freq: 0 }); };
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
  // V53: score de uma refeição já lançada no Diário (mesma conta do cardápio). Retorna null sem estimativa de calorias ou para "Ceia".
  function pontuarRegistro(r, metas, objetivo, slotsBase) {
    const slot = SLOT_POR_REFEICAO[r && r.refeicao]; if (!slot) return null;
    const kcal = num(r.calorias); if (!(kcal > 0)) return null;
    const ativos = Array.from(new Set([...(slotsBase && slotsBase.length ? slotsBase : ['cafe', 'almoco', 'lancheT', 'jantar']), slot]));
    const alvos = alvosDoDia(metas || {}, ativos);
    return pontuar({ slot, alimentos: r.alimentos, kcal, prot: r.proteinas, carb: r.carboidratos, gord: r.gorduras, origem: 'diario' }, { objetivo: objetivo || 'manutencao', alvos });
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
    const slotsOn = Object.assign({ cafe: true, lancheM: false, almoco: true, lancheT: true, jantar: true, pre: true }, e.slotsOn || {});
    const treino = new Set(e.treinoDow || []), horarios = Object.assign({}, ...SLOTS.map(s => ({ [s.id]: s.hora })), e.horarios || {});
    const mantidas = new Map(); // refeições travadas/editadas do plano anterior
    if (e.existente && e.existente.inicio === e.inicio) (e.existente.dias || []).forEach(d => (d.refeicoes || []).forEach(m => { if (m.travada || m.origem === 'manual') mantidas.set(d.data + '|' + m.slot, m); }));
    const removidas = new Set(e.existente && e.existente.inicio === e.inicio ? (e.existente.removidas || []) : []); // refeições que você removeu de um dia
    const uso = new Map(); let vermelhas = 0; const anterior = {};
    const marcarUso = c => { uso.set(c.ck, (uso.get(c.ck) || 0) + 1); if (c.vermelha) vermelhas++; };
    let escolhidas = {};
    const vDia = exceto => Object.keys(escolhidas).reduce((n, s2) => { if (s2 === exceto) return n; const x = escolhidas[s2], r = x && (x.fixa || x.c); return n + (r && r.vermelha ? 1 : 0); }, 0);
    const temFrito = c => c._an.flags.some(f => f.cod === 'frito'); // o plano pede evitar frituras: só entram se não houver alternativa
    const permitido = (c, slot, usadosNoDia, folga) => !(uso.get(c.ck) >= MAX_USO + folga) && !(c.vermelha && vermelhas + vDia(slot) >= 2) && !usadosNoDia.has(c.ck) && !(anterior[slot] === c.ck && folga < 1) && !(temFrito(c) && folga < 3);
    const out = { inicio: e.inicio, geradoEm: e.agora || new Date().toISOString(), objetivo, dias: [], removidas: [...removidas] };
    for (let i = 0; i < dias; i++) {
      const data = somaDias(e.inicio, i), ativos = SLOTS.filter(s => (mantidas.has(data + '|' + s.id)) || (!removidas.has(data + '|' + s.id) && (s.id === 'pre' ? (slotsOn.pre !== false && treino.has(dow(data))) : !!slotsOn[s.id]))).map(s => s.id);
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
        dia.refeicoes.push({ id: `${data}-${slot}`, slot, hora: horarios[slot], alimentos: x.c.alimentos, itens: x.c.itens ? x.c.itens.map(it => ({ id: it.id, q: it.q })) : undefined, kcal: Math.round(x.c.kcal), prot: Math.round(x.c.prot), carb: Math.round(x.c.carb), gord: Math.round(x.c.gord), origem: x.c.origem, fonte: x.c.fonte, ck: x.c.ck, vermelha: !!x.c.vermelha, travada: false });
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

  root.CardapioMotor = { pontuarRegistro, CAT, GRUPOS, catInfo, macrosItens, textoItens, SLOTS, SLOT_POR_ID, SLOT_POR_REFEICAO, TOL, norm, dataStr, parseData, somaDias, dow, mulberry32, analisarTexto, alvosDoDia, pontuar, faixa, candidatosHistorico, montarPools, prepararPools, gerarSemana, resumoDia, resumoSemana, alternativas, plano: PLANO };
})(typeof window !== 'undefined' ? window : globalThis);
