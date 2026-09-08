/**
 * Sesión y permisos.
 *
 *  - Modo local: no hay login; se trabaja siempre como administrador y se puede
 *    previsualizar el portal del cliente.
 *  - Modo Supabase: acceso por enlace mágico al correo. El rol y el cliente
 *    asociado salen de la tabla `perfiles`.
 */
import { modo } from './config.js';
import { supa } from './data/supabase.js';

export const sesion = {
    activa: false,
    usuario: null,      // { id, email }
    perfil: null,       // fila de `perfiles`
    rol: 'admin',       // 'admin' | 'cliente'
    clienteId: null,
    nombre: 'Equipo PuntoZero',
};

export const esAdmin = () => sesion.rol === 'admin';

/** Restaura la sesión al arrancar la aplicación. */
export async function iniciarSesionGuardada() {
    if (modo() === 'local') {
        Object.assign(sesion, {
            activa: true, rol: 'admin', clienteId: null,
            nombre: 'Equipo PuntoZero', usuario: { id: 'local', email: 'local' },
        });
        return sesion;
    }

    const sb = await supa();
    const { data } = await sb.auth.getSession();
    if (!data?.session) {
        Object.assign(sesion, { activa: false, usuario: null, perfil: null });
        return sesion;
    }
    return aplicarUsuario(data.session.user);
}

async function aplicarUsuario(usuario) {
    const sb = await supa();
    const { data: perfil } = await sb.from('perfiles').select('*').eq('id', usuario.id).maybeSingle();

    Object.assign(sesion, {
        activa: true,
        usuario: { id: usuario.id, email: usuario.email },
        perfil: perfil || null,
        rol: perfil?.rol || 'cliente',
        clienteId: perfil?.cliente_id || null,
        nombre: perfil?.nombre || usuario.email,
    });
    return sesion;
}

/** Envía el enlace mágico de acceso. */
export async function enviarEnlace(email) {
    const sb = await supa();
    const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (error) throw new Error(error.message);
}

/** Acceso con contraseña, por si algún cliente la prefiere. */
export async function entrarConClave(email, clave) {
    const sb = await supa();
    const { data, error } = await sb.auth.signInWithPassword({ email, password: clave });
    if (error) throw new Error(error.message);
    return aplicarUsuario(data.user);
}

export async function salir() {
    if (modo() === 'supabase') {
        const sb = await supa();
        await sb.auth.signOut();
    }
    Object.assign(sesion, { activa: false, usuario: null, perfil: null, rol: 'admin', clienteId: null });
    location.hash = '';
    location.reload();
}

/** Avisa cuando Supabase cambia el estado de sesión (por ejemplo, al volver del email). */
export async function alCambiarSesion(fn) {
    if (modo() !== 'supabase') return;
    const sb = await supa();
    sb.auth.onAuthStateChange(async (evento, s) => {
        if (evento === 'SIGNED_IN' && s?.user) {
            await aplicarUsuario(s.user);
            fn(sesion);
        }
        if (evento === 'SIGNED_OUT') {
            Object.assign(sesion, { activa: false, usuario: null, perfil: null });
            fn(sesion);
        }
    });
}
