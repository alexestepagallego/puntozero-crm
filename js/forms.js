/**
 * Definición de los formularios de alta y edición.
 * Un único sitio donde están los campos de cada ficha, para que las vistas
 * solo tengan que decir "abre el formulario de pago con estos valores".
 */
import { CONFIG } from './config.js';
import { formulario, toast, hoyISO } from './util.js';
import {
    cache, crear, editar, crearProyecto, FASES, TIPOS_PROYECTO,
    PERIODICIDADES, ESTADOS_LEAD, TIPOS_ACCESO,
} from './data/index.js';
import { repintar } from './estado.js';
import { sesion } from './auth.js';

const opcionesClientes = () => cache.clientes
    .slice().sort((a, b) => (a.empresa || a.nombre).localeCompare(b.empresa || b.nombre))
    .map(c => [c.id, c.empresa || c.nombre]);

const opcionesProyectos = () => cache.proyectos
    .map(p => [p.id, `${p.nombre} · ${cache.clientes.find(c => c.id === p.cliente_id)?.empresa || ''}`]);

const IMPUESTOS = [
    { name: 'iva_pct', label: 'IVA (%)', tipo: 'number', paso: '0.01', mitad: true, valor: CONFIG.IVA_DEFECTO },
    { name: 'irpf_pct', label: 'Retención IRPF (%)', tipo: 'number', paso: '0.01', mitad: true, valor: CONFIG.IRPF_DEFECTO },
];

