-- V42: log das chamadas de IA (Texto IA, Foto IA, bioimpedância e relatório).
-- Rode uma vez no SQL Editor do Supabase (projeto "Nutri e concursos").
create table if not exists public.ia_logs (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  tipo        text not null,   -- refeicao_texto | refeicao_foto | bio | relatorio | outro
  status      text not null,   -- ok | erro | timeout | cancelado
  http_status int,
  duracao_ms  int,
  tamanho_kb  int,             -- tamanho do pedido enviado
  pre_ms      int,             -- tempo na função antes do Gemini (login + limite diário)
  gemini_ms   int,             -- tempo da chamada ao Gemini dentro da função
  erro        text
);
alter table public.ia_logs add column if not exists pre_ms int, add column if not exists gemini_ms int; -- para tabelas criadas antes da V42b
create index if not exists ia_logs_user_data_idx on public.ia_logs (user_id, created_at desc);
alter table public.ia_logs enable row level security;
drop policy if exists "ia_logs_insert_proprio" on public.ia_logs;
drop policy if exists "ia_logs_select_proprio" on public.ia_logs;
create policy "ia_logs_insert_proprio" on public.ia_logs for insert to authenticated with check (auth.uid() = user_id);
create policy "ia_logs_select_proprio" on public.ia_logs for select to authenticated using (auth.uid() = user_id);

-- Consultas úteis:
-- Tempo médio e falhas por tipo (últimos 7 dias)
-- select tipo, count(*) n, round(avg(duracao_ms)/1000.0,1) seg_medio,
--        count(*) filter (where status <> 'ok') falhas
--   from ia_logs where created_at > now() - interval '7 days' group by tipo;
-- Últimas falhas
-- select created_at, tipo, status, http_status, duracao_ms, erro
--   from ia_logs where status <> 'ok' order by created_at desc limit 20;
