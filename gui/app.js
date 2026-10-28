'use strict';

/*
  GUI ini sengaja memakai JavaScript murni tanpa framework.
  Implementasi matematikanya dibuat lagi untuk browser karena file src memakai CommonJS Node.js.
  Pemisahan ini membuat CLI tetap mandiri dan GUI juga dapat dibuka langsung sebagai file statis.
*/

const state = {
  page: 'dashboard',
  key: null,
  lastMessage: null
};

const $ = selector => document.querySelector(selector);
const content = $('#content');

function big(value, label = 'nilai') {
  try {
    return BigInt(String(value).trim());
  } catch {
    throw new Error(`${label} harus berupa bilangan bulat.`);
  }
}

function abs(n) { return n < 0n ? -n : n; }

function gcdTrace(a, b) {
  a = abs(a);
  b = abs(b);
  const steps = [];
  while (b !== 0n) {
    const q = a / b;
    const r = a % b;
    steps.push({ a, b, q, r });
    a = b;
    b = r;
  }
  return { gcd: a, steps };
}

function extendedGcd(a, b) {
  let oldR = a;
  let r = b;
  let oldS = 1n;
  let s = 0n;
  let oldT = 0n;
  let t = 1n;
  const steps = [];

  while (r !== 0n) {
    const q = oldR / r;
    steps.push({ q, oldR, r, oldS, s, oldT, t });
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
    [oldT, t] = [t, oldT - q * t];
  }
  return { gcd: abs(oldR), x: oldR < 0n ? -oldS : oldS, y: oldR < 0n ? -oldT : oldT, steps };
}

function positiveMod(n, m) {
  const r = n % m;
  return r < 0n ? r + m : r;
}

function modInverse(a, m) {
  const result = extendedGcd(a, m);
  if (result.gcd !== 1n) throw new Error(`Invers tidak ada karena gcd(${a}, ${m}) = ${result.gcd}.`);
  return positiveMod(result.x, m);
}

function modPowTrace(base, exponent, modulus) {
  if (modulus <= 0n) throw new Error('Modulus harus positif.');
  if (exponent < 0n) throw new Error('Eksponen tidak boleh negatif.');
  let result = 1n;
  let b = positiveMod(base, modulus);
  let e = exponent;
  const steps = [];

  while (e > 0n) {
    const bit = e % 2n;
    const before = result;
    if (bit === 1n) result = (result * b) % modulus;
    steps.push({ exponent: e, bit, base: b, before, after: result });
    e /= 2n;
    b = (b * b) % modulus;
  }
  return { result, steps };
}

function modPow(base, exponent, modulus) {
  return modPowTrace(base, exponent, modulus).result;
}

function primeTrace(n) {
  const tested = [];
  if (n < 2n) return { prime: false, reason: 'Bilangan kurang dari 2 bukan prima.', tested };
  if (n === 2n) return { prime: true, reason: '2 adalah bilangan prima.', tested };
  if (n % 2n === 0n) return { prime: false, reason: 'Habis dibagi 2.', tested: [{ divisor: 2n, remainder: 0n }] };
  for (let d = 3n; d * d <= n; d += 2n) {
    const remainder = n % d;
    tested.push({ divisor: d, remainder });
    if (remainder === 0n) return { prime: false, reason: `Habis dibagi ${d}.`, tested };
  }
  return { prime: true, reason: 'Tidak ditemukan pembagi sampai √n.', tested };
}

function makeKey(p, q, requestedE) {
  const pCheck = primeTrace(p);
  const qCheck = primeTrace(q);
  if (!pCheck.prime) throw new Error(`p = ${p} bukan prima.`);
  if (!qCheck.prime) throw new Error(`q = ${q} bukan prima.`);
  if (p === q) throw new Error('p dan q harus berbeda.');

  const n = p * q;
  const phi = (p - 1n) * (q - 1n);
  let e = requestedE;
  if (e === null) {
    const preferred = 65537n;
    if (preferred < phi && gcdTrace(preferred, phi).gcd === 1n) e = preferred;
    else {
      e = 3n;
      while (e < phi && gcdTrace(e, phi).gcd !== 1n) e += 2n;
    }
  }
  if (e <= 1n || e >= phi) throw new Error('e harus memenuhi 1 < e < φ(n).');
  const gcdInfo = gcdTrace(e, phi);
  if (gcdInfo.gcd !== 1n) throw new Error(`e tidak relatif prima terhadap φ(n). gcd = ${gcdInfo.gcd}.`);

  const egcd = extendedGcd(e, phi);
  const d = modInverse(e, phi);
  return { p, q, n, phi, e, d, gcdInfo, egcd };
}

