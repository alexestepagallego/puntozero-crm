/** Menú rápido del botón "Nuevo" de la cabecera. */
import { modal, html, raw } from '../util.js';
import { ico } from '../ui.js';
import { abrirFicha } from '../forms.js';

const OPCIONES = [
    { tipo: 'cliente', icono: 'clientes', txt: 'Cliente', sub: 'Un negocio nuevo con el que trabajar' },
    { tipo: 'proyecto', icono: 'proyectos', txt: 'Proyecto', sub: 'Crea el tablero y el presupuesto' },
    { tipo: 'pago', icono: 'pagos', txt: 'Pago', sub: 'Un cobro puntual, hecho o pendiente' },
    { tipo: 'suscripcion', icono: 'cuotas', txt: 'Cuota recurrente', sub: 'Mantenimiento, hosting…' },
    { tipo: 'dominio', icono: 'dominios', txt: 'Dominio', sub: 'Con su fecha de renovación' },
    { tipo: 'lead', icono: 'pipeline', txt: 'Oportunidad', sub: 'Alguien interesado que aún no es cliente' },
    { tipo: 'nota', icono: 'nota', txt: 'Anotación', sub: 'Lo que has hablado con un cliente' },
];

export function menuNuevo() {
    const m = modal({
        titulo: 'Crear',
        cuerpo: html`
            <div class="stack" style="gap:2px">
                ${OPCIONES.map(o => html`
                    <button class="list-item" data-tipo="${o.tipo}" style="width:100%;text-align:left;border-radius:6px;padding:10px">
                        <span class="ic muted">${raw(ico(o.icono))}</span>
                        <span class="stack grow">
                            <span class="small strong">${o.txt}</span>
                            <span class="tiny muted">${o.sub}</span>
                        </span>
                    </button>`)}
            </div>`,
    });

    m.addEventListener('click', (ev) => {
        const boton = ev.target.closest('[data-tipo]');
        if (!boton) return;
        m.cerrar();
        abrirFicha(boton.dataset.tipo);
    });
}
