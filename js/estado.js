/**
 * Pequeño puente para que cualquier vista pueda pedir "recarga y vuelve a
 * pintar" sin depender de main.js (y sin importaciones circulares).
 */
import { cargarTodo } from './data/index.js';
import { resolver } from './router.js';

let alRefrescarNav = () => {};

export function registrarRefrescoNav(fn) { alRefrescarNav = fn; }

/** Recarga los datos de la base y repinta la vista actual. */
export async function refrescar() {
    await cargarTodo();
    await resolver();
    alRefrescarNav();
}

/** Repinta la vista actual con los datos que ya hay en memoria. */
export async function repintar() {
    await resolver();
    alRefrescarNav();
}
