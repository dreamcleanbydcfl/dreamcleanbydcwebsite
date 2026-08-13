// Dream Clean by DC — Aviso por email cuando entra un lead nuevo
// Ubicacion en el repo: /api/lead-alert.js
//
// Variables de entorno en Vercel:
//   RESEND_API_KEY     llave de resend.com
//   LEAD_ALERT_TO      a quien avisar (ej: info@dreamcleanbydc.com)
//   LEAD_ALERT_FROM    remitente verificado (ej: onboarding@resend.dev)
//   LEAD_ALERT_SECRET  palabra secreta, la misma que se pone en el webhook
//
// Lo llama un Database Webhook de Supabase cuando se inserta una fila
// en la tabla de leads.
//
// REGLA: siempre responde 200. Si devolviera error, Supabase lo reintentaria
// una y otra vez. Mejor fallar en silencio y dejar rastro en los logs.

function esc(s) {
  return String(s == null ? '' : s)
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;');
}

function fila(etiqueta, valor) {
  if (!valor) return '';
  return '<tr>' +
    '<td style="padding:6px 12px 6px 0;color:#7a7268;font-size:13px;white-space:nowrap">' + esc(etiqueta) + '</td>' +
    '<td style="padding:6px 0;color:#2e2a25;font-size:15px;font-weight:600">' + esc(valor) + '</td>' +
    '</tr>';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: false, reason: 'method' });
  }

  // Solo Supabase puede llamar aqui
  const secretoEsperado = process.env.LEAD_ALERT_SECRET || '';
  const secretoRecibido = req.headers['x-dc-secret'] || '';
  if (!secretoEsperado || secretoRecibido !== secretoEsperado) {
    console.log('[lead-alert] rechazado: secreto invalido');
    return res.status(200).json({ ok: false, reason: 'auth' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const para = process.env.LEAD_ALERT_TO;
  const de = process.env.LEAD_ALERT_FROM || 'onboarding@resend.dev';

  if (!apiKey || !para) {
    console.log('[lead-alert] falta configurar RESEND_API_KEY o LEAD_ALERT_TO');
    return res.status(200).json({ ok: false, reason: 'not_configured' });
  }

  // Supabase manda { type, table, record, old_record }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const lead = (body && body.record) || body || {};

  // Nombres reales de las columnas (vienen del RPC submit_lead)
  const nombre = lead.full_name || lead.name || 'Sin nombre';
  const telefono = lead.phone || '';
  const email = lead.email || '';
  const servicio = lead.cleaning_type || '';
  const estimado = lead.estimated_range || '';
  const sqft = lead.sqft || '';
  const recamaras = lead.bedrooms || '';
  const banos = lead.bathrooms || '';
  const frecuencia = lead.frequency || '';
  const extras = lead.addons || '';
  const fechaPref = lead.preferred_date || '';
  const horaPref = lead.preferred_time || '';
  const codigo = lead.discount_code || '';
  const referidoPor = lead.referred_by || '';
  const smsOk = lead.sms_consent ? 'Si' : '';

  // El formulario guarda la direccion dentro de notes como
  // "Service address: 1008 Delaney Park Dr, ...". La separamos para
  // que se lea bien en el email.
  let notas = lead.notes || '';
  let direccion = '';
  const marca = 'Service address:';
  if (notas.indexOf(marca) === 0) {
    direccion = notas.slice(marca.length).trim();
    notas = '';
  }

  const telLimpio = String(telefono).replace(/[^0-9]/g, '');

  const html =
    '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px">' +
      '<p style="margin:0 0 4px;color:#b68911;font-size:12px;letter-spacing:1.5px;text-transform:uppercase">Dream Clean by DC</p>' +
      '<h1 style="margin:0 0 20px;font-size:22px;color:#2e2a25">Nuevo estimado solicitado</h1>' +
      '<table style="border-collapse:collapse;width:100%">' +
        fila('Nombre', nombre) +
        fila('Telefono', telefono) +
        fila('Email', email) +
        fila('Direccion', direccion) +
        fila('Servicio', servicio) +
        fila('Frecuencia', frecuencia) +
        fila('Estimado', estimado) +
        fila('Tamano', sqft ? sqft + ' sq ft' : '') +
        fila('Recamaras', recamaras) +
        fila('Banos', banos) +
        fila('Extras', extras) +
        fila('Fecha preferida', fechaPref) +
        fila('Hora preferida', horaPref) +
        fila('Codigo', codigo) +
        fila('Referido por', referidoPor) +
        fila('Acepta SMS', smsOk) +
        fila('Notas', notas) +
      '</table>' +
      '<div style="margin:24px 0 8px">' +
        (telLimpio ? '<a href="tel:+1' + esc(telLimpio) + '" style="display:inline-block;background:#b68911;color:#fff;text-decoration:none;padding:11px 20px;border-radius:6px;font-weight:600;font-size:14px;margin-right:8px">Llamar ahora</a>' : '') +
        '<a href="https://portal.dreamcleanbydc.com" style="display:inline-block;background:#2e2a25;color:#fff;text-decoration:none;padding:11px 20px;border-radius:6px;font-weight:600;font-size:14px">Ver en el portal</a>' +
      '</div>' +
      '<p style="margin:20px 0 0;color:#9a938a;font-size:12px;line-height:1.5">Los primeros minutos son los que mas convierten. Si puedes, llama hoy mismo.</p>' +
    '</div>';

  // Sin secuencias de escape a proposito: los backslashes se corrompen al
  // copiar el archivo entre herramientas y el bug queda invisible.
  const NL = String.fromCharCode(10);
  const linea = function (etq, val) { return val ? etq + ': ' + val + NL : ''; };

  const texto =
    'NUEVO ESTIMADO SOLICITADO' + NL + NL +
    linea('Nombre', nombre) +
    linea('Telefono', telefono) +
    linea('Email', email) +
    linea('Direccion', direccion) +
    linea('Servicio', servicio) +
    linea('Estimado', estimado) +
    NL + 'Ver en el portal: https://portal.dreamcleanbydc.com';

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Dream Clean <' + de + '>',
        to: [para],
        reply_to: email || undefined,
        subject: 'Nuevo estimado: ' + nombre + (estimado ? ' (' + estimado + ')' : ''),
        html: html,
        text: texto,
      }),
    });

    const detalle = await r.text();
    if (!r.ok) {
      console.log('[lead-alert] resend fallo', r.status, detalle.slice(0, 200));
      return res.status(200).json({ ok: false, reason: 'resend_' + r.status });
    }

    console.log('[lead-alert] enviado a', para, 'lead:', nombre);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.log('[lead-alert] excepcion', err && err.message);
    return res.status(200).json({ ok: false, reason: 'exception' });
  }
};