function encodeText(text) {
  return Array.from(new TextEncoder().encode(text), byte => BigInt(byte));
}

function decodeText(blocks) {
  const bytes = Uint8Array.from(blocks.map(v => Number(v)));
  return new TextDecoder().decode(bytes);
}

function encryptBlocks(blocks, key) {
  return blocks.map(m => {
    if (m >= key.n) throw new Error(`Blok ${m} tidak lebih kecil dari n = ${key.n}. Gunakan p dan q lebih besar.`);
    return modPow(m, key.e, key.n);
  });
}

function decryptBlocks(blocks, key) {
  return blocks.map(c => modPow(c, key.d, key.n));
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

function renderDashboard() {
  content.innerHTML = `<div class="chat-stack">
    <div class="bubble"><strong>Apa yang dilakukan aplikasi ini?</strong><p>GUI mempelajari RSA, AES-GCM mandiri, dan hybrid RSA + AES-GCM. Modul RSA menunjukkan hitungan dengan BigInt; AES-GCM menggunakan Web Crypto API bawaan browser.</p></div>
    <div class="bubble out"><strong>Contoh default</strong><p>p = 61, q = 53, e = 17. Contoh ini menghasilkan n = 3233, φ(n) = 3120, dan d = 2753.</p></div>
    <section class="panel">
      <div class="panel-title">Jalankan alur lengkap</div>
      <div class="panel-body">
        ${keyForm('dash')}
        <div class="field" style="margin-top:12px"><label>Pesan</label><textarea id="dashMessage">MATDIS</textarea></div>
        <div class="actions"><button id="runDashboard" class="action-button" type="button">Hitung Semua</button></div>
        <div id="dashboardResult"></div>
      </div>
    </section>
  </div>`;

  $('#runDashboard').addEventListener('click', () => {
    const target = $('#dashboardResult');
    try {
      const key = makeKey(big($('#dashp').value, 'p'), big($('#dashq').value, 'q'), big($('#dashe').value, 'e'));
      if (key.n <= 255n) throw new Error('Untuk pesan UTF-8 per byte, gunakan n > 255.');
      state.key = key;
      const text = $('#dashMessage').value;
      const plain = encodeText(text);
      const cipher = encryptBlocks(plain, key);
      const restored = decryptBlocks(cipher, key);
      state.lastMessage = { text, plain, cipher, restored };

      const blockRows = plain.map((m, i) => [i, m, `${m}^${key.e} mod ${key.n}`, cipher[i], `${cipher[i]}^${key.d} mod ${key.n}`, restored[i]]);
      target.innerHTML = `${keyMetrics(key)}
        <div class="notice">Syarat utama: p dan q prima, e relatif prima dengan φ(n), lalu d adalah invers e modulo φ(n).</div>
        ${table(['i', 'm', 'Rumus enkripsi', 'c', 'Rumus dekripsi', 'm kembali'], blockRows)}
        <div class="code">Pesan awal    : ${html(text)}\nByte UTF-8     : ${plain.join(', ')}\nCipher         : ${cipher.join(', ')}\nByte kembali   : ${restored.join(', ')}\nTeks kembali   : ${html(decodeText(restored))}</div>`;
    } catch (error) {
      target.innerHTML = `<div class="error">${html(error.message)}</div>`;
    }
  });
}

function renderKeygen() {
  content.innerHTML = `<div class="chat-stack">
    <div class="bubble"><strong>Kenapa butuh p dan q?</strong><p>Dua bilangan prima dikalikan menjadi n. Nilai φ(n) dihitung dari (p − 1)(q − 1), lalu e dipilih agar gcd(e, φ(n)) = 1.</p></div>
    <section class="panel"><div class="panel-title">Pembentukan kunci dengan jejak hitung</div><div class="panel-body">
      ${keyForm('key')}
      <div class="actions"><button id="runKey" class="action-button" type="button">Bentuk Kunci</button></div>
      <div id="keyResult"></div>
    </div></section>
  </div>`;

  $('#runKey').addEventListener('click', () => {
    const target = $('#keyResult');
    try {
      const key = makeKey(big($('#keyp').value), big($('#keyq').value), big($('#keye').value));
      state.key = key;
      const gcdRows = key.gcdInfo.steps.map((s, i) => [i + 1, s.a, s.b, s.q, s.r]);
      const egcdRows = key.egcd.steps.map((s, i) => [i + 1, s.q, s.oldR, s.r, s.oldS, s.s, s.oldT, s.t]);
      target.innerHTML = `${keyMetrics(key)}
        <div class="code">n = p × q = ${key.p} × ${key.q} = ${key.n}\nφ(n) = (p − 1) × (q − 1) = ${key.p - 1n} × ${key.q - 1n} = ${key.phi}\ngcd(e, φ) = gcd(${key.e}, ${key.phi}) = 1\nd = e⁻¹ mod φ = ${key.d}\nPemeriksaan: (${key.e} × ${key.d}) mod ${key.phi} = ${(key.e * key.d) % key.phi}</div>
        <h3>Euclid untuk gcd</h3>
        ${table(['Langkah', 'a', 'b', 'q = a div b', 'r = a mod b'], gcdRows)}
        <h3>Extended Euclid untuk invers modulo</h3>
        ${table(['Langkah', 'q', 'oldR', 'r', 'oldS', 's', 'oldT', 't'], egcdRows)}
        <div class="notice">Koefisien x = ${key.egcd.x}. Karena bisa negatif, d dihitung sebagai x mod φ(n), hasilnya ${key.d}.</div>`;
    } catch (error) {
      target.innerHTML = `<div class="error">${html(error.message)}</div>`;
    }
  });
}

function renderMessage() {
  content.innerHTML = `<div class="chat-stack">
    <div class="bubble out"><strong>Mode pesan</strong><p>Satu byte UTF-8 dijadikan satu blok m. Setiap blok dienkripsi dengan c = m^e mod n dan didekripsi dengan m = c^d mod n.</p></div>
    <section class="panel"><div class="panel-title">Enkripsi dan dekripsi teks</div><div class="panel-body">
      ${keyForm('msg')}
      <div class="field" style="margin-top:12px"><label>Pesan yang diuji</label><textarea id="messageText">Halo Matdis</textarea></div>
      <div class="actions"><button id="runMessage" class="action-button" type="button">Proses Pesan</button></div>
      <div id="messageResult"></div>
    </div></section>
  </div>`;

  $('#runMessage').addEventListener('click', () => {
    const target = $('#messageResult');
    try {
      const key = makeKey(big($('#msgp').value), big($('#msgq').value), big($('#msge').value));
      if (key.n <= 255n) throw new Error('n harus lebih besar dari 255 untuk menampung seluruh nilai byte 0 sampai 255.');
      const text = $('#messageText').value;
      const plain = encodeText(text);
      const cipher = encryptBlocks(plain, key);
      const restored = decryptBlocks(cipher, key);
      const rows = plain.map((m, i) => [i, m, `0x${Number(m).toString(16).padStart(2, '0')}`, cipher[i], restored[i]]);
      target.innerHTML = `${keyMetrics(key)}${table(['Index', 'Byte m', 'Hex', 'Cipher c', 'Byte kembali'], rows)}
        <div class="code">Teks awal   : ${html(text)}\nCipher      : ${cipher.join(', ')}\nTeks akhir  : ${html(decodeText(restored))}</div>
        <p class="${decodeText(restored) === text ? 'success' : 'error'}">${decodeText(restored) === text ? 'Valid: teks akhir sama dengan teks awal.' : 'Hasil berbeda.'}</p>`;
    } catch (error) {
      target.innerHTML = `<div class="error">${html(error.message)}</div>`;
    }
  });
}

function renderPrime() {
  content.innerHTML = `<div class="chat-stack">
    <div class="bubble"><strong>Uji prima manual</strong><p>Cukup mencoba pembagi sampai √n. Jika tidak ada pembagi yang menghasilkan sisa 0, n adalah prima.</p></div>
    <section class="panel"><div class="panel-title">Trial Division</div><div class="panel-body">
      <div class="form-grid two"><div class="field"><label>Bilangan n</label><input id="primeN" value="61"></div></div>
      <div class="actions"><button id="runPrime" class="action-button" type="button">Uji Prima</button></div>
      <div id="primeResult"></div>
    </div></section>
  </div>`;
  $('#runPrime').addEventListener('click', () => {
    const target = $('#primeResult');
    try {
      const n = big($('#primeN').value, 'n');
      const result = primeTrace(n);
      target.innerHTML = `<div class="notice"><strong>${n} ${result.prime ? 'adalah prima' : 'bukan prima'}.</strong> ${html(result.reason)}</div>${table(['Pembagi yang dicoba', 'Sisa n mod pembagi'], result.tested.map(x => [x.divisor, x.remainder]))}`;
    } catch (error) {
      target.innerHTML = `<div class="error">${html(error.message)}</div>`;
    }
  });
}

function renderModPow() {
  content.innerHTML = `<div class="chat-stack">
    <div class="bubble out"><strong>Kenapa tidak menghitung base^exp langsung?</strong><p>Eksponen RSA dapat sangat besar. Square-and-multiply mengecilkan hasil dengan modulo pada setiap langkah sehingga perhitungan tetap efisien.</p></div>
    <section class="panel"><div class="panel-title">Square-and-Multiply</div><div class="panel-body">
      <div class="form-grid"><div class="field"><label>Base</label><input id="powBase" value="65"></div><div class="field"><label>Eksponen</label><input id="powExp" value="17"></div><div class="field"><label>Modulus</label><input id="powMod" value="3233"></div></div>
      <div class="actions"><button id="runPow" class="action-button" type="button">Hitung</button></div>
      <div id="powResult"></div>
    </div></section>
  </div>`;
  $('#runPow').addEventListener('click', () => {
    const target = $('#powResult');
    try {
      const base = big($('#powBase').value);
      const exp = big($('#powExp').value);
      const mod = big($('#powMod').value);
      const result = modPowTrace(base, exp, mod);
      const rows = result.steps.map((s, i) => [i + 1, s.exponent, s.bit, s.base, s.before, s.after]);
      target.innerHTML = `<div class="metric-grid"><div class="metric"><span>Hasil</span><strong>${result.result}</strong></div><div class="metric"><span>Jumlah langkah</span><strong>${result.steps.length}</strong></div></div>${table(['Langkah', 'Eksponen saat ini', 'Bit', 'Base saat ini', 'Result sebelum', 'Result sesudah'], rows)}
      <div class="notice">Jika bit eksponen = 1, result dikalikan base lalu dimodulo. Setelah itu eksponen dibagi 2 dan base dikuadratkan modulo n.</div>`;
    } catch (error) {
      target.innerHTML = `<div class="error">${html(error.message)}</div>`;
    }
  });
}

function renderAbout() {
  content.innerHTML = `<div class="chat-stack">
    <div class="bubble"><strong>Urutan penjelasan saat presentasi</strong><p>Mulai dari tujuan RSA, lanjut ke p dan q, hitung n dan φ(n), pilih e, cari d memakai Extended Euclid, ubah teks ke byte, lalu tunjukkan enkripsi serta dekripsi.</p></div>
    <section class="panel"><div class="panel-title">Poin yang penting dijelaskan</div><div class="panel-body">
      <p><strong>1. BigInt</strong> dipakai karena JavaScript Number memiliki batas presisi bilangan bulat. BigInt menjaga operasi bilangan bulat tetap tepat.</p>
      <p><strong>2. gcd</strong> memakai algoritma Euclid: pasangan (a, b) diganti menjadi (b, a mod b) sampai b = 0.</p>
      <p><strong>3. Extended Euclid</strong> mencari x dan y sehingga ax + by = gcd(a,b). Saat gcd(e, φ) = 1, koefisien x menjadi calon invers e modulo φ.</p>
      <p><strong>4. Modular exponentiation</strong> memakai square-and-multiply agar tidak membuat bilangan base^exponent secara langsung.</p>
      <p><strong>5. Encoding pesan</strong> memakai UTF-8. Satu byte dijadikan satu blok agar alurnya mudah diamati saat tugas Matematika Diskrit.</p>
      <div class="notice">Proyek ini untuk pembelajaran. Ukuran prima kecil, RSA per byte, checksum sederhana, dan demonstrasi hybrid bukan desain kriptografi produksi.</div>
    </div></section>
  </div>`;
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

// Browser memakai Web Crypto API agar halaman AES dapat berjalan tanpa library tambahan.
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
  const elapsedMs = performance.now() - startedAt;

  return {
    rawKey,
    iv,
    ciphertext: encrypted.slice(0, -16),
    authTag: encrypted.slice(-16),
    elapsedMs
  };
}

// AES-GCM hanya mengeluarkan plaintext jika ciphertext dan tag cocok dengan kuncinya.
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

// Membuat satu pesan hybrid: AES menyegel data, RSA membungkus tiap byte kunci sesi.
async function encryptWithBrowserHybrid(text, key) {
  const startedAt = performance.now();
  const aesPayload = await encryptWithBrowserAesGcm(text);
  if (key.n <= 255n) throw new Error('n RSA harus lebih besar dari 255 untuk membungkus byte kunci AES.');
  const wrappedKey = Array.from(aesPayload.rawKey, byte => modPow(BigInt(byte), key.e, key.n));
  const elapsedMs = performance.now() - startedAt;
  return { ...aesPayload, wrappedKey, elapsedMs };
}

// Penerima membuka byte kunci RSA dahulu, lalu AES-GCM memeriksa tag pesan.
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

function requireBrowserCrypto() {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API tidak tersedia. Buka GUI melalui browser modern pada HTTPS atau localhost.');
  }
}