export const FICHAS = {
    cliente: {
        tabla: 'clientes',
        titulo: 'cliente',
        campos: () => [
            { name: 'empresa', label: 'Negocio o empresa', requerido: true, placeholder: 'Pizza José Villegas' },
            { name: 'nombre', label: 'Persona de contacto', mitad: true, placeholder: 'José Villegas' },
            { name: 'telefono', label: 'Teléfono', tipo: 'tel', mitad: true, placeholder: '600 00 00 00' },
            { name: 'email', label: 'Email', tipo: 'email', mitad: true, pista: 'Con este correo entrará al portal' },
            { name: 'nif', label: 'NIF / CIF', mitad: true },
            { name: 'direccion', label: 'Dirección', mitad: true },
            { name: 'estado', label: 'Estado', tipo: 'select', mitad: true, valor: 'activo',
              opciones: [['activo', 'Activo'], ['potencial', 'Potencial'], ['inactivo', 'Inactivo']] },
            { name: 'notas', label: 'Notas internas', tipo: 'textarea', filas: 3 },
        ],
    },

    proyecto: {
        tabla: 'proyectos',
        titulo: 'proyecto',
        campos: () => [
            { name: 'nombre', label: 'Nombre del proyecto', requerido: true, placeholder: 'Landing + carta digital' },
            { name: 'cliente_id', label: 'Cliente', tipo: 'select', requerido: true, opciones: opcionesClientes(), vacio: 'Elige cliente…' },
            { name: 'tipo', label: 'Tipo', tipo: 'select', mitad: true, opciones: TIPOS_PROYECTO, valor: 'Landing' },
            { name: 'estado', label: 'Fase', tipo: 'select', mitad: true, opciones: FASES, valor: 'Presupuesto' },
            { name: 'descripcion', label: 'Descripción', tipo: 'textarea', filas: 3 },
            { separador: 'Presupuesto' },
            { name: 'precio_base', label: 'Precio (base imponible)', tipo: 'number', mitad: true, paso: '0.01', min: 0 },
            { name: 'iva_pct', label: 'IVA (%)', tipo: 'number', mitad: true, paso: '0.01', valor: CONFIG.IVA_DEFECTO },
            { name: 'irpf_pct', label: 'Retención IRPF (%)', tipo: 'number', mitad: true, paso: '0.01', valor: CONFIG.IRPF_DEFECTO },
            { name: 'presupuesto_notas', label: 'Qué incluye el precio', tipo: 'textarea', filas: 2,
              pista: 'Lo que le dijiste al cliente, para no depender de la memoria' },
            { separador: 'Fechas' },
            { name: 'fecha_inicio', label: 'Inicio', tipo: 'date', mitad: true, valor: hoyISO() },
            { name: 'fecha_entrega', label: 'Entrega prevista', tipo: 'date', mitad: true },
        ],
    },

    pago: {
        tabla: 'pagos',
        titulo: 'pago',
        campos: () => [
            { name: 'concepto', label: 'Concepto', requerido: true, placeholder: 'Señal 50 % landing' },
            { name: 'cliente_id', label: 'Cliente', tipo: 'select', requerido: true, opciones: opcionesClientes(), vacio: 'Elige cliente…' },
            { name: 'proyecto_id', label: 'Proyecto (opcional)', tipo: 'select', opciones: opcionesProyectos(), vacio: 'Sin proyecto' },
            { name: 'importe', label: 'Importe (base)', tipo: 'number', requerido: true, mitad: true, paso: '0.01' },
            { name: 'metodo', label: 'Método', tipo: 'select', mitad: true, valor: 'Transferencia',
              opciones: ['Transferencia', 'Bizum', 'Efectivo', 'Tarjeta', 'Otro'] },
            ...IMPUESTOS,
            { name: 'fecha_vencimiento', label: 'Vence el', tipo: 'date', mitad: true, valor: hoyISO() },
            { name: 'fecha_pago', label: 'Cobrado el', tipo: 'date', mitad: true },
            { name: 'estado', label: 'Estado', tipo: 'select', valor: 'pendiente',
              opciones: [['pendiente', 'Pendiente'], ['pagado', 'Pagado']] },
            { name: 'notas', label: 'Notas', tipo: 'textarea', filas: 2 },
        ],
    },

    suscripcion: {
        tabla: 'suscripciones',
        titulo: 'cuota',
        campos: () => [
            { name: 'concepto', label: 'Concepto', requerido: true, placeholder: 'Mantenimiento carta digital' },
            { name: 'cliente_id', label: 'Cliente', tipo: 'select', requerido: true, opciones: opcionesClientes(), vacio: 'Elige cliente…' },
            { name: 'proyecto_id', label: 'Proyecto (opcional)', tipo: 'select', opciones: opcionesProyectos(), vacio: 'Sin proyecto' },
            { name: 'importe', label: 'Importe por cobro', tipo: 'number', requerido: true, mitad: true, paso: '0.01' },
            { name: 'iva_pct', label: 'IVA (%)', tipo: 'number', mitad: true, paso: '0.01', valor: CONFIG.IVA_DEFECTO },
            { name: 'periodicidad', label: 'Cada cuánto', tipo: 'select', requerido: true, mitad: true, opciones: PERIODICIDADES, valor: 'anual' },
            { name: 'proxima_fecha', label: 'Próximo cobro', tipo: 'date', requerido: true, mitad: true, valor: hoyISO() },
            { name: 'activa', label: 'Cuota activa', tipo: 'check', valor: true },
            { name: 'notas', label: 'Notas', tipo: 'textarea', filas: 2 },
        ],
    },

    dominio: {
        tabla: 'dominios',
        titulo: 'dominio',
        campos: () => [
            { name: 'dominio', label: 'Dominio', requerido: true, placeholder: 'micliente.es' },
            { name: 'cliente_id', label: 'Cliente', tipo: 'select', requerido: true, opciones: opcionesClientes(), vacio: 'Elige cliente…' },
            { name: 'proyecto_id', label: 'Proyecto (opcional)', tipo: 'select', opciones: opcionesProyectos(), vacio: 'Sin proyecto' },
            { name: 'registrador', label: 'Registrador', mitad: true, placeholder: 'IONOS, Dondominio…' },
            { name: 'coste', label: 'Coste anual', tipo: 'number', mitad: true, paso: '0.01' },
            { name: 'fecha_renovacion', label: 'Se renueva el', tipo: 'date', requerido: true, mitad: true },
            { name: 'auto_renueva', label: 'Renovación automática activada', tipo: 'check' },
            { name: 'notas', label: 'Notas', tipo: 'textarea', filas: 2, pista: '¿Quién paga? ¿A nombre de quién está?' },
        ],
    },

    acceso: {
        tabla: 'accesos',
        titulo: 'acceso',
        campos: () => [
            { name: 'titulo', label: 'Título', requerido: true, placeholder: 'Panel de hosting' },
            { name: 'tipo', label: 'Tipo', tipo: 'select', opciones: TIPOS_ACCESO, valor: 'Hosting' },
            { name: 'cliente_id', label: 'Cliente', tipo: 'select', requerido: true, opciones: opcionesClientes(), vacio: 'Elige cliente…' },
            { name: 'proyecto_id', label: 'Proyecto (opcional)', tipo: 'select', opciones: opcionesProyectos(), vacio: 'Sin proyecto' },
            { name: 'url', label: 'Enlace', tipo: 'url', placeholder: 'https://…' },
            { name: 'usuario', label: 'Usuario / cuenta', pista: 'No guardes contraseñas aquí: usa un gestor de claves' },
            { name: 'notas', label: 'Notas', tipo: 'textarea', filas: 2 },
        ],
    },

    servicio: {
        tabla: 'servicios',
        titulo: 'servicio',
        campos: () => [
            { name: 'nombre', label: 'Servicio', requerido: true, placeholder: 'Carta digital QR' },
            { name: 'descripcion', label: 'Qué incluye', tipo: 'textarea', filas: 3 },
            { name: 'precio', label: 'Precio de referencia', tipo: 'number', requerido: true, mitad: true, paso: '0.01' },
            { name: 'unidad', label: 'Cobro', tipo: 'select', mitad: true, valor: 'único',
              opciones: [['único', 'Pago único'], ['mensual', 'Mensual'], ['trimestral', 'Trimestral'], ['anual', 'Anual']] },
        ],
    },

    nota: {
        tabla: 'notas',
        titulo: 'nota',
        campos: () => [
            { name: 'texto', label: 'Qué ha pasado', tipo: 'textarea', requerido: true, filas: 4,
              placeholder: 'Le he dicho 450 € IVA incluido, con carta y QR…' },
            { name: 'cliente_id', label: 'Cliente', tipo: 'select', requerido: true, opciones: opcionesClientes(), vacio: 'Elige cliente…' },
            { name: 'proyecto_id', label: 'Proyecto (opcional)', tipo: 'select', opciones: opcionesProyectos(), vacio: 'Sin proyecto' },
            { name: 'fecha', label: 'Fecha', tipo: 'date', mitad: true, valor: hoyISO() },
            { name: 'autor', label: 'Quién lo anota', mitad: true, valor: sesion.nombre },
        ],
    },

    lead: {
        tabla: 'leads',
        titulo: 'oportunidad',
        campos: () => [
            { name: 'nombre', label: 'Negocio', requerido: true, placeholder: 'Peluquería Gala' },
            { name: 'contacto', label: 'Contacto', mitad: true },
            { name: 'telefono', label: 'Teléfono', tipo: 'tel', mitad: true },
            { name: 'email', label: 'Email', tipo: 'email', mitad: true },
            { name: 'origen', label: 'De dónde sale', mitad: true, placeholder: 'Instagram, recomendación…' },
            { name: 'estado', label: 'Estado', tipo: 'select', mitad: true, opciones: ESTADOS_LEAD, valor: 'interesado' },
            { name: 'valor_estimado', label: 'Valor estimado', tipo: 'number', mitad: true, paso: '0.01' },
            { name: 'fecha', label: 'Primer contacto', tipo: 'date', valor: hoyISO() },
            { name: 'notas', label: 'Notas', tipo: 'textarea', filas: 3 },
        ],
    },

    tarjeta: {
        tabla: 'tarjetas',
        titulo: 'tarea',
        campos: () => [
            { name: 'titulo', label: 'Tarea', requerido: true, placeholder: 'Maquetar sección de menú' },
            { name: 'descripcion', label: 'Detalle', tipo: 'textarea', filas: 3 },
            { name: 'etiqueta', label: 'Etiqueta', tipo: 'select', vacio: 'Sin etiqueta',
              opciones: ['Diseño', 'Desarrollo', 'Contenido', 'Cliente', 'Técnico', 'Comercial'] },
            { name: 'vence', label: 'Fecha límite', tipo: 'date', mitad: true },
            { name: 'visible_cliente', label: 'Visible para el cliente', tipo: 'check', valor: true,
              pista: 'Si lo desmarcas, la tarea solo la veis vosotros' },
        ],
    },
};

