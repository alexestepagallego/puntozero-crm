/** Listado de clientes y ficha completa de cada uno. */
import { html, raw, esc, euros, fecha, on, confirmar, toast, copiar, porCampo, reiniciarEscuchas } from '../util.js';
import {
    cache, cliente, proyectosDe, deCliente, balance, progreso, borrarCliente,
    borrar, marcarPagado, nombreCliente, adaptador, esLocal,
} from '../data/index.js';
import { cabecera, vacio, stat, ico, avatar, tagFase, tagPago, tagVence, progresoBarra, campoCopiar } from '../ui.js';
import { abrirFicha } from '../forms.js';
import { refrescar } from '../estado.js';
import { modal } from '../util.js';

/* ------------------------------------------------------------- LISTADO --- */

export async function vistaClientes(_params, raiz) {
    reiniciarEscuchas(raiz);
    const clientes = cache.clientes.slice().sort(porCampo('empresa'));

    raiz.innerHTML = html`
        ${raw(cabecera({
            titulo: 'Clientes',
            sub: `${clientes.length} fichas`,
            acciones: `<button class="btn btn-sm" data-nuevo>${ico('mas', 14)} Nuevo cliente</button>`,
        }))}

        ${raw(clientes.length ? html`
            <div class="grid grid-cards">
                ${clientes.map(c => {
                    const proyectos = proyectosDe(c.id);
                    const dinero = balance(c.id);
                    return html`
                        <a class="card card-link" href="#/cliente/${c.id}">
                            <div class="row">
                                ${raw(avatar(c.empresa || c.nombre))}
                                <span class="stack grow" style="min-width:0">
                                    <span class="strong truncate">${c.empresa || c.nombre}</span>
                                    <span class="tiny muted truncate">${c.nombre || c.email || '—'}</span>
                                </span>
                                ${raw(c.estado === 'inactivo' ? '<span class="tag line">Inactivo</span>' : '')}
                            </div>
                            <div class="row-between mt">
                                <span class="tiny muted">${proyectos.length} proyecto${raw(proyectos.length === 1 ? '' : 's')}</span>
                                ${raw(dinero.pendiente
                                    ? `<span class="tag ${dinero.vencido ? 'bad' : 'warn'}">${esc(euros(dinero.pendiente))} pendiente</span>`
                                    : '<span class="tag ok">Al día</span>')}
                            </div>
                        </a>`;
                })}
            </div>` : vacio('Aún no has dado de alta ningún cliente.',
                '<button class="btn btn-sm" data-nuevo>Crear el primero</button>'))}`;

    on(raiz, 'click', '[data-nuevo]', () => abrirFicha('cliente'));
}

/* --------------------------------------------------------------- FICHA --- */

