# Seguridad del CRM

Repaso de los 20 puntos de la lista, con lo que hay hecho de verdad y lo que
queda fuera a propósito. Todo lo marcado como comprobado se ha probado atacando
el sistema, no solo leyendo el código.

---

## 1. Claves de API ocultas

Hay tres claves en juego y cada una está donde debe:

| Clave | Dónde vive | Qué puede hacer |
|---|---|---|
| `anon` (pública) | En el código, a la vista | Nada por sí sola: toda tabla está bajo RLS |
| `service_role` | Solo en el servidor, en las funciones | Todo. **Nunca** llega al navegador |
| Token de gestión | Solo en el ordenador de Alejandro | Administrar el proyecto de Supabase |

## 2. Sin secretos en Git

Comprobado con `git grep` sobre todo el repositorio: no hay claves de servicio,
ni tokens, ni contraseñas. El `.gitignore` excluye `.env` y `.env.local`.

## 3. La clave pública de la base

La `anon` es pública **por diseño**: identifica al proyecto, no autoriza nada.
Probado como anónimo: leer clientes o pagos devuelve vacío y escribir devuelve
`violates row-level security policy`.

## 4. RLS configurado

Las 13 tablas tienen RLS activo y políticas. El resumen:

- **Administrador**: todo.
- **Cliente**: solo lectura de sus filas — su ficha, sus proyectos, sus pagos,
  sus dominios, sus archivos visibles y las tareas marcadas como visibles.
- **Cliente nunca**: notas internas, accesos técnicos, tarifas, oportunidades.
- **Anónimo**: nada. Solo la función del enlace secreto, que devuelve un único
  proyecto acotado.

## 5. Datos sensibles

No se guardan contraseñas de clientes: el CRM anota **dónde** está cada cosa
(registrador, hosting, repositorio), nunca las claves. Esas van en un gestor de
contraseñas. Las contraseñas de acceso al CRM las guarda Supabase con bcrypt.

## 6. Autenticación reforzada

- Registro público **desactivado**: nadie se crea una cuenta.
- Mínimo 10 caracteres, con mayúscula, minúscula y número (exigido por el
  servidor, no solo por el formulario).
- Las contraseñas que genera el CRM son de 17 caracteres y garantizan las tres
  familias.
- La sesión caduca en 1 hora, con rotación de token de refresco.

Pendiente de plan de pago: bloquear contraseñas filtradas en brechas conocidas
(HaveIBeenPwned) es una función de pago en Supabase.

## 7. Registro de accesos

Cada alta, cambio de contraseña o baja de un cliente queda anotada en
`registro_accesos` con quién lo hizo y cuándo. Se ve en **Ajustes → Accesos
dados a clientes**. Lo escribe el servidor: no se puede tocar desde el navegador.

## 8. Sin manipulación de campos

Un cliente no puede escribir en **ninguna** tabla, así que no puede cambiarse el
rol ni reasignarse a otra empresa. Comprobado: intentar crear una fila devuelve
error de política. El rol solo se cambia por SQL o desde la función de servidor,
que antes verifica contra la base que quien llama es administrador.

## 9. Cookies

El portal lo dice por escrito en su aviso de privacidad (`#/privacidad`): no hay
cookies de seguimiento ni analítica. El CRM no usa cookies propias. La sesión vive en el almacenamiento del navegador
con caducidad de 1 hora y rotación de refresco. Al salir se borra.

## 10. Contraseñas con hash

Las gestiona Supabase (bcrypt). El CRM nunca ve ni almacena una contraseña: la
genera, la enseña una vez y la olvida.

## 11. Límite de intentos de acceso

Rate limit de verificación y de códigos bajado de 30 a **10 por hora e IP**, y un
máximo de 2 correos por hora. Frena la fuerza bruta sobre contraseñas.

## 12. Protección contra bots

No hay captcha. La superficie es mínima: **no existe formulario de registro**, ni
de contacto, ni ningún formulario público donde un bot pueda escribir. Lo único
expuesto es el propio inicio de sesión, ya limitado por intentos.

Si algún día hiciera falta, Supabase admite hCaptcha o Turnstile; requiere darse
de alta en uno de esos servicios.

## 13. Consultas parametrizadas

No se construye SQL concatenando texto en ninguna parte. El navegador habla con
PostgREST, que parametriza siempre, y la única función SQL a medida
(`proyecto_por_token`) recibe el token como parámetro.

## 14. Entradas validadas

39 reglas de validación **en la base de datos**, no solo en el formulario.
Comprobado intentando saltarse la interfaz y hablar directo con la API:

| Intento | Resultado |
|---|---|
| Importe de −500 € | rechazado |
| IVA del 900 % | rechazado |
| Correo `no-es-correo` | rechazado |
| Nombre de 50.000 letras | rechazado |
| Enlace `javascript:alert(1)` | rechazado |
| Fase de proyecto inventada | rechazado |

## 15. Contenido de usuario escapado

Todo lo que se pinta pasa por una plantilla que escapa por defecto; para meter
HTML hay que pedirlo explícitamente. Comprobado: guardar
`<img src=x onerror=alert(1)>` como nombre se muestra como texto y no crea
ningún elemento. Además, los enlaces guardados solo se pintan como enlace si
empiezan por `http://` o `https://`.

## 16. Acceso a los archivos

Cubo **privado**: no hay URL pública. Cada descarga usa un enlace firmado que
caduca en una hora. Un cliente solo puede leer los archivos de sus propios
proyectos. Límite de 25 MB y lista blanca de 13 tipos de archivo (PDF, imágenes,
documentos, hojas de cálculo): un ejecutable no entra.

## 17. Respuestas de la API limitadas

Tope de 2.000 filas por respuesta, para que ninguna consulta pueda arrastrar la
base entera de una vez.

## 18. Cabeceras de seguridad

GitHub Pages no permite cabeceras propias, así que la política de seguridad de
contenido va declarada en la propia página, y es estricta:

- `default-src 'none'`: por defecto no se puede cargar nada.
- Scripts: solo del propio sitio, de cdnjs (GSAP) y de esm.sh (Supabase).
  **Sin scripts en línea**, que es por donde entran las inyecciones.
- Conexiones: solo al proyecto de Supabase. Comprobado que cualquier otro
  dominio queda bloqueado.
- `form-action 'none'`, `base-uri 'none'`, `object-src 'none'`.
- Política de referente estricta.

## 19. HTTPS forzado

Activado en GitHub Pages (`https_enforced`), más `upgrade-insecure-requests` en
la política. Supabase solo habla por HTTPS.

## 20. (el punto que faltaba en la lista)

Lo que pondría yo ahí: **copias de seguridad y mínimo privilegio**.

- Copia completa en un clic desde **Ajustes → Descargar copia**, más las copias
  diarias de Supabase.
- El token de gestión de Supabase caduca solo el 8 de octubre de 2026 y se puede
  revocar cuando quieras sin que el CRM deje de funcionar.
- Al rol anónimo se le han retirado los permisos sobre `perfiles` y sobre el
  registro de accesos.

---

## Lo que sigue dependiendo de vosotros

Ninguna medida técnica cubre esto:

- **No reutilicéis** las contraseñas del CRM en otros sitios.
- Pasadle la contraseña al cliente por un canal privado, no por un grupo.
- Si un cliente deja de serlo, **quitadle el acceso** desde su ficha.
- Las claves de hosting y dominios, en un gestor de contraseñas. El CRM guarda
  dónde está cada cosa, no cómo entrar.
