/**
 * Capa de datos del CRM: elige adaptador (nube o local), guarda una copia en
 * memoria para que las vistas pinten rápido y expone las reglas de negocio
 * (fases, alertas, totales).
 */
import { modo } from '../config.js';
import { adaptadorLocal } from './local.js';
import { adaptadorSupabase } from './supabase.js';
import { diasHasta, sumarPeriodo, uuid, token, hoyISO } from '../util.js';

/* ------------------------------------------------------------ CATÁLOGOS -- */

export const FASES = ['Presupuesto', 'Diseño', 'Desarrollo', 'Revisión', 'Publicado', 'Mantenimiento'];

export const TIPOS_PROYECTO = [
    'Landing', 'Carta digital QR', 'Web a medida', 'E-commerce',
    'Impresión 3D', 'Mantenimiento', 'Otro',
];

export const COLUMNAS_DEFECTO = ['Por hacer', 'En curso', 'En revisión', 'Hecho'];

export const PERIODICIDADES = [
    ['mensual', 'Mensual'], ['bimestral', 'Bimestral'], ['trimestral', 'Trimestral'],
    ['semestral', 'Semestral'], ['anual', 'Anual'],
];

export const ESTADOS_LEAD = [
    ['interesado', 'Interesado'], ['contactado', 'Contactado'],
    ['presupuesto', 'Presupuesto enviado'], ['ganado', 'Ganado'], ['perdido', 'Perdido'],
];

export const TIPOS_ACCESO = [
    'Dominio', 'Hosting', 'Repositorio', 'Carta digital', 'Panel de administración',
    'Google Business', 'Redes sociales', 'Correo', 'Otro',
];

/* ------------------------------------------------------------ ADAPTADOR -- */

export let adaptador = modo() === 'supabase' ? adaptadorSupabase : adaptadorLocal;

export function recargarAdaptador() {
    adaptador = modo() === 'supabase' ? adaptadorSupabase : adaptadorLocal;
    return adaptador;
}

export const esLocal = () => adaptador.modo === 'local';

/* --------------------------------------------------------------- CACHÉ --- */

const TABLAS = ['clientes', 'proyectos', 'columnas', 'tarjetas', 'pagos', 'suscripciones',
    'dominios', 'accesos', 'servicios', 'notas', 'leads', 'archivos'];

export const cache = Object.fromEntries(TABLAS.map(t => [t, []]));

/**
 * Quién se entera de que una carga ha fallado. Antes los errores se tragaban en
 * silencio y el CRM se quedaba vacío sin decir nada: parecía que no funcionaba
 * nada cuando en realidad era la sesión caducada o la conexión.
 */
let avisarDeFallos = () => {};
export function alFallarLaCarga(fn) { avisarDeFallos = fn; }

/** Recarga de la base todo lo que el usuario actual tenga permiso de ver. */
export async function cargarTodo() {
    const fallos = [];
    const resultados = await Promise.all(TABLAS.map(async (tabla) => {
        try {
            return await adaptador.list(tabla);
        } catch (e) {
            fallos.push({ tabla, mensaje: e.message });
            return null;   // null = no tocar lo que ya había en memoria
        }
    }));

    TABLAS.forEach((t, i) => { if (resultados[i]) cache[t] = resultados[i]; });
    if (fallos.length) avisarDeFallos(fallos);
    return cache;
}

export async function recargar(tabla) {
    cache[tabla] = await adaptador.list(tabla);
    return cache[tabla];
}

/* -------------------------------------------------- OPERACIONES DE ALTO NIVEL */

export async function crear(tabla, fila) {
    const limpia = { ...fila };
    delete limpia.id_temporal;             // nunca es una columna real
    const nueva = await adaptador.insert(tabla, limpia);
    cache[tabla].push(nueva);
    return nueva;
}

