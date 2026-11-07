-- Diário Nutricional V49 — tela "Usuários" (administrador): consumo de IA e estimativa de tokens.
-- RODAR UMA VEZ no SQL Editor do Supabase (projeto "Nutri e concursos"), depois de SQL_IA_LOGS.sql. Seguro para repetir.
-- Sem esta migração o app continua funcionando; só a aba "Usuários" avisa que falta rodar.

-- 1) Novas colunas de tokens em ia_logs (nulas nos registros antigos; o app V49 passa a gravá-las)
alter table public.ia_logs
  add column if not exists tokens_entrada int,
  add column if not exists tokens_saida   int,
  add column if not exists tokens_total   int;

-- 2) Administradores do Diário (ausência de linha = não é administrador)
create table if not exists public.nutri_app_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.nutri_app_admins enable row level security;
revoke all on public.nutri_app_admins from anon, authenticated;

-- Administrador padrão. TROQUE o e-mail abaixo se a sua conta de administrador for outra.
-- Se a conta ainda não existir, nada é inserido: rode este insert de novo depois do cadastro.
insert into public.nutri_app_admins (user_id)
select id from auth.users where lower(email) = 'westter@gmail.com'
on conflict do nothing;

-- 3) Funções (security definer: o navegador nunca lê auth.users nem ia_logs de outros usuários)
create or replace function public.nutri_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.nutri_app_admins where user_id = auth.uid());
$$;

-- Lista de usuários (só administrador)
create or replace function public.nutri_all_users()
returns table(r_user_id uuid, r_email text, r_created_at timestamptz, r_last_sign_in timestamptz, r_is_admin boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.nutri_is_admin() then raise exception 'Somente o administrador pode listar os usuários.'; end if;
  return query
    select u.id, u.email::text, u.created_at, u.last_sign_in_at,
           exists (select 1 from public.nutri_app_admins s where s.user_id = u.id)
    from auth.users u order by 5 desc, 2;
end $$;

-- Consumo por usuário, tipo de chamada e modelo. p_days = null → todo o período.
-- Tokens: usa o que a IA informou (V49 em diante). Chamadas antigas (sem tokens) são ESTIMADAS só na entrada:
-- foto ≈ 1.300 tokens; demais ≈ tamanho do pedido (KB × 1024 ÷ 4). A saída delas conta 0. Chamadas que falharam contam 0 tokens.
create or replace function public.nutri_ia_usage_summary(p_days integer default null)
returns table(r_user_id uuid, r_email text, r_tipo text, r_model text, r_queries bigint, r_failed bigint,
              r_prompt bigint, r_output bigint, r_total bigint, r_estimated bigint, r_last_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.nutri_is_admin() then raise exception 'Somente o administrador pode ver o uso da IA.'; end if;
  return query
    select l.user_id, au.email::text, l.tipo, coalesce(nullif(l.modelo, ''), 'não informado'),
           count(*), count(*) filter (where l.status <> 'ok'),
           coalesce(sum(case when l.status <> 'ok' then 0
                             else coalesce(l.tokens_entrada, case when l.tipo = 'refeicao_foto' then 1300
                                                                  else round(coalesce(l.tamanho_kb, 0) * 1024 / 4.0) end) end), 0)::bigint,
           coalesce(sum(case when l.status <> 'ok' then 0 else coalesce(l.tokens_saida, 0) end), 0)::bigint,
           coalesce(sum(case when l.status <> 'ok' then 0
                             else coalesce(l.tokens_total, coalesce(l.tokens_entrada, case when l.tipo = 'refeicao_foto' then 1300
                                                                  else round(coalesce(l.tamanho_kb, 0) * 1024 / 4.0) end)) end), 0)::bigint,
           count(*) filter (where l.status = 'ok' and l.tokens_total is null),
           max(l.created_at)
    from public.ia_logs l
    left join auth.users au on au.id = l.user_id
    where p_days is null or l.created_at >= now() - make_interval(days => p_days)
    group by l.user_id, au.email, l.tipo, coalesce(nullif(l.modelo, ''), 'não informado')
    order by 9 desc;
end $$;

-- Últimas chamadas (só administrador)
create or replace function public.nutri_ia_usage_recent(p_limit integer default 50)
returns table(r_id bigint, r_created_at timestamptz, r_email text, r_tipo text, r_model text, r_status text,
              r_prompt integer, r_output integer, r_total integer, r_estimated boolean, r_ms integer, r_error text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.nutri_is_admin() then raise exception 'Somente o administrador pode ver o uso da IA.'; end if;
  return query
    select l.id, l.created_at, au.email::text, l.tipo, coalesce(nullif(l.modelo, ''), 'não informado'), l.status,
           case when l.status <> 'ok' then 0 else coalesce(l.tokens_entrada, case when l.tipo = 'refeicao_foto' then 1300 else round(coalesce(l.tamanho_kb, 0) * 1024 / 4.0)::int end) end,
           case when l.status <> 'ok' then 0 else coalesce(l.tokens_saida, 0) end,
           case when l.status <> 'ok' then 0 else coalesce(l.tokens_total, coalesce(l.tokens_entrada, case when l.tipo = 'refeicao_foto' then 1300 else round(coalesce(l.tamanho_kb, 0) * 1024 / 4.0)::int end)) end,
           (l.status = 'ok' and l.tokens_total is null), l.duracao_ms, l.erro
    from public.ia_logs l left join auth.users au on au.id = l.user_id
    order by l.created_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 200));
end $$;

revoke all on function public.nutri_is_admin()                      from public, anon;
revoke all on function public.nutri_all_users()                     from public, anon;
revoke all on function public.nutri_ia_usage_summary(integer)       from public, anon;
revoke all on function public.nutri_ia_usage_recent(integer)        from public, anon;
grant execute on function public.nutri_is_admin()                   to authenticated;
grant execute on function public.nutri_all_users()                  to authenticated;
grant execute on function public.nutri_ia_usage_summary(integer)    to authenticated;
grant execute on function public.nutri_ia_usage_recent(integer)     to authenticated;

-- Conferência (opcional): deve listar o e-mail do administrador
-- select u.email from public.nutri_app_admins a join auth.users u on u.id = a.user_id;
