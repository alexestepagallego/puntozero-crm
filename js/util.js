/**
 * Utilidades compartidas: plantillas seguras, formato de fechas y dinero,
 * modales, avisos y exportación a calendario.
 */
import { CONFIG } from './config.js';

/* ---------------------------------------------------------------- DOM ---- */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Escapa texto para poder inyectarlo en HTML sin sustos. */
export function esc(valor) {
    if (valor === null || valor === undefined) return '';
    return String(valor)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Cadena que ya es HTML válido y por tanto no se vuelve a escapar. */
class Segura extends String {}

/** Marca una cadena como HTML ya seguro dentro de una plantilla `html`. */
export const raw = (texto) => new Segura(texto ?? '');

/**
 * Plantilla que escapa todo lo interpolado salvo lo que ya es HTML seguro
 * (otra plantilla `html` o algo envuelto en `raw()`). Los arrays se concatenan,
 * lo que permite escribir `${lista.map(x => html`...`)}`.
 */
export function html(cachos, ...valores) {
    let salida = cachos[0];
    for (let i = 0; i < valores.length; i++) {
        salida += pinta(valores[i]) + cachos[i + 1];
    }
    return new Segura(salida);
}

function pinta(valor) {
    if (valor === null || valor === undefined || valor === false) return '';
    if (valor instanceof Segura) return valor.toString();
    if (Array.isArray(valor)) return valor.map(pinta).join('');
    return esc(valor);
}

/**
 * Corta las escuchas registradas antes en este contenedor y abre una tanda nueva.
 *
 * Hace falta porque las vistas se repintan cambiando el `innerHTML` de un mismo
 * contenedor (`#view`), y los `addEventListener` del contenedor sobreviven a ese
 * repintado. Sin esto se van acumulando vista tras vista y, como varias
 * pantallas comparten selectores (`[data-nuevo]`), un solo clic acababa abriendo
 * el formulario de cliente, el de proyecto, el de pago y el de servicio a la vez.
 */
const ESCUCHAS = new WeakMap();

export function reiniciarEscuchas(raiz) {
    ESCUCHAS.get(raiz)?.abort();
    const control = new AbortController();
    ESCUCHAS.set(raiz, control);
    return control.signal;
}

/**
 * Delegación de eventos: `on(raiz, 'click', '.btn', (ev, el) => …)`.
 * Si el contenedor pasó por `reiniciarEscuchas`, la escucha muere con él en el
 * siguiente repintado; si no (por ejemplo en `document.body`), es permanente.
 */
export function on(raiz, evento, selector, fn) {
    const signal = ESCUCHAS.get(raiz)?.signal;
    raiz.addEventListener(evento, (ev) => {
        const el = ev.target.closest(selector);
        if (el && raiz.contains(el)) fn(ev, el);
    }, signal ? { signal } : undefined);
}

/* ------------------------------------------------------------ FORMATO ---- */

const dinero = new Intl.NumberFormat(CONFIG.LOCALE, {
    style: 'currency', currency: CONFIG.MONEDA, minimumFractionDigits: 2,
});

export function euros(n) {
    const numero = Number(n);
    return dinero.format(Number.isFinite(numero) ? numero : 0);
}

/** Igual que `euros` pero sin decimales cuando el importe es redondo. */
export function eurosCorto(n) {
    const numero = Number(n) || 0;
    return Number.isInteger(numero)
        ? new Intl.NumberFormat(CONFIG.LOCALE, { style: 'currency', currency: CONFIG.MONEDA, maximumFractionDigits: 0 }).format(numero)
        : euros(numero);
}

export function hoyISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Convierte "2026-03-14" en un Date local (evita el desfase de zona horaria). */
export function aFecha(iso) {
    if (!iso) return null;
    const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    if (!a || !m || !d) return null;
    return new Date(a, m - 1, d);
}

export function fecha(iso, opciones = { day: 'numeric', month: 'short', year: 'numeric' }) {
    const f = aFecha(iso);
    return f ? f.toLocaleDateString(CONFIG.LOCALE, opciones) : '—';
}

export function fechaCorta(iso) {
    return fecha(iso, { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/** Días que faltan (negativo si ya pasó). */
export function diasHasta(iso) {
    const f = aFecha(iso);
    if (!f) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Math.round((f - hoy) / 86400000);
}

/** Texto humano del plazo: "vence hoy", "en 12 días", "hace 3 días". */
export function plazo(iso) {
    const d = diasHasta(iso);
    if (d === null) return '—';
    if (d === 0) return 'hoy';
    if (d === 1) return 'mañana';
    if (d === -1) return 'ayer';
    return d > 0 ? `en ${d} días` : `hace ${Math.abs(d)} días`;
}

/** Suma un periodo a una fecha ISO y devuelve la nueva fecha ISO. */
export function sumarPeriodo(iso, periodicidad) {
    const f = aFecha(iso) || new Date();
    const meses = { mensual: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 }[periodicidad] ?? 1;
    f.setMonth(f.getMonth() + meses);
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
}

export function iniciales(nombre = '') {
    return nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase() || '·';
}

/** Desglose de impuestos de un importe base. */
export function desglose(base, ivaPct = 0, irpfPct = 0) {
    const b = Number(base) || 0;
    const iva = b * (Number(ivaPct) || 0) / 100;
    const irpf = b * (Number(irpfPct) || 0) / 100;
    return { base: b, iva, irpf, total: b + iva - irpf };
}

export function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

/** Token corto y legible para los enlaces secretos de proyecto. */
export function token(largo = 10) {
    const alfabeto = 'abcdefghijkmnpqrstuvwxyz23456789';
    return Array.from(crypto.getRandomValues(new Uint8Array(largo)))
        .map(n => alfabeto[n % alfabeto.length]).join('');
}

/* ------------------------------------------------------------- AVISOS ---- */

let ultimoToast = { txt: '', ts: 0 };
export function toast(mensaje, tipo = '') {
    const cont = $('#toasts');
    if (!cont) return;
    // Evita inundar la pantalla: ignora el mismo aviso repetido en < 3 s
    // y no deja más de 3 avisos a la vez.
    const ahora = Date.now();
    if (mensaje === ultimoToast.txt && ahora - ultimoToast.ts < 3000) return;
    ultimoToast = { txt: mensaje, ts: ahora };
    while (cont.children.length >= 3) cont.firstChild.remove();
    const t = document.createElement('div');
    t.className = `toast ${tipo}`;
    t.textContent = mensaje;
    cont.appendChild(t);
    setTimeout(() => {
        t.style.transition = 'opacity .3s';
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 300);
    }, 2600);
}

/* ------------------------------------------------------------- MODALES --- */

/** Modal genérico. Devuelve el nodo para que quien lo abra pueda engancharse. */
export function modal({ titulo, cuerpo, acciones = '', ancho = false, alCerrar }) {
    const scrim = document.createElement('div');
    scrim.className = 'modal-scrim';
    scrim.innerHTML = html`
        <div class="modal ${raw(ancho ? 'wide' : '')}" role="dialog" aria-modal="true">
            <div class="modal-head">
                <h2>${titulo}</h2>
                <button class="btn-quiet" data-cerrar aria-label="Cerrar">✕</button>
            </div>
            <div class="modal-body">${raw(cuerpo)}</div>
            ${raw(acciones ? `<div class="modal-foot">${acciones}</div>` : '')}
        </div>`;

    const cerrar = () => {
        scrim.remove();
        document.removeEventListener('keydown', alPulsar);
        alCerrar?.();
    };
    const alPulsar = (ev) => { if (ev.key === 'Escape') cerrar(); };

    scrim.addEventListener('click', (ev) => {
        if (ev.target === scrim || ev.target.closest('[data-cerrar]')) cerrar();
    });
    document.addEventListener('keydown', alPulsar);
    document.body.appendChild(scrim);
    setTimeout(() => scrim.querySelector('input, select, textarea')?.focus(), 60);

    scrim.cerrar = cerrar;
    return scrim;
}

/** Confirmación con promesa. */
export function confirmar(mensaje, { textoOk = 'Sí, continuar', peligro = true } = {}) {
    return new Promise((resolve) => {
        let respondido = false;
        const m = modal({
            titulo: 'Confirmar',
            cuerpo: html`<p class="small">${mensaje}</p>`,
            acciones: html`
                <button class="btn btn-ghost" data-cerrar>Cancelar</button>
                <button class="btn ${raw(peligro ? 'btn-danger' : '')}" data-ok>${textoOk}</button>`,
            alCerrar: () => { if (!respondido) resolve(false); },
        });
        m.querySelector('[data-ok]').addEventListener('click', () => {
            respondido = true;
            m.cerrar();
            resolve(true);
        });
    });
}

/**
 * Modal con formulario generado a partir de una lista de campos.
 * campo: { name, label, tipo, opciones, requerido, mitad, pista, placeholder, paso, min }
 */
export function formulario({ titulo, campos, valores = {}, textoOk = 'Guardar', ancho = false, onGuardar }) {
    const pintaCampo = (c) => {
        const v = valores[c.name] ?? c.valor ?? '';
        const req = c.requerido ? 'required' : '';
        const ph = c.placeholder ? `placeholder="${esc(c.placeholder)}"` : '';
        let control;

        if (c.tipo === 'select') {
            const opciones = (c.opciones || []).map(o => {
                const [val, txt] = Array.isArray(o) ? o : [o, o];
                return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(txt)}</option>`;
            }).join('');
            control = `<select name="${esc(c.name)}" ${req}>${c.vacio ? `<option value="">${esc(c.vacio)}</option>` : ''}${opciones}</select>`;
        } else if (c.tipo === 'textarea') {
            control = `<textarea name="${esc(c.name)}" ${ph} ${req} rows="${c.filas || 4}">${esc(v)}</textarea>`;
        } else if (c.tipo === 'check') {
            return `<div class="field"><label class="check"><input type="checkbox" name="${esc(c.name)}" ${v ? 'checked' : ''}> <span>${esc(c.label)}</span></label>
                ${c.pista ? `<span class="hint">${esc(c.pista)}</span>` : ''}</div>`;
        } else {
            const extra = c.tipo === 'number' ? `step="${c.paso || '0.01'}" ${c.min !== undefined ? `min="${c.min}"` : ''}` : '';
            control = `<input type="${c.tipo || 'text'}" name="${esc(c.name)}" value="${esc(v)}" ${ph} ${req} ${extra}>`;
        }

        return `<div class="field">
            <label for="${esc(c.name)}">${esc(c.label)}${c.requerido ? ' *' : ''}</label>
            ${control}
            ${c.pista ? `<span class="hint">${esc(c.pista)}</span>` : ''}
        </div>`;
    };

    // Los campos marcados como "mitad" se agrupan de dos en dos.
    let cuerpo = '';
    for (let i = 0; i < campos.length; i++) {
        const c = campos[i];
        if (c.mitad && campos[i + 1]?.mitad) {
            cuerpo += `<div class="grid-2">${pintaCampo(c)}${pintaCampo(campos[i + 1])}</div>`;
            i++;
        } else if (c.separador) {
            cuerpo += `<div class="nav-label" style="padding-left:0">${esc(c.separador)}</div>`;
        } else {
            cuerpo += pintaCampo(c);
        }
    }

    const m = modal({
        titulo,
        ancho,
        cuerpo: `<form id="form-modal" novalidate>${cuerpo}</form>`,
        acciones: html`
            <button class="btn btn-ghost" data-cerrar>Cancelar</button>
            <button class="btn" type="submit" form="form-modal">${textoOk}</button>`,
    });

    m.querySelector('#form-modal').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const form = ev.target;
        if (!form.reportValidity()) return;

        const datos = {};
        for (const c of campos) {
            if (c.separador) continue;
            const el = form.elements[c.name];
            if (!el) continue;
            if (c.tipo === 'check') datos[c.name] = el.checked;
            else if (c.tipo === 'number') datos[c.name] = el.value === '' ? null : Number(el.value);
            else datos[c.name] = el.value.trim() === '' ? null : el.value.trim();
        }

        const boton = m.querySelector('[type=submit]');
        boton.disabled = true;
        try {
            await onGuardar(datos);
            m.cerrar();
        } catch (e) {
            console.error(e);
            toast(e.message || 'No se ha podido guardar', 'bad');
            boton.disabled = false;
        }
    });

    return m;
}

/* --------------------------------------------------------- CALENDARIO ---- */

/** Genera y descarga un .ics con los vencimientos recibidos. */
export function descargarICS(eventos, nombreArchivo = 'puntozero-vencimientos.ics') {
    const sello = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '');
    const lineas = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PuntoZero//CRM//ES',
        'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${CONFIG.EMPRESA} · Vencimientos`,
    ];

    for (const ev of eventos) {
        const dia = String(ev.fecha).slice(0, 10).replace(/-/g, '');
        if (dia.length !== 8) continue;
        const fin = new Date(aFecha(ev.fecha).getTime() + 86400000);
        const diaFin = `${fin.getFullYear()}${String(fin.getMonth() + 1).padStart(2, '0')}${String(fin.getDate()).padStart(2, '0')}`;
        lineas.push(
            'BEGIN:VEVENT',
            `UID:${ev.id || uuid()}@puntozero-crm`,
            `DTSTAMP:${sello}`,
            `DTSTART;VALUE=DATE:${dia}`,
            `DTEND;VALUE=DATE:${diaFin}`,
            `SUMMARY:${escICS(ev.titulo)}`,
            `DESCRIPTION:${escICS(ev.descripcion || '')}`,
            'BEGIN:VALARM', 'TRIGGER:-P7D', 'ACTION:DISPLAY',
            `DESCRIPTION:${escICS(ev.titulo)}`, 'END:VALARM',
            'END:VEVENT',
        );
    }

    lineas.push('END:VCALENDAR');
    descargar(new Blob([lineas.join('\r\n')], { type: 'text/calendar;charset=utf-8' }), nombreArchivo);
}

const escICS = (t) => String(t || '').replace(/\\/g, '\\\\').replace(/[;,]/g, m => '\\' + m).replace(/\n/g, '\\n');

export function descargar(blob, nombre) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copiar(texto) {
    try {
        await navigator.clipboard.writeText(texto);
        toast('Copiado al portapapeles');
    } catch {
        toast('No se ha podido copiar', 'bad');
    }
}

/**
 * Devuelve la URL solo si es navegable (http o https).
 *
 * Es una segunda barrera: la base ya rechaza cualquier otro esquema, pero si
 * algún día entrara un `javascript:...` por otra vía, aquí no se pinta como
 * enlace y no puede ejecutarse al pulsarlo.
 */
export function urlSegura(url) {
    const texto = String(url || '').trim();
    return /^https?:\/\//i.test(texto) ? texto : null;
}

/** Ordena por campo (fechas ISO y números incluidos). */
export function porCampo(campo, dir = 'asc') {
    return (a, b) => {
        const x = a?.[campo] ?? '', y = b?.[campo] ?? '';
        if (x === y) return 0;
        if (x === '' || x === null) return 1;
        if (y === '' || y === null) return -1;
        return (x > y ? 1 : -1) * (dir === 'asc' ? 1 : -1);
    };
}