function renderAesGcm() {
  content.innerHTML = `<div class="chat-stack">
    <div class="bubble"><strong>AES-256-GCM mandiri</strong><p>AES adalah enkripsi simetris: pengirim dan penerima memakai kunci rahasia yang sama. GCM juga menghasilkan authentication tag untuk mendeteksi ciphertext atau tag yang berubah.</p></div>
    <section class="panel"><div class="panel-title">Uji AES-GCM tanpa RSA</div><div class="panel-body">
      <div class="field"><label>Pesan</label><textarea id="aesText">Halo Matdis</textarea></div>
      <div class="actions"><button class="action-button" id="runAes">Enkripsi dan Dekripsi AES</button></div><div id="aesResult"></div>
    </div></section>
  </div>`;
  $('#runAes').addEventListener('click', async () => {
    const target = $('#aesResult');
    try {
      requireBrowserCrypto();
      const text = $('#aesText').value;
      const encrypted = await encryptWithBrowserAesGcm(text);
      const restored = await decryptWithBrowserAesGcm(encrypted, encrypted.rawKey);
      const payload = {
        iv: bytesToHex(encrypted.iv),
        ciphertext: bytesToHex(encrypted.ciphertext),
        authTag: bytesToHex(encrypted.authTag)
      };
      target.innerHTML = `<div class="code">Algoritma : AES-256-GCM\nKunci sesi: acak dan disimpan sementara, tidak ditampilkan\nIV        : ${payload.iv}\nCiphertext: ${payload.ciphertext}\nTag       : ${payload.authTag}\nWaktu enkripsi: ${encrypted.elapsedMs.toFixed(4)} ms\nWaktu dekripsi: ${restored.elapsedMs.toFixed(4)} ms\nHasil     : ${html(restored.text)}</div>
        <div class="notice">Mode ini hanya memakai AES. Kedua pihak harus sudah berbagi kunci rahasia dengan cara yang aman; AES sendiri tidak mengirimkan kunci ke penerima.</div>`;
    } catch (error) {
      target.innerHTML = `<div class="error">${html(error.message)}</div>`;
    }
  });
}

