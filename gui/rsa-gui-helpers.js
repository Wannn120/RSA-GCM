(function () {
  const api = window.RSA_GUI = window.RSA_GUI || {};

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
    const generated = getBridge().rsa.generateKeyPairFromPrimes(p, q, requestedE);
    const { p: pValue, q: qValue, n, phi, e, d } = generated.details;
    return { p: pValue, q: qValue, n, phi, e, d, gcdInfo: getBridge().math.gcdTrace(e, phi), egcd: getBridge().math.extendedGcd(e, phi) };
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

  function simpleChecksum(blocks) {
    let total = 0n;
    const steps = [];
    blocks.forEach((value, index) => {
      const term = BigInt(index + 1) * BigInt(value);
      total = (total + term) % 1000003n;
      steps.push({ index, value, weight: index + 1, term, subtotal: total });
    });
    return { total, steps };
  }

  async function encryptWithBrowserAesGcm(text) {
    const rawKey = window.crypto.getRandomValues(new Uint8Array(32));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const startedAt = performance.now();
    const cryptoKey = await window.crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt']);
    const encrypted = new Uint8Array(await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      cryptoKey,
      new TextEncoder().encode(text)
    ));
    return {
      rawKey,
      iv,
      ciphertext: encrypted.slice(0, -16),
      authTag: encrypted.slice(-16),
      elapsedMs: performance.now() - startedAt
    };
  }

  async function decryptWithBrowserAesGcm(payload, rawKey) {
    const startedAt = performance.now();
    const cryptoKey = await window.crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
    const authenticated = new Uint8Array(payload.ciphertext.length + payload.authTag.length);
    authenticated.set(payload.ciphertext);
    authenticated.set(payload.authTag, payload.ciphertext.length);
    const restored = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: payload.iv, tagLength: 128 },
      cryptoKey,
      authenticated
    );
    return {
      text: new TextDecoder('utf-8', { fatal: true }).decode(restored),
      elapsedMs: performance.now() - startedAt
    };
  }

  function bytesToHex(bytes) {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function browserPayloadSize(payload) {
    return new TextEncoder().encode(JSON.stringify(payload)).length;
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

  function comparisonChart(title, rsaValue, hybridValue, unit) {
    const maximum = Math.max(rsaValue, hybridValue, Number.EPSILON);
    const bar = (label, value, className) => `<div class="chart-row">
      <span>${label}</span>
      <div class="bar-track"><div class="bar-fill ${className}" style="width:${Math.max(value / maximum * 100, value > 0 ? 1 : 0)}%"></div></div>
      <strong>${value.toFixed(4)} ${unit}</strong>
    </div>`;
    return `<section class="bar-chart"><h3>${title}</h3>
      ${bar('RSA biasa', rsaValue, 'rsa')}
      ${bar('RSA + AES + CRT', hybridValue, 'hybrid')}
    </section>`;
  }

  function renderComparisonResults(settings, rows) {
    const stats = {
      rsaEncryptMs: comparisonStats(rows, 'rsaEncryptMs'),
      rsaDecryptMs: comparisonStats(rows, 'rsaDecryptMs'),
      rsaPayloadBytes: comparisonStats(rows, 'rsaPayloadBytes'),
      hybridEncryptMs: comparisonStats(rows, 'hybridEncryptMs'),
      hybridDecryptCrtMs: comparisonStats(rows, 'hybridDecryptCrtMs'),
      hybridPayloadBytes: comparisonStats(rows, 'hybridPayloadBytes'),
      keyGenerationMs: comparisonStats(rows, 'keyGenerationMs')
    };
    const overviewRows = [
      ['Enkripsi', 'ms', stats.rsaEncryptMs, stats.hybridEncryptMs],
      ['Dekripsi', 'ms', stats.rsaDecryptMs, stats.hybridDecryptCrtMs],
      ['Ukuran payload JSON', 'byte', stats.rsaPayloadBytes, stats.hybridPayloadBytes]
    ].flatMap(([metric, unit, rsa, hybrid]) => [
      [`${metric} rata-rata (${unit})`, rsa.mean, hybrid.mean],
      [`${metric} median (${unit})`, rsa.median, hybrid.median],
      [`${metric} minimum (${unit})`, rsa.min, hybrid.min],
      [`${metric} maksimum (${unit})`, rsa.max, hybrid.max]
    ]);
    const dataRows = rows.map(row => [
      row.run, row.p, row.q, row.n, row.messageBytes, row.keyGenerationMs.toFixed(6),
      row.rsaEncryptMs.toFixed(6), row.rsaDecryptMs.toFixed(6), row.rsaPayloadBytes,
      row.hybridEncryptMs.toFixed(6), row.hybridDecryptCrtMs.toFixed(6), row.hybridPayloadBytes,
      row.rsaRoundTrip, row.hybridRoundTrip
    ]);
    const allPassed = rows.every(row => row.rsaRoundTrip && row.hybridRoundTrip);

    return `<div class="metric-grid">
        <div class="metric"><span>Jumlah percobaan</span><strong>${settings.runs}</strong></div>
        <div class="metric"><span>Rentang prima p, q</span><strong>${settings.minPrime} sampai ${settings.maxPrime}</strong></div>
        <div class="metric"><span>Rentang modulus n</span><strong>${Math.min(...rows.map(row => Number(row.n)))} sampai ${Math.max(...rows.map(row => Number(row.n)))}</strong></div>
        <div class="metric"><span>Panjang pesan acak</span><strong>${settings.messageBytes} byte</strong></div>
        <div class="metric"><span>Rata-rata buat kunci RSA (bersama)</span><strong>${stats.keyGenerationMs.mean.toFixed(4)} ms</strong></div>
        <div class="metric"><span>Round-trip</span><strong>${allPassed ? 'Semua berhasil' : 'Ada yang gagal'}</strong></div>
      </div>
      <div class="chart-grid">
        ${comparisonChart('Rata-rata waktu enkripsi', stats.rsaEncryptMs.mean, stats.hybridEncryptMs.mean, 'ms')}
        ${comparisonChart('Rata-rata waktu dekripsi', stats.rsaDecryptMs.mean, stats.hybridDecryptCrtMs.mean, 'ms')}
        ${comparisonChart('Rata-rata ukuran payload JSON', stats.rsaPayloadBytes.mean, stats.hybridPayloadBytes.mean, 'byte')}
      </div>
      <h3>Ringkasan statistik</h3>
      ${table(['Ukuran', 'RSA biasa', 'RSA + AES + CRT'], overviewRows)}
      <h3>Data semua percobaan</h3>
      ${table(
        ['No', 'p', 'q', 'n', 'Pesan byte', 'Buat kunci ms', 'RSA enkripsi ms', 'RSA dekripsi ms', 'RSA payload byte', 'Hybrid enkripsi ms', 'Hybrid dekripsi CRT ms', 'Hybrid payload byte', 'RSA benar', 'Hybrid benar'],
        dataRows
      )}
      <div class="notice">Semua nilai p, q, n, pesan, dan kunci dibuat acak pada setiap putaran. Waktu pembuatan kunci ditampilkan terpisah karena pasangan yang sama dipakai kedua metode. Pengukuran satu putaran per sampel dan prima kecil hanya untuk pengamatan pendidikan, bukan benchmark produksi.</div>`;
  }

  function downloadComparisonCsv(lastComparisonRows) {
    if (!lastComparisonRows || lastComparisonRows.length === 0) return;
    const columns = [
      'run', 'p', 'q', 'n', 'messageBytes', 'keyGenerationMs',
      'rsaEncryptMs', 'rsaDecryptMs', 'rsaPayloadBytes',
      'hybridEncryptMs', 'hybridDecryptCrtMs', 'hybridPayloadBytes',
      'rsaRoundTrip', 'hybridRoundTrip'
    ];
    const escape = value => `"${String(value).replaceAll('"', '""')}"`;
    const csv = [columns, ...lastComparisonRows.map(row => columns.map(column => row[column]))]
      .map(row => row.map(escape).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'perbandingan-rsa-hybrid.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function encryptWithBrowserHybrid(text, key) {
    const startedAt = performance.now();
    const aesPayload = await encryptWithBrowserAesGcm(text);
    if (key.n <= 255n) throw new Error('n RSA harus lebih besar dari 255 untuk membungkus byte kunci AES.');
    const wrappedKey = Array.from(aesPayload.rawKey, byte => modPow(BigInt(byte), key.e, key.n));
    return { ...aesPayload, wrappedKey, elapsedMs: performance.now() - startedAt };
  }

  async function decryptWithBrowserHybrid(payload, key) {
    const startedAt = performance.now();
    const rawKey = Uint8Array.from(payload.wrappedKey.map(block => {
      const byte = modPow(block, key.d, key.n);
      if (byte < 0n || byte > 255n) throw new Error('RSA menghasilkan byte kunci AES yang tidak valid.');
      return Number(byte);
    }));
    const restored = await decryptWithBrowserAesGcm(payload, rawKey);
    return { text: restored.text, elapsedMs: performance.now() - startedAt };
  }

  async function decryptWithBrowserHybridCrt(payload, key) {
    const startedAt = performance.now();
    const rawKey = Uint8Array.from(payload.wrappedKey.map(block => {
      const byte = decryptBlockWithCrtTrace(block, key).message;
      if (byte < 0n || byte > 255n) throw new Error('RSA-CRT menghasilkan byte kunci AES yang tidak valid.');
      return Number(byte);
    }));
    const restored = await decryptWithBrowserAesGcm(payload, rawKey);
    return { text: restored.text, elapsedMs: performance.now() - startedAt };
  }

  function requireBrowserCrypto() {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('Web Crypto API tidak tersedia. Buka GUI melalui browser modern pada HTTPS atau localhost.');
    }
  }

  const exported = {
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
    simpleChecksum,
    encryptWithBrowserAesGcm,
    decryptWithBrowserAesGcm,
    bytesToHex,
    browserPayloadSize,
    browserRandomInt,
    browserListPrimes,
    browserRandomMessage,
    validateComparisonSettings,
    comparisonStats,
    comparisonChart,
    renderComparisonResults,
    downloadComparisonCsv,
    encryptWithBrowserHybrid,
    decryptWithBrowserHybrid,
    decryptWithBrowserHybridCrt,
    requireBrowserCrypto
  };

  Object.assign(api, exported);
  Object.assign(window, exported);
})();
