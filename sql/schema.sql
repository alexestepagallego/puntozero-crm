-- ============================================================================
--  PUNTOZERO CRM · Esquema completo para Supabase
--  ---------------------------------------------------------------------------
--  Cópialo entero en Supabase → SQL Editor → New query → Run.
--  Es idempotente: puedes ejecutarlo más de una vez sin romper nada.
--
--  Reglas de acceso (las aplica la base de datos, no el navegador):
--    · admin   → lo ve y lo toca todo.
--    · cliente → solo lee lo suyo, y ni notas internas ni accesos técnicos.
--    · anónimo → nada, salvo lo que devuelve la función del enlace secreto.
-- ============================================================================

-- ---------------------------------------------------------------- TABLAS ----

create table if not exists clientes (
    id          uuid primary key default gen_random_uuid(),
    empresa     text not null,
    nombre      text,
    email       text,
    telefono    text,
    nif         text,
    direccion   text,
    estado      text default 'activo',
    notas       text,
    demo        boolean default false,
    creado      timestamptz default now()
);

create table if not exists perfiles (
    id          uuid primary key references auth.users(id) on delete cascade,
    email       text,
    nombre      text,
    rol         text not null default 'cliente' check (rol in ('admin', 'cliente')),
    cliente_id  uuid references clientes(id) on delete set null,
    creado      timestamptz default now()
);

create table if not exists proyectos (
    id                 uuid primary key default gen_random_uuid(),
    cliente_id         uuid references clientes(id) on delete cascade,
    nombre             text not null,
    tipo               text,
    estado             text default 'Presupuesto',
    descripcion        text,
    precio_base        numeric(10,2),
    iva_pct            numeric(5,2) default 21,
    irpf_pct           numeric(5,2) default 0,
    presupuesto_notas  text,
    fecha_inicio       date,
    fecha_entrega      date,
    progreso           int default 0,
    token_acceso       text unique,
    demo               boolean default false,
    creado             timestamptz default now()
);

create table if not exists columnas (
    id          uuid primary key default gen_random_uuid(),
    proyecto_id uuid references proyectos(id) on delete cascade,
    nombre      text not null,
    orden       int default 0,
    demo        boolean default false,
    creado      timestamptz default now()
);

create table if not exists tarjetas (
    id               uuid primary key default gen_random_uuid(),
    proyecto_id      uuid references proyectos(id) on delete cascade,
    columna_id       uuid references columnas(id) on delete cascade,
    titulo           text not null,
    descripcion      text,
    etiqueta         text,
    vence            date,
    orden            int default 0,
    completada       boolean default false,
    visible_cliente  boolean default true,
    demo             boolean default false,
    creado           timestamptz default now()
);

create table if not exists pagos (
    id                 uuid primary key default gen_random_uuid(),
    cliente_id         uuid references clientes(id) on delete cascade,
    proyecto_id        uuid references proyectos(id) on delete set null,
    concepto           text not null,
    importe            numeric(10,2) not null default 0,
    iva_pct            numeric(5,2) default 21,
    irpf_pct           numeric(5,2) default 0,
    metodo             text,
    fecha_vencimiento  date,
    fecha_pago         date,
    estado             text default 'pendiente' check (estado in ('pendiente', 'pagado')),
    notas              text,
    demo               boolean default false,
    creado             timestamptz default now()
);

create table if not exists suscripciones (
    id             uuid primary key default gen_random_uuid(),
    cliente_id     uuid references clientes(id) on delete cascade,
    proyecto_id    uuid references proyectos(id) on delete set null,
    concepto       text not null,
    importe        numeric(10,2) not null default 0,
    iva_pct        numeric(5,2) default 21,
    periodicidad   text default 'anual',
    proxima_fecha  date,
    activa         boolean default true,
    notas          text,
    demo           boolean default false,
    creado         timestamptz default now()
);

