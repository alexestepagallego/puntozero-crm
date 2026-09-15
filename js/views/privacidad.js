/**
 * Aviso de privacidad del portal.
 *
 * No es adorno: el CRM guarda datos personales de los clientes (nombre, correo,
 * teléfono, NIF) y ellos entran con una cuenta, así que el RGPD obliga a
 * contarles qué se guarda, por qué y cómo pedir que se borre.
 *
 * Lo que dice aquí describe el sistema tal y como está construido de verdad.
 * Si algún día cambia dónde viven los datos, hay que cambiar este texto.
 */
import { CONFIG } from '../config.js';
import { html, raw, esc } from '../util.js';
import { ponerTitulo } from '../ui.js';

export async function vistaPrivacidad(raiz) {
    ponerTitulo('Privacidad');

    const faltanDatos = !CONFIG.EMPRESA_CIF || !CONFIG.EMPRESA_DIRECCION;
    const responsable = CONFIG.EMPRESA_RAZON_SOCIAL || CONFIG.EMPRESA;

    const seccion = (titulo, cuerpo) => html`
        <h2 class="mt-lg mb">${titulo}</h2>
        ${raw(cuerpo)}`;

    raiz.innerHTML = html`
        <div class="portal-wrap">
            <header class="portal-head row-between">
                <a class="brand" href="#/">
                    <span class="brand-dot"></span>
                    <span class="stack" style="gap:0">
                        <span class="brand-name">${CONFIG.EMPRESA}</span>
                        <span class="brand-sub">Privacidad</span>
                    </span>
                </a>
                <a class="btn btn-ghost btn-sm" href="#/">Volver</a>
            </header>

            <div class="view-narrow">
                <h1>Cómo tratamos tus datos</h1>
                <p class="muted small mt">Última actualización: septiembre de 2026.</p>

                ${raw(faltanDatos ? `<div class="banner warn mt">
                    Pendiente de completar por ${esc(CONFIG.EMPRESA)}: razón social, CIF y domicilio.
                    Mientras tanto, para cualquier asunto sobre tus datos escríbenos por los medios de contacto de tu portal.
                </div>` : '')}

                ${raw(seccion('Quién es responsable', html`
                    <p class="small">${responsable}${raw(CONFIG.EMPRESA_CIF ? `, con CIF ${esc(CONFIG.EMPRESA_CIF)}` : '')}${raw(CONFIG.EMPRESA_DIRECCION ? `, con domicilio en ${esc(CONFIG.EMPRESA_DIRECCION)}` : '')}.
                    Puedes escribirnos por WhatsApp o por correo desde tu portal para cualquier cuestión relacionada con tus datos.</p>`))}

                ${raw(seccion('Qué datos guardamos', html`
                    <ul class="small stack" style="gap:8px">
                        <li><span class="strong">Identificación y contacto:</span> nombre del negocio, persona de contacto, correo, teléfono, NIF o CIF y dirección.</li>
                        <li><span class="strong">Del proyecto:</span> qué te estamos haciendo, en qué fase está, fechas y tareas.</li>
                        <li><span class="strong">Económicos:</span> presupuesto acordado, pagos hechos y pendientes, cuotas y renovaciones de dominio.</li>
                        <li><span class="strong">Notas de seguimiento:</span> lo que hablamos contigo sobre el trabajo, para no depender de la memoria.</li>
                        <li><span class="strong">Documentos:</span> los archivos que te compartimos o que nos envías (presupuestos, logotipos, cartas).</li>
                        <li><span class="strong">De acceso:</span> tu correo y una contraseña cifrada, si tienes cuenta.</li>
                    </ul>
                    <p class="small mt">No guardamos datos de tarjetas ni de cuentas bancarias, ni contraseñas de tus servicios:
                    del CRM solo anotamos <span class="strong">dónde</span> está alojado cada cosa, nunca cómo entrar.</p>`))}

                ${raw(seccion('Para qué y con qué fundamento', html`
                    <ul class="small stack" style="gap:8px">
                        <li><span class="strong">Para prestarte el servicio contratado</span> y que puedas seguirlo desde tu portal. Base: el contrato entre nosotros.</li>
                        <li><span class="strong">Para cumplir con Hacienda</span> en lo que toca a facturación y contabilidad. Base: obligación legal.</li>
                        <li><span class="strong">Para avisarte</span> de vencimientos, renovaciones y entregas. Base: nuestro interés legítimo en que el servicio no se te caiga.</li>
                    </ul>
                    <p class="small mt">No hacemos publicidad con tus datos, no los vendemos y no los cedemos a nadie salvo obligación legal.</p>`))}

                ${raw(seccion('Cuánto tiempo los conservamos', html`
                    <p class="small">Mientras trabajemos juntos, y después el tiempo que exige la ley para la
                    documentación mercantil y fiscal. Pasado ese plazo, se eliminan. Si dejas de ser cliente y
                    nos lo pides, te retiramos el acceso al portal de inmediato.</p>`))}

                ${raw(seccion('Quién más los ve', html`
                    <p class="small">Solo el equipo de ${esc(CONFIG.EMPRESA)}. Para que el servicio funcione nos apoyamos en
                    dos proveedores, que actúan por cuenta nuestra y no pueden usar tus datos para otra cosa:</p>
                    <ul class="small stack mt" style="gap:8px">
                        <li><span class="strong">Supabase</span> — guarda la base de datos y los archivos, en servidores dentro de la Unión Europea (Irlanda).</li>
                        <li><span class="strong">GitHub Pages</span> — sirve la página que estás viendo. No recibe tus datos de cliente.</li>
                    </ul>`))}

                ${raw(seccion('Cookies y seguimiento', html`
                    <p class="small">Este portal <span class="strong">no usa cookies de seguimiento ni analítica</span>.
                    No hay Google Analytics ni nada parecido: no sabemos qué otras páginas visitas.
                    Lo único que se guarda en tu navegador es lo imprescindible para mantener la sesión abierta
                    mientras usas el portal, y desaparece al cerrar sesión.</p>`))}

                ${raw(seccion('Qué puedes exigirnos', html`
                    <p class="small">Tienes derecho a saber qué datos tenemos, a corregirlos si están mal, a que los
                    borremos, a limitar u oponerte a su uso y a llevártelos a otro sitio. Basta con pedírnoslo por
                    los medios de contacto de tu portal; te respondemos en menos de un mes.</p>
                    <p class="small mt">Si crees que no lo hemos hecho bien, puedes reclamar ante la
                    <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">Agencia Española de Protección de Datos</a>.</p>`))}

                ${raw(seccion('Cómo los protegemos', html`
                    <p class="small">Todo viaja cifrado (HTTPS). Cada cliente solo puede ver lo suyo, y eso lo
                    impone la propia base de datos, no solo la pantalla. Las contraseñas se guardan cifradas y ni
                    siquiera nosotros podemos verlas. Los documentos están en un almacén privado al que se accede
                    con enlaces que caducan.</p>`))}

                <p class="center tiny muted mt-lg">
                    ${esc(CONFIG.EMPRESA)} · <a href="${CONFIG.EMPRESA_WEB}" target="_blank" rel="noopener">puntozerosl.es</a>
                </p>
            </div>
        </div>`;
}
