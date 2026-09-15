/**
 * Ficha de proyecto: tablero estilo Trello, presupuesto, cobros, accesos,
 * archivos y notas. Es la pantalla donde vive el día a día.
 */
import {
    html, raw, esc, euros, fecha, on, confirmar, toast, desglose, uuid,
    formulario, modal, porCampo, reiniciarEscuchas, urlSegura } from '../util.js';
import {
    cache, adaptador, esLocal, proyecto, cliente, deProyecto, crear, editar, borrar,
    borrarProyecto, marcarPagado, progreso, FASES,
} from '../data/index.js';
import { cabecera, vacio, ico, tagFase, tagPago, tagVence, progresoBarra, campoCopiar, fasesLinea, ponerTitulo } from '../ui.js';
import { abrirFicha } from '../forms.js';
import { refrescar } from '../estado.js';
import { tablaPagos } from './clientes.js';

let pestana = 'tablero';

export async function vistaProyecto({ id }, raiz) {
    reiniciarEscuchas(raiz);
    const p = proyecto(id);
    if (!p) {
        raiz.innerHTML = vacio('Este proyecto ya no existe.', '<a class="btn btn-sm" href="#/proyectos">Volver a proyectos</a>');
        return;
    }
    const c = cliente(p.cliente_id);
    const pct = progreso(p.id);
    ponerTitulo(p.nombre);

    raiz.innerHTML = html`
        ${raw(cabecera({
            ruta: [
                { txt: 'Clientes', href: '#/clientes' },
                c ? { txt: c.empresa || c.nombre, href: `#/cliente/${c.id}` } : null,
                { txt: p.nombre },
            ].filter(Boolean),
            titulo: p.nombre,
            sub: `${c ? esc(c.empresa || c.nombre) : 'Sin cliente'} · ${esc(p.tipo || 'Proyecto')}`,
            acciones: `
                <button class="btn btn-ghost btn-sm" data-enlace>${ico('enlace', 14)} Enlace para el cliente</button>
                <button class="btn btn-ghost btn-sm" data-editar>${ico('editar', 14)} Editar</button>`,
        }))}

        <div class="row wrap mb">
            ${raw(tagFase(p.estado))}
            <select id="cambiar-fase" style="max-width:190px">
                ${FASES.map(f => html`<option value="${f}" ${raw(p.estado === f ? 'selected' : '')}>${f}</option>`)}
            </select>
            <span class="grow" style="max-width:280px">${raw(progresoBarra(pct))}</span>
            <span class="small muted nowrap">${pct} %</span>
            ${raw(p.fecha_entrega ? `<span class="tag line">Entrega ${esc(fecha(p.fecha_entrega))}</span>` : '')}
        </div>

        <div class="tabs">
            ${['tablero', 'resumen', 'dinero', 'accesos', 'archivos', 'notas'].map(t => html`
                <button data-tab="${t}" class="${raw(pestana === t ? 'active' : '')}">${raw(({
                    tablero: 'Tablero', resumen: 'Resumen', dinero: 'Dinero',
                    accesos: 'Accesos', archivos: 'Archivos', notas: 'Notas',
                })[t])}</button>`)}
        </div>

        <div id="panel-proyecto"></div>`;

    const panel = raiz.querySelector('#panel-proyecto');
    pintarPestana(p, panel);

    on(raiz, 'click', '[data-tab]', (_ev, boton) => {
        pestana = boton.dataset.tab;
        raiz.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b === boton));
        pintarPestana(p, panel);
    });

    raiz.querySelector('#cambiar-fase').addEventListener('change', async (ev) => {
        await editar('proyectos', p.id, { estado: ev.target.value });
        toast(`Fase: ${ev.target.value}`);
        refrescar();
    });

    on(raiz, 'click', '[data-editar]', () => abrirFicha('proyecto', { valores: p }));
    on(raiz, 'click', '[data-enlace]', () => enlaceCliente(p));
}

function pintarPestana(p, panel) {
    // Las pestañas reescriben el mismo contenedor: sin esto, cambiar de pestaña
    // y volver duplicaría los botones de "Añadir pago", "Anotar", etc.
    reiniciarEscuchas(panel);
    if (pestana === 'tablero') return pintarTablero(p, panel);
    if (pestana === 'resumen') return pintarResumen(p, panel);
    if (pestana === 'dinero') return pintarDinero(p, panel);
    if (pestana === 'accesos') return pintarAccesos(p, panel);
    if (pestana === 'archivos') return pintarArchivos(p, panel);
    return pintarNotas(p, panel);
}

/* =========================================================== TABLERO ===== */

const columnasDe = (p) => deProyecto('columnas', p.id).slice().sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
const tarjetasDe = (columnaId) => cache.tarjetas
    .filter(t => String(t.columna_id) === String(columnaId))
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

function pintarTablero(p, panel) {
    const columnas = columnasDe(p);
    const idFinal = columnas[columnas.length - 1]?.id;

    panel.innerHTML = html`
        <p class="small muted mb">Arrastra las tarjetas entre columnas. Lo que caiga en
            «${raw(esc(columnas[columnas.length - 1]?.nombre || 'la última columna'))}» cuenta como terminado.</p>

        <div class="board" id="board">
            ${columnas.map(col => {
                const tarjetas = tarjetasDe(col.id);
                return html`
                    <div class="column" data-columna="${col.id}">
                        <div class="column-head">
                            <span class="name grow truncate">${col.nombre}</span>
                            <span class="n">${tarjetas.length}</span>
                            <button class="btn-quiet" data-menu-columna="${col.id}" title="Opciones">⋯</button>
                        </div>
                        <div class="column-body" data-destino="${col.id}">
                            ${tarjetas.map(t => tarjetaHTML(t))}
                        </div>
                        <div class="column-foot">
                            <button class="column-add" data-add="${col.id}">+ Añadir tarea</button>
                        </div>
                    </div>`;
            })}
            <div class="add-column">
                <button class="column-add" id="add-columna">+ Añadir columna</button>
            </div>
        </div>`;

    conectarTablero(p, panel, idFinal);
}

function tarjetaHTML(t) {
    return html`
        <article class="kcard ${raw(t.completada ? 'done' : '')}" draggable="true" data-tarjeta="${t.id}">
            <div class="t">${t.titulo}</div>
            <div class="meta">
                ${raw(t.etiqueta ? `<span class="tag line tiny">${esc(t.etiqueta)}</span>` : '')}
                ${raw(t.vence ? tagVence(t.vence).replace('class="tag', 'class="tag tiny') : '')}
                ${raw(t.visible_cliente === false ? '<span class="tag tiny">Interna</span>' : '')}
            </div>
        </article>`;
}

function conectarTablero(p, panel, idFinal) {
    let arrastrada = null;

    panel.querySelectorAll('.kcard').forEach(el => {
        el.addEventListener('dragstart', () => {
            arrastrada = el;
            el.classList.add('dragging');
        });
        el.addEventListener('dragend', () => {
            el.classList.remove('dragging');
            arrastrada = null;
        });
        el.addEventListener('click', () => abrirTarjeta(el.dataset.tarjeta, p));
    });

    panel.querySelectorAll('.column-body').forEach(cuerpo => {
        cuerpo.addEventListener('dragover', (ev) => {
            ev.preventDefault();
            cuerpo.classList.add('drag-over');
            const referencia = tarjetaSiguiente(cuerpo, ev.clientY);
            if (!arrastrada) return;
            if (referencia) cuerpo.insertBefore(arrastrada, referencia);
            else cuerpo.appendChild(arrastrada);
        });
        cuerpo.addEventListener('dragleave', () => cuerpo.classList.remove('drag-over'));
        cuerpo.addEventListener('drop', async (ev) => {
            ev.preventDefault();
            cuerpo.classList.remove('drag-over');
            await guardarOrden(cuerpo, idFinal);
        });
    });

    panel.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => {
        const columnaId = b.dataset.add;
        abrirFicha('tarjeta', {
            fijos: { proyecto_id: p.id, columna_id: columnaId, orden: tarjetasDe(columnaId).length, completada: columnaId === idFinal },
            alTerminar: async () => { await refrescar(); },
        });
    }));

    panel.querySelectorAll('[data-menu-columna]').forEach(b =>
        b.addEventListener('click', () => menuColumna(b.dataset.menuColumna, p)));

    panel.querySelector('#add-columna')?.addEventListener('click', async () => {
        formulario({
            titulo: 'Nueva columna',
            campos: [{ name: 'nombre', label: 'Nombre de la columna', requerido: true, placeholder: 'Pendiente de cliente' }],
            onGuardar: async ({ nombre }) => {
                await crear('columnas', { proyecto_id: p.id, nombre, orden: columnasDe(p).length });
                await refrescar();
            },
        });
    });
}

/** Devuelve la tarjeta ante la que hay que insertar según la posición del ratón. */
function tarjetaSiguiente(cuerpo, y) {
    const candidatas = [...cuerpo.querySelectorAll('.kcard:not(.dragging)')];
    return candidatas.find(el => {
        const caja = el.getBoundingClientRect();
        return y < caja.top + caja.height / 2;
    }) || null;
}

/** Persiste el nuevo orden y columna de las tarjetas movidas. */
async function guardarOrden(cuerpo, idFinal) {
    const columnaId = cuerpo.dataset.destino;
    const ids = [...cuerpo.querySelectorAll('.kcard')].map(el => el.dataset.tarjeta);

    for (const [orden, id] of ids.entries()) {
        const t = cache.tarjetas.find(x => String(x.id) === String(id));
        if (!t) continue;
        const completada = String(columnaId) === String(idFinal);
        if (String(t.columna_id) === String(columnaId) && t.orden === orden && t.completada === completada) continue;
        await editar('tarjetas', id, { columna_id: columnaId, orden, completada });
    }
    await refrescar();
}

function abrirTarjeta(id, p) {
    const t = cache.tarjetas.find(x => String(x.id) === String(id));
    if (!t) return;

    const m = modal({
        titulo: t.titulo,
        cuerpo: html`
            ${raw(t.descripcion ? `<p class="small">${esc(t.descripcion)}</p>` : '<p class="small muted">Sin descripción.</p>')}
            <div class="row wrap mt">
                ${raw(t.etiqueta ? `<span class="tag line">${esc(t.etiqueta)}</span>` : '')}
                ${raw(t.vence ? tagVence(t.vence) : '')}
                ${raw(t.completada ? '<span class="tag ok">Terminada</span>' : '')}
                ${raw(t.visible_cliente === false ? '<span class="tag">Solo interna</span>' : '<span class="tag info">La ve el cliente</span>')}
            </div>`,
        acciones: html`
            <button class="btn btn-danger" data-borrar>Eliminar</button>
            <button class="btn btn-ghost" data-visible>${raw(t.visible_cliente === false ? 'Mostrar al cliente' : 'Ocultar al cliente')}</button>
            <button class="btn" data-editar>Editar</button>`,
    });

    m.querySelector('[data-editar]').addEventListener('click', () => {
        m.cerrar();
        abrirFicha('tarjeta', { valores: t, fijos: { proyecto_id: p.id } });
    });
    m.querySelector('[data-visible]').addEventListener('click', async () => {
        await editar('tarjetas', t.id, { visible_cliente: t.visible_cliente === false });
        m.cerrar();
        refrescar();
    });
    m.querySelector('[data-borrar]').addEventListener('click', async () => {
        if (!await confirmar('¿Eliminar esta tarea?')) return;
        await borrar('tarjetas', t.id);
        m.cerrar();
        toast('Tarea eliminada');
        refrescar();
    });
}

function menuColumna(id, p) {
    const col = cache.columnas.find(c => String(c.id) === String(id));
    if (!col) return;

    const m = modal({
        titulo: `Columna «${col.nombre}»`,
        cuerpo: html`<p class="small muted">${tarjetasDe(col.id).length} tarjetas dentro.</p>`,
        acciones: html`
            <button class="btn btn-danger" data-borrar>Eliminar columna</button>
            <button class="btn btn-ghost" data-izq>← Mover</button>
            <button class="btn btn-ghost" data-der>Mover →</button>
            <button class="btn" data-renombrar>Renombrar</button>`,
    });

    m.querySelector('[data-renombrar]').addEventListener('click', () => {
        m.cerrar();
        formulario({
            titulo: 'Renombrar columna',
            campos: [{ name: 'nombre', label: 'Nombre', requerido: true }],
            valores: { nombre: col.nombre },
            onGuardar: async ({ nombre }) => { await editar('columnas', col.id, { nombre }); await refrescar(); },
        });
    });

    const mover = async (delta) => {
        const columnas = columnasDe(p);
        const i = columnas.findIndex(c => String(c.id) === String(col.id));
        const j = i + delta;
        if (j < 0 || j >= columnas.length) return;
        await editar('columnas', columnas[i].id, { orden: j });
        await editar('columnas', columnas[j].id, { orden: i });
        m.cerrar();
        refrescar();
    };
    m.querySelector('[data-izq]').addEventListener('click', () => mover(-1));
    m.querySelector('[data-der]').addEventListener('click', () => mover(1));

    m.querySelector('[data-borrar]').addEventListener('click', async () => {
        const n = tarjetasDe(col.id).length;
        if (!await confirmar(`Se eliminará la columna y sus ${n} tarjetas.`)) return;
        for (const t of tarjetasDe(col.id)) await borrar('tarjetas', t.id);
        await borrar('columnas', col.id);
        m.cerrar();
        refrescar();
    });
}

/* =========================================================== RESUMEN ===== */

function pintarResumen(p, panel) {
    const c = cliente(p.cliente_id);
    const d = desglose(p.precio_base, p.iva_pct, p.irpf_pct);

    panel.innerHTML = html`
        <div class="view-narrow">
            ${raw(fasesLinea(p.estado))}

            <div class="card">
                <div class="card-head"><h2>Presupuesto</h2>
                    <button class="btn btn-ghost btn-sm" data-editar-proyecto>Editar</button></div>
                <div class="table-wrap"><table>
                    <tbody>
                        <tr><td>Base imponible</td><td class="right mono">${euros(d.base)}</td></tr>
                        <tr><td>IVA (${raw(esc(p.iva_pct ?? 0))} %)</td><td class="right mono">${euros(d.iva)}</td></tr>
                        ${raw(d.irpf ? `<tr><td>Retención IRPF (${esc(p.irpf_pct)} %)</td><td class="right mono">−${esc(euros(d.irpf))}</td></tr>` : '')}
                        <tr><td class="strong">Total</td><td class="right mono strong">${euros(d.total)}</td></tr>
                    </tbody>
                </table></div>
                ${raw(p.presupuesto_notas ? `<div class="field mt"><label>Qué incluye</label><p class="small">${esc(p.presupuesto_notas)}</p></div>` : '')}
            </div>

            <div class="card">
                <h2 class="mb">Ficha</h2>
                <div class="grid-2">
                    <div class="field"><label>Cliente</label>
                        <p class="small">${raw(c ? `<a href="#/cliente/${esc(c.id)}">${esc(c.empresa || c.nombre)}</a>` : '—')}</p></div>
                    <div class="field"><label>Tipo</label><p class="small">${p.tipo || '—'}</p></div>
                    <div class="field"><label>Inicio</label><p class="small">${fecha(p.fecha_inicio)}</p></div>
                    <div class="field"><label>Entrega prevista</label><p class="small">${fecha(p.fecha_entrega)}</p></div>
                </div>
                ${raw(p.descripcion ? `<div class="field"><label>Descripción</label><p class="small">${esc(p.descripcion)}</p></div>` : '')}
                <div class="row mt">
                    <button class="btn btn-ghost btn-sm" data-editar-proyecto>Editar proyecto</button>
                    <button class="btn btn-danger btn-sm" data-borrar-proyecto>Eliminar proyecto</button>
                </div>
            </div>
        </div>`;

    on(panel, 'click', '[data-editar-proyecto]', () => abrirFicha('proyecto', { valores: p }));
    on(panel, 'click', '[data-borrar-proyecto]', async () => {
        if (!await confirmar(`Se eliminará «${p.nombre}» con su tablero, pagos y archivos.`, { textoOk: 'Eliminar' })) return;
        await borrarProyecto(p.id);
        toast('Proyecto eliminado');
        location.hash = '#/proyectos';
        refrescar();
    });
}

/* ============================================================ DINERO ===== */

function pintarDinero(p, panel) {
    const pagos = deProyecto('pagos', p.id).sort(porCampo('fecha_vencimiento', 'desc'));
    const cuotas = deProyecto('suscripciones', p.id);
    const cobrado = pagos.filter(x => x.estado === 'pagado').reduce((s, x) => s + (Number(x.importe) || 0), 0);
    const pendiente = pagos.filter(x => x.estado !== 'pagado').reduce((s, x) => s + (Number(x.importe) || 0), 0);
    const precio = Number(p.precio_base) || 0;

    panel.innerHTML = html`
        <div class="grid grid-stats mb">
            <div class="stat"><div class="k">Presupuestado</div><div class="v">${euros(precio)}</div><div class="s">base imponible</div></div>
            <div class="stat"><div class="k">Cobrado</div><div class="v">${euros(cobrado)}</div>
                <div class="s">${raw(precio ? `${Math.round(cobrado / precio * 100)} % del proyecto` : '')}</div></div>
            <div class="stat"><div class="k">Pendiente</div><div class="v">${euros(pendiente)}</div>
                <div class="s">${pagos.filter(x => x.estado !== 'pagado').length} pagos</div></div>
        </div>

        <div class="section-title"><h2>Pagos</h2>
            <button class="btn btn-ghost btn-sm" data-nuevo-pago>${raw(ico('mas', 14))} Añadir pago</button></div>
        ${raw(pagos.length ? tablaPagos(pagos) : vacio('Sin pagos registrados en este proyecto.'))}

        <div class="section-title mt-lg"><h2>Cuotas recurrentes</h2>
            <button class="btn btn-ghost btn-sm" data-nueva-cuota>${raw(ico('mas', 14))} Añadir cuota</button></div>
        ${raw(cuotas.length ? html`
            <div class="table-wrap"><table>
                <thead><tr><th>Concepto</th><th>Cada</th><th>Importe</th><th>Próximo cobro</th></tr></thead>
                <tbody>${cuotas.map(s => html`
                    <tr><td>${s.concepto}</td><td class="muted">${s.periodicidad}</td>
                        <td class="mono">${euros(s.importe)}</td><td>${raw(tagVence(s.proxima_fecha))}</td></tr>`)}
                </tbody></table></div>` : vacio('Sin cuotas asociadas.'))}`;

    on(panel, 'click', '[data-nuevo-pago]', () => abrirFicha('pago', { fijos: { proyecto_id: p.id, cliente_id: p.cliente_id } }));
    on(panel, 'click', '[data-nueva-cuota]', () => abrirFicha('suscripcion', { fijos: { proyecto_id: p.id, cliente_id: p.cliente_id } }));
    on(panel, 'click', '[data-pagar]', async (_ev, el) => {
        await marcarPagado(cache.pagos.find(x => x.id === el.dataset.pagar));
        toast('Pago cobrado');
        refrescar();
    });
    on(panel, 'click', '[data-editar-pago]', (_ev, el) =>
        abrirFicha('pago', { valores: cache.pagos.find(x => x.id === el.dataset.editarPago) }));
    on(panel, 'click', '[data-borrar-pago]', async (_ev, el) => {
        if (!await confirmar('¿Eliminar este pago?')) return;
        await borrar('pagos', el.dataset.borrarPago);
        refrescar();
    });
}

/* =========================================================== ACCESOS ===== */

function pintarAccesos(p, panel) {
    const accesos = deProyecto('accesos', p.id);
    const dominios = deProyecto('dominios', p.id);

    panel.innerHTML = html`
        <div class="section-title"><h2>Dominios</h2>
            <button class="btn btn-ghost btn-sm" data-nuevo-dominio>${raw(ico('mas', 14))} Añadir</button></div>
        ${raw(dominios.length ? html`
            <div class="grid grid-cards">
                ${dominios.map(d => html`
                    <div class="card">
                        <div class="row-between"><span class="strong">${d.dominio}</span>${raw(tagVence(d.fecha_renovacion))}</div>
                        <p class="tiny muted mt">${d.registrador || 'Sin registrador'}${raw(d.coste ? ` · ${esc(euros(d.coste))}/año` : '')}
                            ${raw(d.auto_renueva ? ' · renovación automática' : '')}</p>
                    </div>`)}
            </div>` : vacio('Sin dominios asociados a este proyecto.'))}

        <div class="section-title mt-lg"><h2>Accesos técnicos</h2>
            <button class="btn btn-ghost btn-sm" data-nuevo-acceso>${raw(ico('mas', 14))} Añadir</button></div>
        ${raw(accesos.length ? html`
            <div class="grid grid-cards">
                ${accesos.map(a => html`
                    <div class="card">
                        <div class="row-between">
                            <span class="row gap-sm">${raw(ico('llave', 14))}<span class="strong small">${a.titulo}</span></span>
                            <span class="tag line">${a.tipo}</span>
                        </div>
                        ${raw(urlSegura(a.url) ? `<a class="small truncate" href="${esc(urlSegura(a.url))}" target="_blank" rel="noopener noreferrer">${esc(a.url)}</a>` : (a.url ? `<span class="small muted">${esc(a.url)}</span>` : ''))}
                        ${raw(a.usuario ? `<p class="tiny muted mt">Usuario: ${esc(a.usuario)}</p>` : '')}
                        ${raw(a.notas ? `<p class="tiny muted">${esc(a.notas)}</p>` : '')}
                        <div class="right mt"><button class="btn-quiet tiny" data-borrar-acceso="${esc(a.id)}">Eliminar</button></div>
                    </div>`)}
            </div>` : vacio('Hosting, repositorio, panel del dominio, redes… lo técnico de este proyecto.'))}`;

    on(panel, 'click', '[data-nuevo-dominio]', () => abrirFicha('dominio', { fijos: { proyecto_id: p.id, cliente_id: p.cliente_id } }));
    on(panel, 'click', '[data-nuevo-acceso]', () => abrirFicha('acceso', { fijos: { proyecto_id: p.id, cliente_id: p.cliente_id } }));
    on(panel, 'click', '[data-borrar-acceso]', async (_ev, el) => {
        if (!await confirmar('¿Eliminar este acceso?')) return;
        await borrar('accesos', el.dataset.borrarAcceso);
        refrescar();
    });
}

/* ========================================================== ARCHIVOS ===== */

function pintarArchivos(p, panel) {
    const archivos = deProyecto('archivos', p.id).sort(porCampo('creado', 'desc'));

    panel.innerHTML = html`
        <div class="section-title"><h2>Archivos</h2>
            ${raw(esLocal() ? '' : `<label class="btn btn-sm">${ico('mas', 14)} Subir archivo
                <input type="file" id="subir" class="hidden"></label>`)}
        </div>

        ${raw(esLocal()
            ? '<div class="banner warn">Los archivos necesitan la base de datos en la nube. Configura Supabase en Ajustes para poder subir presupuestos y contratos.</div>'
            : '<p class="small muted mb">El cliente puede descargarlos desde su portal. Solo vosotros podéis subir.</p>')}

        ${raw(archivos.length ? html`
            <div class="table-wrap"><table>
                <thead><tr><th>Archivo</th><th>Subido</th><th>Visible</th><th></th></tr></thead>
                <tbody>${archivos.map(a => html`
                    <tr>
                        <td class="row gap-sm">${raw(ico('archivo', 14))} <span class="strong">${a.nombre}</span></td>
                        <td class="muted small">${fecha(a.creado)}</td>
                        <td>${raw(a.visible_cliente === false ? '<span class="tag">Interno</span>' : '<span class="tag info">El cliente lo ve</span>')}</td>
                        <td class="right nowrap">
                            <button class="btn btn-ghost btn-sm" data-descargar="${esc(a.id)}">Abrir</button>
                            <button class="btn-quiet" data-borrar-archivo="${esc(a.id)}">${raw(ico('borrar', 14))}</button>
                        </td>
                    </tr>`)}
                </tbody></table></div>` : vacio('Aquí puedes guardar el presupuesto firmado, el contrato o el logotipo del cliente.'))}`;

    panel.querySelector('#subir')?.addEventListener('change', async (ev) => {
        const fichero = ev.target.files?.[0];
        if (!fichero) return;
        if (fichero.size > 25 * 1024 * 1024) return toast('El archivo supera los 25 MB', 'bad');
        try {
            toast('Subiendo…');
            const ruta = `${p.id}/${uuid()}-${fichero.name.replace(/[^\w.\-]/g, '_')}`;
            await adaptador.subirArchivo(ruta, fichero);
            await crear('archivos', {
                proyecto_id: p.id, cliente_id: p.cliente_id, nombre: fichero.name,
                ruta, tamano: fichero.size, visible_cliente: true,
            });
            toast('Archivo subido');
            refrescar();
        } catch (e) {
            toast(e.message || 'No se ha podido subir', 'bad');
        }
    });

    on(panel, 'click', '[data-descargar]', async (_ev, el) => {
        const a = cache.archivos.find(x => String(x.id) === String(el.dataset.descargar));
        try {
            const url = await adaptador.urlArchivo(a.ruta);
            if (url) window.open(url, '_blank', 'noopener');
        } catch (e) {
            toast(e.message || 'No se ha podido abrir', 'bad');
        }
    });

    on(panel, 'click', '[data-borrar-archivo]', async (_ev, el) => {
        if (!await confirmar('¿Eliminar este archivo?')) return;
        const a = cache.archivos.find(x => String(x.id) === String(el.dataset.borrarArchivo));
        await adaptador.borrarArchivo?.(a.ruta).catch(() => {});
        await borrar('archivos', a.id);
        refrescar();
    });
}

/* ============================================================= NOTAS ===== */

function pintarNotas(p, panel) {
    const notas = deProyecto('notas', p.id).sort(porCampo('fecha', 'desc'));

    panel.innerHTML = html`
        <div class="section-title"><h2>Notas del proyecto</h2>
            <button class="btn btn-ghost btn-sm" data-nueva-nota>${raw(ico('mas', 14))} Anotar</button></div>
        ${raw(notas.length ? html`
            <div class="timeline view-narrow">
                ${notas.map(n => html`
                    <div class="timeline-item">
                        <div class="row-between">
                            <span class="tiny muted">${fecha(n.fecha)}${raw(n.autor ? ` · ${esc(n.autor)}` : '')}</span>
                            <button class="btn-quiet tiny" data-borrar-nota="${n.id}">Eliminar</button>
                        </div>
                        <p class="small">${n.texto}</p>
                    </div>`)}
            </div>` : vacio('Todo lo que hables sobre este proyecto, aquí.'))}`;

    on(panel, 'click', '[data-nueva-nota]', () => abrirFicha('nota', { fijos: { proyecto_id: p.id, cliente_id: p.cliente_id } }));
    on(panel, 'click', '[data-borrar-nota]', async (_ev, el) => {
        if (!await confirmar('¿Eliminar esta nota?')) return;
        await borrar('notas', el.dataset.borrarNota);
        refrescar();
    });
}

/* ==================================================== ENLACE AL CLIENTE == */

function enlaceCliente(p) {
    const base = location.origin + location.pathname;
    const c = cliente(p.cliente_id);
    const visibles = deProyecto('tarjetas', p.id).filter(t => t.visible_cliente !== false).length;

    modal({
        titulo: 'Enlace para el cliente',
        cuerpo: html`
            <p class="small muted">Pásaselo por WhatsApp: entra sin registrarse y ve la fase del proyecto,
                ${visibles} tareas visibles, sus pagos y sus fechas.</p>
            ${raw(campoCopiar(`${base}#/p/${p.token_acceso}`, 'Enlace secreto de este proyecto'))}
            ${raw(c?.email ? `<p class="small muted mt">También puede entrar con su email <span class="strong">${esc(c.email)}</span> desde ${esc(base)}</p>` : '')}
            <div class="banner mt">Quien tenga este enlace puede ver el proyecto. Si quieres invalidarlo, genera uno nuevo.</div>`,
        acciones: html`
            <button class="btn btn-ghost" data-cerrar>Cerrar</button>
            <button class="btn" data-regenerar>Generar enlace nuevo</button>`,
    }).querySelector('[data-regenerar]').addEventListener('click', async function () {
        const { token } = await import('../util.js');
        await editar('proyectos', p.id, { token_acceso: token(10) });
        toast('Enlace regenerado: el anterior deja de funcionar');
        this.closest('.modal-scrim').cerrar();
        refrescar();
    });
}
