/**
 * Panel del asistente (IA). Chat flotante donde el equipo escribe órdenes en
 * lenguaje natural. La IA propone cambios; el equipo confirma; entonces se
 * aplican por el camino seguro (misma capa de datos, con permisos y validación).
 */
import { html, raw, esc, on, toast, confirmar, euros } from '../util.js';
import { preguntarAsistente, ejecutarAccion, esLocal } from '../data/index.js';
import { ico } from '../ui.js';
import { repintar } from '../estado.js';

// El historial de la conversación se guarda en memoria mientras el panel vive.
let conversacion = [];

/** Abre (o cierra) el panel del asistente. */
export function alternarAsistente() {
    const existente = document.getElementById('pz-asistente');
    if (existente) { existente.remove(); return; }
    document.body.appendChild(construir());
    setTimeout(() => document.querySelector('#pz-asist-input')?.focus(), 80);
    pintarConversacion();
}

function construir() {
    const panel = document.createElement('div');
    panel.id = 'pz-asistente';
    panel.innerHTML = html`
        <div class="asist-cab">
            <span class="row gap-sm">
                <span class="asist-punto"></span>
                <span class="strong small">Asistente</span>
                <span class="tag line tiny">IA</span>
            </span>
            <button class="btn-quiet" id="pz-asist-cerrar" aria-label="Cerrar">✕</button>
        </div>
        <div class="asist-cuerpo" id="pz-asist-cuerpo"></div>
        <form class="asist-pie" id="pz-asist-form">
            <textarea id="pz-asist-input" rows="1" placeholder="Ej: sube a 200 € la carta de Villegas"
                autocomplete="off"></textarea>
            <button class="btn btn-icon" type="submit" id="pz-asist-enviar" aria-label="Enviar">${raw(ico('mas', 16))}</button>
        </form>`;

    on(panel, 'click', '#pz-asist-cerrar', () => panel.remove());

    const input = panel.querySelector('#pz-asist-input');
    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });
    input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); panel.querySelector('#pz-asist-form').requestSubmit(); }
    });

    panel.querySelector('#pz-asist-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const texto = input.value.trim();
        if (!texto) return;
        input.value = '';
        input.style.height = 'auto';
        enviar(texto);
    });

    return panel;
}

/* ------------------------------------------------------------ MENSAJES ---- */

function pintarConversacion() {
    const cuerpo = document.getElementById('pz-asist-cuerpo');
    if (!cuerpo) return;

    if (!conversacion.length) {
        cuerpo.innerHTML = html`
            <div class="asist-bienvenida">
                <p class="small">Escríbeme lo que quieras hacer y te lo preparo. Tú confirmas antes de aplicar nada.</p>
                <div class="asist-ejemplos">
                    ${['¿Quién me debe dinero?',
                       'Crea un cliente: Bar Pepe, contacto Luis, 600112233',
                       'Pon la carta de Villegas en Publicado',
                       'Añade un pago de 150 € a Bocatería Sur'].map(e => html`
                        <button class="asist-ejemplo" data-ejemplo="${esc(e)}">${e}</button>`)}
                </div>
            </div>`;
        on(cuerpo, 'click', '[data-ejemplo]', (_ev, el) => enviar(el.dataset.ejemplo));
        return;
    }

    cuerpo.innerHTML = conversacion.map(pintarMensaje).join('');
    conectarAcciones(cuerpo);
    cuerpo.scrollTop = cuerpo.scrollHeight;
}

function pintarMensaje(m, i) {
    if (m.rol === 'usuario') {
        return html`<div class="asist-msg asist-yo"><div class="asist-burbuja">${m.texto}</div></div>`;
    }
    if (m.rol === 'pensando') {
        return html`<div class="asist-msg asist-ia"><div class="asist-burbuja asist-pensando"><span></span><span></span><span></span></div></div>`;
    }
    // Mensaje de la IA: texto + posibles acciones para confirmar.
    return html`
        <div class="asist-msg asist-ia">
            <div class="asist-burbuja">
                ${raw(m.texto ? esc(m.texto) : '')}
                ${raw((m.acciones && m.acciones.length) ? tarjetaAcciones(m, i) : '')}
                ${raw(m.error ? `<span class="asist-error">${esc(m.error)}</span>` : '')}
            </div>
        </div>`;
}

