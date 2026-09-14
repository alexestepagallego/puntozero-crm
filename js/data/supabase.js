/**
 * Adaptador "supabase": los datos viven en la nube.
 * La seguridad no depende de este archivo sino de las políticas RLS definidas
 * en sql/schema.sql — un cliente solo puede leer sus propias filas.
 */
import { leerConexion } from '../config.js';

const CDN = 'https://esm.sh/@supabase/supabase-js@2.45.4';

let cliente = null;

/** Devuelve (creando si hace falta) el cliente de Supabase. */
export async function supa() {
    if (cliente) return cliente;
    const conexion = leerConexion();
    if (!conexion) throw new Error('Falta configurar la conexión con Supabase');
    const { createClient } = await import(/* @vite-ignore */ CDN);
    cliente = createClient(conexion.url, conexion.key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    return cliente;
}

function revienta(error) {
    if (!error) return;
    const mensaje = error.message || 'Error de conexión';
    if (/row-level security|permission denied/i.test(mensaje)) {
        throw new Error('No tienes permiso para esta operación');
    }
    throw new Error(mensaje);
}

export const adaptadorSupabase = {
    modo: 'supabase',

    async init() { await supa(); },

    async list(tabla, opciones = {}) {
        const sb = await supa();
        let q = sb.from(tabla).select('*');
        if (opciones.eq) {
            for (const [campo, valor] of Object.entries(opciones.eq)) {
                if (valor !== undefined && valor !== null) q = q.eq(campo, valor);
            }
        }
        if (opciones.dentro) {
            for (const [campo, valores] of Object.entries(opciones.dentro)) {
                q = q.in(campo, valores || []);
            }
        }
        if (opciones.orden) q = q.order(opciones.orden, { ascending: opciones.dir !== 'desc' });
        const { data, error } = await q;
        revienta(error);
        return data || [];
    },

    async get(tabla, id) {
        const sb = await supa();
        const { data, error } = await sb.from(tabla).select('*').eq('id', id).maybeSingle();
        revienta(error);
        return data;
    },

    async insert(tabla, fila) {
        const sb = await supa();
        const { data, error } = await sb.from(tabla).insert(fila).select().single();
        revienta(error);
        return data;
    },

    async insertMany(tabla, filas) {
        const sb = await supa();
        const { data, error } = await sb.from(tabla).insert(filas).select();
        revienta(error);
        return data || [];
    },

    async update(tabla, id, parche) {
        const sb = await supa();
        const { data, error } = await sb.from(tabla).update(parche).eq('id', id).select().single();
        revienta(error);
        return data;
    },

    async remove(tabla, id) {
        const sb = await supa();
        const { error } = await sb.from(tabla).delete().eq('id', id);
        revienta(error);
    },

    async removeWhere(tabla, eq) {
        const sb = await supa();
        let q = sb.from(tabla).delete();
        for (const [campo, valor] of Object.entries(eq)) q = q.eq(campo, valor);
        const { error } = await q;
        revienta(error);
    },

    /**
     * Acceso por enlace secreto. Pasa por una función del servidor
     * (SECURITY DEFINER) para no abrir las tablas a usuarios anónimos.
     */
    async proyectoPorToken(tk) {
        const sb = await supa();
        const { data, error } = await sb.rpc('proyecto_por_token', { p_token: tk });
        revienta(error);
        return data || null;
    },

    /**
     * Llama a una función del servidor (Edge Function) con la sesión actual.
     * Se usa para lo que el navegador no puede hacer por sí solo, como dar de
     * alta el acceso de un cliente.
     */
    async funcion(nombre, cuerpo) {
        const sb = await supa();
        const { data, error } = await sb.functions.invoke(nombre, { body: cuerpo });
        if (error) {
            // El mensaje útil viene en el cuerpo de la respuesta, no en el error.
            try {
                const detalle = await error.context.json();
                throw new Error(detalle.error || error.message);
            } catch (e) {
                throw new Error(e.message || 'No se ha podido completar la operación');
            }
        }
        if (data?.error) throw new Error(data.error);
        return data;
    },

    /* ------------------------------------------------------------ ficheros */

    async subirArchivo(ruta, fichero) {
        const sb = await supa();
        const { error } = await sb.storage.from('archivos').upload(ruta, fichero, { upsert: true });
        revienta(error);
        return ruta;
    },

    async urlArchivo(ruta, segundos = 3600) {
        const sb = await supa();
        const { data, error } = await sb.storage.from('archivos').createSignedUrl(ruta, segundos);
        revienta(error);
        return data?.signedUrl || null;
    },

    async borrarArchivo(ruta) {
        const sb = await supa();
        const { error } = await sb.storage.from('archivos').remove([ruta]);
        revienta(error);
    },

    async exportar() {
        const tablas = ['clientes', 'proyectos', 'columnas', 'tarjetas', 'pagos', 'suscripciones',
            'dominios', 'accesos', 'servicios', 'notas', 'leads', 'archivos'];
        const datos = {};
        for (const t of tablas) datos[t] = await this.list(t);
        return { version: 1, generado: new Date().toISOString(), datos };
    },
};
