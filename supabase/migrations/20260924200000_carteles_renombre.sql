-- ============================================================
-- LOS CARTELES — lo que ayer se llamaba «publicidad»
--
-- Por qué se renombra todo: los bloqueadores de anuncios —y varias
-- redes y DNS— cortan cualquier dirección que lleve la palabra
-- «publicidad». No es una teoría: en el navegador del dueño,
-- /js/admin/publicidad.js no llegaba a cargar («Failed to fetch»)
-- mientras /js/admin/audit.js cargaba sin problema. Sin ese archivo,
-- el panel enseñaba la pantalla pero no respondía a nada: ni el clic,
-- ni la subida, ni el interruptor.
--
-- Lo mismo le habría pasado al cliente: la tabla se consulta por una
-- dirección que lleva su nombre (/rest/v1/publicidad) y las imágenes
-- se sirven desde /object/public/publicidad/…, así que a cualquiera
-- con un bloqueador instalado no le habrían aparecido nunca.
--
-- Por eso el nombre nuevo es `carteles`, que no esta en ninguna lista
-- de filtros. La tabla y el depósito estaban VACÍOS —nunca llegó a
-- subirse nada—, así que se rehacen en vez de arrastrar el nombre.
--
-- Idempotente.
-- ============================================================

create table if not exists public.carteles (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null default '',
  imagen_url  text not null,
  imagen_path text,
  enlace      text,
  activa      boolean not null default false,
  orden       integer not null default 0,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null
);

alter table public.carteles enable row level security;

drop policy if exists "carteles: leer lo activo" on public.carteles;
create policy "carteles: leer lo activo"
  on public.carteles for select
  to anon, authenticated
  using (activa = true);

drop policy if exists "carteles: el admin manda" on public.carteles;
create policy "carteles: el admin manda"
  on public.carteles for all
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

create index if not exists carteles_orden_idx
  on public.carteles (activa, orden, created_at desc);


-- ===== El depósito =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('carteles', 'carteles', true, 5242880,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

drop policy if exists "carteles: ver las imagenes" on storage.objects;
create policy "carteles: ver las imagenes"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'carteles');

drop policy if exists "carteles: subir imagenes" on storage.objects;
create policy "carteles: subir imagenes"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'carteles' and public.is_current_user_admin());

drop policy if exists "carteles: reemplazar imagenes" on storage.objects;
create policy "carteles: reemplazar imagenes"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'carteles' and public.is_current_user_admin())
  with check (bucket_id = 'carteles' and public.is_current_user_admin());

drop policy if exists "carteles: borrar imagenes" on storage.objects;
create policy "carteles: borrar imagenes"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'carteles' and public.is_current_user_admin());


-- ===== Fuera lo viejo =====
-- Estaba vacío: ni una fila ni un archivo. Se comprobó antes de escribir
-- esto, y por eso se puede tirar sin guardar nada.
drop policy if exists "publicidad: ver las imagenes"        on storage.objects;
drop policy if exists "publicidad: subir imagenes"          on storage.objects;
drop policy if exists "publicidad: reemplazar imagenes"     on storage.objects;
drop policy if exists "publicidad: borrar imagenes"         on storage.objects;
-- El deposito viejo no se puede borrar desde SQL («Direct deletion from
-- storage tables is not allowed»): se queda vacio y sin politicas, que
-- es lo mismo que no existir. Se borra a mano desde el panel de
-- Supabase cuando se quiera.
drop table if exists public.publicidad;