export async function editar(tabla, id, parche) {
    const limpio = { ...parche };
    delete limpio.id_temporal;
    const fila = await adaptador.update(tabla, id, limpio);
    const i = cache[tabla].findIndex(f => String(f.id) === String(id));
    if (i !== -1) cache[tabla][i] = fila ?? { ...cache[tabla][i], ...limpio };
    return cache[tabla][i];
}

export async function borrar(tabla, id) {
    await adaptador.remove(tabla, id);
    cache[tabla] = cache[tabla].filter(f => String(f.id) !== String(id));
}

/** Crea un proyecto con su tablero inicial y su enlace secreto. */
export async function crearProyecto(datos) {
    const proyecto = await crear('proyectos', {
        estado: 'Presupuesto',
        progreso: 0,
        token_acceso: token(10),
        ...datos,
    });
    const columnas = COLUMNAS_DEFECTO.map((nombre, i) => ({
        id: uuid(), proyecto_id: proyecto.id, nombre, orden: i,
    }));
    const creadas = await adaptador.insertMany('columnas', columnas);
    cache.columnas.push(...creadas);
    return proyecto;
}

/** Borra un proyecto y todo lo que cuelga de él. */
export async function borrarProyecto(id) {
    for (const tabla of ['tarjetas', 'columnas', 'pagos', 'suscripciones', 'dominios', 'accesos', 'notas', 'archivos']) {
        await adaptador.removeWhere(tabla, { proyecto_id: id }).catch(() => {});
        cache[tabla] = cache[tabla].filter(f => String(f.proyecto_id) !== String(id));
    }
    await borrar('proyectos', id);
}

/** Borra un cliente con todos sus proyectos. */
export async function borrarCliente(id) {
    for (const p of cache.proyectos.filter(p => String(p.cliente_id) === String(id))) {
        await borrarProyecto(p.id);
    }
    for (const tabla of ['pagos', 'suscripciones', 'dominios', 'accesos', 'notas', 'archivos']) {
        await adaptador.removeWhere(tabla, { cliente_id: id }).catch(() => {});
        cache[tabla] = cache[tabla].filter(f => String(f.cliente_id) !== String(id));
    }
    await borrar('clientes', id);
}

/** Marca un pago como cobrado. */
export async function marcarPagado(pago) {
    return editar('pagos', pago.id, { estado: 'pagado', fecha_pago: hoyISO() });
}

/** Renueva una suscripción: registra el cobro y adelanta la próxima fecha. */
export async function renovarSuscripcion(suscripcion) {
    await crear('pagos', {
        cliente_id: suscripcion.cliente_id,
        proyecto_id: suscripcion.proyecto_id,
        concepto: `${suscripcion.concepto} (${suscripcion.periodicidad})`,
        importe: suscripcion.importe,
        iva_pct: suscripcion.iva_pct ?? 0,
        irpf_pct: 0,
        fecha_vencimiento: suscripcion.proxima_fecha,
        fecha_pago: hoyISO(),
        estado: 'pagado',
        notas: 'Generado al renovar la cuota',
    });
    return editar('suscripciones', suscripcion.id, {
        proxima_fecha: sumarPeriodo(suscripcion.proxima_fecha, suscripcion.periodicidad),
    });
}

/* ---------------------------------------------------------- CONSULTAS ---- */

export const cliente = (id) => cache.clientes.find(c => String(c.id) === String(id));
export const proyecto = (id) => cache.proyectos.find(p => String(p.id) === String(id));
export const proyectosDe = (clienteId) => cache.proyectos.filter(p => String(p.cliente_id) === String(clienteId));
export const deProyecto = (tabla, proyectoId) => cache[tabla].filter(f => String(f.proyecto_id) === String(proyectoId));
export const deCliente = (tabla, clienteId) => cache[tabla].filter(f => String(f.cliente_id) === String(clienteId));

export function nombreCliente(id) {
    const c = cliente(id);
    return c ? (c.empresa || c.nombre) : 'Sin cliente';
}

