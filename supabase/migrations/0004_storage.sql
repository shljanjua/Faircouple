-- ============================================================================
-- FairCouples — 0004_storage.sql
-- Storage buckets + object-level policies.
-- Path convention for private buckets:  <couple_id>/<user_id>/<filename>
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 5242880,
   array['image/png','image/jpeg','image/webp','image/gif']),
  ('couple-media', 'couple-media', false, 26214400,
   array['image/png','image/jpeg','image/webp','image/gif','image/heic','video/mp4','video/quicktime']),
  ('documents', 'documents', false, 52428800,
   array['application/pdf','image/png','image/jpeg','image/webp','image/heic',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/msword','text/plain']),
  ('blog', 'blog', true, 10485760,
   array['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('site', 'site', true, 10485760,
   array['image/png','image/jpeg','image/webp','image/svg+xml','image/x-icon'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Helper: is the first path segment a couple the current user belongs to?
create or replace function public.storage_couple_ok(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_couple uuid;
begin
  begin
    v_couple := (string_to_array(object_name, '/'))[1]::uuid;
  exception when others then
    return false;
  end;
  return public.is_couple_member(v_couple);
end;
$$;

grant execute on function public.storage_couple_ok(text) to authenticated;

-- --------------------------- avatars (public read) --------------------------
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_write" on storage.objects;
create policy "avatars_owner_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (string_to_array(name, '/'))[1] = auth.uid()::text);

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (string_to_array(name, '/'))[1] = auth.uid()::text);

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (string_to_array(name, '/'))[1] = auth.uid()::text);

-- ------------------- couple-media & documents (private) ---------------------
drop policy if exists "couple_media_read" on storage.objects;
create policy "couple_media_read" on storage.objects
  for select to authenticated
  using (bucket_id in ('couple-media','documents')
         and (public.storage_couple_ok(name) or public.is_platform_admin()));

drop policy if exists "couple_media_insert" on storage.objects;
create policy "couple_media_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('couple-media','documents') and public.storage_couple_ok(name));

drop policy if exists "couple_media_update" on storage.objects;
create policy "couple_media_update" on storage.objects
  for update to authenticated
  using (bucket_id in ('couple-media','documents') and public.storage_couple_ok(name));

drop policy if exists "couple_media_delete" on storage.objects;
create policy "couple_media_delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('couple-media','documents')
         and (public.storage_couple_ok(name) or public.is_platform_admin()));

-- ----------------------- blog & site (public read, admin write) -------------
drop policy if exists "cms_public_read" on storage.objects;
create policy "cms_public_read" on storage.objects
  for select using (bucket_id in ('blog','site'));

drop policy if exists "cms_admin_write" on storage.objects;
create policy "cms_admin_write" on storage.objects
  for all to authenticated
  using (bucket_id in ('blog','site') and public.is_platform_admin())
  with check (bucket_id in ('blog','site') and public.is_platform_admin());

commit;
