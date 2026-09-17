/**
 * Asistente del CRM (IA).
 *
 * Traduce una orden en lenguaje natural ("sube a 200 € la carta de Villegas")
 * en una propuesta de cambios que el equipo confirma antes de aplicar.
 *
 * Puntos clave de seguridad:
 *   · Solo responde a administradores (se comprueba contra la base en cada
 *     llamada, igual que la función de accesos).
 *   · Esta función NO escribe en la base. Devuelve una PROPUESTA; quien la
 *     ejecuta es el propio CRM, por el camino de siempre (con sus permisos y
 *     validaciones). Así la IA nunca tiene credenciales de escritura.
 *   · La clave de Gemini vive aquí, en el servidor, nunca en la web.
 *
 * Variables de entorno (Supabase → Edge Functions → Secrets):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  · las pone Supabase
 *   GEMINI_API_KEY                           · tu clave de aistudio.google.com
 *   GEMINI_MODEL                             · opcional (por defecto gemini-flash-latest)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const responder = (cuerpo: unknown, estado = 200) =>
    new Response(JSON.stringify(cuerpo), {
        status: estado,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });

const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
);

/* ------------------------------------------------------------ CATÁLOGO ---- */
// Qué tablas puede tocar la IA y con qué campos. Es la lista blanca: nada
// fuera de aquí se acepta, ni en el servidor ni luego en el CRM.

const TABLAS: Record<string, string[]> = {
    clientes: ['empresa', 'nombre', 'telefono', 'email', 'nif', 'direccion', 'estado', 'notas'],
    proyectos: ['cliente_id', 'nombre', 'tipo', 'estado', 'descripcion', 'precio_base', 'iva_pct', 'irpf_pct', 'presupuesto_notas', 'fecha_inicio', 'fecha_entrega'],
    pagos: ['cliente_id', 'proyecto_id', 'concepto', 'importe', 'iva_pct', 'irpf_pct', 'metodo', 'fecha_vencimiento', 'fecha_pago', 'estado', 'notas'],
    suscripciones: ['cliente_id', 'proyecto_id', 'concepto', 'importe', 'iva_pct', 'periodicidad', 'proxima_fecha', 'activa', 'notas'],
    dominios: ['cliente_id', 'proyecto_id', 'dominio', 'registrador', 'coste', 'fecha_renovacion', 'auto_renueva', 'notas'],
    accesos: ['cliente_id', 'proyecto_id', 'tipo', 'titulo', 'url', 'usuario', 'notas'],
    servicios: ['nombre', 'descripcion', 'precio', 'unidad'],
    notas: ['cliente_id', 'proyecto_id', 'fecha', 'texto', 'autor'],
    leads: ['nombre', 'contacto', 'telefono', 'email', 'origen', 'estado', 'valor_estimado', 'fecha', 'notas'],
    tarjetas: ['proyecto_id', 'columna_id', 'titulo', 'descripcion', 'etiqueta', 'vence', 'visible_cliente', 'completada'],
};