/** Progreso del proyecto: porcentaje de tarjetas completadas. */
export function progreso(proyectoId) {
    const tarjetas = deProyecto('tarjetas', proyectoId);
    if (!tarjetas.length) {
        const p = proyecto(proyectoId);
        const i = FASES.indexOf(p?.estado);
        return i <= 0 ? 0 : Math.round((i / (FASES.length - 1)) * 100);
    }
    const hechas = tarjetas.filter(t => t.completada).length;
    return Math.round((hechas / tarjetas.length) * 100);
}

/** Resumen económico de un cliente o de todo el negocio. */
export function balance(clienteId = null) {
    const suyo = (f) => !clienteId || String(f.cliente_id) === String(clienteId);
    const pagos = cache.pagos.filter(suyo);
    const cobrado = pagos.filter(p => p.estado === 'pagado').reduce((s, p) => s + (Number(p.importe) || 0), 0);
    const pendiente = pagos.filter(p => p.estado !== 'pagado').reduce((s, p) => s + (Number(p.importe) || 0), 0);
    const vencido = pagos
        .filter(p => p.estado !== 'pagado' && diasHasta(p.fecha_vencimiento) < 0)
        .reduce((s, p) => s + (Number(p.importe) || 0), 0);

    const recurrenteAnual = cache.suscripciones.filter(s => suyo(s) && s.activa !== false)
        .reduce((s, sub) => {
            const vecesAlAno = { mensual: 12, bimestral: 6, trimestral: 4, semestral: 2, anual: 1 }[sub.periodicidad] ?? 1;
            return s + (Number(sub.importe) || 0) * vecesAlAno;
        }, 0);

    return { cobrado, pendiente, vencido, recurrenteAnual };
}

/* ----------------------------------------------------------- ALERTAS ----- */

/**
 * Todo lo que vence pronto o ya venció, ordenado por urgencia.
 * Devuelve objetos { tipo, nivel, titulo, detalle, fecha, ruta }.
 */
export function alertas({ dias = 30, incluirLejanas = false } = {}) {
    const salida = [];
    const nivel = (d) => (d < 0 ? 'bad' : d <= 7 ? 'warn' : 'info');

    for (const d of cache.dominios) {
        const q = diasHasta(d.fecha_renovacion);
        if (q === null || (!incluirLejanas && q > dias)) continue;
        salida.push({
            tipo: 'dominio', nivel: nivel(q), fecha: d.fecha_renovacion, dias: q,
            titulo: `Renovar dominio ${d.dominio}`,
            detalle: `${nombreCliente(d.cliente_id)}${d.registrador ? ` · ${d.registrador}` : ''}`,
            ruta: '#/dominios', id: `dom-${d.id}`,
        });
    }

    for (const s of cache.suscripciones) {
        if (s.activa === false) continue;
        const q = diasHasta(s.proxima_fecha);
        if (q === null || (!incluirLejanas && q > dias)) continue;
        salida.push({
            tipo: 'cuota', nivel: nivel(q), fecha: s.proxima_fecha, dias: q,
            titulo: `Cobrar ${s.concepto}`,
            detalle: `${nombreCliente(s.cliente_id)} · ${s.periodicidad}`,
            ruta: '#/cuotas', id: `sus-${s.id}`,
        });
    }

    for (const p of cache.pagos) {
        if (p.estado === 'pagado') continue;
        const q = diasHasta(p.fecha_vencimiento);
        if (q === null || (!incluirLejanas && q > dias)) continue;
        salida.push({
            tipo: 'pago', nivel: nivel(q), fecha: p.fecha_vencimiento, dias: q,
            titulo: `Pago pendiente: ${p.concepto}`,
            detalle: nombreCliente(p.cliente_id),
            ruta: '#/pagos', id: `pag-${p.id}`,
        });
    }

    for (const p of cache.proyectos) {
        if (['Publicado', 'Mantenimiento'].includes(p.estado)) continue;
        const q = diasHasta(p.fecha_entrega);
        if (q === null || (!incluirLejanas && q > dias)) continue;
        salida.push({
            tipo: 'entrega', nivel: nivel(q), fecha: p.fecha_entrega, dias: q,
            titulo: `Entrega de ${p.nombre}`,
            detalle: `${nombreCliente(p.cliente_id)} · ${p.estado}`,
            ruta: `#/proyecto/${p.id}`, id: `pro-${p.id}`,
        });
    }

    for (const t of cache.tarjetas) {
        if (t.completada || !t.vence) continue;
        const q = diasHasta(t.vence);
        if (q === null || q > 7) continue;
        salida.push({
            tipo: 'tarea', nivel: nivel(q), fecha: t.vence, dias: q,
            titulo: `Tarea: ${t.titulo}`,
            detalle: proyecto(t.proyecto_id)?.nombre || '',
            ruta: `#/proyecto/${t.proyecto_id}`, id: `tar-${t.id}`,
        });
    }

    return salida.sort((a, b) => (a.dias ?? 999) - (b.dias ?? 999));
}

