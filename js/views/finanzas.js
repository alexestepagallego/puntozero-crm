/** Pagos, cuotas recurrentes y dominios: el dinero y las renovaciones. */
import {
    html, raw, esc, euros, fecha, on, confirmar, toast, porCampo,
    diasHasta, descargarICS, sumarPeriodo,
} from '../util.js';
import {
    cache, borrar, editar, marcarPagado, renovarSuscripcion, nombreCliente, balance,
} from '../data/index.js';
import { cabecera, vacio, stat, ico, tagPago, tagVence } from '../ui.js';
import { abrirFicha } from '../forms.js';
import { refrescar } from '../estado.js';
import { tablaPagos } from './clientes.js';

/* ============================================================== PAGOS ==== */

let filtroPagos = 'pendientes';

export async function vistaPagos(_params, raiz) {
    const dinero = balance();
    const todos = cache.pagos.slice().sort(porCampo('fecha_vencimiento', 'desc'));

    const filtrados = todos.filter(p => {
        if (filtroPagos === 'todos') return true;
        if (filtroPagos === 'pagados') return p.estado === 'pagado';
        if (filtroPagos === 'vencidos') return p.estado !== 'pagado' && diasHasta(p.fecha_vencimiento) < 0;
        return p.estado !== 'pagado';
    });

    raiz.innerHTML = html`
        ${raw(cabecera({
            titulo: 'Pagos',
            sub: 'Cobros puntuales: señales, entregas y facturas sueltas',
            acciones: `<button class="btn btn-sm" data-nuevo>${ico('mas', 14)} Añadir pago</button>`,
        }))}

        <div class="grid grid-stats mb">
            ${raw(stat('Pendiente de cobro', euros(dinero.pendiente), `${todos.filter(p => p.estado !== 'pagado').length} pagos`))}
            ${raw(stat('Vencido', euros(dinero.vencido), dinero.vencido ? 'Reclamar ya' : 'Nada vencido'))}
            ${raw(stat('Cobrado', euros(dinero.cobrado), 'Total registrado'))}
        </div>

        <div class="tabs">
            ${[['pendientes', 'Pendientes'], ['vencidos', 'Vencidos'], ['pagados', 'Cobrados'], ['todos', 'Todos']].map(([k, t]) => html`
                <button data-filtro="${k}" class="${raw(filtroPagos === k ? 'active' : '')}">${t}</button>`)}
        </div>

        ${raw(filtrados.length ? tablaPagos(filtrados, { mostrarCliente: true })
            : vacio('No hay pagos con este filtro.', '<button class="btn btn-sm" data-nuevo>Añadir pago</button>'))}`;

    on(raiz, 'click', '[data-filtro]', (_ev, el) => {
        filtroPagos = el.dataset.filtro;
        vistaPagos({}, raiz);
    });
    on(raiz, 'click', '[data-nuevo]', () => abrirFicha('pago'));
    on(raiz, 'click', '[data-pagar]', async (_ev, el) => {
        await marcarPagado(cache.pagos.find(p => p.id === el.dataset.pagar));
        toast('Pago cobrado');
        refrescar();
    });
    on(raiz, 'click', '[data-editar-pago]', (_ev, el) =>
        abrirFicha('pago', { valores: cache.pagos.find(p => p.id === el.dataset.editarPago) }));
    on(raiz, 'click', '[data-borrar-pago]', async (_ev, el) => {
        if (!await confirmar('¿Eliminar este pago?')) return;
        await borrar('pagos', el.dataset.borrarPago);
        refrescar();
    });
}

/* ============================================================= CUOTAS ==== */

