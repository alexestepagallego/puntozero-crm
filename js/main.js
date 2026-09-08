/**
 * Arranque del CRM: sesión, estructura de la aplicación y rutas.
 */
import { CONFIG, modo } from './config.js';
import { sesion, esAdmin, iniciarSesionGuardada, alCambiarSesion, salir } from './auth.js';
import { cargarTodo, cache, alertas, recargarAdaptador } from './data/index.js';
import { ruta, arrancar, alCambiar, actual, ir } from './router.js';
import { registrarRefrescoNav } from './estado.js';
import { $, $$, html, raw, esc, on, copiar, toast } from './util.js';
import { ico, avatar } from './ui.js';

import { vistaPanel } from './views/panel.js';
import { vistaClientes, vistaCliente } from './views/clientes.js';
import { vistaProyectos } from './views/proyectos.js';
import { vistaProyecto } from './views/proyecto.js';
import { vistaPagos, vistaCuotas, vistaDominios } from './views/finanzas.js';
import { vistaCatalogo } from './views/catalogo.js';
import { vistaPipeline } from './views/pipeline.js';
import { vistaAjustes } from './views/ajustes.js';
import { vistaPortal, vistaPublica } from './views/portal.js';
import { vistaLogin } from './views/login.js';

/* --------------------------------------------------------------- SHELL --- */

const NAV_ADMIN = [
    { seccion: null, items: [
        { h: '#/', ico: 'panel', txt: 'Panel' },
        { h: '#/clientes', ico: 'clientes', txt: 'Clientes', cuenta: () => cache.clientes.length },
        { h: '#/proyectos', ico: 'proyectos', txt: 'Proyectos', cuenta: () => cache.proyectos.length },
    ]},
    { seccion: 'Dinero', items: [
        { h: '#/pagos', ico: 'pagos', txt: 'Pagos', cuenta: () => cache.pagos.filter(p => p.estado !== 'pagado').length },
        { h: '#/cuotas', ico: 'cuotas', txt: 'Cuotas y suscripciones' },
        { h: '#/dominios', ico: 'dominios', txt: 'Dominios' },
    ]},
    { seccion: 'Negocio', items: [
        { h: '#/pipeline', ico: 'pipeline', txt: 'Oportunidades', cuenta: () => cache.leads.filter(l => !['ganado', 'perdido'].includes(l.estado)).length },
        { h: '#/catalogo', ico: 'catalogo', txt: 'Tarifas' },
        { h: '#/ajustes', ico: 'ajustes', txt: 'Ajustes' },
    ]},
];

const NAV_CLIENTE = [
    { seccion: null, items: [{ h: '#/portal', ico: 'proyectos', txt: 'Mis proyectos' }] },
];

let shellMontado = false;