create table if not exists dominios (
    id                uuid primary key default gen_random_uuid(),
    cliente_id        uuid references clientes(id) on delete cascade,
    proyecto_id       uuid references proyectos(id) on delete set null,
    dominio           text not null,
    registrador       text,
    coste             numeric(10,2),
    fecha_renovacion  date,
    auto_renueva      boolean default false,
    notas             text,
    demo              boolean default false,
    creado            timestamptz default now()
);

create table if not exists accesos (
    id           uuid primary key default gen_random_uuid(),
    cliente_id   uuid references clientes(id) on delete cascade,
    proyecto_id  uuid references proyectos(id) on delete set null,
    tipo         text,
    titulo       text not null,
    url          text,
    usuario      text,
    notas        text,
    demo         boolean default false,
    creado       timestamptz default now()
);

create table if not exists servicios (
    id           uuid primary key default gen_random_uuid(),
    nombre       text not null,
    descripcion  text,
    precio       numeric(10,2),
    unidad       text default 'único',
    demo         boolean default false,
    creado       timestamptz default now()
);

create table if not exists notas (
    id           uuid primary key default gen_random_uuid(),
    cliente_id   uuid references clientes(id) on delete cascade,
    proyecto_id  uuid references proyectos(id) on delete set null,
    fecha        date default current_date,
    texto        text not null,
    autor        text,
    demo         boolean default false,
    creado       timestamptz default now()
);

create table if not exists leads (
    id              uuid primary key default gen_random_uuid(),
    nombre          text not null,
    contacto        text,
    telefono        text,
    email           text,
    origen          text,
    estado          text default 'interesado',
    valor_estimado  numeric(10,2),
    fecha           date default current_date,
    notas           text,
    demo            boolean default false,
    creado          timestamptz default now()
);

create table if not exists archivos (
    id               uuid primary key default gen_random_uuid(),
    cliente_id       uuid references clientes(id) on delete cascade,
    proyecto_id      uuid references proyectos(id) on delete cascade,
    nombre           text not null,
    ruta             text not null,
    tamano           bigint,
    visible_cliente  boolean default true,
    demo             boolean default false,
    creado           timestamptz default now()
);

-- ------------------------------------------------------------- ÍNDICES -----

create index if not exists idx_proyectos_cliente     on proyectos(cliente_id);
create index if not exists idx_columnas_proyecto     on columnas(proyecto_id);
create index if not exists idx_tarjetas_proyecto     on tarjetas(proyecto_id);
create index if not exists idx_tarjetas_columna      on tarjetas(columna_id);
create index if not exists idx_pagos_cliente         on pagos(cliente_id);
create index if not exists idx_pagos_vencimiento     on pagos(fecha_vencimiento) where estado = 'pendiente';
create index if not exists idx_suscripciones_cliente on suscripciones(cliente_id);
create index if not exists idx_dominios_renovacion   on dominios(fecha_renovacion);
create index if not exists idx_archivos_proyecto     on archivos(proyecto_id);

-- --------------------------------------------- QUIÉN ES QUIEN (helpers) ----
-- SECURITY DEFINER: se saltan RLS a propósito, si no las políticas que
-- consultan `perfiles` se llamarían a sí mismas en bucle.

create or replace function es_admin()
returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from perfiles where id = auth.uid() and rol = 'admin');
$$;

create or replace function mi_cliente()
returns uuid language sql stable security definer set search_path = public as $$
    select cliente_id from perfiles where id = auth.uid();
$$;

-- Alta automática de perfil la primera vez que alguien entra.
-- El primero que entra manda: se queda como administrador.
create or replace function crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
declare
    hay_admin boolean;
    id_cliente uuid;
begin
    select exists (select 1 from perfiles where rol = 'admin') into hay_admin;
    select id into id_cliente from clientes where lower(email) = lower(new.email) limit 1;

    insert into perfiles (id, email, nombre, rol, cliente_id)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
        case when hay_admin then 'cliente' else 'admin' end,
        case when hay_admin then id_cliente else null end
    )
    on conflict (id) do nothing;

    return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
    after insert on auth.users
    for each row execute function crear_perfil();

-- ------------------------------------------------ SEGURIDAD POR FILA (RLS) --

