/**
 * Datos de ejemplo para ver el CRM lleno desde el primer minuto.
 * Se cargan bajo demanda y se pueden borrar de golpe desde Ajustes:
 * todas las filas llevan la marca `demo: true`.
 */
import { adaptador, cache, COLUMNAS_DEFECTO, cargarTodo } from './index.js';
import { uuid, token } from '../util.js';

/** Fecha ISO desplazada N días respecto a hoy. */
function dia(desplazamiento) {
    const f = new Date();
    f.setDate(f.getDate() + desplazamiento);
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
}

export async function cargarEjemplos() {
    const idPizza = uuid(), idJuana = uuid(), idBocateria = uuid();

    const clientes = [
        {
            id: idPizza, demo: true, nombre: 'José Villegas', empresa: 'Pizza José Villegas',
            email: 'pizzajosevillegas@example.com', telefono: '600 11 22 33', nif: 'B10000001',
            direccion: 'Córdoba', estado: 'activo',
            notas: 'Pizzería del barrio. Quiere renovar la carta cada temporada.',
        },
        {
            id: idJuana, demo: true, nombre: 'Juana Ruiz', empresa: 'La Juana',
            email: 'lajuana@example.com', telefono: '600 44 55 66', nif: 'B10000002',
            direccion: 'Córdoba', estado: 'activo',
            notas: 'Carta digital publicada. Muy contenta, posible ampliación a reservas.',
        },
        {
            id: idBocateria, demo: true, nombre: 'Manuel Sur', empresa: 'Bocatería Sur',
            email: 'bocateriasur@example.com', telefono: '600 77 88 99', nif: 'B10000003',
            direccion: 'Córdoba', estado: 'activo',
            notas: 'Le interesa también packaging impreso en 3D.',
        },
    ];

    const idProyPizza = uuid(), idProyJuana = uuid(), idProyBoca = uuid();

    const proyectos = [
        {
            id: idProyPizza, demo: true, cliente_id: idPizza, nombre: 'Landing + carta digital QR',
            tipo: 'Carta digital QR', estado: 'Desarrollo',
            descripcion: 'Landing de captación con menú, alérgenos y pedido por WhatsApp.',
            precio_base: 450, iva_pct: 21, irpf_pct: 0,
            fecha_inicio: dia(-24), fecha_entrega: dia(9),
            token_acceso: token(10), progreso: 0,
        },
        {
            id: idProyJuana, demo: true, cliente_id: idJuana, nombre: 'Carta digital La Juana',
            tipo: 'Carta digital QR', estado: 'Publicado',
            descripcion: 'Carta digital con QR impreso para las mesas.',
            precio_base: 350, iva_pct: 21, irpf_pct: 0,
            fecha_inicio: dia(-95), fecha_entrega: dia(-60),
            token_acceso: token(10), progreso: 100,
        },
        {
            id: idProyBoca, demo: true, cliente_id: idBocateria, nombre: 'Web Bocatería Sur',
            tipo: 'Landing', estado: 'Presupuesto',
            descripcion: 'Landing de una página con horarios, carta y ubicación.',
            precio_base: 390, iva_pct: 21, irpf_pct: 0,
            fecha_inicio: dia(-3), fecha_entrega: dia(28),
            token_acceso: token(10), progreso: 0,
        },
    ];

    const columnas = [];
    const tarjetas = [];

    const tableroDe = (proyectoId, porColumna) => {
        const ids = COLUMNAS_DEFECTO.map((nombre, i) => {
            const id = uuid();
            columnas.push({ id, demo: true, proyecto_id: proyectoId, nombre, orden: i });
            return id;
        });
        porColumna.forEach((lista, indiceColumna) => {
            lista.forEach((t, orden) => {
                tarjetas.push({
                    id: uuid(), demo: true, proyecto_id: proyectoId, columna_id: ids[indiceColumna],
                    titulo: t.titulo, descripcion: t.descripcion || null, orden,
                    etiqueta: t.etiqueta || null, vence: t.vence || null,
                    visible_cliente: t.visible !== false,
                    completada: indiceColumna === COLUMNAS_DEFECTO.length - 1,
                });
            });
        });
    };

    tableroDe(idProyPizza, [
        [
            { titulo: 'Fotos de producto', descripcion: 'Pedir al cliente fotos de las pizzas nuevas.', etiqueta: 'Cliente', vence: dia(2) },
            { titulo: 'Alta del dominio', etiqueta: 'Técnico' },
        ],
        [
            { titulo: 'Maquetar sección de menú', vence: dia(4) },
            { titulo: 'Botón de pedido por WhatsApp' },
        ],
        [{ titulo: 'Revisión de textos', descripcion: 'Pendiente del visto bueno de José.', etiqueta: 'Cliente' }],
        [
            { titulo: 'Diseño aprobado' },
            { titulo: 'Estructura del proyecto' },
            { titulo: 'Presupuesto aceptado (450 €)', visible: false },
        ],
    ]);

    tableroDe(idProyJuana, [
        [],
        [{ titulo: 'Actualizar precios de temporada', vence: dia(12) }],
        [],
        [{ titulo: 'Carta publicada' }, { titulo: 'QR impreso y entregado' }, { titulo: 'Formación al personal' }],
    ]);

    tableroDe(idProyBoca, [
        [
            { titulo: 'Enviar presupuesto', vence: dia(1), etiqueta: 'Comercial' },
            { titulo: 'Recopilar logotipo y carta', etiqueta: 'Cliente' },
        ],
        [], [], [{ titulo: 'Primera reunión' }],
    ]);

    const pagos = [
        { id: uuid(), demo: true, cliente_id: idPizza, proyecto_id: idProyPizza, concepto: 'Señal 50 % landing', importe: 225, iva_pct: 21, irpf_pct: 0, fecha_vencimiento: dia(-20), fecha_pago: dia(-20), estado: 'pagado', metodo: 'Transferencia' },
        { id: uuid(), demo: true, cliente_id: idPizza, proyecto_id: idProyPizza, concepto: 'Resto a la entrega', importe: 225, iva_pct: 21, irpf_pct: 0, fecha_vencimiento: dia(9), fecha_pago: null, estado: 'pendiente', metodo: 'Transferencia' },
        { id: uuid(), demo: true, cliente_id: idJuana, proyecto_id: idProyJuana, concepto: 'Carta digital completa', importe: 350, iva_pct: 21, irpf_pct: 0, fecha_vencimiento: dia(-60), fecha_pago: dia(-58), estado: 'pagado', metodo: 'Bizum' },
        { id: uuid(), demo: true, cliente_id: idJuana, proyecto_id: idProyJuana, concepto: 'Mantenimiento trimestral', importe: 45, iva_pct: 21, irpf_pct: 0, fecha_vencimiento: dia(-4), fecha_pago: null, estado: 'pendiente', metodo: 'Transferencia', notas: 'Recordar por WhatsApp.' },
    ];

    const suscripciones = [
        { id: uuid(), demo: true, cliente_id: idJuana, proyecto_id: idProyJuana, concepto: 'Mantenimiento carta digital', importe: 45, iva_pct: 21, periodicidad: 'trimestral', proxima_fecha: dia(5), activa: true },
        { id: uuid(), demo: true, cliente_id: idPizza, proyecto_id: idProyPizza, concepto: 'Hosting + actualizaciones', importe: 120, iva_pct: 21, periodicidad: 'anual', proxima_fecha: dia(51), activa: true },
    ];

    const dominios = [
        { id: uuid(), demo: true, cliente_id: idJuana, proyecto_id: idProyJuana, dominio: 'lajuana.es', registrador: 'Dondominio', fecha_renovacion: dia(14), coste: 14.5, auto_renueva: false, notas: 'Pagamos nosotros y se lo repercutimos.' },
        { id: uuid(), demo: true, cliente_id: idPizza, proyecto_id: idProyPizza, dominio: 'pizzajosevillegas.es', registrador: 'IONOS', fecha_renovacion: dia(120), coste: 12, auto_renueva: true },
    ];

    const accesos = [
        { id: uuid(), demo: true, cliente_id: idJuana, proyecto_id: idProyJuana, tipo: 'Carta digital', titulo: 'Carta pública', url: 'https://puntozerosl.es/la-juana/', usuario: null, notas: 'QR impreso en las mesas.' },
        { id: uuid(), demo: true, cliente_id: idPizza, proyecto_id: idProyPizza, tipo: 'Repositorio', titulo: 'Repo de la landing', url: 'https://github.com/', usuario: null, notas: 'Rama main = producción.' },
        { id: uuid(), demo: true, cliente_id: idPizza, proyecto_id: idProyPizza, tipo: 'Dominio', titulo: 'Panel IONOS', url: 'https://ionos.es', usuario: 'cuenta de PuntoZero', notas: 'La contraseña está en el gestor de claves, aquí no.' },
    ];

    const servicios = [
        { id: uuid(), demo: true, nombre: 'Landing de una página', descripcion: 'Diseño a medida, responsive, SEO básico y formulario de contacto.', precio: 390, unidad: 'único' },
        { id: uuid(), demo: true, nombre: 'Carta digital QR', descripcion: 'Carta con categorías, alérgenos y QR listo para imprimir.', precio: 350, unidad: 'único' },
        { id: uuid(), demo: true, nombre: 'Mantenimiento web', descripcion: 'Cambios menores, copias y actualizaciones.', precio: 45, unidad: 'trimestral' },
        { id: uuid(), demo: true, nombre: 'Hosting + dominio gestionado', descripcion: 'Alojamiento, certificado y renovación del dominio.', precio: 120, unidad: 'anual' },
        { id: uuid(), demo: true, nombre: 'Impresión 3D (por pieza)', descripcion: 'Presupuesto según material y tiempo de impresión.', precio: 25, unidad: 'único' },
    ];

    const notas = [
        { id: uuid(), demo: true, cliente_id: idPizza, proyecto_id: idProyPizza, fecha: dia(-24), texto: 'Cerrado precio de 450 € IVA incluido: landing + carta + QR. Paga la mitad por adelantado.', autor: 'Alejandro' },
        { id: uuid(), demo: true, cliente_id: idPizza, proyecto_id: idProyPizza, fecha: dia(-6), texto: 'Quiere añadir las pizzas de temporada en verano. Lo presupuestamos aparte.', autor: 'Alejandro' },
        { id: uuid(), demo: true, cliente_id: idJuana, proyecto_id: idProyJuana, fecha: dia(-58), texto: 'Entregado y cobrado. Contentísima, nos va a recomendar a la peluquería de al lado.', autor: 'Alejandro' },
    ];

    const leads = [
        { id: uuid(), demo: true, nombre: 'Peluquería Gala', contacto: 'Marta', telefono: '600 12 34 56', email: 'gala@example.com', origen: 'Recomendación de La Juana', estado: 'presupuesto', valor_estimado: 400, notas: 'Enviado presupuesto de landing + reservas.', fecha: dia(-5) },
        { id: uuid(), demo: true, nombre: 'Taller Motos Córdoba', contacto: 'Rafa', telefono: '600 98 76 54', email: 'motos@example.com', origen: 'Instagram', estado: 'interesado', valor_estimado: 600, notas: 'Quiere web con catálogo de recambios.', fecha: dia(-2) },
    ];

    await adaptador.insertMany('clientes', clientes);
    await adaptador.insertMany('proyectos', proyectos);
    await adaptador.insertMany('columnas', columnas);
    await adaptador.insertMany('tarjetas', tarjetas);
    await adaptador.insertMany('pagos', pagos);
    await adaptador.insertMany('suscripciones', suscripciones);
    await adaptador.insertMany('dominios', dominios);
    await adaptador.insertMany('accesos', accesos);
    await adaptador.insertMany('servicios', servicios);
    await adaptador.insertMany('notas', notas);
    await adaptador.insertMany('leads', leads);

    await cargarTodo();
}

/** Elimina únicamente las filas marcadas como demo. */
export async function borrarEjemplos() {
    const tablas = ['tarjetas', 'columnas', 'pagos', 'suscripciones', 'dominios', 'accesos',
        'servicios', 'notas', 'leads', 'archivos', 'proyectos', 'clientes'];
    for (const tabla of tablas) {
        for (const fila of cache[tabla].filter(f => f.demo)) {
            await adaptador.remove(tabla, fila.id).catch(() => {});
        }
    }
    await cargarTodo();
}

export const hayEjemplos = () => cache.clientes.some(c => c.demo);
