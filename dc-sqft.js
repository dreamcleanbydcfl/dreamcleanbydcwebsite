/* Dream Clean by DC — Autollenado de pies cuadrados habitables
 * Archivo: /dc-sqft.js   (cargar DESPUÉS de dc-places.js)
 *
 *   <script src="/dc-places.js" defer></script>
 *   <script src="/dc-sqft.js" defer></script>
 *
 * Conexión (una línea por calculadora):
 *   DCSqft.wire({
 *     addressInput: document.getElementById('lAddress'),
 *     sqftInput:    document.getElementById('sqft'),     // slider O input
 *     statusEl:     document.getElementById('sqftNote'), // opcional
 *   });
 *
 * Funciona con sliders (input[type=range]) y con inputs de texto, y con
 * calculadoras de React (usa el setter nativo para que el estado se entere).
 */
(function (window, document) {
  'use strict';

  var ENDPOINT = window.DC_SQFT_ENDPOINT || '/api/sqft';

  var cache = {};
  var currentReq = 0;

  var T = {
    searching: 'Buscando el tamaño de la propiedad…',
    found: function (n) {
      return 'Aprox. ' + n.toLocaleString('en-US') +
        ' sq ft según registros públicos. Ajústalo si no coincide.';
    },
    clamped: function (n, lim) {
      return 'Esta propiedad mide ~' + n.toLocaleString('en-US') +
        ' sq ft. Ajustamos al máximo de la calculadora (' +
        lim.toLocaleString('en-US') + '). Escríbenos para un estimado exacto.';
    },
    unit: 'Para apartamentos no tenemos el tamaño exacto. Ajusta el control tú.',
    none: 'No encontramos el tamaño de esta propiedad. Ajusta el control tú.',
  };

  function setStatus(el, text, state) {
    if (!el) return;
    el.textContent = text || '';
    el.setAttribute('data-state', state || '');
    el.style.display = text ? '' : 'none';
  }

  /* Escribe un valor en un input de forma que React también se entere. */
  function setValue(input, value) {
    var proto = input instanceof window.HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    var setter = Object.getOwnPropertyDescriptor(proto, 'value');
    if (setter && setter.set) {
      setter.set.call(input, String(value));
    } else {
      input.value = String(value);
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function lookup(address) {
    var key = String(address || '').trim().toLowerCase();
    if (key.length < 8) {
      return Promise.resolve({ ok: false, sqft: null, reason: 'short' });
    }
    if (cache[key]) return Promise.resolve(cache[key]);

    var myReq = ++currentReq;
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 8000);

    return fetch(ENDPOINT + '?address=' + encodeURIComponent(address), {
      signal: ctrl.signal,
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        clearTimeout(timer);
        cache[key] = data;
        // Si el cliente ya cambió de dirección, descartamos esta respuesta.
        if (myReq !== currentReq) return { ok: false, sqft: null, reason: 'stale' };
        return data;
      })
      .catch(function () {
        clearTimeout(timer);
        return { ok: false, sqft: null, reason: 'network' };
      });
  }

  function wire(opts) {
    var addressInput = opts.addressInput;
    var sqftInput = opts.sqftInput;
    var statusEl = opts.statusEl || null;
    if (!addressInput || !sqftInput) return;

    var isRange = sqftInput.type === 'range';
    var min = isRange ? Number(sqftInput.min) || 0 : 0;
    var max = isRange ? Number(sqftInput.max) || Infinity : Infinity;

    // Si el cliente mueve el control a mano, ya no lo tocamos más.
    var manual = false;
    sqftInput.addEventListener('pointerdown', function () { manual = true; });
    sqftInput.addEventListener('keydown', function () { manual = true; });

    function apply(data, isUnit) {
      if (manual) return;

      if (isUnit) {
        setStatus(statusEl, T.unit, 'unit');
        return;
      }
      if (!data || !data.ok || !data.sqft) {
        if (data && data.reason === 'stale') return;
        setStatus(statusEl, T.none, 'empty');
        return;
      }

      var raw = data.sqft;
      var val = Math.min(Math.max(raw, min), max);

      // Los sliders van de 50 en 50; alineamos para que no quede a medias.
      var step = Number(sqftInput.step) || 0;
      if (step > 1) val = Math.round(val / step) * step;

      setValue(sqftInput, val);
      setStatus(
        statusEl,
        raw > max ? T.clamped(raw, max) : T.found(val),
        raw > max ? 'clamped' : 'ok'
      );
    }

    function run(address, isUnit) {
      if (manual) return;
      setStatus(statusEl, T.searching, 'loading');
      lookup(address).then(function (d) { apply(d, isUnit); });
    }

    // Camino 1: el cliente eligió una sugerencia de Google Places.
    if (window.DCPlaces) {
      window.DCPlaces.attach(addressInput, {
        onSelect: function (place) {
          run(place.lookupAddress, place.isUnit);
        },
      });
    }

    // Camino 2: sin Places (o el cliente pegó la dirección). Al salir del
    // campo, intentamos igual. Cuesta lo mismo y rescata muchos casos.
    addressInput.addEventListener('blur', function () {
      if (addressInput.dataset.dcLookup) return; // ya lo resolvió Places
      var v = addressInput.value.trim();
      if (v.length >= 10 && /\d/.test(v)) run(v, false);
    });

    // Si borra la dirección, limpiamos el mensaje.
    addressInput.addEventListener('input', function () {
      if (!addressInput.value.trim()) {
        delete addressInput.dataset.dcLookup;
        setStatus(statusEl, '', '');
      }
    });
  }

  window.DCSqft = { lookup: lookup, wire: wire };
})(window, document);
