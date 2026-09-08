# Avisos por email

El CRM ya te enseña los vencimientos al entrar y te los exporta al calendario. Si además
quieres un correo automático (por ejemplo, todos los lunes por la mañana), esto lo activa.

Requisitos: el CRM ya conectado a Supabase y la [CLI de Supabase](https://supabase.com/docs/guides/cli)
instalada (`brew install supabase/tap/supabase`).

---

## 1. Cuenta de envío

Crea una cuenta gratuita en [resend.com](https://resend.com) (3.000 correos al mes) y copia
la **API key**. Para que el remitente sea `crm@puntozerosl.es` tendrás que verificar el
dominio en Resend; mientras tanto puedes enviar desde `onboarding@resend.dev`.

## 2. Guardar los secretos

```bash
supabase login
supabase link --project-ref TU_REFERENCIA_DE_PROYECTO

supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
supabase secrets set AVISOS_PARA="alex@puntozerosl.es,socio@puntozerosl.es"
supabase secrets set AVISOS_DESDE="CRM PuntoZero <onboarding@resend.dev>"
supabase secrets set AVISOS_DIAS=15
```

## 3. Desplegar la función

```bash
supabase functions deploy avisos
```

Pruébala a mano:

```bash
curl -X POST "https://TU-REFERENCIA.supabase.co/functions/v1/avisos" \
     -H "Authorization: Bearer TU_CLAVE_ANON"
```

Si no hay nada que vence, responde `{"enviado":false,"motivo":"nada que avisar"}`.
Es la respuesta correcta, no un error.

## 4. Programarla

En Supabase: **SQL Editor**, y ejecuta esto una vez (cambia la referencia y la clave):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
    'avisos-crm-lunes',
    '0 8 * * 1',                       -- lunes a las 8:00 UTC
    $$
    select net.http_post(
        url     := 'https://TU-REFERENCIA.supabase.co/functions/v1/avisos',
        headers := '{"Content-Type":"application/json","Authorization":"Bearer TU_CLAVE_ANON"}'::jsonb
    );
    $$
);
```

Para cambiar la frecuencia, edita la expresión cron (`0 8 * * *` sería todos los días).
Para quitarlo: `select cron.unschedule('avisos-crm-lunes');`

## Si algo falla

- **No llega el correo**: mira **Edge Functions → avisos → Logs** en Supabase.
- **`Faltan RESEND_API_KEY o AVISOS_PARA`**: repite el paso 2, los secretos no se guardaron.
- **Llega a spam**: verifica tu dominio en Resend y envía desde `@puntozerosl.es`.