alter table clientes      enable row level security;
alter table perfiles      enable row level security;
alter table proyectos     enable row level security;
alter table columnas      enable row level security;
alter table tarjetas      enable row level security;
alter table pagos         enable row level security;
alter table suscripciones enable row level security;
alter table dominios      enable row level security;
alter table accesos       enable row level security;
alter table servicios     enable row level security;
alter table notas         enable row level security;
alter table leads         enable row level security;
alter table archivos      enable row level security;

-- Cada bloque: el administrador puede todo; el cliente solo lee lo suyo.

drop policy if exists admin_clientes on clientes;
create policy admin_clientes on clientes for all to authenticated
    using (es_admin()) with check (es_admin());
drop policy if exists cliente_ve_su_ficha on clientes;
create policy cliente_ve_su_ficha on clientes for select to authenticated
    using (id = mi_cliente());

drop policy if exists perfil_propio on perfiles;
create policy perfil_propio on perfiles for select to authenticated
    using (id = auth.uid() or es_admin());
drop policy if exists admin_perfiles on perfiles;
create policy admin_perfiles on perfiles for update to authenticated
    using (es_admin()) with check (es_admin());

drop policy if exists admin_proyectos on proyectos;
create policy admin_proyectos on proyectos for all to authenticated
    using (es_admin()) with check (es_admin());
drop policy if exists cliente_ve_sus_proyectos on proyectos;
create policy cliente_ve_sus_proyectos on proyectos for select to authenticated
    using (cliente_id = mi_cliente());

drop policy if exists admin_columnas on columnas;
create policy admin_columnas on columnas for all to authenticated
    using (es_admin()) with check (es_admin());
drop policy if exists cliente_ve_columnas on columnas;
create policy cliente_ve_columnas on columnas for select to authenticated
    using (proyecto_id in (select id from proyectos where cliente_id = mi_cliente()));

drop policy if exists admin_tarjetas on tarjetas;
create policy admin_tarjetas on tarjetas for all to authenticated
    using (es_admin()) with check (es_admin());
drop policy if exists cliente_ve_tarjetas on tarjetas;
create policy cliente_ve_tarjetas on tarjetas for select to authenticated
    using (visible_cliente and proyecto_id in (select id from proyectos where cliente_id = mi_cliente()));

drop policy if exists admin_pagos on pagos;
create policy admin_pagos on pagos for all to authenticated
    using (es_admin()) with check (es_admin());
drop policy if exists cliente_ve_pagos on pagos;
create policy cliente_ve_pagos on pagos for select to authenticated
    using (cliente_id = mi_cliente());

drop policy if exists admin_suscripciones on suscripciones;
create policy admin_suscripciones on suscripciones for all to authenticated
    using (es_admin()) with check (es_admin());
drop policy if exists cliente_ve_suscripciones on suscripciones;
create policy cliente_ve_suscripciones on suscripciones for select to authenticated
    using (cliente_id = mi_cliente());

drop policy if exists admin_dominios on dominios;
create policy admin_dominios on dominios for all to authenticated
    using (es_admin()) with check (es_admin());
drop policy if exists cliente_ve_dominios on dominios;
create policy cliente_ve_dominios on dominios for select to authenticated
    using (cliente_id = mi_cliente());

drop policy if exists admin_archivos on archivos;
create policy admin_archivos on archivos for all to authenticated
    using (es_admin()) with check (es_admin());
drop policy if exists cliente_ve_archivos on archivos;
create policy cliente_ve_archivos on archivos for select to authenticated
    using (visible_cliente and cliente_id = mi_cliente());

-- Solo el equipo: accesos técnicos, notas internas, tarifas y oportunidades.
drop policy if exists admin_accesos on accesos;
create policy admin_accesos on accesos for all to authenticated
    using (es_admin()) with check (es_admin());
drop policy if exists admin_servicios on servicios;
create policy admin_servicios on servicios for all to authenticated
    using (es_admin()) with check (es_admin());
drop policy if exists admin_notas on notas;
create policy admin_notas on notas for all to authenticated
    using (es_admin()) with check (es_admin());