export async function vistaCliente({ id }, raiz) {
    reiniciarEscuchas(raiz);
    const c = cliente(id);
    if (!c) {
        raiz.innerHTML = vacio('Este cliente ya no existe.', '<a class="btn btn-sm" href="#/clientes">Volver a clientes</a>');
        return;
    }

    const proyectos = proyectosDe(c.id);
    const pagos = deCliente('pagos', c.id).sort(porCampo('fecha_vencimiento', 'desc'));
    const cuotas = deCliente('suscripciones', c.id);
    const dominios = deCliente('dominios', c.id);
    const accesos = deCliente('accesos', c.id);
    const notas = deCliente('notas', c.id).sort(porCampo('fecha', 'desc'));
    const dinero = balance(c.id);

    raiz.innerHTML = html`
        ${raw(cabecera({
            volver: '#/clientes',
            titulo: c.empresa || c.nombre,
            sub: [c.nombre, c.email, c.telefono].filter(Boolean).join(' · '),
            acciones: `
                <button class="btn btn-ghost btn-sm" data-portal>${ico('enlace', 14)} Portal del cliente</button>
                <button class="btn btn-ghost btn-sm" data-editar>${ico('editar', 14)} Editar</button>
                <button class="btn btn-sm" data-nuevo-proyecto>${ico('mas', 14)} Proyecto</button>`,
        }))}

        <div class="grid grid-stats">
            ${raw(stat('Facturado', euros(dinero.cobrado), 'Cobrado hasta hoy'))}
            ${raw(stat('Pendiente', euros(dinero.pendiente), dinero.vencido ? `<span class="tag bad">${esc(euros(dinero.vencido))} vencido</span>` : 'Sin retrasos'))}
            ${raw(stat('Recurrente/año', euros(dinero.recurrenteAnual), `${cuotas.filter(s => s.activa !== false).length} cuotas`))}
            ${raw(stat('Proyectos', proyectos.length, `${proyectos.filter(p => p.estado === 'Publicado').length} publicados`))}
        </div>

        <div class="tabs mt-lg">
            <button class="active" data-tab="proyectos">Proyectos</button>
            <button data-tab="dinero">Dinero</button>
            <button data-tab="accesos">Accesos y dominios</button>
            <button data-tab="historial">Historial</button>
            <button data-tab="ficha">Ficha</button>
        </div>

        <section data-panel="proyectos">
            ${raw(proyectos.length ? html`
                <div class="grid grid-cards">
                    ${proyectos.map(p => html`
                        <a class="card card-link" href="#/proyecto/${p.id}">
                            <div class="row-between">
                                <span class="strong">${p.nombre}</span>
                                ${raw(tagFase(p.estado))}
                            </div>
                            <p class="tiny muted mt">${p.tipo || ''}${raw(p.precio_base ? ` · ${esc(euros(p.precio_base))}` : '')}</p>
                            <div class="mt">${raw(progresoBarra(progreso(p.id)))}</div>
                        </a>`)}
                </div>` : vacio('Este cliente aún no tiene proyectos.',
                    '<button class="btn btn-sm" data-nuevo-proyecto>Crear proyecto</button>'))}
        </section>

        <section data-panel="dinero" class="hidden">
            <div class="section-title"><h2>Pagos</h2>
                <button class="btn btn-ghost btn-sm" data-nuevo-pago>${raw(ico('mas', 14))} Añadir pago</button></div>
            ${raw(pagos.length ? tablaPagos(pagos) : vacio('Sin pagos registrados.'))}

            <div class="section-title mt-lg"><h2>Cuotas recurrentes</h2>
                <button class="btn btn-ghost btn-sm" data-nueva-cuota>${raw(ico('mas', 14))} Añadir cuota</button></div>
            ${raw(cuotas.length ? html`
                <div class="table-wrap"><table>
                    <thead><tr><th>Concepto</th><th>Cada</th><th>Importe</th><th>Próximo cobro</th><th></th></tr></thead>
                    <tbody>${cuotas.map(s => html`
                        <tr>
                            <td>${s.concepto}</td>
                            <td class="muted">${s.periodicidad}</td>
                            <td class="mono">${euros(s.importe)}</td>
                            <td>${raw(tagVence(s.proxima_fecha))}</td>
                            <td class="right"><button class="btn-quiet" data-borrar-cuota="${s.id}" title="Eliminar">${raw(ico('borrar', 14))}</button></td>
                        </tr>`)}
                    </tbody>
                </table></div>` : vacio('Sin cuotas recurrentes.'))}
        </section>

        <section data-panel="accesos" class="hidden">
            <div class="section-title"><h2>Dominios</h2>
                <button class="btn btn-ghost btn-sm" data-nuevo-dominio>${raw(ico('mas', 14))} Añadir dominio</button></div>
            ${raw(dominios.length ? html`
                <div class="table-wrap"><table>
                    <thead><tr><th>Dominio</th><th>Registrador</th><th>Renueva</th><th>Coste</th><th></th></tr></thead>
                    <tbody>${dominios.map(d => html`
                        <tr>
                            <td class="strong">${d.dominio}</td>
                            <td class="muted">${d.registrador || '—'}</td>
                            <td>${raw(tagVence(d.fecha_renovacion))}</td>
                            <td class="mono">${raw(d.coste ? esc(euros(d.coste)) : '—')}</td>
                            <td class="right"><button class="btn-quiet" data-borrar-dominio="${d.id}">${raw(ico('borrar', 14))}</button></td>
                        </tr>`)}
                    </tbody>
                </table></div>` : vacio('Sin dominios registrados.'))}

            <div class="section-title mt-lg"><h2>Accesos técnicos</h2>
                <button class="btn btn-ghost btn-sm" data-nuevo-acceso>${raw(ico('mas', 14))} Añadir acceso</button></div>
            ${raw(accesos.length ? html`
                <div class="grid grid-cards">
                    ${accesos.map(a => html`
                        <div class="card">
                            <div class="row-between">
                                <span class="row gap-sm">${raw(ico('llave', 14))}<span class="strong small">${a.titulo}</span></span>
                                <span class="tag line">${a.tipo}</span>
                            </div>
                            ${raw(a.url ? `<a class="small truncate" href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.url)}</a>` : '')}
                            ${raw(a.usuario ? `<p class="tiny muted mt">Usuario: ${esc(a.usuario)}</p>` : '')}
                            ${raw(a.notas ? `<p class="tiny muted">${esc(a.notas)}</p>` : '')}
                            <div class="right mt"><button class="btn-quiet tiny" data-borrar-acceso="${esc(a.id)}">Eliminar</button></div>
                        </div>`)}
                </div>` : vacio('Aquí van hosting, repositorio, panel del dominio… todo lo técnico de este cliente.'))}
        </section>

        <section data-panel="historial" class="hidden">
            <div class="section-title"><h2>Historial de conversaciones</h2>
                <button class="btn btn-ghost btn-sm" data-nueva-nota>${raw(ico('mas', 14))} Anotar</button></div>
            ${raw(notas.length ? html`
                <div class="timeline">
                    ${notas.map(n => html`
                        <div class="timeline-item">
                            <div class="row-between">
                                <span class="tiny muted">${fecha(n.fecha)}${raw(n.autor ? ` · ${esc(n.autor)}` : '')}</span>
                                <button class="btn-quiet tiny" data-borrar-nota="${n.id}">Eliminar</button>
                            </div>
                            <p class="small">${n.texto}</p>
                        </div>`)}
                </div>` : vacio('Apunta aquí lo que hablas: precios cerrados, promesas, cambios pedidos.'))}
        </section>

        <section data-panel="ficha" class="hidden">
            <div class="card view-narrow">
                <div class="grid-2">
                    ${raw(dato('Negocio', c.empresa))}
                    ${raw(dato('Contacto', c.nombre))}
                    ${raw(dato('Email', c.email))}
                    ${raw(dato('Teléfono', c.telefono))}
                    ${raw(dato('NIF / CIF', c.nif))}
                    ${raw(dato('Dirección', c.direccion))}
                </div>
                ${raw(c.notas ? `<div class="field"><label>Notas internas</label><p class="small">${esc(c.notas)}</p></div>` : '')}
                <div class="row mt">
                    <button class="btn btn-ghost btn-sm" data-editar>Editar ficha</button>
                    <button class="btn btn-danger btn-sm" data-borrar-cliente>Eliminar cliente</button>
                </div>
            </div>
        </section>`;

    /* pestañas */
    on(raiz, 'click', '[data-tab]', (_ev, boton) => {
        raiz.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b === boton));
        raiz.querySelectorAll('[data-panel]').forEach(p =>
            p.classList.toggle('hidden', p.dataset.panel !== boton.dataset.tab));
    });

    /* acciones */
    on(raiz, 'click', '[data-editar]', () => abrirFicha('cliente', { valores: c }));
    on(raiz, 'click', '[data-nuevo-proyecto]', () => abrirFicha('proyecto', { fijos: { cliente_id: c.id } }));
    on(raiz, 'click', '[data-nuevo-pago]', () => abrirFicha('pago', { fijos: { cliente_id: c.id } }));
    on(raiz, 'click', '[data-nueva-cuota]', () => abrirFicha('suscripcion', { fijos: { cliente_id: c.id } }));
    on(raiz, 'click', '[data-nuevo-dominio]', () => abrirFicha('dominio', { fijos: { cliente_id: c.id } }));
    on(raiz, 'click', '[data-nuevo-acceso]', () => abrirFicha('acceso', { fijos: { cliente_id: c.id } }));
    on(raiz, 'click', '[data-nueva-nota]', () => abrirFicha('nota', { fijos: { cliente_id: c.id } }));
    on(raiz, 'click', '[data-portal]', () => abrirPortalCliente(c));

    on(raiz, 'click', '[data-pagar]', async (_ev, el) => {
        await marcarPagado(cache.pagos.find(p => p.id === el.dataset.pagar));
        toast('Pago marcado como cobrado');
        refrescar();
    });
    on(raiz, 'click', '[data-editar-pago]', (_ev, el) =>
        abrirFicha('pago', { valores: cache.pagos.find(p => p.id === el.dataset.editarPago) }));

    for (const [attr, tabla] of [['data-borrar-cuota', 'suscripciones'], ['data-borrar-dominio', 'dominios'],
        ['data-borrar-acceso', 'accesos'], ['data-borrar-nota', 'notas'], ['data-borrar-pago', 'pagos']]) {
        on(raiz, 'click', `[${attr}]`, async (_ev, el) => {
            if (!await confirmar('¿Seguro que quieres eliminar este registro?')) return;
            await borrar(tabla, el.getAttribute(attr));
            toast('Eliminado');
            refrescar();
        });
    }

    on(raiz, 'click', '[data-borrar-cliente]', async () => {
        const ok = await confirmar(`Se eliminará «${c.empresa || c.nombre}» con sus ${proyectos.length} proyectos, pagos, dominios y notas. Esto no se puede deshacer.`, { textoOk: 'Eliminar todo' });
        if (!ok) return;
        await borrarCliente(c.id);
        toast('Cliente eliminado');
        location.hash = '#/clientes';
        refrescar();
    });
}

