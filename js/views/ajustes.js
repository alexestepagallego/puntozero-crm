/** Ajustes: conexión, equipo, copias de seguridad y datos de ejemplo. */
import { CONFIG, modo, leerConexion } from '../config.js';
import { html, raw, esc, on, confirmar, toast, descargar, descargarICS, fecha, reiniciarEscuchas } from '../util.js';
import { adaptador, esLocal, cache, eventosCalendario } from '../data/index.js';
import { cargarEjemplos, borrarEjemplos, hayEjemplos } from '../data/demo.js';
import { cabecera, ico, stat } from '../ui.js';
import { abrirConexion } from './login.js';
import { refrescar, repintar } from '../estado.js';
import { sesion } from '../auth.js';

export async function vistaAjustes(_params, raiz) {
    reiniciarEscuchas(raiz);
    const conexion = leerConexion();
    const equipo = modo() === 'supabase' ? await adaptador.list('perfiles').catch(() => []) : [];
    const registro = modo() === 'supabase'
        ? (await adaptador.list('registro_accesos', { orden: 'creado', dir: 'desc' }).catch(() => [])).slice(0, 12)
        : [];

    raiz.innerHTML = html`
        ${raw(cabecera({ titulo: 'Ajustes', sub: 'Conexión, equipo y copias de seguridad' }))}

        <div class="view-narrow">
            <div class="card">
                <div class="card-head">
                    <h2>Dónde se guardan los datos</h2>
                    <span class="tag ${raw(esLocal() ? 'warn' : 'ok')}">${raw(esLocal() ? 'Modo local' : 'En la nube')}</span>
                </div>
                ${raw(esLocal() ? html`
                    <p class="small muted">Ahora mismo todo vive en <span class="strong">este navegador</span>.
                    Sirve para probar, pero tus clientes no pueden entrar y perderías los datos si borras el historial.</p>
                    <p class="small muted mt">Para que sea un CRM de verdad: crea un proyecto gratuito en Supabase,
                    ejecuta el archivo <span class="strong">sql/schema.sql</span> y pega aquí la URL y la clave pública.</p>
                    <div class="row mt">
                        <button class="btn btn-sm" data-conexion>Conectar con Supabase</button>
                        <a class="btn btn-ghost btn-sm" href="https://github.com/alexestepagallego/puntozero-crm/blob/main/docs/PUESTA-EN-MARCHA.md" rel="noopener" target="_blank">Ver guía paso a paso</a>
                    </div>` : html`
                    <p class="small muted">Conectado a <span class="mono">${esc(conexion.url)}</span>.
                    Los permisos los aplica la propia base de datos: cada cliente solo puede leer lo suyo.</p>
                    <div class="row mt">
                        <button class="btn btn-ghost btn-sm" data-conexion>Cambiar conexión</button>
                    </div>`)}
            </div>

            <div class="card">
                <div class="card-head"><h2>Equipo</h2></div>
                ${raw(modo() === 'supabase' ? html`
                    <p class="small muted mb">Quien entre con su email aparecerá aquí. El primero en registrarse
                    es administrador; a los demás socios los subes a administrador con una línea de SQL
                    (está en la guía).</p>
                    ${equipo.length ? equipo.map(u => html`
                        <div class="list-item">
                            <span class="stack grow">
                                <span class="small strong">${u.nombre || u.email}</span>
                                <span class="tiny muted">${u.email}</span>
                            </span>
                            <span class="tag ${raw(u.rol === 'admin' ? 'solid' : 'line')}">${raw(u.rol === 'admin' ? 'Administrador' : 'Cliente')}</span>
                        </div>`).join('') : '<p class="small muted">Todavía no ha entrado nadie más.</p>'}
                    ` : '<p class="small muted">En modo local solo existe un usuario: tú. El control de usuarios llega al conectar Supabase.</p>')}
            </div>

            ${raw(modo() === 'supabase' ? html`
                <div class="card">
                    <div class="card-head">
                        <h2>Accesos dados a clientes</h2>
                        <span class="tag line">${registro.length} últimos</span>
                    </div>
                    <p class="small muted mb">Quién dio o quitó el acceso a cada cliente, y cuándo.
                    Lo escribe el servidor: no se puede tocar desde aquí.</p>
                    ${registro.length ? registro.map(r => html`
                        <div class="list-item">
                            <span class="tag ${raw(r.accion === 'revocar' ? 'bad' : r.accion === 'crear' ? 'ok' : 'warn')}">${raw({
                                crear: 'alta', restablecer: 'nueva clave', revocar: 'baja',
                            }[r.accion] || r.accion)}</span>
                            <span class="stack grow" style="min-width:0">
                                <span class="small strong truncate">${r.email}</span>
                                <span class="tiny muted">${r.email_actor || '—'} · ${fecha(r.creado)}</span>
                            </span>
                        </div>`).join('') : '<p class="small muted">Todavía no has dado ningún acceso.</p>'}
                </div>` : '')}

            <div class="card">
                <div class="card-head">
                    <h2>Asistente (IA)</h2>
                    <span class="tag ${raw(esLocal() ? 'line' : 'info')}">${raw(esLocal() ? 'Necesita Supabase' : 'Gemini')}</span>
                </div>
                <p class="small muted">Un ayudante que entiende órdenes escritas ("sube a 200 € la carta de Villegas")
                y prepara los cambios para que tú los confirmes. Es gratis con Gemini y, al estar en España,
                Google no usa tus datos para entrenar.</p>
                <p class="small mt"><span class="strong">Para activarlo</span> (una sola vez):</p>
                <ol class="small muted" style="padding-left:18px;line-height:1.7">
                    <li>Saca tu clave gratis en <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> (empieza por <span class="mono">AIza…</span>).</li>
                    <li>Guárdala como secreto del proyecto en Supabase:</li>
                </ol>
                <div class="copy-field mt" style="margin-left:18px">
                    <input type="text" readonly value="supabase secrets set GEMINI_API_KEY=TU_CLAVE">
                    <button class="btn btn-ghost btn-sm" data-copiar="supabase secrets set GEMINI_API_KEY=TU_CLAVE">Copiar</button>
                </div>
                <p class="tiny muted mt" style="margin-left:18px">O desde el panel de Supabase: Edge Functions → asistente → Secrets.
                Los pasos completos están en <a href="https://github.com/alexestepagallego/puntozero-crm/blob/main/docs/ASISTENTE-IA.md" target="_blank" rel="noopener">la guía</a>.</p>
                <div class="row mt">
                    <button class="btn btn-ghost btn-sm" data-probar-ia>Probar el asistente</button>
                </div>
            </div>

            <div class="card">
                <div class="card-head"><h2>Avisos</h2></div>
                <p class="small muted">El panel de inicio ya te enseña todo lo que vence en 30 días cada vez que entras.
                Además puedes llevarte los vencimientos a tu calendario y recibirlos por email.</p>
                <div class="row wrap mt">
                    <button class="btn btn-ghost btn-sm" data-ics>${raw(ico('calendario', 14))} Descargar calendario (.ics)</button>
                    <a class="btn btn-ghost btn-sm" href="https://github.com/alexestepagallego/puntozero-crm/blob/main/docs/AVISOS-POR-EMAIL.md" rel="noopener" target="_blank">Activar el email semanal</a>
                </div>
                <p class="tiny muted mt">El .ics se importa en Google Calendar, Apple Calendario u Outlook y avisa 7 días antes.</p>
            </div>

            <div class="card">
                <div class="card-head"><h2>Copia de seguridad</h2></div>
                <p class="small muted">Descarga todo lo que hay en el CRM en un único archivo. Guárdalo de vez en cuando.</p>
                <div class="row wrap mt">
                    <button class="btn btn-ghost btn-sm" data-exportar>Descargar copia (.json)</button>
                    ${raw(esLocal() ? '<label class="btn btn-ghost btn-sm">Restaurar copia<input type="file" id="importar" accept="application/json" class="hidden"></label>' : '')}
                </div>
            </div>

            <div class="card">
                <div class="card-head"><h2>Datos de ejemplo</h2></div>
                <p class="small muted">Tres clientes de mentira para ver el CRM lleno. Se borran de un clic sin tocar lo tuyo.</p>
                <div class="row wrap mt">
                    ${raw(hayEjemplos()
                        ? '<button class="btn btn-danger btn-sm" data-borrar-demo>Borrar datos de ejemplo</button>'
                        : '<button class="btn btn-ghost btn-sm" data-cargar-demo>Cargar datos de ejemplo</button>')}
                </div>
            </div>

            <div class="card">
                <div class="card-head"><h2>Tu empresa</h2></div>
                <div class="grid-2">
                    <div class="field"><label>Nombre</label><p class="small">${CONFIG.EMPRESA}</p></div>
                    <div class="field"><label>Web</label><p class="small">${CONFIG.EMPRESA_WEB}</p></div>
                    <div class="field"><label>Email de contacto</label><p class="small">${CONFIG.EMPRESA_EMAIL}</p></div>
                    <div class="field"><label>IVA por defecto</label><p class="small">${CONFIG.IVA_DEFECTO} %</p></div>
                </div>
                <p class="tiny muted">Se cambian en el archivo <span class="mono">js/config.js</span>.</p>
            </div>

            ${raw(esLocal() ? html`
                <div class="card">
                    <div class="card-head"><h2>Zona peligrosa</h2></div>
                    <p class="small muted">Borra absolutamente todo lo guardado en este navegador.</p>
                    <button class="btn btn-danger btn-sm mt" data-vaciar>Vaciar el CRM</button>
                </div>` : '')}
        </div>`;

    on(raiz, 'click', '[data-conexion]', () => abrirConexion());
    on(raiz, 'click', '[data-probar-ia]', () => {
        if (esLocal()) return toast('Primero conecta Supabase', 'bad');
        import('./asistente.js').then(m => m.alternarAsistente());
    });

    on(raiz, 'click', '[data-ics]', () => {
        const eventos = eventosCalendario();
        if (!eventos.length) return toast('No hay vencimientos que exportar');
        descargarICS(eventos);
        toast(`${eventos.length} vencimientos exportados`);
    });

    on(raiz, 'click', '[data-exportar]', async () => {
        const copia = await adaptador.exportar();
        descargar(new Blob([JSON.stringify(copia, null, 2)], { type: 'application/json' }),
            `puntozero-crm-${new Date().toISOString().slice(0, 10)}.json`);
        toast('Copia descargada');
    });

    raiz.querySelector('#importar')?.addEventListener('change', async (ev) => {
        const fichero = ev.target.files?.[0];
        if (!fichero) return;
        if (!await confirmar('La copia reemplazará todo lo que hay ahora en este navegador. ¿Continuar?')) return;
        try {
            await adaptador.importar(JSON.parse(await fichero.text()));
            toast('Copia restaurada');
            refrescar();   // la copia cambia todo de golpe: hay que releer
        } catch {
            toast('El archivo no es una copia válida', 'bad');
        }
    });

    on(raiz, 'click', '[data-cargar-demo]', async () => {
        await cargarEjemplos();
        toast('Datos de ejemplo cargados');
        repintar();
    });

    on(raiz, 'click', '[data-borrar-demo]', async () => {
        if (!await confirmar('Se eliminarán solo los clientes y proyectos de ejemplo.')) return;
        await borrarEjemplos();
        toast('Datos de ejemplo borrados');
        repintar();
    });

    on(raiz, 'click', '[data-vaciar]', async () => {
        if (!await confirmar('Se borrará TODO el CRM de este navegador. Descarga antes una copia si te interesa.',
            { textoOk: 'Borrar todo' })) return;
        await adaptador.vaciar();
        location.reload();
    });
}
