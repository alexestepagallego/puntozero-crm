/** Panel de inicio: lo que vence, cómo va el dinero y qué proyectos hay vivos. */
import { html, raw, esc, euros, eurosCorto, fecha, plazo, descargarICS, on, toast, reiniciarEscuchas } from '../util.js';
import { cache, alertas, balance, progreso, nombreCliente, eventosCalendario } from '../data/index.js';
import { cabecera, vacio, stat, ico, progresoBarra, tagFase, tagPago } from '../ui.js';
import { abrirFicha } from '../forms.js';

export async function vistaPanel(_params, raiz) {
    reiniciarEscuchas(raiz);
    const lista = alertas();
    const dinero = balance();
    const activos = cache.proyectos
        .filter(p => p.estado !== 'Publicado' || progreso(p.id) < 100)
        .slice()
        .sort((a, b) => (a.fecha_entrega || '9999') .localeCompare(b.fecha_entrega || '9999'));

    const pagosRecientes = cache.pagos
        .filter(p => p.estado === 'pagado')
        .sort((a, b) => String(b.fecha_pago || '').localeCompare(String(a.fecha_pago || '')))
        .slice(0, 5);

    const notasRecientes = cache.notas
        .slice().sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')))
        .slice(0, 4);

    raiz.innerHTML = html`
        ${raw(cabecera({
            titulo: 'Panel',
            sub: `${cache.clientes.length} clientes · ${cache.proyectos.length} proyectos · ${lista.length} avisos`,
            acciones: `<button class="btn btn-ghost btn-sm" id="btn-ics">${ico('calendario', 14)} Exportar al calendario</button>`,
        }))}

        <div class="grid grid-stats">
            ${raw(stat('Pendiente de cobro', eurosCorto(dinero.pendiente),
                dinero.vencido ? `<span class="tag bad">${esc(euros(dinero.vencido))} vencido</span>` : 'Todo al día'))}
            ${raw(stat('Cobrado', eurosCorto(dinero.cobrado), 'Histórico registrado'))}
            ${raw(stat('Recurrente al año', eurosCorto(dinero.recurrenteAnual), `${cache.suscripciones.filter(s => s.activa !== false).length} cuotas activas`))}
            ${raw(stat('Proyectos vivos', activos.length, `${cache.proyectos.filter(p => p.estado === 'Publicado').length} publicados`))}
        </div>

        <div class="mt-lg alerts">
            <div class="alerts-head">
                <h2 class="row gap-sm">${raw(ico('aviso'))} Atención</h2>
                <span class="small muted">Próximos 30 días</span>
            </div>
            ${raw(lista.length ? lista.slice(0, 12).map(a => html`
                <a class="alert-row ${raw(a.nivel)}" href="${a.ruta}">
                    <span class="bar"></span>
                    <span class="stack grow">
                        <span class="strong small">${a.titulo}</span>
                        <span class="tiny muted">${a.detalle}</span>
                    </span>
                    <span class="tag ${raw(a.nivel === 'bad' ? 'bad' : a.nivel === 'warn' ? 'warn' : 'line')} nowrap">
                        ${fecha(a.fecha, { day: 'numeric', month: 'short' })} · ${plazo(a.fecha)}
                    </span>
                </a>`).join('') : `<div class="alert-row"><span class="bar"></span><span class="small muted">Nada vence en los próximos 30 días. Todo bajo control.</span></div>`)}
        </div>

        <div class="mt-lg">
            <div class="section-title">
                <h2>Proyectos en marcha</h2>
                <a href="#/proyectos" class="btn btn-ghost btn-sm">Ver todos</a>
            </div>
            ${raw(activos.length ? html`
                <div class="grid grid-cards">
                    ${activos.slice(0, 6).map(p => html`
                        <a class="card card-link" href="#/proyecto/${p.id}">
                            <div class="row-between">
                                <span class="strong">${p.nombre}</span>
                                ${raw(tagFase(p.estado))}
                            </div>
                            <p class="tiny muted mt">${nombreCliente(p.cliente_id)}</p>
                            <div class="mt">${raw(progresoBarra(progreso(p.id)))}</div>
                            <div class="row-between mt">
                                <span class="tiny muted">${progreso(p.id)} % completado</span>
                                <span class="tiny muted">${raw(p.fecha_entrega ? `Entrega ${esc(fecha(p.fecha_entrega))}` : 'Sin fecha de entrega')}</span>
                            </div>
                        </a>`)}
                </div>` : vacio('Todavía no hay proyectos en marcha.',
                    '<button class="btn btn-sm" data-nuevo-proyecto>Crear el primero</button>'))}
        </div>

        <div class="grid mt-lg" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
            <div class="card">
                <div class="card-head"><h2>Últimos cobros</h2><a href="#/pagos" class="small muted">Ver pagos</a></div>
                ${raw(pagosRecientes.length ? pagosRecientes.map(p => html`
                    <div class="list-item">
                        <span class="stack grow">
                            <span class="small strong truncate">${p.concepto}</span>
                            <span class="tiny muted">${nombreCliente(p.cliente_id)} · ${fecha(p.fecha_pago)}</span>
                        </span>
                        <span class="small mono nowrap">${euros(p.importe)}</span>
                    </div>`).join('') : '<p class="small muted">Aún no hay cobros registrados.</p>')}
            </div>

            <div class="card">
                <div class="card-head"><h2>Últimas anotaciones</h2>
                    <button class="btn btn-ghost btn-sm" data-nueva-nota>${raw(ico('nota', 14))} Anotar</button></div>
                ${raw(notasRecientes.length ? notasRecientes.map(n => html`
                    <div class="list-item">
                        <span class="stack grow">
                            <span class="small">${n.texto}</span>
                            <span class="tiny muted">${nombreCliente(n.cliente_id)} · ${fecha(n.fecha)}</span>
                        </span>
                    </div>`).join('') : '<p class="small muted">Apunta aquí lo que hablas con cada cliente: precios, promesas, cambios.</p>')}
            </div>
        </div>`;

    raiz.querySelector('#btn-ics')?.addEventListener('click', () => {
        const eventos = eventosCalendario();
        if (!eventos.length) return toast('No hay vencimientos que exportar');
        descargarICS(eventos);
        toast(`${eventos.length} vencimientos exportados`);
    });

    on(raiz, 'click', '[data-nuevo-proyecto]', () => abrirFicha('proyecto'));
    on(raiz, 'click', '[data-nueva-nota]', () => abrirFicha('nota'));
}
