(function () {
  'use strict';

  const shared = window.RSAUiShared = window.RSAUiShared || {};

  function getBridge() {
    if (!window.RSA_GCM || !window.RSA_GCM.math || !window.RSA_GCM.rsa) {
      throw new Error('Bridge modul src belum siap. Tunggu hingga modul kriptografi selesai dimuat.');
    }
    return window.RSA_GCM;
  }

  function big(value, label = 'nilai') {
    try {
      return getBridge().math.toBigInt(value, label);
    } catch {
      throw new Error(`${label} harus berupa bilangan bulat.`);
    }
  }

  function abs(n) { return getBridge().math.abs(n); }
  function gcdTrace(a, b) { return getBridge().math.gcdTrace(a, b); }
  function extendedGcd(a, b) { return getBridge().math.extendedGcd(a, b); }
  function positiveMod(n, m) { return getBridge().math.mod(n, m); }
  function modInverse(a, m) { return getBridge().math.modInverse(a, m); }
  function modPowTrace(base, exponent, modulus) { return getBridge().math.modPowTrace(base, exponent, modulus); }
  function modPow(base, exponent, modulus) { return getBridge().math.modPow(base, exponent, modulus); }
  function primeTrace(n) { return getBridge().primality.trialDivisionTrace(n); }
  function encodeText(text) { return getBridge().codec.encodeText(text); }
  function decodeText(blocks) { return getBridge().codec.decodeText(blocks); }

  function makeKey(p, q, requestedE) {
    const { generateKeyPairFromPrimes } = getBridge().rsa;
    const generated = generateKeyPairFromPrimes(p, q, requestedE);
    const { p: pValue, q: qValue, n, phi, e, d } = generated.details;
    return {
      p: pValue,
      q: qValue,
      n,
      phi,
      e,
      d,
      gcdInfo: getBridge().math.gcdTrace(e, phi),
      egcd: getBridge().math.extendedGcd(e, phi)
    };
  }

  function encryptBlocks(blocks, key) {
    return getBridge().rsa.encryptBlocks(blocks, { e: key.e, n: key.n });
  }

  function decryptBlocks(blocks, key) {
    return getBridge().rsa.decryptBlocks(blocks, { d: key.d, n: key.n });
  }

  function decryptBlockWithCrtTrace(cipher, key) {
    const dp = positiveMod(key.d, key.p - 1n);
    const dq = positiveMod(key.d, key.q - 1n);
    const qInverse = modInverse(key.q, key.p);
    const m1 = modPow(cipher, dp, key.p);
    const m2 = modPow(cipher, dq, key.q);
    const h = positiveMod(qInverse * (m1 - m2), key.p);
    return {
      dp,
      dq,
      m1,
      m2,
      h,
      message: getBridge().rsa.decryptNumberCrt(cipher, { d: key.d, n: key.n }, key.p, key.q)
    };
  }

  function decryptBlocksCrt(blocks, key) {
    return blocks.map(cipher => decryptBlockWithCrtTrace(cipher, key).message);
  }

  function html(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function table(headers, rows) {
    return `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${html(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${html(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function keyMetrics(key) {
    return `<div class="metric-grid">
      <div class="metric"><span>p</span><strong>${key.p}</strong></div>
      <div class="metric"><span>q</span><strong>${key.q}</strong></div>
      <div class="metric"><span>n = p × q</span><strong>${key.n}</strong></div>
      <div class="metric"><span>φ(n)</span><strong>${key.phi}</strong></div>
      <div class="metric"><span>e</span><strong>${key.e}</strong></div>
      <div class="metric"><span>d</span><strong>${key.d}</strong></div>
      <div class="metric"><span>Public key</span><strong>(${key.e}, ${key.n})</strong></div>
      <div class="metric"><span>Private key</span><strong>(${key.d}, ${key.n})</strong></div>
    </div>`;
  }

  function keyForm(prefix = '') {
    return `<div class="form-grid">
      <div class="field"><label>p, bilangan prima</label><input id="${prefix}p" value="61" inputmode="numeric"></div>
      <div class="field"><label>q, bilangan prima</label><input id="${prefix}q" value="53" inputmode="numeric"></div>
      <div class="field"><label>e, eksponen publik</label><input id="${prefix}e" value="17" inputmode="numeric"></div>
      <div class="field"><label>Catatan</label><input value="Contoh klasik RSA" disabled></div>
    </div>`;
  }

  function flowSteps(steps) {
    return `<ol class="flow-steps">${steps.map((step, index) => `<li><span class="flow-number">${index + 1}</span><div><strong>${html(step.title)}</strong><small>${html(step.description)}</small></div></li>`).join('')}</ol>`;
  }

  function supportLink(page, title, description) {
    return `<button class="support-link" type="button" data-support-page="${page}"><strong>${title}</strong><span>${description}</span><b aria-hidden="true">→</b></button>`;
  }

  function bytesToHex(bytes) {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function browserPayloadSize(payload) {
    return new TextEncoder().encode(JSON.stringify(payload)).length;
  }

  function requireBrowserCrypto() {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('Web Crypto API tidak tersedia. Buka GUI melalui browser modern pada HTTPS atau localhost.');
    }
  }

  function browserRandomInt(minimum, maximum) {
    const range = maximum - minimum + 1;
    const limit = Math.floor(4294967296 / range) * range;
    const sample = new Uint32Array(1);
    let value;
    do {
      window.crypto.getRandomValues(sample);
      value = sample[0];
    } while (value >= limit);
    return minimum + (value % range);
  }

  function browserListPrimes(minimum, maximum) {
    const sieve = new Uint8Array(maximum + 1);
    sieve.fill(1, 2);
    for (let factor = 2; factor * factor <= maximum; factor++) {
      if (!sieve[factor]) continue;
      for (let multiple = factor * factor; multiple <= maximum; multiple += factor) {
        sieve[multiple] = 0;
      }
    }
    const primes = [];
    for (let candidate = minimum; candidate <= maximum; candidate++) {
      if (sieve[candidate]) primes.push(BigInt(candidate));
    }
    return primes;
  }

  function browserRandomMessage(byteLength) {
    const bytes = window.crypto.getRandomValues(new Uint8Array(byteLength));
    return Array.from(bytes, byte => String.fromCharCode(32 + (byte % 95))).join('');
  }

  function comparisonStats(rows, property) {
    const values = rows.map(row => row[property]).sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    return {
      mean: values.reduce((sum, value) => sum + value, 0) / values.length,
      median: values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2,
      min: values[0],
      max: values[values.length - 1]
    };
  }

  function validateComparisonSettings(settings) {
    const check = (value, label, min, max) => {
      if (!Number.isSafeInteger(value) || value < min || value > max) {
        throw new Error(`${label} harus bilangan bulat antara ${min} dan ${max}.`);
      }
    };
    check(settings.runs, 'Jumlah putaran', 1, 1000);
    check(settings.minPrime, 'Prima minimum', 17, 1000000);
    check(settings.maxPrime, 'Prima maksimum', 17, 1000000);
    check(settings.messageBytes, 'Ukuran pesan', 1, 4096);
    if (settings.minPrime >= settings.maxPrime) throw new Error('Prima minimum harus lebih kecil dari prima maksimum.');
  }

  Object.assign(shared, {
    getBridge,
    big,
    abs,
    gcdTrace,
    extendedGcd,
    positiveMod,
    modInverse,
    modPowTrace,
    modPow,
    primeTrace,
    encodeText,
    decodeText,
    makeKey,
    encryptBlocks,
    decryptBlocks,
    decryptBlockWithCrtTrace,
    decryptBlocksCrt,
    html,
    table,
    keyMetrics,
    keyForm,
    flowSteps,
    supportLink,
    bytesToHex,
    browserPayloadSize,
    requireBrowserCrypto,
    browserRandomInt,
    browserListPrimes,
    browserRandomMessage,
    comparisonStats,
    validateComparisonSettings
  });
})();
