-- ============================================================================
-- FairCouples — 0005_admin_bootstrap.sql
-- Promote your account to superadmin.
--
-- HOW TO USE
--   1. Sign up through the app with the email you want to use as admin.
--   2. Replace the email below.
--   3. Run this file in the Supabase SQL editor.
-- ============================================================================

do $$
declare
  v_email text := 'shljanjua@gmail.com';   -- <<< CHANGE THIS
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(v_email);

  if v_id is null then
    raise notice 'No auth user found for %. Sign up first, then re-run this file.', v_email;
    return;
  end if;

  update public.profiles
     set role = 'superadmin',
         status = 'active',
         email_verified_at = coalesce(email_verified_at, now())
   where id = v_id;

  insert into public.audit_logs (actor_id, actor_email, action, entity_type, entity_id, summary)
  values (v_id, v_email, 'role.promote', 'profile', v_id::text, 'Bootstrapped as superadmin');

  raise notice 'Promoted % to superadmin.', v_email;
end $$;

commit;