/* ------------------------------------------------------------ AUXILIARES */

function dato(etiqueta, valor) {
    return `<div class="field"><label>${esc(etiqueta)}</label><p class="small">${esc(valor || '—')}</p></div>`;
}

export function tablaPagos(pagos, { mostrarCliente = false } = {}) {
    return html`
        <div class="table-wrap"><table>
            <thead><tr>
                <th>Concepto</th>${raw(mostrarCliente ? '<th>Cliente</th>' : '')}
                <th>Importe</th><th>Estado</th><th></th>
            </tr></thead>
            <tbody>
                ${pagos.map(p => html`
                    <tr>
                        <td>
                            <span class="strong">${p.concepto}</span>
                            <div class="tiny muted">${raw(p.fecha_pago ? `Cobrado ${esc(fecha(p.fecha_pago))}` : `Vence ${esc(fecha(p.fecha_vencimiento))}`)}</div>
                        </td>
                        ${raw(mostrarCliente ? `<td class="muted small">${esc(nombreCliente(p.cliente_id))}</td>` : '')}
                        <td class="mono nowrap">${euros(p.importe)}</td>
                        <td>${raw(tagPago(p))}</td>
                        <td class="right nowrap">
                            ${raw(p.estado !== 'pagado' ? `<button class="btn btn-ghost btn-sm" data-pagar="${esc(p.id)}">Cobrado</button>` : '')}
                            <button class="btn-quiet" data-editar-pago="${esc(p.id)}" title="Editar">${raw(ico('editar', 14))}</button>
                            <button class="btn-quiet" data-borrar-pago="${esc(p.id)}" title="Eliminar">${raw(ico('borrar', 14))}</button>
                        </td>
                    </tr>`)}
            </tbody>
        </table></div>`;
}