function renderComparison() {
  content.innerHTML = `<div class="chat-stack">
    <div class="bubble"><strong>Perbandingan metode</strong><p>Pesan yang sama diproses dengan RSA per byte, AES-GCM mandiri, dan hybrid. Waktu hanya satu putaran di browser ini; angka dipengaruhi perangkat, browser, dan overhead, jadi bukan benchmark produksi.</p></div>
    <section class="panel"><div class="panel-title">RSA vs AES-GCM vs Hybrid</div><div class="panel-body">
      ${keyForm('cmp')}
      <div class="field"><label>Pesan untuk dibandingkan</label><textarea id="compareText">Halo Matdis</textarea></div>
      <div class="actions"><button class="action-button" id="runComparison">Bandingkan</button></div><div id="comparisonResult"></div>
    </div></section>
  </div>`;
  $('#runComparison').addEventListener('click', async () => {
    const target = $('#comparisonResult');
    try {
      requireBrowserCrypto();
      const key = makeKey(big($('#cmpp').value, 'p'), big($('#cmpq').value, 'q'), big($('#cmpe').value, 'e'));
      if (key.n <= 255n) throw new Error('Pilih p dan q sehingga n > 255 untuk RSA per byte.');
      const text = $('#compareText').value;
      const plain = encodeText(text);

      const rsaStartedAt = performance.now();
      const rsaCipher = encryptBlocks(plain, key);
      const rsaEncryptMs = performance.now() - rsaStartedAt;
      const rsaDecryptStartedAt = performance.now();
      const rsaRestored = decodeText(decryptBlocks(rsaCipher, key));
      const rsaDecryptMs = performance.now() - rsaDecryptStartedAt;

      const aes = await encryptWithBrowserAesGcm(text);
      const aesRestored = await decryptWithBrowserAesGcm(aes, aes.rawKey);
      const hybrid = await encryptWithBrowserHybrid(text, key);
      const hybridRestored = await decryptWithBrowserHybrid(hybrid, key);
      const aesPayload = {
        algorithm: 'aes-256-gcm',
        iv: bytesToHex(aes.iv),
        ciphertext: bytesToHex(aes.ciphertext),
        authTag: bytesToHex(aes.authTag)
      };
      const hybridPayload = {
        algorithm: 'aes-256-gcm',
        wrappedKey: hybrid.wrappedKey.map(String),
        iv: bytesToHex(hybrid.iv),
        ciphertext: bytesToHex(hybrid.ciphertext),
        authTag: bytesToHex(hybrid.authTag)
      };
      const rows = [
        ['RSA per byte', rsaEncryptMs.toFixed(4), rsaDecryptMs.toFixed(4), browserPayloadSize(rsaCipher.map(String)), rsaRestored === text],
        ['AES-256-GCM', aes.elapsedMs.toFixed(4), aesRestored.elapsedMs.toFixed(4), browserPayloadSize(aesPayload), aesRestored.text === text],
        ['Hybrid RSA + AES-GCM', hybrid.elapsedMs.toFixed(4), hybridRestored.elapsedMs.toFixed(4), browserPayloadSize(hybridPayload), hybridRestored.text === text]
      ];
      target.innerHTML = `${keyMetrics(key)}
        ${table(['Metode', 'Enkripsi (ms)', 'Dekripsi (ms)', 'Payload JSON (byte)', 'Round-trip benar'], rows)}
        <div class="notice">RSA demo memakai p, q kecil dan RSA textbook tanpa padding per byte. Ukuran payload membandingkan format JSON contoh; overhead transport tidak disertakan. AES-GCM memerlukan kunci rahasia yang sudah dibagikan, sedangkan hybrid menyertakan kunci AES yang dibungkus RSA.</div>`;
    } catch (error) {
      target.innerHTML = `<div class="error">${html(error.message)}</div>`;
    }
  });
}

