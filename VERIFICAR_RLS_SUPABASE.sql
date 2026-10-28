-- VERIFICAÇÃO DE SEGURANÇA — Diário Nutricional (somente leitura)
-- Execute no Supabase > SQL Editor. Não altera dados nem políticas.
select c.relname as tabela, c.relrowsecurity as rls_habilitado, c.relforcerowsecurity as rls_forcado
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='diary_data';

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname='public' and tablename='diary_data'
order by policyname;

-- Esperado: rls_habilitado = true; políticas SELECT/INSERT/UPDATE restritas a auth.uid() = user_id;
-- INSERT deve ter WITH CHECK; UPDATE deve ter USING e WITH CHECK.