/**
 * Panel de acceso del cliente.
 *
 * Nadie se registra solo en el CRM: el acceso lo crea aquí el equipo, con el
 * correo que el cliente haya dado. La contraseña se genera en el servidor y se
 * enseña una sola vez, para pasársela por WhatsApp.
 */
export function abrirPortalCliente(c) {
    const base = location.origin + location.pathname;
    const proyectos = proyectosDe(c.id);

    const m = modal({
        titulo: `Acceso de ${c.empresa || c.nombre}`,
        ancho: true,
        cuerpo: html`
            <h3>1 · Su cuenta</h3>
            <div id="panel-acceso" class="mt"><p class="small muted">Comprobando…</p></div>

            <h3 class="mt-lg">2 · Enlace secreto por proyecto</h3>
            <p class="small muted">Sin cuenta ni contraseña: se lo pasas y entra. Quien tenga el enlace, entra.</p>
            ${raw(proyectos.length
                ? proyectos.map(p => campoCopiar(`${base}#/p/${p.token_acceso}`, p.nombre)).join('')
                : '<p class="small muted">Este cliente todavía no tiene proyectos.</p>')}`,
        acciones: `<button class="btn btn-ghost" data-cerrar>Cerrar</button>`,
    });

    const panel = m.querySelector('#panel-acceso');

    /** Mensaje listo para pegar en WhatsApp. */
    const mensaje = (clave) => [
        `Hola${c.nombre ? ' ' + c.nombre : ''}, ya puedes seguir el estado de tu proyecto con PuntoZero aquí:`,
        base,
        '',
        `Usuario: ${c.email}`,
        `Contraseña: ${clave}`,
        '',
        'Cuando entres puedes cambiar la contraseña desde tu nombre, abajo a la izquierda.',
    ].join('\n');

    /** Enlace de WhatsApp con el mensaje ya escrito (no envía nada solo). */
    const enlaceWhatsapp = (clave) => {
        const tel = String(c.telefono || '').replace(/\D/g, '');
        if (tel.length < 9) return null;
        const numero = tel.length === 9 ? `34${tel}` : tel;
        return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje(clave))}`;
    };

    /** Bloque de credenciales recién generadas. */
    const pintarCredenciales = (clave, titulo) => {
        const wa = enlaceWhatsapp(clave);
        panel.innerHTML = html`
            <div class="banner">${titulo} Apúntala o mándasela ahora: por seguridad no se puede volver a ver.</div>
            ${raw(campoCopiar(c.email, 'Usuario'))}
            ${raw(campoCopiar(clave, 'Contraseña'))}
            <div class="row wrap mt">
                <button class="btn btn-sm" data-copiar="${mensaje(clave)}">Copiar mensaje completo</button>
                ${raw(wa ? `<a class="btn btn-ghost btn-sm" href="${esc(wa)}" target="_blank" rel="noopener">Abrir en WhatsApp</a>` : '')}
                <button class="btn btn-ghost btn-sm" data-recargar>Hecho</button>
            </div>`;
    };

    /** Estado actual de la cuenta del cliente. */
    async function pintarEstado() {
        if (esLocal()) {
            panel.innerHTML = '<div class="banner warn">Los accesos de clientes necesitan la base de datos en la nube.</div>';
            return;
        }
        if (!c.email) {
            panel.innerHTML = html`
                <div class="banner warn">Este cliente no tiene correo en su ficha, y hace falta para darle acceso.</div>
                <button class="btn btn-sm" data-ir-ficha>Añadir el correo</button>`;
            return;
        }

        panel.innerHTML = '<p class="small muted">Comprobando…</p>';
        let estado;
        try {
            estado = await adaptador.funcion('acceso', { accion: 'estado', email: c.email });
        } catch (e) {
            panel.innerHTML = `<div class="banner warn">${esc(e.message)}</div>`;
            return;
        }

        panel.innerHTML = estado.existe
            ? html`
                <div class="row wrap">
                    <span class="tag ok">Tiene acceso</span>
                    <span class="small muted">${c.email}${raw(estado.creado ? ` · desde el ${esc(fecha(estado.creado))}` : '')}</span>
                </div>
                <div class="row wrap mt">
                    <button class="btn btn-ghost btn-sm" data-restablecer>Generar contraseña nueva</button>
                    <button class="btn btn-danger btn-sm" data-revocar>Quitar el acceso</button>
                </div>`
            : html`
                <p class="small muted">Todavía no tiene cuenta. Al crearla, entrará con
                    <span class="strong">${c.email}</span> y verá solo sus proyectos, sus pagos y sus fechas.</p>
                <button class="btn btn-sm mt" data-crear>Crear acceso</button>`;
    }

    panel.addEventListener('click', async (ev) => {
        const boton = ev.target.closest('button');
        if (!boton) return;

        if (boton.dataset.irFicha !== undefined) {
            m.cerrar();
            return abrirFicha('cliente', { valores: c });
        }
        if (boton.dataset.recargar !== undefined) return pintarEstado();

        const acciones = {
            crear: { accion: 'crear', titulo: 'Acceso creado.' },
            restablecer: { accion: 'restablecer', titulo: 'Contraseña nueva.' },
            revocar: { accion: 'revocar' },
        };
        const cual = Object.keys(acciones).find(k => boton.dataset[k] !== undefined);
        if (!cual) return;

        if (cual === 'revocar' && !await confirmar(`${c.empresa || c.nombre} dejará de poder entrar. Su ficha y sus proyectos no se tocan.`)) return;
        if (cual === 'restablecer' && !await confirmar('La contraseña actual dejará de funcionar. ¿Generar una nueva?', { peligro: false, textoOk: 'Generar' })) return;

        boton.disabled = true;
        try {
            const r = await adaptador.funcion('acceso', {
                accion: acciones[cual].accion,
                email: c.email,
                cliente_id: c.id,
                nombre: c.nombre || c.empresa,
            });
            if (r.clave) pintarCredenciales(r.clave, acciones[cual].titulo);
            else { toast('Acceso retirado'); pintarEstado(); }
        } catch (e) {
            toast(e.message, 'bad');
            boton.disabled = false;
        }
    });

    pintarEstado();
}
