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

/**
 * Corta una petición que se queda colgada. Sin esto, con la conexión a medias
 * el CRM se queda esperando para siempre y parece que el botón no hace nada.
 */
const LIMITE_MS = 15000;

async function conTiempoLimite(promesa, que = 'la operación') {
    let reloj;
    const tope = new Promise((_, rechazar) => {
        reloj = setTimeout(() => rechazar(new Error(`Sin respuesta al ${que}. Revisa tu conexión e inténtalo otra vez.`)), LIMITE_MS);
    });
    try {
        return await Promise.race([promesa, tope]);
    } finally {
        clearTimeout(reloj);
    }
}

/**
 * Traduce cada regla de validación de la base a un aviso que se entienda.
 * Cuando una regla salta, Postgres devuelve el nombre técnico de la regla
 * (p. ej. accesos_url_esquema); aquí lo convertimos en una frase útil.
 */
const AVISOS_VALIDACION = [
    [/url_esquema/,        'El enlace debe empezar por http:// o https://'],
    [/email_format|email_formato/, 'El correo no tiene un formato válido'],
    [/importe_sano|precio_sano|coste_sano|valor_sano/, 'El importe no es válido (debe estar entre 0 y 1.000.000)'],
    [/iva_sano|irpf_sano/, 'El porcentaje debe estar entre 0 y 100'],
    [/progreso_sano/,      'El progreso debe estar entre 0 y 100'],
    [/dominios_formato/,   'El dominio no tiene un formato válido (ej. micliente.es)'],
    [/estado_valido/,      'Ese estado no es uno de los permitidos'],
    [/periodo_valido/,     'Esa periodicidad no es válida'],
    [/unidad_valida/,      'Ese tipo de cobro no es válido'],
    [/_largo/,             'Alguno de los textos es demasiado largo'],
    [/token_formato/,      'El enlace de acceso no tiene un formato válido'],
];

function revienta(error) {
    if (!error) return;
    const mensaje = error.message || 'Error de conexión';

    if (/row-level security|permission denied/i.test(mensaje)) {
        throw new Error('No tienes permiso para esta operación');
    }
    if (/jwt|token|expired|refresh/i.test(mensaje)) {
        const e = new Error('Tu sesión ha caducado. Vuelve a entrar.');
        e.sesionCaducada = true;
        throw e;
    }
    // Una regla de validación de la base: mensaje claro en vez del técnico.
    if (/violates check constraint|23514/i.test(mensaje) || error.code === '23514') {
        for (const [patron, texto] of AVISOS_VALIDACION) {
            if (patron.test(mensaje)) throw new Error(texto);
        }
        throw new Error('Hay un dato que no cumple el formato esperado. Revisa el formulario.');
    }
    if (/duplicate key|23505/i.test(mensaje) || error.code === '23505') {
        throw new Error('Ya existe un registro con ese valor');
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
        const { data, error } = await conTiempoLimite(q, `leer ${tabla}`);
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
        const { data, error } = await conTiempoLimite(sb.from(tabla).insert(fila).select().single(), 'guardar');
        revienta(error);
        return data;
    },

    async insertMany(tabla, filas) {
        const sb = await supa();
        const { data, error } = await conTiempoLimite(sb.from(tabla).insert(filas).select(), 'guardar');
        revienta(error);
        return data || [];
    },

    async update(tabla, id, parche) {
        const sb = await supa();
        const { data, error } = await conTiempoLimite(sb.from(tabla).update(parche).eq('id', id).select().single(), 'guardar');
        revienta(error);
        return data;
    },

    async remove(tabla, id) {
        const sb = await supa();
        const { error } = await conTiempoLimite(sb.from(tabla).delete().eq('id', id), 'eliminar');
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
    async funcion(nombre, cuerpo, { timeoutMs = 60000 } = {}) {
        const sb = await supa();
        // Carrera contra un reloj: si el servidor no contesta a tiempo, se corta
        // en vez de dejar la interfaz esperando para siempre.
        const conTope = Promise.race([
            sb.functions.invoke(nombre, { body: cuerpo }),
            new Promise((_, rechazar) => setTimeout(
                () => rechazar(new Error('El asistente ha tardado demasiado. Prueba otra vez en un momento.')),
                timeoutMs)),
        ]);
        const { data, error } = await conTope;
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
