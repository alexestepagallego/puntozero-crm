/**
 * Configuración del CRM.
 *
 * Hay dos modos de funcionamiento:
 *
 *  - "local": todo se guarda en este navegador (localStorage). No hace falta
 *    registrarse en ningún sitio y sirve para probar la herramienta, pero los
 *    clientes NO pueden entrar y los datos no viajan a otro ordenador.
 *
 *  - "supabase": los datos viven en la nube (Postgres + login + permisos).
 *    Es el modo real. Rellena las dos constantes de abajo con los datos de tu
 *    proyecto de Supabase (Project Settings → API) o introdúcelos desde la
 *    pantalla de Ajustes → Conexión, sin tocar este archivo.
 *
 * La clave "anon" es pública por diseño: no da acceso a nada por sí sola,
 * porque cada tabla está protegida por políticas RLS (ver sql/schema.sql).
 */
export const CONFIG = {
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: '',

    // Nombre de la empresa, usado en cabeceras, portal de cliente y emails.
    EMPRESA: 'PuntoZero',
    EMPRESA_WEB: 'https://puntozerosl.es',
    EMPRESA_EMAIL: 'hola@puntozerosl.es',

    MONEDA: 'EUR',
    LOCALE: 'es-ES',

    // Impuestos por defecto al crear un proyecto (editables proyecto a proyecto).
    IVA_DEFECTO: 21,
    IRPF_DEFECTO: 0,

    // Días de antelación con los que el panel avisa de un vencimiento.
    AVISO_DIAS: 30,
};

const LS_KEY = 'pz_crm_conexion';

/** Lee la conexión guardada en el navegador (tiene prioridad sobre el archivo). */
export function leerConexion() {
    try {
        const guardada = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
        if (guardada && guardada.url && guardada.key) return guardada;
    } catch { /* configuración corrupta: la ignoramos */ }
    if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
        return { url: CONFIG.SUPABASE_URL, key: CONFIG.SUPABASE_ANON_KEY };
    }
    return null;
}

export function guardarConexion(url, key) {
    localStorage.setItem(LS_KEY, JSON.stringify({ url: url.trim().replace(/\/$/, ''), key: key.trim() }));
}

export function borrarConexion() {
    localStorage.removeItem(LS_KEY);
}

/** "local" mientras no haya conexión a Supabase configurada. */
export function modo() {
    return leerConexion() ? 'supabase' : 'local';
}
