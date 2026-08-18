-- ============================================================
-- LOGOS DE LOS DUPLICADOS CITV
-- ------------------------------------------------------------
-- El cliente pide su duplicado y sube el logotipo de su centro de
-- inspección. Ese archivo tiene que llegar a quien emite el
-- certificado, así que vive en un depósito privado: nadie lo lista
-- desde fuera y cada quien solo alcanza lo suyo.
--
-- La ruta es `{user_id}/{placa}-{marca de tiempo}.png`. Con el
-- usuario de primera carpeta, la regla de acceso se escribe sola:
-- es tuyo si la primera carpeta lleva tu identificador.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('citv-logos', 'citv-logos', false, 3145728,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = 3145728,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

-- El cliente sube y relee lo suyo; nada más.
drop policy if exists "citv logo: subir el propio" on storage.objects;
create policy "citv logo: subir el propio"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'citv-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "citv logo: leer el propio" on storage.objects;
create policy "citv logo: leer el propio"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'citv-logos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      -- Quien emite el certificado necesita ver el de todos.
      or public.is_current_user_admin()
    )
  );

-- Reemplazar el propio (el cliente se equivocó de archivo y lo repite).
drop policy if exists "citv logo: reemplazar el propio" on storage.objects;
create policy "citv logo: reemplazar el propio"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'citv-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