export async function vistaCuotas(_params, raiz) {
    const cuotas = cache.suscripciones.slice().sort(porCampo('proxima_fecha'));
    const activas = cuotas.filter(s => s.activa !== false);
    const dinero = balance();

    const alAno = (s) => (Number(s.importe) || 0) *
        ({ mensual: 12, bimestral: 6, trimestral: 4, semestral: 2, anual: 1 }[s.periodicidad] ?? 1);

    raiz.innerHTML = html`
        ${raw(cabecera({
            titulo: 'Cuotas y suscripciones',
            sub: 'Mantenimientos, hosting y todo lo que se cobra cada X tiempo',
            acciones: `<button class="btn btn-sm" data-nuevo>${ico('mas', 14)} Nueva cuota</button>`,
        }))}

        <div class="grid grid-stats mb">
            ${raw(stat('Ingresos recurrentes', euros(dinero.recurrenteAnual), 'al año, si todo se mantiene'))}
            ${raw(stat('Cuotas activas', activas.length, `${cuotas.length - activas.length} pausadas`))}
            ${raw(stat('Próximo cobro', activas[0] ? fecha(activas[0].proxima_fecha) : '—',
                activas[0] ? esc(activas[0].concepto) : 'sin cuotas'))}
        </div>

        ${raw(cuotas.length ? html`
            <div class="table-wrap"><table>
                <thead><tr>
                    <th>Concepto</th><th>Cliente</th><th>Cada</th><th>Importe</th>
                    <th>Al año</th><th>Próximo cobro</th><th></th>
                </tr></thead>
                <tbody>
                    ${cuotas.map(s => html`
                        <tr class="${raw(s.activa === false ? 'muted' : '')}">
                            <td class="strong">${s.concepto}</td>
                            <td class="small muted">${nombreCliente(s.cliente_id)}</td>
                            <td class="small">${s.periodicidad}</td>
                            <td class="mono nowrap">${euros(s.importe)}</td>
                            <td class="mono nowrap muted">${euros(alAno(s))}</td>
                            <td>${raw(s.activa === false ? '<span class="tag line">Pausada</span>' : tagVence(s.proxima_fecha))}</td>
                            <td class="right nowrap">
                                ${raw(s.activa === false ? '' : `<button class="btn btn-ghost btn-sm" data-renovar="${esc(s.id)}" title="Registrar el cobro y pasar al siguiente periodo">Cobrada</button>`)}
                                <button class="btn-quiet" data-editar="${esc(s.id)}">${raw(ico('editar', 14))}</button>
                                <button class="btn-quiet" data-borrar="${esc(s.id)}">${raw(ico('borrar', 14))}</button>
                            </td>
                        </tr>`)}
                </tbody>
            </table></div>` : vacio('Aún no hay cuotas recurrentes. Aquí es donde se ve el dinero que entra solo cada mes.',
                '<button class="btn btn-sm" data-nuevo>Crear la primera</button>'))}`;

    on(raiz, 'click', '[data-nuevo]', () => abrirFicha('suscripcion'));
    on(raiz, 'click', '[data-editar]', (_ev, el) =>
        abrirFicha('suscripcion', { valores: cache.suscripciones.find(s => s.id === el.dataset.editar) }));
    on(raiz, 'click', '[data-renovar]', async (_ev, el) => {
        const s = cache.suscripciones.find(x => x.id === el.dataset.renovar);
        await renovarSuscripcion(s);
        toast(`Cobro registrado. Siguiente: ${fecha(sumarPeriodo(s.proxima_fecha, s.periodicidad))}`);
        refrescar();
    });
    on(raiz, 'click', '[data-borrar]', async (_ev, el) => {
        if (!await confirmar('¿Eliminar esta cuota recurrente?')) return;
        await borrar('suscripciones', el.dataset.borrar);
        refrescar();
    });
}

/* =========================================================== DOMINIOS ==== */

