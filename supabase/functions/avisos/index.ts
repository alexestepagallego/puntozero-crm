/**
 * Función programada: envía un correo con lo que vence en los próximos días.
 *
 * Variables de entorno necesarias (Supabase → Edge Functions → Secrets):
 *   SUPABASE_URL                  · la pone Supabase sola
 *   SUPABASE_SERVICE_ROLE_KEY     · la pone Supabase sola
 *   RESEND_API_KEY                · tu clave de resend.com (plan gratuito)
 *   AVISOS_PARA                   · a quién se envía (varios separados por comas)
 *   AVISOS_DESDE                  · remitente verificado, p. ej. "CRM <crm@puntozerosl.es>"
 *   AVISOS_DIAS                   · opcional, días de antelación (por defecto 15)
 *
 * Despliegue:  supabase functions deploy avisos
 * Programación: ver docs/AVISOS-POR-EMAIL.md
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const DIAS = Number(Deno.env.get('AVISOS_DIAS') ?? 15);

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const euros = (n: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);

const fecha = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

function dias(iso: string) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Math.round((new Date(iso + 'T00:00:00').getTime() - hoy.getTime()) / 86400000);
}

interface Aviso { titulo: string; detalle: string; fecha: string; dias: number }

async function recopilar(): Promise<Aviso[]> {
    const limite = new Date();
    limite.setDate(limite.getDate() + DIAS);
    const hasta = limite.toISOString().slice(0, 10);

    const [clientes, dominios, cuotas, pagos, proyectos] = await Promise.all([
        supabase.from('clientes').select('id, empresa, nombre'),
        supabase.from('dominios').select('dominio, registrador, cliente_id, fecha_renovacion').lte('fecha_renovacion', hasta),
        supabase.from('suscripciones').select('concepto, importe, periodicidad, cliente_id, proxima_fecha').eq('activa', true).lte('proxima_fecha', hasta),
        supabase.from('pagos').select('concepto, importe, cliente_id, fecha_vencimiento').eq('estado', 'pendiente').lte('fecha_vencimiento', hasta),
        supabase.from('proyectos').select('nombre, estado, cliente_id, fecha_entrega').not('estado', 'in', '("Publicado","Mantenimiento")').lte('fecha_entrega', hasta),
    ]);

    const nombre = (id: string) => {
        const c = (clientes.data ?? []).find((x) => x.id === id);
        return c ? (c.empresa ?? c.nombre ?? '') : 'Sin cliente';
    };

    const avisos: Aviso[] = [];

    for (const d of dominios.data ?? []) {
        avisos.push({
            titulo: `Renovar dominio ${d.dominio}`,
            detalle: `${nombre(d.cliente_id)}${d.registrador ? ` · ${d.registrador}` : ''}`,
            fecha: d.fecha_renovacion, dias: dias(d.fecha_renovacion),
        });
    }
    for (const s of cuotas.data ?? []) {
        avisos.push({
            titulo: `Cobrar ${s.concepto} · ${euros(s.importe)}`,
            detalle: `${nombre(s.cliente_id)} · ${s.periodicidad}`,
            fecha: s.proxima_fecha, dias: dias(s.proxima_fecha),
        });
    }
    for (const p of pagos.data ?? []) {
        avisos.push({
            titulo: `Pago pendiente: ${p.concepto} · ${euros(p.importe)}`,
            detalle: nombre(p.cliente_id),
            fecha: p.fecha_vencimiento, dias: dias(p.fecha_vencimiento),
        });
    }
    for (const p of proyectos.data ?? []) {
        if (!p.fecha_entrega) continue;
        avisos.push({
            titulo: `Entrega de ${p.nombre}`,
            detalle: `${nombre(p.cliente_id)} · ${p.estado}`,
            fecha: p.fecha_entrega, dias: dias(p.fecha_entrega),
        });
    }

    return avisos.sort((a, b) => a.dias - b.dias);
}

function plantilla(avisos: Aviso[]) {
    const fila = (a: Aviso) => `
        <tr>
            <td style="padding:12px 0;border-bottom:1px solid #eee">
                <div style="font-weight:600;font-size:14px;color:#111">${a.titulo}</div>
                <div style="font-size:12px;color:#777">${a.detalle}</div>
            </td>
            <td style="padding:12px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;font-size:12px;color:${a.dias < 0 ? '#9b2020' : a.dias <= 7 ? '#8a5a00' : '#777'}">
                ${fecha(a.fecha)}<br>${a.dias < 0 ? `hace ${Math.abs(a.dias)} días` : a.dias === 0 ? 'hoy' : `en ${a.dias} días`}
            </td>
        </tr>`;

    return `
    <div style="font-family:Inter,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#0a0a0a"></span>
            <strong style="font-size:16px">PuntoZero · CRM</strong>
        </div>
        <p style="color:#777;font-size:13px;margin:0 0 20px">Esto es lo que vence en los próximos ${DIAS} días.</p>
        <table style="width:100%;border-collapse:collapse">${avisos.map(fila).join('')}</table>
        <p style="margin-top:24px;font-size:12px;color:#999">
            Enviado automáticamente por el CRM de PuntoZero.
        </p>
    </div>`;
}

Deno.serve(async () => {
    try {
        const avisos = await recopilar();

        if (!avisos.length) {
            return Response.json({ enviado: false, motivo: 'nada que avisar' });
        }

        const clave = Deno.env.get('RESEND_API_KEY');
        const para = (Deno.env.get('AVISOS_PARA') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        if (!clave || !para.length) {
            return Response.json({ error: 'Faltan RESEND_API_KEY o AVISOS_PARA' }, { status: 400 });
        }

        const respuesta = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: Deno.env.get('AVISOS_DESDE') ?? 'CRM PuntoZero <onboarding@resend.dev>',
                to: para,
                subject: `PuntoZero · ${avisos.length} vencimientos (${avisos.filter((a) => a.dias < 0).length} atrasados)`,
                html: plantilla(avisos),
            }),
        });

        if (!respuesta.ok) {
            return Response.json({ error: await respuesta.text() }, { status: 502 });
        }
        return Response.json({ enviado: true, avisos: avisos.length });
    } catch (e) {
        return Response.json({ error: String(e) }, { status: 500 });
    }
});