/** Los mismos vencimientos, en formato apto para el calendario. */
export function eventosCalendario() {
    return alertas({ incluirLejanas: true }).map(a => ({
        id: a.id,
        fecha: a.fecha,
        titulo: `[PuntoZero] ${a.titulo}`,
        descripcion: a.detalle,
    }));
}

/* ====================================================== ASISTENTE (IA) ==== */

/** Tablas que el asistente puede tocar. Fuera de aquí, no se ejecuta nada. */
const TABLAS_IA = new Set([
    'clientes', 'proyectos', 'pagos', 'suscripciones', 'dominios',
    'accesos', 'servicios', 'notas', 'leads', 'tarjetas',
]);

/**
 * Foto compacta de los datos para que el asistente sepa a qué te refieres.
 * Solo lo justo: nombres, ids y campos clave. No viajan notas internas largas.
 */
export function fotoParaIA() {
    const cli = cache.clientes.map(c => ({
        id: c.id, empresa: c.empresa, nombre: c.nombre, telefono: c.telefono,
        email: c.email, estado: c.estado,
    }));
    const pro = cache.proyectos.map(p => ({
        id: p.id, cliente_id: p.cliente_id, nombre: p.nombre, tipo: p.tipo,
        estado: p.estado, precio_base: p.precio_base, fecha_entrega: p.fecha_entrega,
    }));
    const pag = cache.pagos.map(p => ({
        id: p.id, cliente_id: p.cliente_id, proyecto_id: p.proyecto_id,
        concepto: p.concepto, importe: p.importe, estado: p.estado,
        fecha_vencimiento: p.fecha_vencimiento,
    }));
    const sus = cache.suscripciones.map(s => ({
        id: s.id, cliente_id: s.cliente_id, concepto: s.concepto, importe: s.importe,
        periodicidad: s.periodicidad, proxima_fecha: s.proxima_fecha, activa: s.activa,
    }));
    const dom = cache.dominios.map(d => ({
        id: d.id, cliente_id: d.cliente_id, dominio: d.dominio,
        fecha_renovacion: d.fecha_renovacion, coste: d.coste,
    }));
    const ser = cache.servicios.map(s => ({ id: s.id, nombre: s.nombre, precio: s.precio, unidad: s.unidad }));
    // Columnas por proyecto, para poder añadir tareas al tablero.
    const col = cache.columnas.map(c => ({ id: c.id, proyecto_id: c.proyecto_id, nombre: c.nombre }));
    const lea = cache.leads.map(l => ({ id: l.id, nombre: l.nombre, estado: l.estado, valor_estimado: l.valor_estimado }));

    return JSON.stringify({
        clientes: cli, proyectos: pro, pagos: pag, suscripciones: sus,
        dominios: dom, servicios: ser, columnas: col, leads: lea,
    });
}

