/**
 * Pantalla de acceso (solo en modo Supabase). Ofrece enlace mágico o
 * contraseña, y un atajo para configurar la conexión.
 */
import { CONFIG, guardarConexion, borrarConexion, leerConexion } from '../config.js';
import { enviarEnlace, entrarConClave } from '../auth.js';
import { html, raw, $, toast, formulario, esc } from '../util.js';
import { ico } from '../ui.js';

export async function vistaLogin(raiz) {
    raiz.innerHTML = html`
        <div class="auth-wrap">
            <div class="auth-box">
                <div class="brand">
                    <span class="brand-dot"></span>
                    <span class="brand-name">${CONFIG.EMPRESA}</span>
                </div>
                <p class="center muted small">Acceso al CRM y al portal de clientes</p>

                <div class="auth-tabs">
                    <button class="active" data-modo="clave">Contraseña</button>
                    <button data-modo="enlace">Enlace por email</button>
                </div>

                <form id="form-enlace" class="hidden">
                    <div class="field">
                        <label for="email">Tu email</label>
                        <input type="email" name="email" required placeholder="tu@correo.com" autocomplete="email">
                        <span class="hint">Te enviamos un enlace de un solo uso al correo con el que te dimos de alta.</span>
                    </div>
                    <button class="btn btn-block" type="submit">Enviarme el enlace</button>
                </form>

                <form id="form-clave">
                    <div class="field">
                        <label for="email2">Email</label>
                        <input type="email" name="email2" required placeholder="tu@correo.com" autocomplete="email">
                    </div>
                    <div class="field">
                        <label for="clave">Contraseña</label>
                        <input type="password" name="clave" required autocomplete="current-password">
                    </div>
                    <button class="btn btn-block" type="submit">Entrar</button>
                </form>

                <p class="center tiny muted mt">
                    Aquí no hay registro: los accesos los damos nosotros.
                    ¿Eres cliente y aún no tienes el tuyo? Escríbenos.
                </p>

                <p class="center tiny muted mt-lg">
                    <a href="${CONFIG.EMPRESA_WEB}" target="_blank" rel="noopener">${esc(CONFIG.EMPRESA_WEB.replace('https://', ''))}</a>
                    · <a href="#/privacidad">Privacidad</a>
                    · <button class="btn-quiet tiny" id="btn-conexion">Configurar conexión</button>
                </p>
            </div>
        </div>`;

    const tabs = raiz.querySelectorAll('.auth-tabs button');
    tabs.forEach(t => t.addEventListener('click', () => {
        tabs.forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        const enlace = t.dataset.modo === 'enlace';
        $('#form-enlace').classList.toggle('hidden', !enlace);
        $('#form-clave').classList.toggle('hidden', enlace);
    }));

    $('#form-enlace').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const boton = ev.target.querySelector('button');
        boton.disabled = true;
        boton.textContent = 'Enviando…';
        try {
            await enviarEnlace(ev.target.elements.email.value.trim());
            ev.target.innerHTML = `<div class="banner">${ico('check', 14)} Revisa tu correo: te hemos enviado el enlace de acceso.</div>`;
        } catch (e) {
            toast(e.message || 'No se ha podido enviar', 'bad');
            boton.disabled = false;
            boton.textContent = 'Enviarme el enlace';
        }
    });

    $('#form-clave').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const boton = ev.target.querySelector('button');
        boton.disabled = true;
        try {
            await entrarConClave(ev.target.elements.email2.value.trim(), ev.target.elements.clave.value);
            location.reload();
        } catch (e) {
            toast(e.message || 'Datos incorrectos', 'bad');
            boton.disabled = false;
        }
    });

    $('#btn-conexion').addEventListener('click', () => abrirConexion());
}

/** Formulario de conexión con Supabase (también usado desde Ajustes). */
export function abrirConexion() {
    const actual = leerConexion() || { url: '', key: '' };
    formulario({
        titulo: 'Conexión con la base de datos',
        campos: [
            { name: 'url', label: 'URL del proyecto de Supabase', valor: actual.url,
              placeholder: 'https://xxxxxxxx.supabase.co', pista: 'Supabase → Project Settings → API' },
            { name: 'key', label: 'Clave pública (anon)', tipo: 'textarea', filas: 3, valor: actual.key,
              pista: 'Es pública por diseño: las tablas están protegidas por políticas RLS' },
        ],
        textoOk: 'Guardar y recargar',
        onGuardar: async ({ url, key }) => {
            if (!url || !key) {
                borrarConexion();
                toast('Conexión borrada: vuelves al modo local');
            } else {
                guardarConexion(url, key);
                toast('Conexión guardada');
            }
            setTimeout(() => location.reload(), 600);
        },
    });
}
