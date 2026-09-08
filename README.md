# PuntoZero · CRM

CRM a medida para **PuntoZero**: clientes, proyectos, tablero estilo Trello, presupuestos,
cobros, cuotas recurrentes y renovaciones de dominio. Cada cliente entra a su propio portal
y ve en qué punto está su proyecto y qué tiene pendiente de pagar.

Es una web estática (HTML + CSS + JavaScript, sin frameworks ni compilación), igual que
`puntozerosl.es`. Se publica en GitHub Pages y los datos viven en Supabase.

**En marcha:** <https://alexestepagallego.github.io/puntozero-crm/>
**Base de datos:** proyecto `puntozero-crm` en Supabase (Irlanda), ya conectado y con el
esquema aplicado. No hay que configurar nada para empezar a usarlo.

---

## Qué hace

**Para vosotros**

- **Panel** con todo lo que vence en 30 días: dominios, cuotas, pagos, entregas y tareas.
- **Clientes**: ficha con contacto, NIF, proyectos, dinero, dominios, accesos y el historial
  de todo lo que habéis hablado (ahí es donde se apunta «le dije 450 €»).
- **Proyectos** con tablero Trello: columnas, tarjetas arrastrables, etiquetas, fechas límite
  y tareas que podéis marcar como internas para que el cliente no las vea.
- **Dinero**: presupuesto con IVA e IRPF configurables por proyecto, pagos pendientes y
  cobrados, cuotas recurrentes con su próximo cobro y renovaciones de dominio.
- **Oportunidades**: contactos que aún no son clientes, en columnas de interesado a ganado.
  Cuando cierras uno, se convierte en cliente de un clic.
- **Tarifas**: tus precios de referencia, para presupuestar sin improvisar.
- **Avisos**: panel al entrar, exportación a Google Calendar (.ics) y email automático.

**Para el cliente**

- Fase del proyecto, porcentaje de avance y qué estáis haciendo ahora mismo.
- Sus fechas, su presupuesto y sus pagos (lo cobrado y lo pendiente).
- Próximas renovaciones de dominio y cuotas.
- Entra con su email (enlace de un solo uso) **o** con un enlace secreto que le pasáis por
  WhatsApp, sin registrarse.

---

## Empezar en 30 segundos (modo local)

Abre `index.html` con un servidor local y ya está funcionando:

```bash
python3 -m http.server 8000
```

Luego entra en <http://localhost:8000> → **Ajustes → Cargar datos de ejemplo** para verlo lleno.

En este modo los datos se guardan **solo en tu navegador**: sirve para probar, pero los
clientes no pueden entrar. Para eso hace falta el paso siguiente.

## Producción

Ya está montado: proyecto de Supabase creado, esquema aplicado, permisos activos y el
CRM conectado. Entras con tu email desde la dirección de arriba.

Lo que queda por hacer y cómo (dar de alta socios, atar clientes a su email, apuntar
`crm.puntozerosl.es`, copias de seguridad) está en
[docs/PUESTA-EN-MARCHA.md](docs/PUESTA-EN-MARCHA.md). Si algún día hay que rehacer la base
desde cero, ese mismo documento explica el proceso completo.
Para el correo automático de vencimientos, [docs/AVISOS-POR-EMAIL.md](docs/AVISOS-POR-EMAIL.md).

---

## Cómo está montado

```
index.html              Punto de entrada (una sola página)
css/app.css             Estilos: blanco y negro, Inter, igual que la web
js/
  config.js             Datos de la empresa y conexión con Supabase
  main.js               Arranque, barra lateral y rutas
  router.js             Enrutado por # (funciona en GitHub Pages sin servidor)
  auth.js               Sesión, roles y enlace mágico
  forms.js              Definición de todos los formularios en un solo sitio
  ui.js                 Piezas visuales compartidas (iconos, etiquetas, cabeceras)
  util.js               Plantillas seguras, fechas, dinero, modales, .ics
  data/
    index.js            Reglas de negocio: alertas, balances, progreso
    supabase.js         Adaptador de nube
    local.js            Adaptador de navegador (modo prueba)
    demo.js             Datos de ejemplo borrables
  views/                Una vista por pantalla
sql/schema.sql          Tablas, permisos (RLS) y función del enlace secreto
supabase/functions/     Correo automático de vencimientos
```

**Seguridad**: la clave `anon` es pública por diseño. Quien manda son las políticas RLS
de `sql/schema.sql`: un cliente autenticado solo puede leer sus propias filas, y nunca
las notas internas, los accesos técnicos, las tarifas ni las oportunidades. Los enlaces
secretos no leen tablas: pasan por una función controlada que devuelve solo ese proyecto.

**Contraseñas**: el CRM guarda *dónde* está cada cosa (panel del hosting, registrador,
repositorio), nunca las claves. Esas van en un gestor de contraseñas.

---

## Publicar los cambios

El repositorio se sirve con GitHub Pages desde `main`. Cualquier cambio subido se publica solo:

```bash
git add -A && git commit -m "Descripción del cambio" && git push
```
