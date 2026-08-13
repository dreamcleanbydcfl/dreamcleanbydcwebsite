/* Dream Clean by DC — Autocompletado de direcciones (Google Places)
 * Archivo: /dc-places.js
 * Reemplaza el autocompletado de Nominatim/OpenStreetMap, cuyo uso para
 * autocomplete está prohibido por su política y puede terminar en bloqueo.
 *
 * Incluir ANTES de dc-sqft.js:
 *   <script src="/dc-places.js" defer></script>
 *   <script src="/dc-sqft.js" defer></script>
 *
 * Conexión:
 *   DCPlaces.attach(document.getElementById('lAddress'), {
 *     onSelect: function (place) { ... }   // place.formatted, place.components
 *   });
 *
 * CLAVE DE COSTOS: usa session tokens. Sin ellos, cada tecla se cobra suelta
 * a $2.83/1,000. Con token, la sesión completa cuesta $0 si cierra con un
 * Place Details. El token se renueva después de cada selección.
 */
(function (window, document) {
  'use strict';

  // Se inyecta desde el HTML: <script>window.DC_MAPS_KEY='...'</script>
  // o mejor, se sirve desde /api/maps-key para no dejarla en el HTML.
  var MAPS_KEY = window.DC_MAPS_KEY || '';

  var loading = null;
  var sessionToken = null;

  function loadGoogle() {
    if (window.google && window.google.maps && window.google.maps.places) {
      return Promise.resolve(true);
    }
    if (loading) return loading;
    if (!MAPS_KEY) return Promise.resolve(false);

    loading = new Promise(function (resolve) {
      var cb = 'dcMapsReady_' + Date.now();
      var done = false;

      window[cb] = function () {
        done = true;
        resolve(true);
      };

      var s = document.createElement('script');
      s.src =
        'https://maps.googleapis.com/maps/api/js?key=' +
        encodeURIComponent(MAPS_KEY) +
        '&libraries=places&loading=async&callback=' + cb;
      s.async = true;
      s.defer = true;
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);

      // Si Google no responde en 8s, seguimos sin autocompletado.
      setTimeout(function () { if (!done) resolve(false); }, 8000);
    });

    return loading;
  }

  function newSession() {
    if (window.google && google.maps.places.AutocompleteSessionToken) {
      sessionToken = new google.maps.places.AutocompleteSessionToken();
    }
    return sessionToken;
  }

  // Extrae los pedazos de la dirección en formato limpio para RentCast
  function parseComponents(place) {
    var out = { street: '', city: '', state: '', zip: '', unit: '' };
    (place.address_components || []).forEach(function (c) {
      var t = c.types;
      if (t.indexOf('street_number') > -1) out.street = c.long_name + ' ' + out.street;
      if (t.indexOf('route') > -1) out.street = (out.street + c.long_name).trim();
      if (t.indexOf('subpremise') > -1) out.unit = c.long_name;
      if (t.indexOf('locality') > -1) out.city = c.long_name;
      if (t.indexOf('administrative_area_level_1') > -1) out.state = c.short_name;
      if (t.indexOf('postal_code') > -1) out.zip = c.long_name;
    });
    out.street = out.street.trim();
    return out;
  }

  function attach(input, opts) {
    opts = opts || {};
    if (!input) return;

    loadGoogle().then(function (ok) {
      if (!ok) {
        // Sin Google: el campo sigue siendo un input normal. Nada se rompe.
        input.setAttribute('placeholder', input.getAttribute('placeholder') || 'Your address');
        if (typeof opts.onUnavailable === 'function') opts.onUnavailable();
        return;
      }

      var ac = new google.maps.places.Autocomplete(input, {
        types: ['address'],
        componentRestrictions: { country: 'us' },
        // Pedimos solo estos campos: menos campos = SKU más barato.
        fields: ['formatted_address', 'address_components', 'geometry.location'],
      });

      newSession();

      ac.addListener('place_changed', function () {
        var place = ac.getPlace();
        if (!place || !place.address_components) return;

        var components = parseComponents(place);
        var result = {
          formatted: place.formatted_address || '',
          components: components,
          // Dirección limpia para el lookup de sq ft (sin número de unidad,
          // porque los registros públicos indexan el edificio, no el apto).
          lookupAddress: [
            components.street,
            components.city,
            components.state + ' ' + components.zip,
          ].filter(Boolean).join(', '),
          isUnit: !!components.unit,
        };

        // Cierra la sesión y abre una nueva para la próxima búsqueda.
        newSession();

        input.dataset.dcFormatted = result.formatted;
        input.dataset.dcLookup = result.lookupAddress;
        input.dataset.dcUnit = result.isUnit ? '1' : '';

        if (typeof opts.onSelect === 'function') opts.onSelect(result);

        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Evita que Enter envíe el formulario mientras la lista está abierta.
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') e.preventDefault();
      });
    });
  }

  window.DCPlaces = { attach: attach, load: loadGoogle };
})(window, document);
