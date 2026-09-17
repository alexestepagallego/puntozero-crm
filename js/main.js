/**
 * Arranque del CRM: sesión, estructura de la aplicación y rutas.
 */
import { CONFIG, modo } from './config.js';
import { sesion, esAdmin, iniciarSesionGuardada, alCambiarSesion, salir, cambiarClave } from './auth.js';
import { cargarTodo, cache, alertas, recargarAdaptador, alFallarLaCarga } from './data/index.js';
import { ruta, arrancar, alCambiar, actual, ir } from './router.js';
import { registrarRefrescoNav } from './estado.js';
import { $, $$, html, raw, esc, on, copiar, toast, formulario, modal } from './util.js';
import { ico, avatar, ponerTitulo } from './ui.js';

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
let globalesConectadas = false;

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
                    ${raw(modo() === 'supabase'
                        ? '<button class="btn-quiet tiny mt" id="btn-clave" style="padding-left:0">Cambiar mi contraseña</button>'
                        : '')}
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
        </div>
        ${raw(esAdmin() ? `<button class="asist-lanzador" id="btn-asistente" title="Asistente (IA)">${ico('chat')}</button>` : '')}`;

    shellMontado = true;
    conectarShell();
}

function conectarShell() {
    $('#btn-menu')?.addEventListener('click', () => document.body.classList.toggle('nav-open'));
    $('#scrim')?.addEventListener('click', () => document.body.classList.remove('nav-open'));
    $('#btn-salir')?.addEventListener('click', salir);
    $('#btn-clave')?.addEventListener('click', () => formulario({
        titulo: 'Cambiar mi contraseña',
        campos: [
            { name: 'clave', label: 'Contraseña nueva', tipo: 'password', requerido: true,
              pista: 'Mínimo 10 caracteres, con mayúscula, minúscula y número' },
            { name: 'repetir', label: 'Repítela', tipo: 'password', requerido: true },
        ],
        onGuardar: async ({ clave, repetir }) => {
            if (clave !== repetir) throw new Error('Las dos contraseñas no coinciden');
            if (clave.length < 10) throw new Error('Usa al menos 10 caracteres');
            if (!/[a-z]/.test(clave) || !/[A-Z]/.test(clave) || !/[0-9]/.test(clave)) {
                throw new Error('Debe llevar mayúscula, minúscula y número');
            }
            await cambiarClave(clave);
            toast('Contraseña cambiada');
        },
    }));
    $('#btn-nuevo')?.addEventListener('click', () => import('./views/nuevo.js').then(m => m.menuNuevo()));
    $('#btn-asistente')?.addEventListener('click', () => import('./views/asistente.js').then(m => m.alternarAsistente()));

    const buscador = $('#buscador');
    if (buscador) {
        buscador.addEventListener('input', () => pintarBusqueda(buscador.value));
        buscador.addEventListener('blur', () => setTimeout(() => ocultarBusqueda(), 180));
        buscador.addEventListener('focus', () => pintarBusqueda(buscador.value));
    }

    // Copiar al portapapeles desde cualquier vista. Va en el body, que no se
    // repinta nunca, así que se engancha una sola vez en toda la sesión.
    if (!globalesConectadas) {
        globalesConectadas = true;
        on(document.body, 'click', '[data-copiar]', (ev, el) => {
            ev.preventDefault();
            copiar(el.dataset.copiar);
        });
        window.addEventListener('hashchange', () => document.body.classList.remove('nav-open'));
    }

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

/**
 * Envuelve una vista: monta el shell, comprueba permisos, pone el título de la
 * pestaña y pinta. Las fichas concretas (un cliente, un proyecto) afinan el
 * título por su cuenta con el nombre de verdad.
 */
function protegida(vista, { soloAdmin = true, titulo = '' } = {}) {
    return async (params) => {
        if (soloAdmin && !esAdmin()) return ir('/portal');
        montarShell();
        ponerTitulo(titulo);
        await vista(params, $('#view'));
        refrescarNav();
        window.scrollTo(0, 0);
    };
}

function registrarRutas() {
    ruta('/', async () => {
        if (!esAdmin()) return ir('/portal');
        montarShell();
        ponerTitulo('Panel');
        await vistaPanel({}, $('#view'));
        refrescarNav();
    });

    ruta('/clientes', protegida(vistaClientes, { titulo: 'Clientes' }));
    ruta('/cliente/:id', protegida(vistaCliente));
    ruta('/proyectos', protegida(vistaProyectos, { titulo: 'Proyectos' }));
    ruta('/proyecto/:id', protegida(vistaProyecto));
    ruta('/pagos', protegida(vistaPagos, { titulo: 'Pagos' }));
    ruta('/cuotas', protegida(vistaCuotas, { titulo: 'Cuotas' }));
    ruta('/dominios', protegida(vistaDominios, { titulo: 'Dominios' }));
    ruta('/catalogo', protegida(vistaCatalogo, { titulo: 'Tarifas' }));
    ruta('/pipeline', protegida(vistaPipeline, { titulo: 'Oportunidades' }));
    ruta('/ajustes', protegida(vistaAjustes, { titulo: 'Ajustes' }));

    // Enlace secreto: se pinta a pantalla completa, sin barra lateral.
    ruta('/p/:token', async ({ token }) => {
        shellMontado = false;
        document.body.classList.remove('nav-open');
        await vistaPublica(token, $('#app'));
    });

    // Portal del cliente (también accesible para el administrador, como vista previa).
    ruta('/portal', protegida(vistaPortal, { soloAdmin: false, titulo: 'Tus proyectos' }));
    ruta('/portal/:id', protegida(vistaPortal, { soloAdmin: false }));

    // Aviso de privacidad: a pantalla completa y sin necesidad de sesión.
    ruta('/privacidad', async () => {
        shellMontado = false;
        const { vistaPrivacidad } = await import('./views/privacidad.js');
        await vistaPrivacidad($('#app'));
    });

    alCambiar(() => document.body.classList.remove('nav-open'));
}

/* -------------------------------------------------------------- INICIO --- */

/**
 * Qué hacer cuando los datos no llegan. Antes esto no existía: el CRM se
 * quedaba vacío en silencio y parecía que no funcionaba nada.
 */
function avisarDeFallos(fallos) {
    const caducada = fallos.some(f => /sesión ha caducado|jwt|token/i.test(f.mensaje));
    if (caducada) {
        if (document.querySelector('[data-sesion-caducada]')) return;
        modal({
            titulo: 'Tu sesión ha caducado',
            cuerpo: html`<p class="small">Por seguridad, la sesión dura un rato limitado.
                Vuelve a entrar y sigues donde lo dejaste. No se ha perdido nada de lo guardado.</p>
                <span data-sesion-caducada hidden></span>`,
            acciones: '<button class="btn" onclick="location.reload()">Volver a entrar</button>',
        });
        return;
    }
    toast(`No se han podido cargar ${fallos.length === 1 ? fallos[0].tabla : fallos.length + ' apartados'}. Revisa la conexión.`, 'bad');
    console.warn('Fallos al cargar:', fallos);
}

async function inicio() {
    recargarAdaptador();
    alFallarLaCarga(avisarDeFallos);

    // Acceso por enlace secreto: no necesita sesión ni estructura de la app.
    const camino = actual();
    if (camino === '/privacidad') {
        const { vistaPrivacidad } = await import('./views/privacidad.js');
        await vistaPrivacidad($('#app'));
        window.addEventListener('hashchange', () => location.reload());
        return;
    }
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
