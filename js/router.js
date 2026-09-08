/**
 * Enrutador por hash (#/ruta/parametro). Sin dependencias ni servidor:
 * funciona tal cual en GitHub Pages.
 */
const rutas = [];
let alPintar = null;

/** Registra una ruta: patron('/proyecto/:id') → función(params). */
export function ruta(patron, vista) {
    const nombres = [];
    const expresion = new RegExp('^' + patron.replace(/:[^/]+/g, (m) => {
        nombres.push(m.slice(1));
        return '([^/]+)';
    }) + '$');
    rutas.push({ expresion, nombres, vista, patron });
}

export function actual() {
    const h = location.hash.replace(/^#/, '');
    return h || '/';
}

export function ir(destino) {
    location.hash = destino.startsWith('#') ? destino : '#' + destino;
}

/** Reemplaza la ruta sin dejar rastro en el historial. */
export function irReemplazando(destino) {
    history.replaceState(null, '', destino.startsWith('#') ? destino : '#' + destino);
    resolver();
}

export function alCambiar(fn) { alPintar = fn; }

export async function resolver() {
    const camino = actual();
    for (const r of rutas) {
        const m = camino.match(r.expresion);
        if (!m) continue;
        const params = Object.fromEntries(r.nombres.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
        alPintar?.(camino);
        await r.vista(params);
        return;
    }
    // Ruta desconocida: al inicio.
    ir('/');
}

export function arrancar() {
    window.addEventListener('hashchange', resolver);
    resolver();
}