function renderHybrid() {
  content.innerHTML = `<div class="chat-stack">
    <div class="bubble"><strong>Simulasi hybrid RSA + AES-GCM</strong><p>AES-GCM mengenkripsi pesan dan memeriksa authentication tag. Kunci AES acak 256-bit dibungkus RSA buatan proyek per byte karena modulus contoh yang kecil tidak cukup untuk satu bilangan kunci utuh.</p></div>
    <section class="panel"><div class="panel-title">RSA membungkus kunci sesi, AES-GCM mengenkripsi pesan</div><div class="panel-body">
      ${keyForm('hyb')}
      <div class="field"><label>Pesan</label><textarea id="hybText">Halo Matdis</textarea></div>
      <div class="actions"><button class="action-button" id="runHybrid">Proses Hybrid</button></div><div id="hybridResult"></div>
    </div></section></div>`;
  $('#runHybrid').addEventListener('click', async () => {
    const target = $('#hybridResult');
    try {
      requireBrowserCrypto();
      const key = makeKey(big($('#hybp').value), big($('#hybq').value), big($('#hybe').value));
      const text = $('#hybText').value;
      const encrypted = await encryptWithBrowserHybrid(text, key);
      const restored = await decryptWithBrowserHybrid(encrypted, key);
      target.innerHTML = `${keyMetrics(key)}
        <div class="code">Algoritma data : AES-256-GCM\nKunci sesi     : dibuat acak, tidak ditampilkan\nBlok kunci RSA : ${encrypted.wrappedKey.join(', ')}\nIV             : ${bytesToHex(encrypted.iv)}\nCiphertext     : ${bytesToHex(encrypted.ciphertext)}\nAuthentication tag: ${bytesToHex(encrypted.authTag)}\nPesan kembali  : ${html(restored.text)}</div>
        ${table(['Indeks byte kunci', `Hasil RSA (e=${key.e}, n=${key.n})`], encrypted.wrappedKey.map((block, i) => [i, block]))}
        <div class="notice">AES-GCM menolak ciphertext atau tag yang diubah. Demo memakai RSA tanpa padding dan modulus kecil; RSA per byte hanya untuk menjelaskan alur, bukan pengamanan produksi.</div>`;
    } catch (error) { target.innerHTML = `<div class="error">${html(error.message)}</div>`; }
  });
}