/**
 * Abre el formulario de una ficha. Si `valores.id` existe, edita; si no, crea.
 * `fijos` son valores que no se piden (por ejemplo el proyecto desde su tablero).
 */
export function abrirFicha(tipo, { valores = {}, fijos = {}, alTerminar } = {}) {
    const ficha = FICHAS[tipo];
    if (!ficha) throw new Error(`Ficha desconocida: ${tipo}`);

    const editando = Boolean(valores.id);
    const campos = ficha.campos().filter(c => c.separador || !(c.name in fijos));

    // Los valores por defecto solo se aplican al crear.
    const iniciales = { ...valores };
    if (!editando) {
        for (const c of campos) {
            if (c.separador || iniciales[c.name] !== undefined) continue;
            if (c.valor !== undefined) iniciales[c.name] = c.valor;
        }
    }

    return formulario({
        titulo: `${editando ? 'Editar' : 'Nuev' + (['nota', 'cuota', 'tarea', 'oportunidad'].includes(ficha.titulo) ? 'a' : 'o')} ${ficha.titulo}`,
        campos,
        valores: iniciales,
        textoOk: editando ? 'Guardar cambios' : 'Crear',
        onGuardar: async (datos) => {
            const fila = { ...datos, ...fijos };
            let resultado;
            if (editando) {
                resultado = await editar(ficha.tabla, valores.id, fila);
                toast('Cambios guardados');
            } else if (tipo === 'proyecto') {
                resultado = await crearProyecto(fila);
                toast('Proyecto creado con su tablero');
            } else {
                resultado = await crear(ficha.tabla, fila);
                toast('Creado');
            }
            if (alTerminar) await alTerminar(resultado);
            else await repintar();
        },
    });
}
