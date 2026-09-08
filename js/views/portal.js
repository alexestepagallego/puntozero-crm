/**
 * Lo que ve el cliente: el estado de su proyecto, sus fechas y sus pagos.
 * Se llega por dos caminos —con su email o con el enlace secreto— y los dos
 * acaban pintando la misma pantalla.
 */
import { CONFIG } from '../config.js';
import { html, raw, esc, euros, fecha, plazo, desglose, diasHasta, toast } from '../util.js';
import { cache, cliente, proyectosDe, deProyecto, adaptador, esLocal, cargarTodo, progreso, FASES } from '../data/index.js';
import { sesion, esAdmin } from '../auth.js';
import { cabecera, vacio, ico, fasesLinea, progresoBarra, tagPago, tagVence, tagFase } from '../ui.js';
import { ir } from '../router.js';

/* =============================================== PORTAL CON SESIÓN ======= */

export async function vistaPortal({ id } = {}, raiz) {
    // El administrador puede usar esta pantalla como vista previa de un cliente.
    const clienteId = esAdmin() ? (new URLSearchParams(location.hash.split('?')[1] || '').get('cliente') || null) : sesion.clienteId;

    if (esAdmin() && !clienteId && !id) {
        raiz.innerHTML = html`
            ${raw(cabecera({ titulo: 'Portal del cliente', sub: 'Así ve cada cliente su proyecto' }))}
            <div class="grid grid-cards">
                ${cache.proyectos.map(p => html`
                    <a class="card card-link" href="#/portal/${p.id}">
                        <span class="strong">${p.nombre}</span>
                        <p class="tiny muted mt">${cliente(p.cliente_id)?.empresa || ''}</p>
                        <p class="tiny muted mt">Ver como lo ve el cliente →</p>
                    </a>`)}
            </div>`;
        return;
    }

    if (id) {
        const datos = datosDesdeCache(id);
        if (!datos) return void (raiz.innerHTML = vacio('Proyecto no encontrado.'));
        raiz.innerHTML = pantallaProyecto(datos, { volver: esAdmin() ? `#/proyecto/${id}` : '#/portal' });
        conectarDescargas(raiz);
        return;
    }

    const proyectos = proyectosDe(sesion.clienteId);
    if (proyectos.length === 1) return ir(`/portal/${proyectos[0].id}`);

    raiz.innerHTML = html`
        ${raw(cabecera({ titulo: 'Tus proyectos', sub: `Hola, ${esc(sesion.nombre)}` }))}
        ${raw(proyectos.length ? html`
            <div class="grid grid-cards">
                ${proyectos.map(p => html`
                    <a class="card card-link" href="#/portal/${p.id}">
                        <div class="row-between"><span class="strong">${p.nombre}</span>${raw(tagFase(p.estado))}</div>
                        <div class="mt">${raw(progresoBarra(progreso(p.id)))}</div>
                        <p class="tiny muted mt">${progreso(p.id)} % completado</p>
                    </a>`)}
            </div>` : vacio('Todavía no hay ningún proyecto asociado a tu cuenta.'))}`;

    conectarDescargas(raiz);
}

/* ============================================ ACCESO POR ENLACE SECRETO == */

export async function vistaPublica(tk, raiz) {
    raiz.innerHTML = `<div class="auth-wrap"><div class="auth-box center"><p class="muted small">Abriendo tu proyecto…</p></div></div>`;

    let datos = null;
    try {
        if (esLocal()) {
            await cargarTodo();
            const p = cache.proyectos.find(x => x.token_acceso === tk);
            datos = p ? datosDesdeCache(p.id) : null;
        } else {
            const respuesta = await adaptador.proyectoPorToken(tk);
            datos = normalizar(respuesta);
        }
    } catch (e) {
        console.error(e);
    }

    if (!datos) {
        raiz.innerHTML = html`
            <div class="auth-wrap">
                <div class="auth-box center">
                    <div class="brand" style="justify-content:center"><span class="brand-dot"></span><span class="brand-name">${CONFIG.EMPRESA}</span></div>
                    <h2 class="mt">Enlace no válido</h2>
                    <p class="muted small mt">Puede que haya caducado o que se haya generado uno nuevo.
                        Escríbenos y te pasamos el enlace actualizado.</p>
                    <a class="btn btn-block mt" href="mailto:${esc(CONFIG.EMPRESA_EMAIL)}">Escribir a ${esc(CONFIG.EMPRESA)}</a>
                </div>
            </div>`;
        return;
    }

    raiz.innerHTML = html`
        <div class="portal-wrap">
            <header class="portal-head row-between">
                <a class="brand" href="${CONFIG.EMPRESA_WEB}" target="_blank" rel="noopener">
                    <span class="brand-dot"></span>
                    <span class="stack" style="gap:0">
                        <span class="brand-name">${CONFIG.EMPRESA}</span>
                        <span class="brand-sub">Estado de tu proyecto</span>
                    </span>
                </a>
                <a class="btn btn-ghost btn-sm" href="mailto:${esc(CONFIG.EMPRESA_EMAIL)}">Contactar</a>
            </header>
            ${raw(pantallaProyecto(datos))}
        </div>`;

    conectarDescargas(raiz);
}