drop policy if exists admin_leads on leads;
create policy admin_leads on leads for all to authenticated
    using (es_admin()) with check (es_admin());

-- --------------------------------------------------- ENLACE SECRETO --------
-- Devuelve el estado de UN proyecto a partir de su token, sin abrir ninguna
-- tabla a usuarios anónimos: todo pasa por esta función controlada.

create or replace function proyecto_por_token(p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare
    p proyectos%rowtype;
    resultado json;
begin
    if p_token is null or length(p_token) < 6 then
        return null;
    end if;

    select * into p from proyectos where token_acceso = p_token;
    if not found then
        return null;
    end if;

    select json_build_object(
        'proyecto', json_build_object(
            'id', p.id, 'nombre', p.nombre, 'tipo', p.tipo, 'estado', p.estado,
            'descripcion', p.descripcion, 'precio_base', p.precio_base,
            'iva_pct', p.iva_pct, 'irpf_pct', p.irpf_pct,
            'presupuesto_notas', p.presupuesto_notas,
            'fecha_inicio', p.fecha_inicio, 'fecha_entrega', p.fecha_entrega
        ),
        'cliente', (select json_build_object('empresa', c.empresa, 'nombre', c.nombre)
                    from clientes c where c.id = p.cliente_id),
        'tarjetas', coalesce((select json_agg(json_build_object(
                        'id', t.id, 'titulo', t.titulo, 'descripcion', t.descripcion,
                        'vence', t.vence, 'completada', t.completada, 'orden', t.orden)
                        order by t.orden)
                    from tarjetas t where t.proyecto_id = p.id and t.visible_cliente), '[]'::json),
        'pagos', coalesce((select json_agg(json_build_object(
                        'concepto', pa.concepto, 'importe', pa.importe, 'estado', pa.estado,
                        'fecha_vencimiento', pa.fecha_vencimiento, 'fecha_pago', pa.fecha_pago))
                    from pagos pa where pa.proyecto_id = p.id), '[]'::json),
        'suscripciones', coalesce((select json_agg(json_build_object(
                        'concepto', s.concepto, 'importe', s.importe,
                        'periodicidad', s.periodicidad, 'proxima_fecha', s.proxima_fecha))
                    from suscripciones s where s.proyecto_id = p.id and s.activa), '[]'::json),
        'dominios', coalesce((select json_agg(json_build_object(
                        'dominio', d.dominio, 'coste', d.coste, 'fecha_renovacion', d.fecha_renovacion))
                    from dominios d where d.proyecto_id = p.id), '[]'::json),
        'archivos', '[]'::json
    ) into resultado;

    return resultado;
end;
$$;

grant execute on function proyecto_por_token(text) to anon, authenticated;

-- ------------------------------------------------------------- ARCHIVOS ----
-- Bucket privado: se accede siempre con enlaces firmados y caducables.

insert into storage.buckets (id, name, public)
values ('archivos', 'archivos', false)
on conflict (id) do nothing;

drop policy if exists archivos_admin on storage.objects;
create policy archivos_admin on storage.objects for all to authenticated
    using (bucket_id = 'archivos' and es_admin())
    with check (bucket_id = 'archivos' and es_admin());

drop policy if exists archivos_cliente on storage.objects;
create policy archivos_cliente on storage.objects for select to authenticated
    using (
        bucket_id = 'archivos'
        and name ~ '^[0-9a-fA-F-]{36}/'
        and (substring(name from 1 for 36))::uuid in (
            select id from proyectos where cliente_id = mi_cliente()
        )
    );

-- ============================================================================
--  DESPUÉS DE EJECUTAR ESTO:
--
--  1) Entra en el CRM con tu email. Serás administrador automáticamente.
--  2) Para hacer administrador a un socio (después de que él haya entrado):
--         update perfiles set rol = 'admin' where email = 'socio@puntozerosl.es';
--  3) Para atar un cliente a su email (si lo creaste después de que entrara):
--         update perfiles set cliente_id = (select id from clientes where empresa = 'La Juana')
--         where email = 'lajuana@example.com';
-- ============================================================================
