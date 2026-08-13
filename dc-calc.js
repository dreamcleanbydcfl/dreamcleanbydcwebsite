/* Dream Clean by DC — Cableado automático de las calculadoras
 * Vive en: https://www.dreamcleanbydc.com/dc-calc.js
 * Se carga desde dc-legal.js, que ya está en los 5 sitios.
 *
 * Qué hace, en orden:
 *   1. Encuentra el campo de dirección y el control de sq ft de la página
 *   2. Si el campo NO lo maneja React, lo clona para matar el autocompletado
 *      de Nominatim (prohibido por OpenStreetMap) y le pone Google Places
 *   3. Si SÍ lo maneja React, no lo toca, y solo busca el sq ft al salir del
 *      campo. Menos vistoso, pero cero riesgo de romper la calculadora.
 *   4. Nunca hace nada si no encuentra los dos campos.
 *
 * REGLA: este archivo jamás debe romper una calculadora que hoy funciona.
 * Ante la duda, no hace nada.
 */
(function (window, document) {
  'use strict';

  var ORIGIN = 'https://www.dreamcleanbydc.com';
  var SQFT_ENDPOINT = ORIGIN + '/api/sqft';
  var MAPS_KEY_URL = ORIGIN + '/api/maps-key';

  var MIN_ADDR_LEN = 10;

  /* ---------- utilidades ---------- */

  function log() {
    if (window.DC_DEBUG && window.console) {
      console.log.apply(console, ['[dc-calc]'].concat([].slice.call(arguments)));
    }
  }

  // Este input lo controla React? Si si, no lo tocamos.
  function isReactManaged(el) {
    for (var k in el) {
      if (k.indexOf('__reactProps') === 0 ||
          k.indexOf('__reactFiber') === 0 ||
          k.indexOf('__reactEventHandlers') === 0) return true;
    }
    return !!el._valueTracker;
  }

  // Tiene algun digito? (sin regex a proposito: los backslashes se corrompen
  // facil al copiar el archivo entre herramientas y el bug es invisible)
  function hasDigit(s) {
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 48 && c <= 57) return true;
    }
    return false;
  }

  // Escribe un valor de forma que React también se entere
  function setValue(input, value) {
    var d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    if (d && d.set) d.set.call(input, String(value));
    else input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* ---------- encontrar los campos ---------- */

  function findAddressInput() {
    var byId = document.getElementById('lAddress');
    if (byId) return byId;
    var inputs = [].slice.call(document.querySelectorAll('input[type=text], input:not([type])'));
    for (var i = 0; i < inputs.length; i++) {
      var ph = (inputs[i].getAttribute('placeholder') || '').toLowerCase();
      if (ph.indexOf('address') > -1 || ph.indexOf('direcc') > -1 ||
          ph.indexOf('main st') > -1) return inputs[i];
    }
    return null;
  }

  function findSqftInput() {
    var byId = document.getElementById('sqft');
    if (byId) return byId;
    var ranges = [].slice.call(document.querySelectorAll('input[type=range]'));
    for (var i = 0; i < ranges.length; i++) {
      var min = Number(ranges[i].min), max = Number(ranges[i].max);
      // El slider de sq ft va de cientos a miles. El de ventanas va de 0 a 10.
      if (min >= 100 && max >= 1000) return ranges[i];
    }
    return null;
  }

  /* ---------- mensaje al cliente ---------- */

  function ensureStatusEl(afterEl) {
    var existing = document.getElementById('dcSqftNote');
    if (existing) return existing;
    var p = document.createElement('p');
    p.id = 'dcSqftNote';
    p.style.cssText =
      'margin:6px 0 0;font-size:12px;line-height:1.4;opacity:.75;display:none';
    if (afterEl && afterEl.parentNode) {
      afterEl.parentNode.insertBefore(p, afterEl.nextSibling);
    }
    return p;
  }

  function setStatus(el, text) {
    if (!el) return;
    el.textContent = text || '';
    el.style.display = text ? '' : 'none';
  }

  /* ---------- lookup de sq ft ---------- */

  var cache = {};

  function lookupSqft(address) {
    var key = String(address || '').trim().toLowerCase();
    if (key.length < MIN_ADDR_LEN) {
      return Promise.resolve({ ok: false, reason: 'short' });
    }
    if (cache[key]) return Promise.resolve(cache[key]);

    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 8000);

    return fetch(SQFT_ENDPOINT + '?address=' + encodeURIComponent(address), {
      signal: ctrl.signal,
    })
      .then(function (r) { return r.json(); })
      .then(function (d) { clearTimeout(timer); cache[key] = d; return d; })
      .catch(function () { clearTimeout(timer); return { ok: false, reason: 'network' }; });
  }

  function applySqft(sqftInput, statusEl, data, manualRef) {
    if (manualRef.moved) return;
    if (!data || !data.ok || !data.sqft) {
      setStatus(statusEl, 'No encontramos el tamaño de esta propiedad. Ajústalo tú.');
      return;
    }
    var min = Number(sqftInput.min) || 0;
    var max = Number(sqftInput.max) || Infinity;
    var step = Number(sqftInput.step) || 0;

    var raw = data.sqft;
    var val = Math.min(Math.max(raw, min), max);
    if (step > 1) val = Math.round(val / step) * step;

    setValue(sqftInput, val);

    setStatus(
      statusEl,
      raw > max
        ? 'Esta propiedad mide ~' + raw.toLocaleString('en-US') +
          ' sq ft, más que el máximo de la calculadora. Escríbenos para un estimado exacto.'
        : 'Aprox. ' + val.toLocaleString('en-US') +
          ' sq ft según registros públicos. Ajústalo si no coincide.'
    );
  }

  /* ---------- Google Places ---------- */

  function loadMapsKey() {
    if (window.DC_MAPS_KEY) return Promise.resolve(window.DC_MAPS_KEY);
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = MAPS_KEY_URL;
      s.onload = function () { resolve(window.DC_MAPS_KEY || ''); };
      s.onerror = function () { resolve(''); };
      document.head.appendChild(s);
      setTimeout(function () { resolve(window.DC_MAPS_KEY || ''); }, 5000);
    });
  }

  function loadPlaces(key) {
    if (!key) return Promise.resolve(false);
    if (window.google && window.google.maps && window.google.maps.places) {
      return Promise.resolve(true);
    }
    return new Promise(function (resolve) {
      var cb = 'dcMapsReady' + Date.now();
      var settled = false;
      window[cb] = function () { settled = true; resolve(true); };
      var s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js?key=' +
        encodeURIComponent(key) + '&libraries=places&loading=async&callback=' + cb;
      s.async = true;
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
      setTimeout(function () { if (!settled) resolve(false); }, 8000);
    });
  }

  function cleanAddress(place) {
    var street = '', city = '', state = '', zip = '', unit = '';
    (place.address_components || []).forEach(function (c) {
      var t = c.types;
      if (t.indexOf('street_number') > -1) street = c.long_name + ' ' + street;
      if (t.indexOf('route') > -1) street = (street + c.long_name).trim();
      if (t.indexOf('subpremise') > -1) unit = c.long_name;
      if (t.indexOf('locality') > -1) city = c.long_name;
      if (t.indexOf('administrative_area_level_1') > -1) state = c.short_name;
      if (t.indexOf('postal_code') > -1) zip = c.long_name;
    });
    return {
      lookup: [street.trim(), city, (state + ' ' + zip).trim()].filter(Boolean).join(', '),
      isUnit: !!unit,
    };
  }

  /* ---------- arranque ---------- */

  function start() {
    var addressInput = findAddressInput();
    var sqftInput = findSqftInput();

    if (!addressInput || !sqftInput) {
      log('no encontre los campos, no hago nada');
      return;
    }

    var statusEl = ensureStatusEl(sqftInput);
    var manualRef = { moved: false };

    sqftInput.addEventListener('pointerdown', function () { manualRef.moved = true; });
    sqftInput.addEventListener('keydown', function () { manualRef.moved = true; });

    function run(addr, isUnit) {
      if (manualRef.moved) return;
      if (isUnit) {
        setStatus(statusEl, 'Para apartamentos no tenemos el tamaño exacto. Ajústalo tú.');
        return;
      }
      setStatus(statusEl, 'Buscando el tamaño de la propiedad…');
      lookupSqft(addr).then(function (d) {
        applySqft(sqftInput, statusEl, d, manualRef);
      });
    }

    var reactManaged = isReactManaged(addressInput);
    log('react-managed:', reactManaged);

    // La red de seguridad se engancha YA, sin esperar a Google. Si el cliente
    // escribe la dirección en el primer segundo, igual le buscamos el sq ft.
    function attachSafetyNet(el) {
      el.addEventListener('blur', function () {
        if (el.dataset.dcLookup) return;
        var v = el.value.trim();
        if (v.length >= MIN_ADDR_LEN && hasDigit(v)) run(v, false);
      });
      el.addEventListener('input', function () {
        if (!el.value.trim()) {
          delete el.dataset.dcLookup;
          setStatus(statusEl, '');
        }
      });
    }

    attachSafetyNet(addressInput);

    loadMapsKey().then(loadPlaces).then(function (placesOk) {
      if (!placesOk) { log('sin Places; queda solo la red de seguridad'); return; }

      var target = addressInput;

      if (!reactManaged) {
        // Clonar mata TODOS los listeners viejos, incluido el de Nominatim.
        var clone = addressInput.cloneNode(true);
        clone.value = addressInput.value;
        addressInput.parentNode.replaceChild(clone, addressInput);
        target = clone;
        attachSafetyNet(clone); // el clon nace sin listeners: se los devolvemos
        log('input clonado, Nominatim desactivado');
      }

      var ac = new google.maps.places.Autocomplete(target, {
        types: ['address'],
        componentRestrictions: { country: 'us' },
        fields: ['formatted_address', 'address_components'],
      });
      ac.addListener('place_changed', function () {
        var p = ac.getPlace();
        if (!p || !p.address_components) return;
        var c = cleanAddress(p);
        target.dataset.dcLookup = c.lookup;
        run(c.lookup, c.isUnit);
      });
      target.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') e.preventDefault();
      });

      log('listo con Places');
    });
  }

  // Las calculadoras de React se montan tarde; esperamos a que aparezcan.
  function waitAndStart(attempt) {
    attempt = attempt || 0;
    if (findAddressInput() && findSqftInput()) { start(); return; }
    if (attempt > 40) { log('nunca aparecieron los campos'); return; }
    setTimeout(function () { waitAndStart(attempt + 1); }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { waitAndStart(0); });
  } else {
    waitAndStart(0);
  }
})(window, document);