/** Envía una orden al asistente y devuelve { respuesta, acciones }. */
export async function preguntarAsistente(mensaje, historial = []) {
    if (esLocal()) {
        throw new Error('El asistente necesita la base de datos en la nube (Supabase).');
    }
    return adaptador.funcion('asistente', {
        mensaje,
        foto: fotoParaIA(),
        historial,
    });
}

/**
 * Ejecuta UNA acción propuesta por el asistente, por el camino de siempre
 * (con permisos y validaciones). Devuelve un texto de lo que hizo.
 */
export async function ejecutarAccion(accion) {
    const { operacion, tabla, id, datos } = accion || {};
    if (!TABLAS_IA.has(tabla)) throw new Error(`El asistente no puede tocar la tabla "${tabla}"`);

    if (operacion === 'crear') {
        const fila = tabla === 'proyectos' ? await crearProyecto(datos) : await crear(tabla, datos);
        return { texto: tabla === 'proyectos' ? 'Proyecto creado con su tablero' : 'Creado', fila };
    }
    if (operacion === 'editar') {
        if (!id) throw new Error('Falta el identificador para editar');
        const fila = await editar(tabla, id, datos);
        return { texto: 'Cambios guardados', fila };
    }
    if (operacion === 'borrar') {
        if (!id) throw new Error('Falta el identificador para borrar');
        if (tabla === 'clientes') { await borrarCliente(id); return { texto: 'Cliente eliminado' }; }
        if (tabla === 'proyectos') { await borrarProyecto(id); return { texto: 'Proyecto eliminado' }; }
        await borrar(tabla, id);
        return { texto: 'Eliminado' };
    }
    throw new Error(`Operación desconocida: ${operacion}`);
}

/**
 * Aplica en orden una tanda de acciones del asistente, enlazando las
 * creaciones encadenadas: si una acción crea un cliente con "id_temporal" y otra
 * lo referencia (cliente_id / proyecto_id), se sustituye por el id real. Como
 * red de seguridad, si un proyecto/pago apunta a un cliente que no existe pero
 * en esta misma tanda se acaba de crear justo uno, se enlaza con ese.
 */
export async function ejecutarAcciones(acciones) {
    const mapa = {};                 // id_temporal → id real
    let ultimoCliente = null;        // último cliente creado en la tanda
    let ultimoProyecto = null;
    const hechas = [];

    const existe = (tabla, id) => cache[tabla]?.some(f => String(f.id) === String(id));

    for (const accion of acciones) {
        const datos = { ...(accion.datos || {}) };
        delete datos.id_temporal;              // por si acaso viniera dentro
        const temporal = accion.id_temporal || null;

        // Resolver referencias a cosas creadas en esta misma tanda.
        for (const [campo, tabla, ultimo] of [
            ['cliente_id', 'clientes', () => ultimoCliente],
            ['proyecto_id', 'proyectos', () => ultimoProyecto],
        ]) {
            if (!datos[campo]) continue;
            if (mapa[datos[campo]]) datos[campo] = mapa[datos[campo]];
            else if (!existe(tabla, datos[campo]) && ultimo()) datos[campo] = ultimo();
        }

        // El id de la propia acción (editar/borrar) también puede ser temporal.
        let id = accion.id;
        if (id && mapa[id]) id = mapa[id];

        const res = await ejecutarAccion({ ...accion, id, datos });
        hechas.push(res?.texto || 'Hecho');

        if (accion.operacion === 'crear' && res?.fila?.id) {
            if (temporal) mapa[temporal] = res.fila.id;
            if (accion.tabla === 'clientes') ultimoCliente = res.fila.id;
            if (accion.tabla === 'proyectos') ultimoProyecto = res.fila.id;
        }
    }
    return hechas;
}