/** Dibuja la estructura fija (barra lateral + cabecera) una sola vez. */
export function montarShell() {
    if (shellMontado) return;
    const grupos = esAdmin() ? NAV_ADMIN : NAV_CLIENTE;

    $('#app').innerHTML = html`
        <div class="app">
            <aside class="sidebar">
                <a class="brand" href="#/">
                    <span class="brand-dot"></span>
                    <span class="stack" style="gap:0">
                        <span class="brand-name">${CONFIG.EMPRESA}</span>
                        <span class="brand-sub">CRM</span>
                    </span>
                </a>

                <nav class="nav" id="nav">
                    ${grupos.map(g => html`
                        ${raw(g.seccion ? `<div class="nav-label">${esc(g.seccion)}</div>` : '')}
                        ${g.items.map(i => html`
                            <a href="${i.h}" data-ruta="${i.h}">
                                <span class="ic">${raw(ico(i.ico))}</span>
                                <span>${i.txt}</span>
                                <span class="count" data-cuenta="${i.h}"></span>
                            </a>`)}
                    `)}
                </nav>

                <div class="sidebar-foot">
                    <div class="row">
                        ${raw(avatar(sesion.nombre, true))}
                        <div class="stack grow" style="min-width:0">
                            <span class="small strong truncate">${sesion.nombre}</span>
                            <span class="tiny muted">${raw(esAdmin() ? 'Administrador' : 'Cliente')}</span>
                        </div>
                        <button class="btn-quiet" id="btn-salir" title="Salir">${raw(ico('salir'))}</button>
                    </div>
                    ${raw(modo() === 'local' ? '<p class="tiny muted mt">Modo local: los datos solo están en este navegador.</p>' : '')}
                </div>
            </aside>

            <div class="main">
                <header class="topbar">
                    <button class="btn-quiet menu-btn" id="btn-menu">${raw(ico('menu'))}</button>
                    ${raw(esAdmin() ? `
                        <div class="search">
                            <span class="ic">${ico('buscar', 14)}</span>
                            <input type="text" id="buscador" placeholder="Buscar cliente o proyecto…" autocomplete="off">
                            <div id="resultados"></div>
                        </div>` : '<div class="grow"></div>')}
                    <div class="row grow" style="justify-content:flex-end">
                        ${raw(esAdmin() ? `
                            <a href="#/" class="btn btn-ghost btn-sm" id="chip-alertas">${ico('aviso', 14)} <span id="n-alertas">0</span></a>
                            <button class="btn btn-sm" id="btn-nuevo">${ico('mas', 14)} Nuevo</button>` : '')}
                    </div>
                </header>
                <main class="view" id="view"></main>
            </div>
        </div>`;

    shellMontado = true;
    conectarShell();
}

function conectarShell() {
    $('#btn-menu')?.addEventListener('click', () => document.body.classList.toggle('nav-open'));
    $('#scrim')?.addEventListener('click', () => document.body.classList.remove('nav-open'));
    $('#btn-salir')?.addEventListener('click', salir);
    $('#btn-nuevo')?.addEventListener('click', () => import('./views/nuevo.js').then(m => m.menuNuevo()));

    const buscador = $('#buscador');
    if (buscador) {
        buscador.addEventListener('input', () => pintarBusqueda(buscador.value));
        buscador.addEventListener('blur', () => setTimeout(() => ocultarBusqueda(), 180));
        buscador.addEventListener('focus', () => pintarBusqueda(buscador.value));
    }

    // Copiar al portapapeles desde cualquier vista.
    on(document.body, 'click', '[data-copiar]', (ev, el) => {
        ev.preventDefault();
        copiar(el.dataset.copiar);
    });

    // Cerrar el menú lateral al navegar en móvil.
    window.addEventListener('hashchange', () => document.body.classList.remove('nav-open'));
}

/* ------------------------------------------------------------ BUSCADOR --- */

function ocultarBusqueda() {
    const caja = $('#resultados');
    if (caja) caja.innerHTML = '';
}

function pintarBusqueda(texto) {
    const caja = $('#resultados');
    if (!caja) return;
    const q = texto.trim().toLowerCase();
    if (q.length < 2) return ocultarBusqueda();

    const clientes = cache.clientes
        .filter(c => `${c.nombre} ${c.empresa} ${c.email}`.toLowerCase().includes(q)).slice(0, 5);
    const proyectos = cache.proyectos
        .filter(p => `${p.nombre} ${p.tipo}`.toLowerCase().includes(q)).slice(0, 5);

    if (!clientes.length && !proyectos.length) {
        caja.innerHTML = `<div class="card" style="position:absolute;top:44px;left:0;right:0;z-index:60"><p class="small muted">Sin resultados</p></div>`;
        return;
    }

    caja.innerHTML = html`
        <div class="card" style="position:absolute;top:44px;left:0;right:0;z-index:60;box-shadow:var(--shadow);padding:6px">
            ${clientes.map(c => html`
                <a href="#/cliente/${c.id}" class="list-item" style="padding:8px;border:0">
                    ${raw(avatar(c.empresa || c.nombre))}
                    <span class="stack grow"><span class="small strong">${c.empresa || c.nombre}</span>
                    <span class="tiny muted">Cliente</span></span>
                </a>`)}
            ${proyectos.map(p => html`
                <a href="#/proyecto/${p.id}" class="list-item" style="padding:8px;border:0">
                    <span class="ic">${raw(ico('proyectos'))}</span>
                    <span class="stack grow"><span class="small strong">${p.nombre}</span>
                    <span class="tiny muted">Proyecto · ${p.estado}</span></span>
                </a>`)}
        </div>`;
}

