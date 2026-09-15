-- ============================================================================
--  PUNTOZERO CRM · Endurecimiento de seguridad
--  ---------------------------------------------------------------------------
--  Se aplica encima de schema.sql. Es idempotente: puede ejecutarse varias veces.
--
--  Qué añade:
--    · Validación en la base de datos, no solo en el navegador. Aunque alguien
--      se saltara la interfaz y hablara directamente con la API, no puede meter
--      un importe negativo, un IVA del 900 % ni un texto de un millón de letras.
--    · Un registro de quién da y quita accesos de clientes, y cuándo.
-- ============================================================================

-- ------------------------------------------------- 1. LÍMITES Y FORMATOS ----
-- Se añaden con DO porque Postgres no tiene "ADD CONSTRAINT IF NOT EXISTS".

do $$
declare
    r record;
begin
    for r in
        select * from (values
            -- tabla,           nombre de la regla,        condición
            ('clientes',      'clientes_empresa_largo',   'char_length(empresa) between 1 and 120'),
            ('clientes',      'clientes_email_formato',   'email is null or email ~* ''^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'''),
            ('clientes',      'clientes_email_largo',     'email is null or char_length(email) <= 160'),
            ('clientes',      'clientes_notas_largo',     'notas is null or char_length(notas) <= 5000'),
            ('clientes',      'clientes_estado_valido',   'estado in (''activo'', ''potencial'', ''inactivo'')'),

            ('proyectos',     'proyectos_nombre_largo',   'char_length(nombre) between 1 and 160'),
            ('proyectos',     'proyectos_estado_valido',  'estado in (''Presupuesto'', ''Diseño'', ''Desarrollo'', ''Revisión'', ''Publicado'', ''Mantenimiento'')'),
            ('proyectos',     'proyectos_precio_sano',    'precio_base is null or (precio_base >= 0 and precio_base <= 1000000)'),
            ('proyectos',     'proyectos_iva_sano',       'iva_pct is null or iva_pct between 0 and 100'),
            ('proyectos',     'proyectos_irpf_sano',      'irpf_pct is null or irpf_pct between 0 and 100'),
            ('proyectos',     'proyectos_progreso_sano',  'progreso is null or progreso between 0 and 100'),
            ('proyectos',     'proyectos_token_formato',  'token_acceso is null or token_acceso ~ ''^[a-z0-9]{8,32}$'''),
            ('proyectos',     'proyectos_desc_largo',     'descripcion is null or char_length(descripcion) <= 5000'),

            ('tarjetas',      'tarjetas_titulo_largo',    'char_length(titulo) between 1 and 200'),
            ('tarjetas',      'tarjetas_desc_largo',      'descripcion is null or char_length(descripcion) <= 5000'),

            ('columnas',      'columnas_nombre_largo',    'char_length(nombre) between 1 and 60'),

            ('pagos',         'pagos_concepto_largo',     'char_length(concepto) between 1 and 200'),
            ('pagos',         'pagos_importe_sano',       'importe >= 0 and importe <= 1000000'),
            ('pagos',         'pagos_iva_sano',           'iva_pct is null or iva_pct between 0 and 100'),
            ('pagos',         'pagos_irpf_sano',          'irpf_pct is null or irpf_pct between 0 and 100'),

            ('suscripciones', 'suscripciones_concepto_largo', 'char_length(concepto) between 1 and 200'),
            ('suscripciones', 'suscripciones_importe_sano',   'importe >= 0 and importe <= 1000000'),
            ('suscripciones', 'suscripciones_periodo_valido', 'periodicidad in (''mensual'', ''bimestral'', ''trimestral'', ''semestral'', ''anual'')'),

            ('dominios',      'dominios_formato',         'dominio ~* ''^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'''),
            ('dominios',      'dominios_coste_sano',      'coste is null or (coste >= 0 and coste <= 100000)'),

            ('accesos',       'accesos_titulo_largo',     'char_length(titulo) between 1 and 160'),
            ('accesos',       'accesos_url_esquema',      'url is null or url ~* ''^https?://'''),

            ('servicios',     'servicios_nombre_largo',   'char_length(nombre) between 1 and 160'),
            ('servicios',     'servicios_precio_sano',    'precio is null or (precio >= 0 and precio <= 1000000)'),
            ('servicios',     'servicios_unidad_valida',  'unidad in (''único'', ''mensual'', ''trimestral'', ''anual'')'),

            ('notas',         'notas_texto_largo',        'char_length(texto) between 1 and 10000'),

            ('leads',         'leads_nombre_largo',       'char_length(nombre) between 1 and 160'),
            ('leads',         'leads_estado_valido',      'estado in (''interesado'', ''contactado'', ''presupuesto'', ''ganado'', ''perdido'')'),
            ('leads',         'leads_valor_sano',         'valor_estimado is null or (valor_estimado >= 0 and valor_estimado <= 1000000)'),

            ('archivos',      'archivos_nombre_largo',    'char_length(nombre) between 1 and 255'),
            ('archivos',      'archivos_tamano_sano',     'tamano is null or (tamano >= 0 and tamano <= 26214400)')
        ) as t(tabla, regla, condicion)
    loop
        if not exists (select 1 from pg_constraint where conname = r.regla) then
            execute format('alter table %I add constraint %I check (%s)', r.tabla, r.regla, r.condicion);
        end if;
    end loop;
end $$;

-- --------------------------------------- 2. REGISTRO DE ACCESOS DADOS -------
-- Quién dio o quitó el acceso a un cliente, y cuándo. Solo escribe el servidor.

create table if not exists registro_accesos (
    id           uuid primary key default gen_random_uuid(),
    accion       text not null check (accion in ('crear', 'restablecer', 'revocar')),
    email        text not null,
    cliente_id   uuid references clientes(id) on delete set null,
    hecho_por    uuid references auth.users(id) on delete set null,
    email_actor  text,
    creado       timestamptz default now()
);

create index if not exists idx_registro_accesos_creado on registro_accesos(creado desc);

alter table registro_accesos enable row level security;

-- Solo el equipo puede leerlo. Nadie puede escribirlo desde el navegador:
-- las filas las mete la función del servidor con la clave de servicio.
drop policy if exists admin_lee_registro on registro_accesos;
create policy admin_lee_registro on registro_accesos for select to authenticated
    using (es_admin());

-- ------------------------------------ 3. MENOS PRIVILEGIOS POR DEFECTO ------
-- El rol anónimo no necesita tocar ninguna tabla: entra por la función del
-- enlace secreto, que ya está acotada. Las políticas ya lo impedían; esto lo
-- deja explícito también a nivel de permisos.

revoke all on registro_accesos from anon;
revoke all on perfiles from anon;

-- ============================================================================

-- ------------------------------------------ 4. LÍMITES DE LOS ARCHIVOS ------
-- Tamaño máximo y tipos permitidos en el propio almacén: aunque alguien se
-- saltara la interfaz, no puede subir un ejecutable ni un archivo enorme.

update storage.buckets
set file_size_limit = 26214400,           -- 25 MB
    allowed_mime_types = array[
        'application/pdf',
        'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif',
        'text/plain', 'text/csv',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip'
    ]
where id = 'archivos';