export async function vistaDominios(_params, raiz) {
    const dominios = cache.dominios.slice().sort(porCampo('fecha_renovacion'));
    const proximos = dominios.filter(d => {
        const q = diasHasta(d.fecha_renovacion);
        return q !== null && q <= 60;
    });
    const costeAnual = dominios.reduce((s, d) => s + (Number(d.coste) || 0), 0);

    raiz.innerHTML = html`
        ${raw(cabecera({
            titulo: 'Dominios',
            sub: 'Cuándo caduca cada uno y quién lo paga',
            acciones: `
                <button class="btn btn-ghost btn-sm" data-ics>${ico('calendario', 14)} Al calendario</button>
                <button class="btn btn-sm" data-nuevo>${ico('mas', 14)} Añadir dominio</button>`,
        }))}

        <div class="grid grid-stats mb">
            ${raw(stat('Dominios gestionados', dominios.length, `${costeAnual ? euros(costeAnual) + ' al año' : ''}`))}
            ${raw(stat('Renuevan en 60 días', proximos.length, proximos.length ? 'Revísalos' : 'Nada urgente'))}
            ${raw(stat('Sin renovación automática', dominios.filter(d => !d.auto_renueva).length, 'hay que renovarlos a mano'))}
        </div>

        ${raw(dominios.length ? html`
            <div class="table-wrap"><table>
                <thead><tr><th>Dominio</th><th>Cliente</th><th>Registrador</th><th>Coste</th><th>Renueva</th><th>Auto</th><th></th></tr></thead>
                <tbody>
                    ${dominios.map(d => html`
                        <tr>
                            <td class="strong">${d.dominio}</td>
                            <td class="small muted">${nombreCliente(d.cliente_id)}</td>
                            <td class="small">${d.registrador || '—'}</td>
                            <td class="mono nowrap">${raw(d.coste ? esc(euros(d.coste)) : '—')}</td>
                            <td>${raw(tagVence(d.fecha_renovacion))}</td>
                            <td>${raw(d.auto_renueva ? '<span class="tag ok">Sí</span>' : '<span class="tag warn">No</span>')}</td>
                            <td class="right nowrap">
                                <button class="btn btn-ghost btn-sm" data-renovado="${esc(d.id)}" title="Suma un año a la fecha">+1 año</button>
                                <button class="btn-quiet" data-editar="${esc(d.id)}">${raw(ico('editar', 14))}</button>
                                <button class="btn-quiet" data-borrar="${esc(d.id)}">${raw(ico('borrar', 14))}</button>
                            </td>
                        </tr>`)}
                </tbody>
            </table></div>` : vacio('Ningún dominio registrado todavía.',
                '<button class="btn btn-sm" data-nuevo>Añadir el primero</button>'))}`;

    on(raiz, 'click', '[data-nuevo]', () => abrirFicha('dominio'));
    on(raiz, 'click', '[data-editar]', (_ev, el) =>
        abrirFicha('dominio', { valores: cache.dominios.find(d => d.id === el.dataset.editar) }));
    on(raiz, 'click', '[data-renovado]', async (_ev, el) => {
        const d = cache.dominios.find(x => x.id === el.dataset.renovado);
        const nueva = sumarPeriodo(d.fecha_renovacion, 'anual');
        await editar('dominios', d.id, { fecha_renovacion: nueva });
        toast(`${d.dominio} renovado hasta ${fecha(nueva)}`);
        refrescar();
    });
    on(raiz, 'click', '[data-borrar]', async (_ev, el) => {
        if (!await confirmar('¿Eliminar este dominio del CRM?')) return;
        await borrar('dominios', el.dataset.borrar);
        refrescar();
    });
    on(raiz, 'click', '[data-ics]', () => {
        const eventos = dominios.filter(d => d.fecha_renovacion).map(d => ({
            id: `dom-${d.id}`,
            fecha: d.fecha_renovacion,
            titulo: `[PuntoZero] Renovar ${d.dominio}`,
            descripcion: `${nombreCliente(d.cliente_id)} · ${d.registrador || ''}`,
        }));
        if (!eventos.length) return toast('No hay fechas que exportar');
        descargarICS(eventos, 'puntozero-dominios.ics');
        toast('Descargado: ábrelo con tu calendario');
    });
}
