-- ============================================================
-- PUBLICIDAD — las imágenes que el administrador enseña a todos
--
-- El dueño sube una imagen desde el panel y esa imagen aparece en la
-- aplicación de TODOS los clientes, en computadora y en teléfono. No es
-- una notificación (eso son los anuncios, que llegan a la campana) ni un
-- aviso de incidencia (eso es la cinta de `aviso_clientes`): esto es
-- publicidad, un cartel dentro de la aplicación.
--
-- Qué crea:
--   1) public.publicidad — una fila por imagen, con su enlace, su orden
--      y su interruptor.
--   2) Sus políticas: cualquiera LEE las activas; solo un administrador
--      crea, edita o borra.
--   3) El depósito 'publicidad' en Storage: lectura pública, escritura
--      solo de administradores.
--
-- Subir una imagen NO la publica: nace apagada, igual que el aviso a
-- clientes. Se enciende cuando el dueño lo decide.
--
-- Idempotente: se puede ejecutar las veces que haga falta.
-- ============================================================

create table if not exists public.publicidad (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null default '',
  imagen_url  text not null,
  -- El objeto del depósito, para poder borrar el archivo cuando se borra
  -- la fila. Sin esto el depósito se llena de imágenes huérfanas.
  imagen_path text,
  enlace      text,
  activa      boolean not null default false,
  orden       integer not null default 0,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null
);

alter table public.publicidad enable row level security;

-- Lectura: abierta, pero SOLO lo que está encendido. Va también para
-- anon porque la aplicación pinta el cartel antes de que la sesión
-- termine de restaurarse.
drop policy if exists "publicidad: leer lo activo" on public.publicidad;
create policy "publicidad: leer lo activo"
  on public.publicidad for select
  to anon, authenticated
  using (activa = true);

-- El administrador ve y maneja todo, encendido o no.
drop policy if exists "publicidad: el admin manda" on public.publicidad;
create policy "publicidad: el admin manda"
  on public.publicidad for all
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

create index if not exists publicidad_orden_idx
  on public.publicidad (activa, orden, created_at desc);


-- ===== El depósito de las imágenes =====
-- 5 MB por imagen y solo formatos de imagen: un PDF o un vídeo subidos
-- por error no llegan a entrar.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('publicidad', 'publicidad', true, 5242880,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

drop policy if exists "publicidad: ver las imagenes" on storage.objects;
create policy "publicidad: ver las imagenes"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'publicidad');

drop policy if exists "publicidad: subir imagenes" on storage.objects;
create policy "publicidad: subir imagenes"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'publicidad' and public.is_current_user_admin());

drop policy if exists "publicidad: reemplazar imagenes" on storage.objects;
create policy "publicidad: reemplazar imagenes"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'publicidad' and public.is_current_user_admin())
  with check (bucket_id = 'publicidad' and public.is_current_user_admin());

drop policy if exists "publicidad: borrar imagenes" on storage.objects;
create policy "publicidad: borrar imagenes"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'publicidad' and public.is_current_user_admin());
