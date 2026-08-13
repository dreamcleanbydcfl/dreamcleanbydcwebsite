// Dream Clean by DC — Entrega la llave de Google Maps al navegador
// Ubicación en el repo: /api/maps-key.js
//
// Variable de entorno: GOOGLE_MAPS_KEY
//
// Por qué existe: los sitios son HTML estático y no pueden leer variables de
// entorno. Este endpoint devuelve un JS que define window.DC_MAPS_KEY.
//
// ¿No es inseguro publicar la llave? No más que ponerla en el HTML — las
// llaves de Google Maps para navegador SIEMPRE son visibles para el cliente.
// Lo que de verdad la protege es la restricción por dominio que está puesta
// en Google Cloud (solo *.dreamcleanbydc.com). Esto además permite rotarla
// sin tocar el código de ningún sitio.

const ALLOWED_HOSTS = [
  'www.dreamcleanbydc.com',
  'dreamcleanbydc.com',
  'portal.dreamcleanbydc.com',
  'atrium.dreamcleanbydc.com',
  'card.dreamcleanbydc.com',
  'referrals.dreamcleanbydc.com',
];

function hostAllowed(value) {
  if (!value) return false;
  try {
    const host = new URL(value).hostname;
    if (ALLOWED_HOSTS.indexOf(host) > -1) return true;
    // Previews de Vercel del equipo dream-clean
    if (host.slice(-27) === '-dream-clean.vercel.app') return true;
    if (host.indexOf('dreamcleanbydcwebsite') === 0 && host.slice(-10) === 'vercel.app') return true;
    return false;
  } catch (e) {
    return false;
  }
}

module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  // Sin cache largo: si rotas la llave, se propaga en 5 minutos.
  res.setHeader('Cache-Control', 'public, max-age=300');

  const from = req.headers.origin || req.headers.referer || '';

  if (!hostAllowed(from)) {
    // No es un sitio nuestro. Devolvemos vacío: las calculadoras siguen
    // funcionando en modo manual, nadie se queda con la llave.
    return res.status(200).send('window.DC_MAPS_KEY="";');
  }

  const key = process.env.GOOGLE_MAPS_KEY || '';
  return res.status(200).send('window.DC_MAPS_KEY=' + JSON.stringify(key) + ';');
};
