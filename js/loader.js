/**
 * Animación de entrada del CRM.
 *
 * Es la misma de puntozerosl.es: el logo se dibuja solo desde el donut de
 * origen (el "punto cero"), los arcos crecen en las dos direcciones y cierran
 * arriba a la derecha, la flecha se lanza y después la cortina sube y deja ver
 * el CRM. Unos 2,3 s en total, y mientras tanto la aplicación va arrancando
 * por detrás, así que no se pierde tiempo: se aprovecha el que ya costaba.
 *
 * A diferencia de la web pública, aquí el logo no aterriza en la cabecera
 * (el CRM no tiene ese hueco): la cortina simplemente se retira hacia arriba.
 *
 * Tres cosas que no son negociables, porque el loader tapa el CRM entero:
 *   1. Si GSAP no carga (CDN caído o bloqueado), la cortina se quita al vuelo.
 *   2. Hay un tope duro por si algo se atasca a mitad de la animación.
 *   3. Con "reducir movimiento" activado no se anima nada: logo quieto y fuera.
 * En los tres casos se acaba llamando a quitar(), que es idempotente.
 */
(function () {
    'use strict';

    /**
     * Ponlo en true si te cansa verla cada vez que recargas: entonces solo
     * aparece la primera vez que abres el CRM en esa pestaña.
     */
    var UNA_VEZ_POR_SESION = false;

    var loader = document.getElementById('pz-loader');
    if (!loader) return;

    var raiz = document.documentElement;
    var fuera = false;

    function quitar() {
        if (fuera) return;
        fuera = true;
        raiz.classList.remove('pz-cargando');
        if (loader.parentNode) loader.parentNode.removeChild(loader);
    }

    // Tope duro: pase lo que pase, el CRM se ve.
    var tope = setTimeout(quitar, 6000);

    function desvanecer(retardo) {
        setTimeout(function () {
            loader.classList.add('pz-fuera');
            setTimeout(quitar, 400);
        }, retardo);
    }

    // Ya vista en esta pestaña: fuera sin ceremonia.
    try {
        if (UNA_VEZ_POR_SESION && sessionStorage.getItem('pz_intro_vista')) {
            clearTimeout(tope);
            quitar();
            return;
        }
        sessionStorage.setItem('pz_intro_vista', '1');
    } catch (e) { /* navegación privada: se anima igualmente */ }

    // Sin GSAP no hay animación que valga: se quita y punto.
    if (typeof window.gsap === 'undefined') {
        clearTimeout(tope);
        quitar();
        return;
    }

    var gsap = window.gsap;

    // Quien ha pedido reducir movimiento ve el logo quieto un instante, nada más.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        loader.classList.add('pz-quieto');
        desvanecer(600);
        return;
    }

    // Sin DrawSVG los trazos no se pueden dibujar: se hace una entrada simple
    // en vez de dejar la animación a medias.
    var dibujable = !!window.DrawSVGPlugin;
    if (dibujable) gsap.registerPlugin(window.DrawSVGPlugin);

    gsap.set('#pz-logo', { visibility: 'visible' });

    var tl = gsap.timeline({
        onComplete: function () {
            clearTimeout(tope);
            quitar();
        }
    });

    // El punto cero: todo nace de aquí.
    tl.from('.pz-origin', {
        scale: 0,
        duration: 0.45,
        ease: 'back.out(2)',
        svgOrigin: '62.15 182.3'
    }, 0.10);

    if (dibujable) {
        // Los cuatro arcos empiezan pegados al donut y cierran en el nodo de arriba.
        tl.from('.pz-ring', { drawSVG: '0%', duration: 0.85, ease: 'power2.inOut' }, 0.30);
        tl.from('.pz-oval', { drawSVG: '0%', duration: 0.80, ease: 'power2.inOut' }, 0.45);
    } else {
        tl.from(['.pz-ring', '.pz-oval'], { opacity: 0, duration: 0.7, ease: 'power2.out' }, 0.30);
    }

    tl.from('.pz-node', {
        scale: 0,
        duration: 0.40,
        ease: 'back.out(2.5)',
        stagger: 0.055,
        transformOrigin: '50% 50%'
    }, 0.85);

    // La flecha se lanza desde el origen.
    if (dibujable) {
        tl.from('.pz-shaft', { drawSVG: '0%', duration: 0.40, ease: 'power2.in' }, 0.95);
    } else {
        tl.from('.pz-shaft', { opacity: 0, duration: 0.40 }, 0.95);
    }
    tl.from('.pz-hub', { scale: 0, duration: 0.35, ease: 'back.out(2)', transformOrigin: '50% 50%' }, 1.20);
    tl.from('.pz-head', { scale: 0, duration: 0.32, ease: 'back.out(3)', svgOrigin: '190.17 44.63' }, 1.32);

    // Brillo corto al completarse, sin pasarse.
    tl.to('.pz-glow', { opacity: 0.38, scale: 1.10, duration: 0.30, ease: 'power2.out' }, 1.45);
    tl.to('.pz-glow', { opacity: 0, duration: 0.45, ease: 'power2.in' }, 1.75);

    // Y la cortina se retira hacia arriba dejando el CRM a la vista.
    tl.to('.pz-stage', { scale: 1.06, opacity: 0, duration: 0.40, ease: 'power2.in' }, 1.85);
    tl.to(loader, { yPercent: -100, duration: 0.60, ease: 'power3.inOut' }, 1.93);
})();
