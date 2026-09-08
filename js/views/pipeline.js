/** Oportunidades: quién ha preguntado, a quién hay que enviar presupuesto. */
import { html, raw, esc, euros, fecha, on, confirmar, toast } from '../util.js';
import { cache, ESTADOS_LEAD, borrar, editar, crear } from '../data/index.js';
import { cabecera, vacio, stat, ico } from '../ui.js';
import { abrirFicha } from '../forms.js';
import { refrescar } from '../estado.js';

export async function vistaPipeline(_params, raiz) {
    const leads = cache.leads;
    const abiertos = leads.filter(l => !['ganado', 'perdido'].includes(l.estado));
    const valorAbierto = abiertos.reduce((s, l) => s + (Number(l.valor_estimado) || 0), 0);
    const ganados = leads.filter(l => l.estado === 'ganado');

    raiz.innerHTML = html`
        ${raw(cabecera({
            titulo: 'Oportunidades',
            sub: 'Contactos que todavía no son clientes',
            acciones: `<button class="btn btn-sm" data-nuevo>${ico('mas', 14)} Nueva oportunidad</button>`,
        }))}

        <div class="grid grid-stats mb">
            ${raw(stat('En juego', euros(valorAbierto), `${abiertos.length} oportunidades abiertas`))}
            ${raw(stat('Ganadas', ganados.length, euros(ganados.reduce((s, l) => s + (Number(l.valor_estimado) || 0), 0))))}
            ${raw(stat('Perdidas', leads.filter(l => l.estado === 'perdido').length, 'para aprender del porqué'))}
        </div>

        ${raw(leads.length ? html`
            <div class="board">
                ${ESTADOS_LEAD.map(([clave, titulo]) => {
                    const dentro = leads.filter(l => (l.estado || 'interesado') === clave);
                    return html`
                        <div class="column" data-estado="${clave}">
                            <div class="column-head">
                                <span class="name grow">${titulo}</span>
                                <span class="n">${dentro.length}</span>
                            </div>
                            <div class="column-body" data-destino="${clave}">
                                ${dentro.map(l => html`
                                    <article class="kcard" draggable="true" data-lead="${l.id}">
                                        <div class="t">${l.nombre}</div>
                                        <div class="meta">
                                            ${raw(l.valor_estimado ? `<span class="tag line tiny">${esc(euros(l.valor_estimado))}</span>` : '')}
                                            ${raw(l.origen ? `<span class="tiny muted">${esc(l.origen)}</span>` : '')}
                                        </div>
                                    </article>`)}
                            </div>
                            <div class="column-foot">
                                <button class="column-add" data-nuevo-en="${clave}">+ Añadir</button>
                            </div>
                        </div>`;
                })}
            </div>` : vacio('Apunta aquí a quien pregunta por un presupuesto. Cuando lo cierres, lo conviertes en cliente de un clic.',
                '<button class="btn btn-sm" data-nuevo>Añadir la primera</button>'))}`;

    /* arrastrar entre estados */
    let arrastrado = null;
    raiz.querySelectorAll('[data-lead]').forEach(el => {
        el.addEventListener('dragstart', () => { arrastrado = el.dataset.lead; el.classList.add('dragging'); });
        el.addEventListener('dragend', () => el.classList.remove('dragging'));
        el.addEventListener('click', () => abrirLead(el.dataset.lead));
    });
    raiz.querySelectorAll('.column-body').forEach(cuerpo => {
        cuerpo.addEventListener('dragover', (ev) => { ev.preventDefault(); cuerpo.classList.add('drag-over'); });
        cuerpo.addEventListener('dragleave', () => cuerpo.classList.remove('drag-over'));
        cuerpo.addEventListener('drop', async (ev) => {
            ev.preventDefault();
            cuerpo.classList.remove('drag-over');
            if (!arrastrado) return;
            await editar('leads', arrastrado, { estado: cuerpo.dataset.destino });
            arrastrado = null;
            refrescar();
        });
    });

    on(raiz, 'click', '[data-nuevo]', () => abrirFicha('lead'));
    on(raiz, 'click', '[data-nuevo-en]', (_ev, el) => abrirFicha('lead', { fijos: { estado: el.dataset.nuevoEn } }));
}

/** Detalle de una oportunidad, con el paso a cliente. */
function abrirLead(id) {
    const l = cache.leads.find(x => String(x.id) === String(id));
    if (!l) return;

    import('../util.js').then(({ modal }) => {
        const m = modal({
            titulo: l.nombre,
            cuerpo: html`
                <div class="grid-2">
                    <div class="field"><label>Contacto</label><p class="small">${l.contacto || '—'}</p></div>
                    <div class="field"><label>Teléfono</label><p class="small">${l.telefono || '—'}</p></div>
                    <div class="field"><label>Email</label><p class="small">${l.email || '—'}</p></div>
                    <div class="field"><label>Origen</label><p class="small">${l.origen || '—'}</p></div>
                    <div class="field"><label>Valor estimado</label><p class="small">${raw(l.valor_estimado ? esc(euros(l.valor_estimado)) : '—')}</p></div>
                    <div class="field"><label>Primer contacto</label><p class="small">${fecha(l.fecha)}</p></div>
                </div>
                ${raw(l.notas ? `<div class="field"><label>Notas</label><p class="small">${esc(l.notas)}</p></div>` : '')}`,
            acciones: html`
                <button class="btn btn-danger" data-borrar>Eliminar</button>
                <button class="btn btn-ghost" data-editar>Editar</button>
                <button class="btn" data-convertir>Convertir en cliente</button>`,
        });

        m.querySelector('[data-editar]').addEventListener('click', () => { m.cerrar(); abrirFicha('lead', { valores: l }); });
        m.querySelector('[data-borrar]').addEventListener('click', async () => {
            if (!await confirmar('¿Eliminar esta oportunidad?')) return;
            await borrar('leads', l.id);
            m.cerrar();
            refrescar();
        });
        m.querySelector('[data-convertir]').addEventListener('click', async () => {
            const nuevo = await crear('clientes', {
                empresa: l.nombre, nombre: l.contacto || null, email: l.email || null,
                telefono: l.telefono || null, estado: 'activo',
                notas: [l.origen ? `Origen: ${l.origen}` : '', l.notas || ''].filter(Boolean).join('\n'),
            });
            await editar('leads', l.id, { estado: 'ganado' });
            m.cerrar();
            toast('Cliente creado desde la oportunidad');
            location.hash = `#/cliente/${nuevo.id}`;
            refrescar();
        });
    });
}
