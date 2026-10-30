import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Secrets: GEMINI_API_KEY (obrigatório). Opcionais: GEMINI_MODEL, AI_DAILY_LIMIT (padrão 60), ALLOWED_ORIGIN (padrão *),
// GEMINI_THINKING_BUDGET (raciocínio interno dos demais modos; o modo "refeicao" sempre usa 0),
// GEMINI_MODEL_FALLBACK (modelo reserva do modo "refeicao"; padrão gemini-3.1-flash-lite; "off" desativa).
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'server-timing',
};
// timing: valor do cabeçalho Server-Timing (pre = autenticação + limite diário; gemini = chamada ao Gemini), lido pelo app para o log ia_logs.
const json = (data: unknown, status = 200, timing = '') =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', ...(timing ? { 'Server-Timing': timing } : {}) } });

// Tempo máximo da chamada ao Gemini (ms); abaixo do limite de ~150 s da plataforma, para devolver um erro claro.
const TIMEOUT_MS = Number(Deno.env.get('GEMINI_TIMEOUT_MS') || 100000);
// Orçamento total de tempo (ms) incluindo novas tentativas; abaixo do limite de ~150 s da plataforma.
const BUDGET_MS = 125000;
// Modo rápido (refeição por texto/foto): uma única tentativa, tempo curto, sem novas tentativas por erro 5xx.
// Fica abaixo do tempo limite do app (30 s) para o erro chegar com mensagem clara.
const TIMEOUT_RAPIDO_MS = 25000;
// No modo rápido, se o modelo principal não responder neste tempo (ou der 404/429/500/503/504), a função tenta o modelo reserva.
const TIMEOUT_PRIMARIO_MS = 12000;
const ehTimeout = (e: unknown) => ['TimeoutError', 'AbortError'].includes((e as Error)?.name);
// Modos de texto longo (sem anexos): limite de entrada (caracteres), de saída (tokens) e temperatura.
// Modo com imagem: true aceita também anexos de imagem (texto curto + até 1 imagem), com saída maior.
const MODOS: Record<string, { texto: number; tokens: number; temp: number; imagem?: boolean; rapido?: boolean }> = {
  relatorio: { texto: 14000, tokens: 3500, temp: 0.3 }, // análise do diário alimentar
  edital: { texto: 100000, tokens: 16000, temp: 0.1 },  // análise de edital (Planejador de Estudos)
  agenda: { texto: 4000, tokens: 8000, temp: 0.1, imagem: true }, // foto de calendário escolar (Planner Escolar)
  refeicao: { texto: 4000, tokens: 1200, temp: 0.2, imagem: true, rapido: true }, // Texto IA / Foto IA do lançamento de refeições
};
const MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

