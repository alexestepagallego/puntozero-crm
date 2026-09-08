/** Listado de proyectos con filtro por fase y por cliente. */
import { html, raw, esc, euros, fecha, on, plazo, diasHasta } from '../util.js';
import { cache, FASES, progreso, nombreCliente } from '../data/index.js';
import { cabecera, vacio, ico, tagFase, progresoBarra } from '../ui.js';
import { abrirFicha } from '../forms.js';

let filtroFase = 'todas';
let filtroCliente = 'todos';

export async function vistaProyectos(_params, raiz) {
    const proyectos = cache.proyectos
        .filter(p => filtroFase === 'todas' || p.estado === filtroFase)
        .filter(p => filtroCliente === 'todos' || String(p.cliente_id) === filtroCliente)
        .sort((a, b) => (a.fecha_entrega || '9999').localeCompare(b.fecha_entrega || '9999'));

    raiz.innerHTML = html`
        ${raw(cabecera({
            titulo: 'Proyectos',
            sub: `${proyectos.length} de ${cache.proyectos.length}`,
            acciones: `<button class="btn btn-sm" data-nuevo>${ico('mas', 14)} Nuevo proyecto</button>`,
        }))}

        <div class="row wrap mb">
            <select id="f-fase" style="max-width:200px">
                <option value="todas">Todas las fases</option>
                ${FASES.map(f => html`<option value="${f}" ${raw(filtroFase === f ? 'selected' : '')}>${f}</option>`)}
            </select>
            <select id="f-cliente" style="max-width:240px">
                <option value="todos">Todos los clientes</option>
                ${cache.clientes.map(c => html`
                    <option value="${c.id}" ${raw(filtroCliente === String(c.id) ? 'selected' : '')}>${c.empresa || c.nombre}</option>`)}
            </select>
        </div>

        ${raw(proyectos.length ? html`
            <div class="grid grid-cards">
                ${proyectos.map(p => {
                    const pct = progreso(p.id);
                    const dias = diasHasta(p.fecha_entrega);
                    const urgente = dias !== null && dias < 7 && p.estado !== 'Publicado';
                    return html`
                        <a class="card card-link" href="#/proyecto/${p.id}">
                            <div class="row-between">
                                <span class="strong truncate">${p.nombre}</span>
                                ${raw(tagFase(p.estado))}
                            </div>
                            <p class="tiny muted mt">${nombreCliente(p.cliente_id)} · ${p.tipo || 'Proyecto'}</p>
                            <div class="mt">${raw(progresoBarra(pct))}</div>
                            <div class="row-between mt">
                                <span class="tiny muted">${pct} %</span>
                                ${raw(p.fecha_entrega
                                    ? `<span class="tag ${urgente ? (dias < 0 ? 'bad' : 'warn') : 'line'}">${esc(fecha(p.fecha_entrega, { day: 'numeric', month: 'short' }))} · ${esc(plazo(p.fecha_entrega))}</span>`
                                    : '<span class="tiny muted">Sin fecha</span>')}
                            </div>
                            ${raw(p.precio_base ? `<p class="tiny muted mt">${esc(euros(p.precio_base))} + impuestos</p>` : '')}
                        </a>`;
                })}
            </div>` : vacio('No hay proyectos con este filtro.',
                '<button class="btn btn-sm" data-nuevo>Crear proyecto</button>'))}`;

    raiz.querySelector('#f-fase').addEventListener('change', (ev) => {
        filtroFase = ev.target.value;
        vistaProyectos({}, raiz);
    });
    raiz.querySelector('#f-cliente').addEventListener('change', (ev) => {
        filtroCliente = ev.target.value;
        vistaProyectos({}, raiz);
    });
    on(raiz, 'click', '[data-nuevo]', () => abrirFicha('proyecto'));
}