/* ------------------------------------------------------- ESTADO DEL NAV -- */

export function refrescarNav() {
    const camino = '#' + actual();
    $$('#nav a').forEach(a => {
        const r = a.dataset.ruta;
        const activo = r === camino || (r !== '#/' && camino.startsWith(r));
        a.classList.toggle('active', activo);
    });

    const grupos = esAdmin() ? NAV_ADMIN : NAV_CLIENTE;
    for (const g of grupos) {
        for (const i of g.items) {
            const el = $(`[data-cuenta="${i.h}"]`);
            if (!el) continue;
            const n = i.cuenta ? i.cuenta() : 0;
            el.textContent = n || '';
            el.classList.toggle('hidden', !n);
        }
    }

    const nAlertas = $('#n-alertas');
    if (nAlertas) {
        const lista = alertas();
        nAlertas.textContent = lista.length;
        $('#chip-alertas')?.classList.toggle('btn-danger', lista.some(a => a.nivel === 'bad'));
    }
}

/* --------------------------------------------------------------- RUTAS --- */

/** Envuelve una vista: monta el shell, comprueba permisos y pinta. */
function protegida(vista, soloAdmin = true) {
    return async (params) => {
        if (soloAdmin && !esAdmin()) return ir('/portal');
        montarShell();
        await vista(params, $('#view'));
        refrescarNav();
        window.scrollTo(0, 0);
    };
}

function registrarRutas() {
    ruta('/', async () => {
        if (!esAdmin()) return ir('/portal');
        montarShell();
        await vistaPanel({}, $('#view'));
        refrescarNav();
    });

    ruta('/clientes', protegida(vistaClientes));
    ruta('/cliente/:id', protegida(vistaCliente));
    ruta('/proyectos', protegida(vistaProyectos));
    ruta('/proyecto/:id', protegida(vistaProyecto));
    ruta('/pagos', protegida(vistaPagos));
    ruta('/cuotas', protegida(vistaCuotas));
    ruta('/dominios', protegida(vistaDominios));
    ruta('/catalogo', protegida(vistaCatalogo));
    ruta('/pipeline', protegida(vistaPipeline));
    ruta('/ajustes', protegida(vistaAjustes));

    // Enlace secreto: se pinta a pantalla completa, sin barra lateral.
    ruta('/p/:token', async ({ token }) => {
        shellMontado = false;
        document.body.classList.remove('nav-open');
        await vistaPublica(token, $('#app'));
    });

    // Portal del cliente (también accesible para el administrador, como vista previa).
    ruta('/portal', protegida(vistaPortal, false));
    ruta('/portal/:id', protegida(vistaPortal, false));

    alCambiar(() => document.body.classList.remove('nav-open'));
}

/* -------------------------------------------------------------- INICIO --- */

async function inicio() {
    recargarAdaptador();

    // Acceso por enlace secreto: no necesita sesión ni estructura de la app.
    const camino = actual();
    if (camino.startsWith('/p/')) {
        await vistaPublica(camino.slice(3), $('#app'));
        window.addEventListener('hashchange', () => location.reload());
        return;
    }

    try {
        await iniciarSesionGuardada();
    } catch (e) {
        console.error(e);
        toast('No se ha podido conectar con la base de datos', 'bad');
    }

    if (!sesion.activa) {
        await vistaLogin($('#app'));
        alCambiarSesion(() => location.reload());
        return;
    }

    try {
        await cargarTodo();
    } catch (e) {
        console.error(e);
        toast(e.message || 'Error cargando los datos', 'bad');
    }

    registrarRutas();
    registrarRefrescoNav(refrescarNav);
    arrancar();
    alCambiarSesion(() => location.reload());
}

inicio();
