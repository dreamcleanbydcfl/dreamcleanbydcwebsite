// Dream Clean by DC — Lookup de pies cuadrados habitables (living area)
// Ubicación en el repo: /api/sqft.js  (Vercel Serverless Function, Node.js)
//
// Variable de entorno requerida en Vercel (Settings > Environment Variables):
//   RENTCAST_API_KEY = tu llave de https://app.rentcast.io/app/api
//
// REGLA DE ORO: esta función NUNCA devuelve un error que rompa la calculadora.
// Siempre responde 200 con { ok: true|false, sqft: number|null, ... }

const ALLOWED_ORIGINS = [
  'https://www.dreamcleanbydc.com',
  'https://dreamcleanbydc.com',
  'https://portal.dreamcleanbydc.com',
  'https://atrium.dreamcleanbydc.com',
  'https://card.dreamcleanbydc.com',
  'https://referrals.dreamcleanbydc.com',
];

// Rangos de cordura: si el dato viene fuera de esto, no confiamos en él.
const MIN_SQFT = 200;
const MAX_SQFT = 25000;

function setCors(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Normaliza la dirección para que el cache acierte más seguido
function normalizeAddress(raw) {
  var out = String(raw || '').split(' ').filter(Boolean).join(' ').trim();
  var low = out.toLowerCase();
  if (low.endsWith(', usa')) out = out.slice(0, -5).trim();
  else if (low.endsWith(', united states')) out = out.slice(0, -15).trim();
  if (out.endsWith(',')) out = out.slice(0, -1).trim();
  return out;
}

async function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    return res.status(200).json({ ok: false, sqft: null, reason: 'method' });
  }

  const address = normalizeAddress(req.query.address);

  if (address.length < 8) {
    return res.status(200).json({ ok: false, sqft: null, reason: 'address_too_short' });
  }

  const apiKey = process.env.RENTCAST_API_KEY;
  if (!apiKey) {
    // Falta configurar la llave: la calculadora sigue funcionando manual.
    return res.status(200).json({ ok: false, sqft: null, reason: 'not_configured' });
  }

  try {
    const url =
      'https://api.rentcast.io/v1/properties?address=' + encodeURIComponent(address);

    const r = await fetchWithTimeout(
      url,
      { headers: { 'X-Api-Key': apiKey, Accept: 'application/json' } },
      6000
    );

    if (!r.ok) {
      // 401 = llave mala | 429 = cuota agotada | 5xx = caído del lado de ellos
      return res.status(200).json({
        ok: false,
        sqft: null,
        reason: r.status === 429 ? 'quota' : 'upstream_' + r.status,
      });
    }

    const data = await r.json();
    const rec = Array.isArray(data) ? data[0] : data;

    if (!rec) {
      return res.status(200).json({ ok: false, sqft: null, reason: 'not_found' });
    }

    const sqft = Number(rec.squareFootage);
    const valid = Number.isFinite(sqft) && sqft >= MIN_SQFT && sqft <= MAX_SQFT;

    if (!valid) {
      return res.status(200).json({
        ok: false,
        sqft: null,
        reason: 'no_sqft',
        propertyType: rec.propertyType || null,
      });
    }

    // Cache en el CDN de Vercel: 30 días. Misma dirección = 0 llamadas pagadas.
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=2592000, stale-while-revalidate=86400'
    );

    return res.status(200).json({
      ok: true,
      sqft: Math.round(sqft),
      bedrooms: rec.bedrooms == null ? null : rec.bedrooms,
      bathrooms: rec.bathrooms == null ? null : rec.bathrooms,
      yearBuilt: rec.yearBuilt == null ? null : rec.yearBuilt,
      propertyType: rec.propertyType || null,
      source: 'public_records',
    });
  } catch (err) {
    // Timeout, red caída, JSON malo — todo termina aquí sin romper nada.
    return res.status(200).json({ ok: false, sqft: null, reason: 'timeout_or_network' });
  }
};