/* ============================================================ PANTALLA === */

function pantallaProyecto(d, { volver = null } = {}) {
    const p = d.proyecto;
    const total = desglose(p.precio_base, p.iva_pct, p.irpf_pct);
    const pct = d.progreso;
    const pendientes = d.pagos.filter(x => x.estado !== 'pagado');
    const hechas = d.tarjetas.filter(t => t.completada);
    const enCurso = d.tarjetas.filter(t => !t.completada);

    return html`
        ${raw(volver ? `<a href="${esc(volver)}" class="btn-quiet small row gap-sm mb">${ico('volver', 14)} Volver</a>` : '')}

        <div class="row-between wrap">
            <div class="stack">
                <h1>${p.nombre}</h1>
                <p class="muted small">${d.cliente?.empresa || d.cliente?.nombre || ''}${raw(p.tipo ? ` · ${esc(p.tipo)}` : '')}</p>
            </div>
            ${raw(tagFase(p.estado))}
        </div>

        ${raw(fasesLinea(p.estado))}

        <div class="card">
            <div class="row-between mb"><h2>Avance</h2><span class="small muted">${pct} %</span></div>
            ${raw(progresoBarra(pct))}
            <div class="grid-2 mt">
                <div class="field"><label>Empezado</label><p class="small">${fecha(p.fecha_inicio)}</p></div>
                <div class="field"><label>Entrega prevista</label>
                    <p class="small">${fecha(p.fecha_entrega)}
                        ${raw(p.fecha_entrega && diasHasta(p.fecha_entrega) >= 0 ? `<span class="tiny muted">· ${esc(plazo(p.fecha_entrega))}</span>` : '')}</p></div>
            </div>
            ${raw(p.descripcion ? `<div class="field"><label>En qué consiste</label><p class="small">${esc(p.descripcion)}</p></div>` : '')}
        </div>

        <div class="card">
            <h2 class="mb">Qué estamos haciendo</h2>
            ${raw(enCurso.length ? enCurso.map(t => html`
                <div class="list-item">
                    <span class="dot muted"></span>
                    <span class="stack grow">
                        <span class="small strong">${t.titulo}</span>
                        ${raw(t.descripcion ? `<span class="tiny muted">${esc(t.descripcion)}</span>` : '')}
                    </span>
                    ${raw(t.vence ? tagVence(t.vence) : '')}
                </div>`).join('') : '<p class="small muted">No hay tareas pendientes ahora mismo.</p>')}

            ${raw(hechas.length ? html`
                <details class="mt">
                    <summary class="small muted" style="cursor:pointer">${hechas.length} tareas ya terminadas</summary>
                    ${hechas.map(t => html`
                        <div class="list-item">
                            <span class="muted">${raw(ico('check', 14))}</span>
                            <span class="small muted grow">${t.titulo}</span>
                        </div>`)}
                </details>` : '')}
        </div>

        ${raw(p.precio_base ? html`
            <div class="card">
                <h2 class="mb">Presupuesto</h2>
                <div class="table-wrap"><table><tbody>
                    <tr><td>Base</td><td class="right mono">${euros(total.base)}</td></tr>
                    <tr><td>IVA (${raw(esc(p.iva_pct ?? 0))} %)</td><td class="right mono">${euros(total.iva)}</td></tr>
                    ${raw(total.irpf ? `<tr><td>Retención IRPF</td><td class="right mono">−${esc(euros(total.irpf))}</td></tr>` : '')}
                    <tr><td class="strong">Total</td><td class="right mono strong">${euros(total.total)}</td></tr>
                </tbody></table></div>
                ${raw(p.presupuesto_notas ? `<div class="field mt"><label>Incluye</label><p class="small">${esc(p.presupuesto_notas)}</p></div>` : '')}
            </div>` : '')}

        ${raw(d.pagos.length ? html`
            <div class="card">
                <div class="row-between mb"><h2>Pagos</h2>
                    ${raw(pendientes.length ? `<span class="tag warn">${esc(euros(pendientes.reduce((s, x) => s + (Number(x.importe) || 0), 0)))} pendiente</span>` : '<span class="tag ok">Todo al día</span>')}</div>
                <div class="table-wrap"><table>
                    <thead><tr><th>Concepto</th><th>Fecha</th><th>Importe</th><th>Estado</th></tr></thead>
                    <tbody>${d.pagos.map(x => html`
                        <tr>
                            <td>${x.concepto}</td>
                            <td class="small muted">${fecha(x.fecha_pago || x.fecha_vencimiento)}</td>
                            <td class="mono nowrap">${euros(x.importe)}</td>
                            <td>${raw(tagPago(x))}</td>
                        </tr>`)}
                    </tbody>
                </table></div>
            </div>` : '')}

        ${raw((d.suscripciones.length || d.dominios.length) ? html`
            <div class="card">
                <h2 class="mb">Próximas renovaciones</h2>
                ${d.suscripciones.map(s => html`
                    <div class="list-item">
                        <span class="stack grow"><span class="small strong">${s.concepto}</span>
                            <span class="tiny muted">${s.periodicidad} · ${euros(s.importe)}</span></span>
                        ${raw(tagVence(s.proxima_fecha))}
                    </div>`)}
                ${d.dominios.map(dom => html`
                    <div class="list-item">
                        <span class="stack grow"><span class="small strong">Dominio ${dom.dominio}</span>
                            <span class="tiny muted">${raw(dom.coste ? esc(euros(dom.coste)) + ' al año' : 'renovación anual')}</span></span>
                        ${raw(tagVence(dom.fecha_renovacion))}
                    </div>`)}
            </div>` : '')}

        ${raw(d.archivos.length ? html`
            <div class="card">
                <h2 class="mb">Documentos</h2>
                ${d.archivos.map(a => html`
                    <div class="list-item">
                        <span class="muted">${raw(ico('archivo', 14))}</span>
                        <span class="small grow truncate">${a.nombre}</span>
                        <button class="btn btn-ghost btn-sm" data-abrir="${a.ruta}">Abrir</button>
                    </div>`)}
            </div>` : '')}

        <p class="center tiny muted mt-lg">
            ¿Alguna duda? Escríbenos a <a href="mailto:${esc(CONFIG.EMPRESA_EMAIL)}">${esc(CONFIG.EMPRESA_EMAIL)}</a>
            · ${esc(CONFIG.EMPRESA)}
        </p>`;
}