function renderTamper() {
  content.innerHTML = `<div class="chat-stack"><div class="bubble"><strong>Simulasi integritas sederhana</strong><p>Checksum berbobot menambahkan (indeks + 1) × nilai blok, kemudian mengambil sisa modulo 1000003. Mengubah sebuah blok biasanya akan mengubah checksum, tetapi checksum ini bukan tanda tangan digital.</p></div>
    <section class="panel"><div class="panel-title">Uji perubahan byte</div><div class="panel-body">
      <div class="field"><label>Pesan</label><textarea id="tamperText">MATDIS</textarea></div>
      <div class="form-grid two"><div class="field"><label>Index byte (mulai dari 0)</label><input id="tamperIndex" value="0"></div><div class="field"><label>Delta perubahan</label><input id="tamperDelta" value="1"></div></div>
      <div class="actions"><button class="action-button" id="runTamper">Bandingkan Data</button></div><div id="tamperResult"></div>
    </div></section></div>`;
  $('#runTamper').addEventListener('click', () => {
    const target = $('#tamperResult');
    try {
      const plain = encodeText($('#tamperText').value);
      const index = Number(big($('#tamperIndex').value));
      const delta = big($('#tamperDelta').value);
      if (!Number.isSafeInteger(index) || index < 0 || index >= plain.length) throw new Error('Index tidak valid untuk byte pesan ini.');
      const changed = plain.slice();
      changed[index] += delta;
      const before = simpleChecksum(plain);
      const after = simpleChecksum(changed);
      target.innerHTML = `<div class="metric-grid"><div class="metric"><span>Checksum asli</span><strong>${before.total}</strong></div><div class="metric"><span>Checksum diubah</span><strong>${after.total}</strong></div></div>
        ${table(['Index', 'Byte asli', 'Byte baru', 'Bobot', 'Kontribusi asli', 'Subtotal checksum asli'], before.steps.map((r, i) => [i, r.value, changed[i], r.weight, r.term, r.subtotal]))}
        <div class="notice">Perubahan ${before.total === after.total ? 'tidak' : 'berhasil'} terdeteksi melalui perbandingan checksum. Kolisi mungkin terjadi, sehingga jangan gunakan ini sebagai jaminan keamanan.</div>`;
    } catch (error) { target.innerHTML = `<div class="error">${html(error.message)}</div>`; }
  });
}

