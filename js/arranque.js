/**
 * Lo primero que corre: pone la cortina y deja una red de seguridad por si
 * loader.js no llegara a cargar. Antes iba incrustado en el HTML; está en su
 * propio archivo para que la política de seguridad no tenga que permitir
 * scripts en línea, que es justo por donde entran los ataques de inyección.
 */
(function () {
    // Anti-clickjacking. GitHub Pages no deja enviar la cabecera que impide
    // incrustar la página en un iframe (frame-ancestors), así que lo cortamos
    // desde aquí: si el CRM se abre dentro de otra web, se escapa del marco.
    // Evita que una web maligna lo superponga para robar clics del usuario.
    try {
        if (window.top !== window.self) {
            window.top.location = window.self.location.href;
        }
    } catch (e) {
        // El navegador no nos deja ni leer window.top: seguro que estamos
        // enmarcados por otro origen. Escondemos todo antes que exponernos.
        document.documentElement.style.display = 'none';
        throw new Error('Bloqueado: el CRM no puede abrirse dentro de otra web.');
    }

    document.documentElement.classList.add('pz-cargando');
    // Red de seguridad por si js/loader.js no llega a cargar (404, red
    // caída): sin esto la cortina taparía el CRM para siempre. El tope
    // propio del loader es de 6 s, así que esto solo salta si no está.
    window.setTimeout(function () {
        var l = document.getElementById('pz-loader');
        if (l && l.parentNode) l.parentNode.removeChild(l);
        document.documentElement.classList.remove('pz-cargando');
    }, 7000);
})();