/* =========================================================== AUXILIARES == */

/** Arma los datos del portal a partir de lo que ya hay en memoria. */
function datosDesdeCache(proyectoId) {
    const p = cache.proyectos.find(x => String(x.id) === String(proyectoId));
    if (!p) return null;
    return {
        proyecto: p,
        cliente: cliente(p.cliente_id) || null,
        progreso: progreso(p.id),
        tarjetas: deProyecto('tarjetas', p.id).filter(t => t.visible_cliente !== false)
            .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)),
        pagos: deProyecto('pagos', p.id),
        suscripciones: deProyecto('suscripciones', p.id).filter(s => s.activa !== false),
        dominios: deProyecto('dominios', p.id),
        archivos: deProyecto('archivos', p.id).filter(a => a.visible_cliente !== false),
    };
}

/** Da forma a lo que devuelve la función del servidor para el enlace secreto. */
function normalizar(respuesta) {
    if (!respuesta || !respuesta.proyecto) return null;
    const tarjetas = respuesta.tarjetas || [];
    const hechas = tarjetas.filter(t => t.completada).length;
    return {
        proyecto: respuesta.proyecto,
        cliente: respuesta.cliente || null,
        progreso: tarjetas.length ? Math.round(hechas / tarjetas.length * 100)
            : Math.round(Math.max(0, FASES.indexOf(respuesta.proyecto.estado)) / (FASES.length - 1) * 100),
        tarjetas,
        pagos: respuesta.pagos || [],
        suscripciones: respuesta.suscripciones || [],
        dominios: respuesta.dominios || [],
        archivos: respuesta.archivos || [],
    };
}

function conectarDescargas(raiz) {
    raiz.addEventListener('click', async (ev) => {
        const boton = ev.target.closest('[data-abrir]');
        if (!boton) return;
        try {
            const url = await adaptador.urlArchivo(boton.dataset.abrir);
            if (url) window.open(url, '_blank', 'noopener');
            else toast('No se ha podido abrir el archivo', 'bad');
        } catch (e) {
            toast('No se ha podido abrir el archivo', 'bad');
        }
    });
}