function renderSend() {
  content.innerHTML = `<div class="chat-stack"><div class="bubble out"><strong>Simulasi Alice mengirim pesan kepada Bob</strong><p>Alice mengambil public key Bob, mengenkripsi byte pesannya, lalu Bob memakai private key miliknya untuk membaca isi pesan.</p></div>
    <section class="panel"><div class="panel-title">Alur pengiriman</div><div class="panel-body">
      ${keyForm('send')}
      <div class="field"><label>Pesan Alice</label><textarea id="sendText">Halo Bob</textarea></div>
      <div class="actions"><button class="action-button" id="runSend">Kirim dan Dekripsi</button></div><div id="sendResult"></div>
    </div></section></div>`;
  $('#runSend').addEventListener('click', () => {
    const target = $('#sendResult');
    try {
      const key = makeKey(big($('#sendp').value), big($('#sendq').value), big($('#sende').value));
      if (key.n <= 255n) throw new Error('n harus lebih besar dari 255.');
      const text = $('#sendText').value;
      const plain = encodeText(text);
      const cipher = encryptBlocks(plain, key);
      const restored = decryptBlocks(cipher, key);
      target.innerHTML = `${keyMetrics(key)}
        <div class="bubble"><strong>Alice</strong><p>Meminta public key Bob: (${key.e}, ${key.n})</p></div>
        <div class="bubble out"><strong>Pesan dalam perjalanan</strong><p>Cipher: ${cipher.join(', ')}</p></div>
        <div class="bubble"><strong>Bob</strong><p>Mendekripsi memakai d = ${key.d}. Pesan diterima: ${html(decodeText(restored))}</p></div>
        ${table(['Urutan', 'Byte pesan', 'Cipher terkirim', 'Byte diterima'], plain.map((m, i) => [i, m, cipher[i], restored[i]]))}
        <div class="notice">Simulasi dilakukan lokal di browser; tidak ada jaringan atau server sesungguhnya.</div>`;
    } catch (error) { target.innerHTML = `<div class="error">${html(error.message)}</div>`; }
  });
}