function tarjetaAcciones(m, i) {
    if (m.aplicado) {
        return `<div class="asist-acciones aplicado">${ico('check', 14)} <span class="tiny">Aplicado</span></div>`;
    }
    if (m.cancelado) {
        return `<div class="asist-acciones cancelado"><span class="tiny muted">Cancelado</span></div>`;
    }
    return html`
        <div class="asist-acciones" data-msg="${i}">
            <p class="tiny muted">Voy a hacer esto:</p>
            <ul class="asist-lista">
                ${m.acciones.map(a => html`<li>${raw(icoOperacion(a.operacion))} ${a.resumen}</li>`)}
            </ul>
            <div class="row gap-sm mt">
                <button class="btn btn-sm" data-aplicar="${i}">Confirmar y aplicar</button>
                <button class="btn btn-ghost btn-sm" data-cancelar="${i}">Cancelar</button>
            </div>
        </div>`;
}

const icoOperacion = (op) => ({
    crear: '<span class="asist-op crear">+</span>',
    editar: '<span class="asist-op editar">✎</span>',
    borrar: '<span class="asist-op borrar">✕</span>',
}[op] || '·');

/* ----------------------------------------------------------- ACCIONES ----- */

function conectarAcciones(cuerpo) {
    on(cuerpo, 'click', '[data-aplicar]', (_ev, el) => aplicar(Number(el.dataset.aplicar)));
    on(cuerpo, 'click', '[data-cancelar]', (_ev, el) => {
        conversacion[Number(el.dataset.cancelar)].cancelado = true;
        pintarConversacion();
    });
}

async function aplicar(indice) {
    const m = conversacion[indice];
    if (!m || m.aplicado) return;

    // Confirmación extra si hay algún borrado (lo irreversible).
    const borrados = m.acciones.filter(a => a.operacion === 'borrar');
    if (borrados.length) {
        const ok = await confirmar(
            `Vas a eliminar ${borrados.length} elemento(s). Esto no se puede deshacer.`,
            { textoOk: 'Eliminar' });
        if (!ok) return;
    }

    const botones = document.querySelector(`[data-msg="${indice}"]`);
    if (botones) botones.querySelectorAll('button').forEach(b => b.disabled = true);

    const errores = [];
    for (const accion of m.acciones) {
        try {
            await ejecutarAccion(accion);
        } catch (e) {
            errores.push(`${accion.resumen}: ${e.message}`);
        }
    }

    if (errores.length) {
        m.error = 'No se pudieron aplicar algunos cambios:\n' + errores.join('\n');
        toast('Algún cambio falló', 'bad');
    } else {
        m.aplicado = true;
        toast('Cambios aplicados');
    }
    await repintar();            // refresca la vista de detrás con los datos nuevos
    pintarConversacion();
}

/* -------------------------------------------------------------- ENVÍO ----- */

async function enviar(texto) {
    if (esLocal()) {
        conversacion.push({ rol: 'usuario', texto });
        conversacion.push({ rol: 'ia', texto: '', error: 'El asistente necesita la conexión con Supabase. Actívala en Ajustes.' });
        pintarConversacion();
        return;
    }

    conversacion.push({ rol: 'usuario', texto });
    conversacion.push({ rol: 'pensando' });
    pintarConversacion();

    // Historial para Gemini (solo turnos con texto, en su formato).
    const historial = [];
    for (const m of conversacion) {
        if (m.rol === 'usuario') historial.push({ role: 'user', parts: [{ text: m.texto }] });
        else if (m.rol === 'ia' && m.texto) historial.push({ role: 'model', parts: [{ text: m.texto }] });
    }
    historial.pop(); // el último "user" lo manda la función junto con la foto

    try {
        const res = await preguntarAsistente(texto, historial);
        conversacion.pop(); // quita el "pensando"
        conversacion.push({ rol: 'ia', texto: res.respuesta || '', acciones: res.acciones || [] });
    } catch (e) {
        conversacion.pop();
        const ayuda = /clave de Gemini|no tiene configurada/i.test(e.message)
            ? e.message + ' (Ajustes → Asistente)'
            : e.message;
        conversacion.push({ rol: 'ia', texto: '', error: ayuda });
    }
    pintarConversacion();
}

export function reiniciarConversacion() {
    conversacion = [];
}