const INSTRUCCIONES = `Eres el asistente del CRM de PuntoZero, un estudio de software de Córdoba.
Ayudas al equipo (los dueños) a consultar y modificar los datos de sus clientes y proyectos.

Hablas español, claro y directo, sin rodeos. Tratas al equipo de tú.

Te paso, en cada mensaje, una foto actual de los datos del CRM (clientes, proyectos,
pagos, etc.) con sus identificadores. Úsala para resolver a qué se refiere el usuario
("la carta de Villegas" = el proyecto cuyo nombre encaja del cliente Pizzeria Villegas)
y para responder preguntas.

DEBES responder SIEMPRE con un único objeto JSON con esta forma exacta:
{
  "respuesta": "texto breve para el usuario, en español",
  "acciones": [ ... ]   // vacío [] si el usuario solo pregunta o no hay cambios claros
}

Cada acción es:
{
  "operacion": "crear" | "editar" | "borrar",
  "tabla": una de: ${Object.keys(TABLAS).join(', ')},
  "id": "identificador"   // OBLIGATORIO para editar y borrar; se omite al crear
  "datos": { ...campos... },  // los campos a poner; al editar, solo los que cambian
  "resumen": "frase clara de qué hará esta acción, para que el usuario confirme"
}

Campos válidos por tabla (no inventes otros):
${Object.entries(TABLAS).map(([t, c]) => `- ${t}: ${c.join(', ')}`).join('\n')}

Reglas:
- Fechas en formato AAAA-MM-DD. Importes como número (ej. 200 o 149.80), sin símbolo de euro.
- estado de proyecto: Presupuesto, Diseño, Desarrollo, Revisión, Publicado o Mantenimiento.
- estado de cliente: activo, potencial o inactivo. estado de pago: pendiente o pagado.
- Para crear un pago o proyecto sobre un cliente que YA existe, usa su cliente_id de la foto.
- Si en la MISMA orden creas un registro y otro lo necesita (p. ej. "crea un cliente
  y su proyecto"), al crear el primero añade en "datos" un campo "id_temporal" con un
  nombre inventado (p. ej. "nuevo1"), y en la acción que lo referencia pon ese mismo
  valor en cliente_id (o proyecto_id). El CRM sustituirá "nuevo1" por el id real.
  Ejemplo: crear cliente {..., "id_temporal": "nuevo1"} y luego crear proyecto
  {"cliente_id": "nuevo1", ...}.
- Si el usuario pide algo ambiguo (dos clientes podrían encajar, falta un dato obligatorio),
  NO inventes: pon acciones vacías y pregunta en "respuesta" qué falta.
- Si solo es una pregunta ("¿quién me debe dinero?"), responde en "respuesta" y deja "acciones": [].
- No borres nada salvo que el usuario lo pida de forma explícita.
- Nunca toques usuarios, contraseñas ni permisos: no es tu cometido.`;

/* --------------------------------------------------------------- GEMINI --- */

