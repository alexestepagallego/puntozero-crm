/**
 * Adaptador "local": guarda todo en el navegador (localStorage).
 * Sirve para probar el CRM sin cuenta en la nube. Los clientes no pueden
 * entrar en este modo, porque los datos no salen de este ordenador.
 */
import { uuid, hoyISO } from '../util.js';

const CLAVE = 'pz_crm_datos';

export const TABLAS = [
    'clientes', 'proyectos', 'columnas', 'tarjetas', 'pagos', 'suscripciones',
    'dominios', 'accesos', 'servicios', 'notas', 'leads', 'archivos', 'perfiles',
];

function cargar() {
    try {
        const datos = JSON.parse(localStorage.getItem(CLAVE) || '{}');
        for (const t of TABLAS) if (!Array.isArray(datos[t])) datos[t] = [];
        return datos;
    } catch {
        return Object.fromEntries(TABLAS.map(t => [t, []]));
    }
}

function volcar(datos) {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
}

function filtra(filas, opciones = {}) {
    let salida = filas;
    if (opciones.eq) {
        for (const [campo, valor] of Object.entries(opciones.eq)) {
            if (valor === undefined) continue;
            salida = salida.filter(f => String(f[campo]) === String(valor));
        }
    }
    if (opciones.dentro) {
        for (const [campo, valores] of Object.entries(opciones.dentro)) {
            const set = new Set((valores || []).map(String));
            salida = salida.filter(f => set.has(String(f[campo])));
        }
    }
    if (opciones.orden) {
        const dir = opciones.dir === 'desc' ? -1 : 1;
        salida = [...salida].sort((a, b) => {
            const x = a[opciones.orden] ?? '', y = b[opciones.orden] ?? '';
            if (x === y) return 0;
            return (x > y ? 1 : -1) * dir;
        });
    }
    return salida;
}

export const adaptadorLocal = {
    modo: 'local',

    async init() { /* nada que preparar */ },

    async list(tabla, opciones) {
        return filtra(cargar()[tabla] || [], opciones);
    },

    async get(tabla, id) {
        return (cargar()[tabla] || []).find(f => String(f.id) === String(id)) || null;
    },

    async insert(tabla, fila) {
        const datos = cargar();
        const nueva = { id: uuid(), creado: new Date().toISOString(), ...fila };
        datos[tabla].push(nueva);
        volcar(datos);
        return nueva;
    },

    async insertMany(tabla, filas) {
        const datos = cargar();
        const nuevas = filas.map(f => ({ id: uuid(), creado: new Date().toISOString(), ...f }));
        datos[tabla].push(...nuevas);
        volcar(datos);
        return nuevas;
    },

    async update(tabla, id, parche) {
        const datos = cargar();
        const i = datos[tabla].findIndex(f => String(f.id) === String(id));
        if (i === -1) throw new Error('No encontrado');
        datos[tabla][i] = { ...datos[tabla][i], ...parche };
        volcar(datos);
        return datos[tabla][i];
    },

    async remove(tabla, id) {
        const datos = cargar();
        datos[tabla] = datos[tabla].filter(f => String(f.id) !== String(id));
        volcar(datos);
    },

    async removeWhere(tabla, eq) {
        const datos = cargar();
        datos[tabla] = datos[tabla].filter(f =>
            !Object.entries(eq).every(([c, v]) => String(f[c]) === String(v)));
        volcar(datos);
    },

    /** Exporta toda la base para copia de seguridad. */
    async exportar() {
        return { version: 1, generado: hoyISO(), datos: cargar() };
    },

    async importar(paquete) {
        const datos = paquete?.datos || paquete;
        const limpio = Object.fromEntries(TABLAS.map(t => [t, Array.isArray(datos[t]) ? datos[t] : []]));
        volcar(limpio);
    },

    async vaciar() {
        localStorage.removeItem(CLAVE);
    },

    async funcion() {
        throw new Error('Los accesos de clientes necesitan la base de datos en la nube');
    },

    /** Acceso por enlace secreto: en local no hay servidor, se busca en memoria. */
    async proyectoPorToken(tk) {
        const datos = cargar();
        const proyecto = datos.proyectos.find(p => p.token_acceso === tk);
        return proyecto || null;
    },
};