// Aceita somente o formato que o app usa; nada além disso chega ao Gemini.
// Com modo (relatorio/edital): só texto, com limite maior de entrada e de saída.
function validar(body: any, modo: { texto: number; imagem?: boolean } | null = null): string | null {
  const sys = body?.systemInstruction?.parts?.[0]?.text;
  if (typeof sys !== 'string' || sys.length > 8000) return 'Instrução inválida.';
  const contents = body?.contents;
  if (!Array.isArray(contents) || contents.length !== 1 || contents[0]?.role !== 'user') return 'Solicitação inválida.';
  const parts = contents[0].parts;
  if (!Array.isArray(parts) || parts.length < 1 || parts.length > (modo && !modo.imagem ? 1 : 2)) return 'Solicitação inválida.';
  for (const p of parts) {
    if (typeof p?.text === 'string') { if (p.text.length > (modo ? modo.texto : 4000)) return 'Texto muito longo.'; continue; }
    const d = p?.inlineData;
    if ((!modo || modo.imagem) && d && MIMES.includes(d.mimeType) && typeof d.data === 'string' && d.data.length <= 9_000_000) continue;
    return 'Conteúdo não permitido.';
  }
  if (!body?.generationConfig?.responseSchema) return 'Esquema ausente.';
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  const t0 = Date.now();
  let timing = '';
  try {
    const url = Deno.env.get('SUPABASE_URL'), anon = Deno.env.get('SUPABASE_ANON_KEY'), key = Deno.env.get('GEMINI_API_KEY');
    if (!url || !anon || !key) return json({ error: 'Configuração do servidor incompleta.' }, 500);

    const auth = req.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ')) return json({ error: 'Autenticação necessária.' }, 401);
    const sb = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await sb.auth.getUser();
    if (authError || !user) return json({ error: 'Sessão inválida ou expirada. Entre novamente no aplicativo.' }, 401);

    const body = await req.json();
    const nomeModo = String(body?.modo ?? '');
    const modo = MODOS[nomeModo] ?? null;
    const erro = validar(body, modo);
    if (erro) return json({ error: erro }, 400);

    // Limite diário por usuário (requer supabase/ai_usage.sql; sem a tabela, apenas avisa no log).
    // O uso só é registrado quando a IA responde com sucesso: falhas e timeouts não gastam o limite.
    const limite = Number(Deno.env.get('AI_DAILY_LIMIT') || 60);
    const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count, error: cErr } = await sb.from('ai_usage').select('id', { count: 'exact', head: true }).gte('created_at', desde);
    if (cErr) console.warn('ai_usage indisponível (aplique supabase/ai_usage.sql):', cErr.message);
    else if ((count ?? 0) >= limite) return json({ error: `Limite diário de ${limite} análises de IA atingido. Tente novamente amanhã.` }, 429);

    const inicio = Date.now();
    const preMs = inicio - t0;
    timing = `pre;dur=${preMs}`;
    const rapido = !!modo?.rapido;
    const timeoutMs = rapido ? TIMEOUT_RAPIDO_MS : TIMEOUT_MS;
    const budgetMs = rapido ? TIMEOUT_RAPIDO_MS + 3000 : BUDGET_MS;
    const model = Deno.env.get('GEMINI_MODEL') || 'gemini-3.8-flash';
    const reservaEnv = Deno.env.get('GEMINI_MODEL_FALLBACK') ?? 'gemini-3.1-flash-lite';
    const reserva = rapido && reservaEnv && reservaEnv.toLowerCase() !== 'off' && reservaEnv !== model ? reservaEnv : null;
    let modeloUsado = model;
    let motivo = '';
    // Server-Timing: pre = login + limite; gemini = tempo no Gemini; modelo = quem respondeu; reserva = por que o modelo reserva entrou.
    const tm = (gemMs?: number) => `pre;dur=${preMs}` + (gemMs !== undefined ? `, gemini;dur=${gemMs}` : '') + `, modelo;desc=${modeloUsado}` + (motivo ? `, reserva;desc=${motivo}` : '');
    timing = tm();
    const chamar = (m: string, generationConfig: unknown, systemInstruction: unknown, limiteMs: number) => fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, // chave no cabeçalho, não na URL
      signal: AbortSignal.timeout(Math.max(3000, Math.min(limiteMs, budgetMs - (Date.now() - inicio)))),
      body: JSON.stringify({ systemInstruction, contents: body.contents, generationConfig }),
    });
    // Alta demanda (500/503/504): até 2 novas tentativas, desde que reste tempo no orçamento. No modo rápido não há novas tentativas (há o modelo reserva).
    const esperas = rapido ? [] : [1500, 4000];
    const comRetry = async (fn: () => Promise<Response>) => {
      let r = await fn();
      for (const ms of esperas) {
        if (![500, 503, 504].includes(r.status) || budgetMs - (Date.now() - inicio) < 30000) break;
        await r.body?.cancel();
        await new Promise((ok) => setTimeout(ok, ms));
        r = await fn();
      }
      return r;
    };
    // Configuração fixa no servidor: o navegador não controla tokens nem temperatura.
    // Raciocínio interno: modo rápido sempre desligado (0); os demais seguem o secret GEMINI_THINKING_BUDGET, se existir.
    const thinkingEnv = Deno.env.get('GEMINI_THINKING_BUDGET');
    const thinkingConfig = rapido ? { thinkingBudget: 0 } : (thinkingEnv ? { thinkingBudget: Number(thinkingEnv) } : null);
    const cfg: Record<string, unknown> = { responseMimeType: 'application/json', responseSchema: body.generationConfig.responseSchema, temperature: modo?.temp ?? 0.2, maxOutputTokens: modo?.tokens ?? 1800,
      ...(thinkingConfig ? { thinkingConfig } : {}) };
    const executar = async (m: string, limiteMs: number) => {
      let r = await comRetry(() => chamar(m, cfg, body.systemInstruction, limiteMs));
      if (r.status === 400 && cfg.thinkingConfig) { // o modelo pode não aceitar desligar o raciocínio: tenta uma vez sem esse ajuste
        const t400 = await r.clone().text();
        if (/thinking/i.test(t400)) {
          const { thinkingConfig: _ignorado, ...semThinking } = cfg;
          r = await comRetry(() => chamar(m, semThinking, body.systemInstruction, limiteMs));
        }
      }
      if (r.status === 400) { // alguns modelos rejeitam o esquema: tenta uma vez só com instrução textual
        const extra = ' Responda somente com JSON válido que siga este esquema: ' + JSON.stringify(body.generationConfig.responseSchema);
        r = await comRetry(() => chamar(m, { ...cfg, responseSchema: undefined }, { parts: [{ text: body.systemInstruction.parts[0].text + extra }] }, limiteMs));
      }
      return r;
    };

    let resp: Response | null = null;
    try { resp = await executar(model, reserva ? TIMEOUT_PRIMARIO_MS : timeoutMs); }
    catch (e) { if (!reserva || !ehTimeout(e)) throw e; motivo = 'timeout'; }
    if (reserva && (!resp || [404, 429, 500, 503, 504].includes(resp.status))) { // principal sem resposta: tenta o modelo reserva
      motivo = motivo || String(resp!.status);
      await resp?.body?.cancel();
      console.warn(JSON.stringify({ aviso: 'modelo principal falhou, usando reserva', principal: model, reserva, motivo, ms: Date.now() - inicio }));
      modeloUsado = reserva;
      timing = tm();
      resp = await executar(reserva, timeoutMs);
    }
    const respFinal = resp as Response;
    const texto = await respFinal.text();
    const geminiMs = Date.now() - inicio;
    timing = tm(geminiMs);
    console.log(JSON.stringify({ modo: nomeModo || '-', status: respFinal.status, modelo: modeloUsado, reserva: motivo || null, pre_ms: preMs, gemini_ms: geminiMs }));
    if (!respFinal.ok) {
      console.error('Gemini HTTP', respFinal.status, modeloUsado, texto.slice(0, 300));
      let msg = `Gemini retornou HTTP ${respFinal.status}.`;
      try { msg = JSON.parse(texto)?.error?.message || msg; } catch { /* mantém a mensagem padrão */ }
      return json({ error: msg }, respFinal.status >= 500 ? 502 : respFinal.status, timing);
    }
    if (!cErr) await sb.from('ai_usage').insert({ user_id: user.id });
    try { return json(JSON.parse(texto), 200, timing); } catch { return json({ error: 'Resposta inválida recebida do Gemini.' }, 502, timing); }
  } catch (e) {
    if (ehTimeout(e)) return json({ error: 'A IA demorou demais para responder. Tente novamente em instantes ou com um arquivo menor.' }, 504, timing);
    console.error('nutri-gemini error:', e);
    return json({ error: 'Não foi possível processar a solicitação de IA.' }, 500, timing);
  }
});