async function preguntarGemini(historial: unknown[], foto: string, mensaje: string) {
    const clave = Deno.env.get('GEMINI_API_KEY');
    if (!clave) {
        return { error: 'sin_configurar' };
    }
    const modelo = Deno.env.get('GEMINI_MODEL') || 'gemini-flash-lite-latest';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${clave}`;

    // El último turno lleva la foto de datos + la orden del usuario.
    const contents = [
        ...(Array.isArray(historial) ? historial : []),
        { role: 'user', parts: [{ text: `DATOS ACTUALES DEL CRM (en JSON):\n${foto}\n\nORDEN DEL USUARIO:\n${mensaje}` }] },
    ];

    const cuerpo = {
        system_instruction: { parts: [{ text: INSTRUCCIONES }] },
        contents,
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 2048 },
    };

    // Los modelos nuevos sufren picos de demanda (503). Reintentamos un par de
    // veces con una pequeña espera antes de rendirnos, para que al usuario no le
    // llegue ese error temporal.
    let r: Response | null = null;
    let ultimoDetalle = '';
    for (let intento = 0; intento < 3; intento++) {
        r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cuerpo),
        });
        if (r.ok) break;

        ultimoDetalle = await r.text();
        if (r.status === 400 && /API key not valid/i.test(ultimoDetalle)) return { error: 'clave_invalida' };
        if (r.status === 429) return { error: 'limite', detalle: 'Has llegado al límite gratuito de Gemini por hoy. Prueba de nuevo en un rato.' };
        // 503/UNAVAILABLE (o 500): pico temporal → esperar y reintentar.
        if (r.status === 503 || r.status === 500) {
            await new Promise((res) => setTimeout(res, 700 * (intento + 1)));
            continue;
        }
        return { error: 'gemini', detalle: ultimoDetalle.slice(0, 300) };
    }

    if (!r || !r.ok) {
        return { error: 'ocupado', detalle: 'Gemini está saturado ahora mismo. Espera unos segundos y vuelve a intentarlo.' };
    }

    const data = await r.json();
    const texto = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
    return { texto };
}

/* ------------------------------------------------------------ SANEADO ----- */
// La IA propone; aquí filtramos: solo tablas y campos de la lista blanca.

function sanear(bruto: unknown) {
    let obj: { respuesta?: string; acciones?: unknown[] };
    try {
        obj = typeof bruto === 'string' ? JSON.parse(bruto) : (bruto as typeof obj);
    } catch {
        return { respuesta: String(bruto || 'No he entendido la respuesta.'), acciones: [] };
    }

    const acciones = Array.isArray(obj.acciones) ? obj.acciones : [];
    const limpias = acciones.map((a) => {
        const ac = a as Record<string, unknown>;
        const tabla = String(ac.tabla || '');
        const operacion = String(ac.operacion || '');
        if (!TABLAS[tabla]) return null;
        if (!['crear', 'editar', 'borrar'].includes(operacion)) return null;
        if ((operacion === 'editar' || operacion === 'borrar') && !ac.id) return null;

        const permitidos = TABLAS[tabla];
        const datosBrutos = (ac.datos && typeof ac.datos === 'object') ? ac.datos as Record<string, unknown> : {};
        const datos: Record<string, unknown> = {};
        for (const campo of permitidos) {
            if (campo in datosBrutos) datos[campo] = datosBrutos[campo];
        }
        // id_temporal no es una columna: es la etiqueta para encadenar creaciones.
        if (typeof datosBrutos.id_temporal === 'string') datos.id_temporal = datosBrutos.id_temporal;

        return {
            operacion, tabla,
            id: ac.id ? String(ac.id) : null,
            datos,
            resumen: String(ac.resumen || 'Cambio propuesto'),
        };
    }).filter(Boolean);

    return { respuesta: String(obj.respuesta || ''), acciones: limpias };
}

/* --------------------------------------------------------------- HTTP ----- */

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);

    try {
        // 1. ¿Quién llama? Solo administradores.
        const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
        if (!token) return responder({ error: 'Falta la sesión' }, 401);
        const { data: sesion, error: errSesion } = await admin.auth.getUser(token);
        if (errSesion || !sesion?.user) return responder({ error: 'Sesión no válida' }, 401);
        const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', sesion.user.id).maybeSingle();
        if (perfil?.rol !== 'admin') return responder({ error: 'Solo el equipo puede usar el asistente' }, 403);

        // 2. Entrada.
        const crudo = await req.text();
        if (crudo.length > 200_000) return responder({ error: 'Petición demasiado grande' }, 413);
        const { mensaje, foto, historial } = JSON.parse(crudo || '{}');
        if (!mensaje || typeof mensaje !== 'string') return responder({ error: 'Falta el mensaje' }, 400);

        // 3. A Gemini.
        const salida = await preguntarGemini(historial, String(foto || '{}'), mensaje.slice(0, 4000));
        if ('error' in salida) {
            const mensajes: Record<string, string> = {
                sin_configurar: 'El asistente todavía no tiene configurada la clave de Gemini.',
                clave_invalida: 'La clave de Gemini no es válida. Revísala en Ajustes.',
                limite: salida.detalle || 'Límite alcanzado.',
                ocupado: salida.detalle || 'Gemini está saturado. Prueba de nuevo en unos segundos.',
                gemini: 'Gemini ha devuelto un error: ' + (salida.detalle || ''),
            };
            const estado = salida.error === 'sin_configurar' ? 503 : salida.error === 'ocupado' ? 503 : 502;
            return responder({ error: mensajes[salida.error] || 'Error del asistente', codigo: salida.error }, estado);
        }

        // 4. Saneado y respuesta.
        return responder(sanear(salida.texto));
    } catch (e) {
        return responder({ error: String((e as Error)?.message || e) }, 500);
    }
});
