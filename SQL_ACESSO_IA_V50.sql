-- Diário Nutricional V50 — o administrador libera ou bloqueia a IA por usuário (tela "Usuários").
-- RODAR UMA VEZ no SQL Editor do Supabase (projeto "Nutri e concursos"), DEPOIS de SQL_USUARIOS_IA_V49.sql. Seguro para repetir.
--
-- REGRA: ausência de linha = sem IA (o administrador sempre pode). Para NADA mudar nas contas que já existem,
-- este script libera a IA de todas elas agora. Contas criadas depois entram SEM IA até você liberar em Usuários.

create table if not exists public.nutri_ai_access (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  allowed    boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.nutri_ai_access enable row level security;
revoke all on public.nutri_ai_access from anon, authenticated;

-- Contas existentes continuam com IA (não sobrescreve quem já tem linha)
insert into public.nutri_ai_access (user_id, allowed)
select id, true from auth.users
on conflict (user_id) do nothing;

-- Usada pela Edge Function (dynamic-service) para barrar a IA no servidor
create or replace function public.nutri_can_use_ai()
returns boolean language sql stable security definer set search_path = public as $$
  select public.nutri_is_admin()
      or coalesce((select allowed from public.nutri_ai_access where user_id = auth.uid()), false);
$$;

-- Uma chamada só para o app: sou administrador? tenho IA?
create or replace function public.nutri_my_access()
returns table(r_is_admin boolean, r_ai boolean)
language sql stable security definer set search_path = public as $$
  select public.nutri_is_admin(), public.nutri_can_use_ai();
$$;

-- Libera ou bloqueia a IA de um usuário (só administrador)
create or replace function public.nutri_set_ai(p_user uuid, p_allowed boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.nutri_is_admin() then raise exception 'Somente o administrador pode alterar permissões.'; end if;
  if not exists (select 1 from auth.users where id = p_user) then raise exception 'Usuário não encontrado.'; end if;
  insert into public.nutri_ai_access (user_id, allowed, updated_by, updated_at)
  values (p_user, coalesce(p_allowed, false), auth.uid(), now())
  on conflict (user_id) do update set allowed = excluded.allowed, updated_by = excluded.updated_by, updated_at = now();
end $$;

-- Lista de usuários agora inclui a permissão de IA (muda o formato de retorno: precisa recriar)
drop function if exists public.nutri_all_users();
create function public.nutri_all_users()
returns table(r_user_id uuid, r_email text, r_created_at timestamptz, r_last_sign_in timestamptz, r_is_admin boolean, r_ai_allowed boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.nutri_is_admin() then raise exception 'Somente o administrador pode listar os usuários.'; end if;
  return query
    select u.id, u.email::text, u.created_at, u.last_sign_in_at,
           exists (select 1 from public.nutri_app_admins s where s.user_id = u.id),
           coalesce(a.allowed, false)
    from auth.users u
    left join public.nutri_ai_access a on a.user_id = u.id
    order by 5 desc, 6 desc, 2;
end $$;

revoke all on function public.nutri_can_use_ai()            from public, anon;
revoke all on function public.nutri_my_access()             from public, anon;
revoke all on function public.nutri_set_ai(uuid, boolean)   from public, anon;
revoke all on function public.nutri_all_users()             from public, anon;
grant execute on function public.nutri_can_use_ai()          to authenticated;
grant execute on function public.nutri_my_access()           to authenticated;
grant execute on function public.nutri_set_ai(uuid, boolean) to authenticated;
grant execute on function public.nutri_all_users()           to authenticated;

-- Conferência (opcional): quem tem IA liberada
-- select u.email, a.allowed from public.nutri_ai_access a join auth.users u on u.id = a.user_id order by 1;
