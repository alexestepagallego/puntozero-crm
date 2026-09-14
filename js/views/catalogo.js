/** Catálogo de servicios y tarifas de referencia. */
import { html, raw, esc, euros, on, confirmar, toast, desglose, reiniciarEscuchas } from '../util.js';
import { CONFIG } from '../config.js';
import { cache, borrar } from '../data/index.js';
import { cabecera, vacio, ico } from '../ui.js';
import { abrirFicha } from '../forms.js';
import { refrescar } from '../estado.js';

const ETIQUETA_UNIDAD = {
    'único': 'pago único', mensual: 'al mes', trimestral: 'al trimestre', anual: 'al año',
};

export async function vistaCatalogo(_params, raiz) {
    reiniciarEscuchas(raiz);
    const servicios = cache.servicios.slice().sort((a, b) => (b.precio || 0) - (a.precio || 0));

    raiz.innerHTML = html`
        ${raw(cabecera({
            titulo: 'Tarifas',
            sub: 'Tus precios de referencia, para no improvisar en cada presupuesto',
            acciones: `<button class="btn btn-sm" data-nuevo>${ico('mas', 14)} Nuevo servicio</button>`,
        }))}

        ${raw(servicios.length ? html`
            <div class="grid grid-cards">
                ${servicios.map(s => {
                    const d = desglose(s.precio, CONFIG.IVA_DEFECTO, 0);
                    return html`
                        <div class="card">
                            <div class="row-between">
                                <span class="strong">${s.nombre}</span>
                                <span class="tag line">${raw(esc(ETIQUETA_UNIDAD[s.unidad] || s.unidad || ''))}</span>
                            </div>
                            <p class="small muted mt">${s.descripcion || ''}</p>
                            <div class="row-between mt">
                                <span class="stack">
                                    <span class="strong" style="font-size:1.15rem">${euros(s.precio)}</span>
                                    <span class="tiny muted">${euros(d.total)} con IVA</span>
                                </span>
                                <span class="row gap-sm">
                                    <button class="btn btn-ghost btn-sm" data-usar="${s.id}">Presupuestar</button>
                                    <button class="btn-quiet" data-editar="${s.id}">${raw(ico('editar', 14))}</button>
                                    <button class="btn-quiet" data-borrar="${s.id}">${raw(ico('borrar', 14))}</button>
                                </span>
                            </div>
                        </div>`;
                })}
            </div>` : vacio('Añade tus servicios con su precio: landing, carta digital, mantenimiento…',
                '<button class="btn btn-sm" data-nuevo>Crear el primero</button>'))}

        <div class="banner mt-lg">
            «Presupuestar» crea un proyecto nuevo ya relleno con el nombre y el precio del servicio.
        </div>`;

    on(raiz, 'click', '[data-nuevo]', () => abrirFicha('servicio'));
    on(raiz, 'click', '[data-editar]', (_ev, el) =>
        abrirFicha('servicio', { valores: cache.servicios.find(s => s.id === el.dataset.editar) }));
    on(raiz, 'click', '[data-borrar]', async (_ev, el) => {
        if (!await confirmar('¿Eliminar este servicio del catálogo?')) return;
        await borrar('servicios', el.dataset.borrar);
        refrescar();
    });
    on(raiz, 'click', '[data-usar]', (_ev, el) => {
        const s = cache.servicios.find(x => x.id === el.dataset.usar);
        if (!cache.clientes.length) return toast('Primero crea un cliente', 'bad');
        abrirFicha('proyecto', {
            valores: {
                nombre: s.nombre,
                precio_base: s.precio,
                presupuesto_notas: s.descripcion || '',
                tipo: /carta/i.test(s.nombre) ? 'Carta digital QR' : /landing|web/i.test(s.nombre) ? 'Landing' : 'Otro',
            },
        });
    });
}