const pages = {
  dashboard: ['Ringkasan RSA', 'Semua data perhitungan ditampilkan', renderDashboard],
  keygen: ['Pembentukan Kunci', 'Euclid dan Extended Euclid terlihat langkah demi langkah', renderKeygen],
  message: ['Pesan RSA', 'Encoding UTF-8, cipher, dan hasil dekripsi', renderMessage],
  aes: ['AES-GCM Mandiri', 'Enkripsi simetris tanpa RSA', renderAesGcm],
  compare: ['Perbandingan Metode', 'RSA, AES-GCM, dan hybrid pada pesan yang sama', renderComparison],
  prime: ['Uji Prima', 'Trial division tanpa library eksternal', renderPrime],
  modpow: ['Modular Power', 'Square-and-multiply dengan tabel jejak', renderModPow],
  hybrid: ['Hybrid RSA + AES-GCM', 'RSA membungkus kunci sesi, AES-GCM mengautentikasi pesan', renderHybrid],
  tamper: ['Perubahan Data', 'Hitung checksum dan bandingkan byte', renderTamper],
  send: ['Pengiriman Pesan', 'Alice dan Bob bertukar pesan terenkripsi', renderSend],
  about: ['Catatan Presentasi', 'Konsep, alasan implementasi, dan batasan', renderAbout]
};

function go(page) {
  state.page = page;
  document.querySelectorAll('.module-item').forEach(item => item.classList.toggle('active', item.dataset.page === page));
  const [title, subtitle, renderer] = pages[page];
  $('#pageTitle').textContent = title;
  $('#pageSubtitle').textContent = subtitle;
  renderer();
}

document.querySelectorAll('.module-item').forEach(item => item.addEventListener('click', () => go(item.dataset.page)));

$('#searchModule').addEventListener('input', event => {
  const query = event.target.value.toLowerCase();
  document.querySelectorAll('.module-item').forEach(item => {
    item.style.display = item.textContent.toLowerCase().includes(query) ? '' : 'none';
  });
});

$('#themeButton').addEventListener('click', () => document.body.classList.toggle('light'));

go('dashboard');
