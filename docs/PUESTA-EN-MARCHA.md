# Puesta en marcha

> **Los pasos 1, 2 y 3 ya están hechos.** El proyecto `puntozero-crm` existe en Supabase
> (región Irlanda), el esquema está aplicado y el CRM ya está conectado: puedes entrar
> directamente en <https://alexestepagallego.github.io/puntozero-crm/> con tu email.
> La plaza de administrador está reservada para `alexestepagallego@gmail.com`.
>
> Se dejan documentados por si algún día hay que rehacerlo o montar una copia.
> Lo que sí te queda pendiente: los apartados **5**, **6** y **7**.
>
> La contraseña de la base de datos está guardada en `~/puntozero-crm-supabase.txt`
> (fuera del repositorio). Solo hace falta para conectarse por SQL directo.

---

## 1. Crear la base de datos (5 minutos, gratis)

1. Entra en <https://supabase.com> y crea una cuenta (puedes usar la de GitHub).
2. **New project**. Ponle de nombre `puntozero-crm`, elige región **West EU (Ireland)**
   y guarda la contraseña de la base de datos donde guardas las demás.
3. Espera a que termine de crearse (un par de minutos).

## 2. Crear las tablas

1. En el menú lateral: **SQL Editor → New query**.
2. Abre el archivo `sql/schema.sql` de este repositorio, cópialo **entero** y pégalo.
3. Pulsa **Run**. Debe terminar en verde (`Success`).

Eso crea las tablas, los permisos y la función de los enlaces secretos.

## 3. Conectar el CRM

1. En Supabase: **Project Settings → API**. Ahí hay dos datos:
   - **Project URL** → algo tipo `https://abcdefgh.supabase.co`
   - **anon public** → una clave larga
2. Abre el CRM y ve a **Ajustes → Conectar con Supabase**. Pega los dos datos y guarda.

> La clave `anon` es pública a propósito, se puede subir al repositorio sin problema.
> Lo que protege los datos son las políticas de la base de datos, no esa clave.

## 4. Entrar

1. Abre el CRM. Pide un email.
2. Escribe **tu** email y pulsa *Enviarme el enlace*.
3. Te llega un correo de Supabase; al pulsar el enlace entras.

**El primero que entra se queda como administrador**, y esa plaza ya está reservada para
tu correo. Cualquier otro que entre lo hace como cliente y, si no tiene ficha asociada,
no ve absolutamente nada.

## 5. Dar de alta a tus socios

Que entren ellos primero con su email (se crearán como clientes). Después, en
**SQL Editor**, ejecuta una línea por socio:

```sql
update perfiles set rol = 'admin' where email = 'socio@puntozerosl.es';
```

Que cierren sesión y vuelvan a entrar: ya lo verán todo.

## 6. Dar acceso a un cliente

1. Crea el cliente en el CRM con **su email real** en la ficha.
2. Dile que entre en la dirección del CRM y pida el enlace con ese mismo email.
   El sistema lo ata solo a su ficha y verá únicamente sus proyectos.

Si el cliente ya había entrado antes de que crearas su ficha, átalos a mano:

```sql
update perfiles
set cliente_id = (select id from clientes where empresa = 'La Juana')
where email = 'lajuana@example.com';
```

**Alternativa sin registro**: en la ficha del proyecto, botón *Enlace para el cliente*.
Le pasas esa URL por WhatsApp y entra directo. Quien tenga el enlace, entra; si quieres
invalidarlo, genera uno nuevo desde ese mismo botón.

---

## 7. Publicar el CRM en tu dominio

El CRM ya está publicado en <https://alexestepagallego.github.io/puntozero-crm/>.
Para que responda además en `crm.puntozerosl.es`:

1. En tu proveedor del dominio (donde tengas `puntozerosl.es`), añade un registro:

   | Tipo  | Nombre | Valor                    |
   |-------|--------|--------------------------|
   | CNAME | `crm`  | `alexestepagallego.github.io.` |

2. En GitHub: **Settings → Pages → Custom domain**, escribe `crm.puntozerosl.es` y guarda.
3. Marca **Enforce HTTPS** cuando GitHub te deje (tarda unos minutos en emitir el certificado).
4. En Supabase: **Authentication → URL Configuration**, añade `https://crm.puntozerosl.es`
   en *Site URL* y en *Redirect URLs*. Sin esto, los enlaces mágicos no vuelven al sitio correcto.

---

## Copias de seguridad

**Ajustes → Descargar copia (.json)** te baja todo el CRM en un archivo. Hazlo de vez en
cuando y guárdalo fuera del ordenador. Supabase además hace sus propias copias diarias.

## Preguntas rápidas

**¿Cuánto cuesta?** Nada. El plan gratuito de Supabase (500 MB) y GitHub Pages sobran de
lejos para cientos de clientes. Solo pagarías si empiezas a subir muchos archivos pesados.

**¿Y si Supabase se cae?** Tienes la copia `.json` y el modo local. Los datos son tuyos y
salen en un formato abierto.

**¿Puedo usarlo desde el móvil?** Sí, la interfaz está pensada también para pantalla pequeña.
