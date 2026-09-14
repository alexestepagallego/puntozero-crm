/**
 * Alta de accesos de clientes.
 *
 * El registro público está cerrado: nadie puede crearse una cuenta. Los accesos
 * los da el equipo de PuntoZero desde el CRM, y esta función es la que los crea
 * de verdad, porque hacerlo requiere la clave de servicio del proyecto, que no
 * puede vivir en una web pública.
 *
 * Quién puede llamarla: solo un usuario con sesión iniciada cuyo perfil tenga
 * rol "admin". Se comprueba aquí dentro, contra la base de datos, en cada
 * llamada. La clave anónima por sí sola no abre nada.
 *
 * Acciones:
 *   estado        → ¿este correo tiene ya acceso?
 *   crear         → crea el usuario, lo ata a su ficha de cliente y devuelve
 *                   una contraseña generada (se enseña una sola vez)
 *   restablecer   → genera una contraseña nueva para un acceso existente
 *   revocar       → elimina el acceso (la ficha del cliente no se toca)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const responder = (cuerpo: unknown, estado = 200) =>
    new Response(JSON.stringify(cuerpo), {
        status: estado,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });

const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
);

/** Contraseña legible: sin caracteres que se confundan al dictarla por teléfono. */
function generarClave() {
    const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const cadena = Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('');
    return `${cadena.slice(0, 8)}-${cadena.slice(8)}`;
}

async function buscarUsuario(email: string) {
    // La API de administración no filtra por correo, así que se recorren las
    // páginas. Con los volúmenes de PuntoZero esto es instantáneo.
    for (let pagina = 1; pagina <= 20; pagina++) {
        const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
        if (error) throw new Error(error.message);
        const encontrado = data.users.find((u) => u.email?.toLowerCase() === email);
        if (encontrado) return encontrado;
        if (data.users.length < 200) return null;
    }
    return null;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);

    try {
        // 1. ¿Quién llama?
        const cabecera = req.headers.get('Authorization') ?? '';
        const token = cabecera.replace(/^Bearer\s+/i, '');
        if (!token) return responder({ error: 'Falta la sesión' }, 401);

        const { data: sesion, error: errorSesion } = await admin.auth.getUser(token);
        if (errorSesion || !sesion?.user) return responder({ error: 'Sesión no válida' }, 401);

        // 2. ¿Es del equipo? Se pregunta a la base, no al navegador.
        const { data: perfil } = await admin
            .from('perfiles').select('rol').eq('id', sesion.user.id).maybeSingle();
        if (perfil?.rol !== 'admin') return responder({ error: 'Solo el equipo de PuntoZero puede dar accesos' }, 403);

        // 3. A lo que venía.
        const { accion, email: correoBruto, cliente_id, nombre } = await req.json();
        const email = String(correoBruto || '').trim().toLowerCase();

        if (!accion) return responder({ error: 'Falta la acción' }, 400);
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            return responder({ error: 'El correo no es válido' }, 400);
        }

        const usuario = await buscarUsuario(email);

        if (accion === 'estado') {
            return responder({ existe: Boolean(usuario), creado: usuario?.created_at ?? null });
        }

        if (accion === 'crear') {
            if (usuario) return responder({ error: 'Ese correo ya tiene acceso' }, 409);

            const clave = generarClave();
            const { data: creado, error } = await admin.auth.admin.createUser({
                email,
                password: clave,
                email_confirm: true,
                user_metadata: { name: nombre || null },
            });
            if (error) return responder({ error: error.message }, 400);

            // El disparador de la base ya le puso rol "cliente"; aquí se ata a
            // su ficha para que vea sus proyectos y nada más.
            const { error: errorPerfil } = await admin.from('perfiles')
                .update({ rol: 'cliente', cliente_id: cliente_id ?? null, nombre: nombre ?? null })
                .eq('id', creado.user.id);
            if (errorPerfil) return responder({ error: errorPerfil.message }, 400);

            return responder({ email, clave, creado: true });
        }

        if (accion === 'restablecer') {
            if (!usuario) return responder({ error: 'Ese correo no tiene acceso todavía' }, 404);
            const clave = generarClave();
            const { error } = await admin.auth.admin.updateUserById(usuario.id, { password: clave });
            if (error) return responder({ error: error.message }, 400);
            return responder({ email, clave, restablecida: true });
        }

        if (accion === 'revocar') {
            if (!usuario) return responder({ error: 'Ese correo no tiene acceso' }, 404);
            const { data: suPerfil } = await admin
                .from('perfiles').select('rol').eq('id', usuario.id).maybeSingle();
            if (suPerfil?.rol === 'admin') {
                return responder({ error: 'No se puede revocar el acceso de un administrador desde aquí' }, 400);
            }
            const { error } = await admin.auth.admin.deleteUser(usuario.id);
            if (error) return responder({ error: error.message }, 400);
            return responder({ email, revocado: true });
        }

        return responder({ error: 'Acción desconocida' }, 400);
    } catch (e) {
        return responder({ error: String(e?.message || e) }, 500);
    }
});
