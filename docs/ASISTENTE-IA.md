# Asistente con IA

El CRM lleva un asistente que entiende órdenes escritas y prepara los cambios
para que tú los confirmes. Ejemplos de lo que le puedes pedir:

- «¿Quién me debe dinero?»
- «Crea un cliente: Bar Pepe, contacto Luis, teléfono 600112233»
- «Pon la carta de Villegas en Publicado»
- «Añade un pago de 150 € a Bocatería Sur, vence el 30 de este mes»
- «Sube a 200 € el precio de la web de Dynamic Health»

Nunca cambia nada por su cuenta: **te enseña lo que va a hacer y tú confirmas**.
Y todo lo que aplica pasa por los mismos permisos y validaciones que cuando lo
haces a mano.

---

## Activarlo (una sola vez, gratis)

### 1. Consigue tu clave de Gemini

1. Entra en <https://aistudio.google.com/apikey> con tu cuenta **personal** de
   Google (no la de la universidad: esa es para uso académico y podría cortarse).
2. Pulsa **Create API key**. Te da un código que empieza por `AIza…`.
3. Cópialo. Es gratis y no pide tarjeta.

> Al estar en España (Espacio Económico Europeo), Google **no usa** lo que
> escribes para entrenar sus modelos. Tus datos de clientes se quedan tuyos.

### 2. Guárdala en el proyecto

La clave vive en el **servidor**, nunca en la web. Dos formas:

**Opción A — desde el panel de Supabase (sin instalar nada):**
1. Entra en tu proyecto en supabase.com.
2. **Edge Functions → asistente → Secrets** (o **Project Settings → Edge Functions → Secrets**).
3. Añade un secreto: nombre `GEMINI_API_KEY`, valor tu clave `AIza…`. Guarda.

**Opción B — desde la terminal (si tienes la CLI de Supabase):**
```bash
supabase secrets set GEMINI_API_KEY=AIza_tu_clave_aqui
```

### 3. Listo

Abre el CRM, pulsa el botón redondo de abajo a la derecha y escríbele algo.
No hay que volver a desplegar nada: la función coge la clave sola.

---

## Ajustes opcionales

- **Cambiar de modelo**: por defecto usa `gemini-flash-latest` (rápido y gratis).
  Para otro, añade el secreto `GEMINI_MODEL` con el nombre que quieras.
- **Límite gratuito**: el plan gratis de Gemini tiene un tope de peticiones al
  día, de sobra para el día a día. Si algún día lo agotas, el asistente te avisa
  y basta con esperar un rato.

## Cómo está montado (seguridad)

- La clave de Gemini está solo en el servidor. La web nunca la ve.
- La función del asistente comprueba, contra la base de datos, que quien
  escribe es del equipo (admin). Un cliente no puede usarla.
- La IA **no tiene permiso de escritura**: solo propone. Los cambios los aplica
  el CRM con tu sesión, por el camino de siempre (permisos RLS + validaciones).
- Solo puede tocar las tablas de trabajo (clientes, proyectos, pagos…), nunca
  usuarios, contraseñas ni permisos.
