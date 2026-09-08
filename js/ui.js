/** Piezas visuales reutilizadas por todas las vistas. */
import { html, esc, raw, iniciales, diasHasta, fecha, plazo } from './util.js';
import { FASES } from './data/index.js';

/* ------------------------------------------------------------ ICONOS ----- */

const ICONOS = {
    panel: '<path d="M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 13h7v8H3z"/>',
    clientes: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
    proyectos: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    pagos: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    cuotas: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>',
    dominios: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18"/>',
    pipeline: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    catalogo: '<path d="M4 4h16v5H4zM4 13h7v7H4zM13 13h7v7h-7z"/>',
    ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 15H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 3V3a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 17 4.6a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    buscar: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    mas: '<path d="M12 5v14M5 12h14"/>',
    calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    aviso: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    volver: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    enlace: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    archivo: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    nota: '<path d="M4 4h16v12l-4 4H4z"/><path d="M20 16h-4v4"/>',
    borrar: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
    editar: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    llave: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 21 2M17 6l3 3M14 9l3 3"/>',
};

/** Devuelve un icono SVG listo para insertar (ya es HTML seguro). */
export function ico(nombre, tam = 16) {
    const cuerpo = ICONOS[nombre] || ICONOS.panel;
    return `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${cuerpo}</svg>`;
}

/* ------------------------------------------------------------- BLOQUES --- */

export function cabecera({ titulo, sub = '', acciones = '', volver = null }) {
    return html`
        <div class="section-title">
            <div class="stack">
                ${raw(volver ? `<a href="${esc(volver)}" class="btn-quiet small row gap-sm" style="margin-left:-8px">${ico('volver', 14)} Volver</a>` : '')}
                <h1>${titulo}</h1>
                ${raw(sub ? `<p class="muted small">${sub}</p>` : '')}
            </div>
            <div class="row wrap">${raw(acciones)}</div>
        </div>`;
}

export function vacio(texto, accion = '') {
    return html`<div class="empty"><div class="big">·</div><p class="small">${texto}</p>${raw(accion ? `<div class="mt">${accion}</div>` : '')}</div>`;
}

export function progresoBarra(pct) {
    const p = Math.max(0, Math.min(100, Math.round(pct || 0)));
    return `<div class="progress" role="progressbar" aria-valuenow="${p}"><i style="width:${p}%"></i></div>`;
}

/** Línea de fases del proyecto (la que ve el cliente). */
export function fasesLinea(estadoActual) {
    const indice = Math.max(0, FASES.indexOf(estadoActual));
    return `<div class="phases">${FASES.map((f, i) => `
        <div class="phase ${i < indice ? 'done' : ''} ${i === indice ? 'now' : ''}">
            <div class="l">${esc(f)}</div>
        </div>`).join('')}</div>`;
}

export function tagFase(estado) {
    const clase = estado === 'Publicado' ? 'ok' : estado === 'Presupuesto' ? 'line' : 'info';
    return `<span class="tag ${clase}">${esc(estado || '—')}</span>`;
}

/** Etiqueta de estado de un pago, calculando el vencimiento. */
export function tagPago(pago) {
    if (pago.estado === 'pagado') return `<span class="tag ok">Pagado</span>`;
    const d = diasHasta(pago.fecha_vencimiento);
    if (d === null) return `<span class="tag">Pendiente</span>`;
    if (d < 0) return `<span class="tag bad">Vencido ${esc(plazo(pago.fecha_vencimiento))}</span>`;
    if (d <= 7) return `<span class="tag warn">Vence ${esc(plazo(pago.fecha_vencimiento))}</span>`;
    return `<span class="tag">Pendiente · ${esc(fecha(pago.fecha_vencimiento, { day: 'numeric', month: 'short' }))}</span>`;
}

/** Etiqueta para fechas de renovación (dominios y cuotas). */
export function tagVence(iso) {
    const d = diasHasta(iso);
    if (d === null) return '<span class="tag line">Sin fecha</span>';
    if (d < 0) return `<span class="tag bad">Venció ${esc(plazo(iso))}</span>`;
    if (d <= 15) return `<span class="tag warn">${esc(fecha(iso))} · ${esc(plazo(iso))}</span>`;
    return `<span class="tag">${esc(fecha(iso))}</span>`;
}

export function avatar(nombre, oscuro = false) {
    return `<div class="avatar ${oscuro ? 'dark' : ''}">${esc(iniciales(nombre))}</div>`;
}

export function stat(k, v, s = '') {
    return html`<div class="stat"><div class="k">${k}</div><div class="v">${v}</div>${raw(s ? `<div class="s">${s}</div>` : '')}</div>`;
}

/** Campo de solo lectura con botón de copiar. */
export function campoCopiar(valor, etiqueta = '') {
    return html`
        <div class="field">
            ${raw(etiqueta ? `<label>${esc(etiqueta)}</label>` : '')}
            <div class="copy-field">
                <input type="text" readonly value="${raw(esc(valor))}">
                <button class="btn btn-ghost btn-sm" data-copiar="${raw(esc(valor))}">Copiar</button>
            </div>
        </div>`;
}
