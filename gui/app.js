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
let lastComparisonRows = [];

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
  // Nilai absolut menyederhanakan pembagian; algoritma berhenti ketika sisa menjadi nol.
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
  // oldR/r menyimpan sisa; oldS/s dan oldT/t melacak koefisien identitas Bezout.
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
  // JavaScript BigInt dapat memberi sisa negatif; normalisasi menghasilkan rentang [0, m).
  const r = n % m;
  return r < 0n ? r + m : r;
}

function modInverse(a, m) {
  // Koefisien x dari Extended Euclid adalah invers jika gcd(a,m) sama dengan satu.
  const result = extendedGcd(a, m);
  if (result.gcd !== 1n) throw new Error(`Invers tidak ada karena gcd(${a}, ${m}) = ${result.gcd}.`);
  return positiveMod(result.x, m);
}

function modPowTrace(base, exponent, modulus) {
  if (modulus <= 0n) throw new Error('Modulus harus positif.');
  if (exponent < 0n) throw new Error('Eksponen tidak boleh negatif.');
  // Square-and-multiply mengolah bit eksponen tanpa membentuk pangkat yang sangat besar.
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
  // Trial division mencoba pembagi sampai akar n dan menyimpan jejak untuk pembelajaran.
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
  // Kunci harus dibangun dari prima berbeda; validasi dilakukan sebelum operasi modular.
  const pCheck = primeTrace(p);
  const qCheck = primeTrace(q);
  if (!pCheck.prime) throw new Error(`p = ${p} bukan prima.`);
  if (!qCheck.prime) throw new Error(`q = ${q} bukan prima.`);
  if (p === q) throw new Error('p dan q harus berbeda.');

  // n dipakai sebagai modulus RSA dan phi dipakai untuk mencari inverse e.
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

  // Simpan jejak Extended Euclid agar GUI dapat menjelaskan asal private exponent d.
  const egcd = extendedGcd(e, phi);
  const d = modInverse(e, phi);
  return { p, q, n, phi, e, d, gcdInfo, egcd };
}

function encodeText(text) {
  // RSA demo memproses byte UTF-8 satu per satu, bukan karakter JavaScript.
  return Array.from(new TextEncoder().encode(text), byte => BigInt(byte));
}

function decodeText(blocks) {
  // Byte hasil RSA dikembalikan ke UTF-8 untuk menyusun teks semula.
  const bytes = Uint8Array.from(blocks.map(v => Number(v)));
  return new TextDecoder().decode(bytes);
}

function encryptBlocks(blocks, key) {
  // Terapkan public operation RSA ke setiap byte; setiap m wajib lebih kecil dari n.
  return blocks.map(m => {
    if (m >= key.n) throw new Error(`Blok ${m} tidak lebih kecil dari n = ${key.n}. Gunakan p dan q lebih besar.`);
    return modPow(m, key.e, key.n);
  });
}

function decryptBlocks(blocks, key) {
  // Cara RSA biasa memakai satu eksponen privat d modulo n untuk setiap blok.
  return blocks.map(c => modPow(c, key.d, key.n));
}

// CRT memecah dekripsi RSA menjadi dua eksponensial lebih kecil lalu menggabungkan hasilnya.
function decryptBlockWithCrtTrace(cipher, key) {
  // dp dan dq mengecilkan eksponen privat dengan teorema Fermat.
  const dp = positiveMod(key.d, key.p - 1n);
  const dq = positiveMod(key.d, key.q - 1n);
  // Invers q modulo p diperlukan untuk menggabungkan residu yang dihitung terpisah.
  const qInverse = modInverse(key.q, key.p);
  // Hitung sisa plaintext di bawah p dan q.
  const m1 = modPow(cipher, dp, key.p);
  const m2 = modPow(cipher, dq, key.q);
  // Cari koreksi h sehingga m2 + h*q cocok dengan m1 modulo p.
  const h = positiveMod(qInverse * (m1 - m2), key.p);
  // Hasil akhir cocok pada kedua modulus prima, sehingga menjadi plaintext modulo n.
  return { dp, dq, m1, m2, h, message: m2 + h * key.q };
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
  // Web Crypto membuat key 256-bit dan IV 96-bit baru untuk operasi enkripsi ini.
  const rawKey = window.crypto.getRandomValues(new Uint8Array(32));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const startedAt = performance.now();
  const cryptoKey = await window.crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt']);
  // API browser mengembalikan ciphertext diikuti tag 128-bit dalam satu buffer.
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
  // Web Crypto mengharapkan ciphertext || authenticationTag dalam satu input.
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

// Random integer memakai rejection sampling agar batas rentang tidak condong oleh modulo.
function browserRandomInt(minimum, maximum) {
  // Buang sampel di ujung rentang 32-bit agar pemetaan modulo tidak bias.
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

// Sieve menyiapkan daftar prima untuk pengambilan acak tanpa mencoba prima satu per satu.
function browserListPrimes(minimum, maximum) {
  // Sieve menandai bilangan komposit sekali; percobaan berikutnya tinggal mengambil dari daftar.
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
  // Pesan berupa ASCII printable supaya jumlah karakter sama dengan jumlah byte yang diminta.
  const bytes = window.crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, byte => String.fromCharCode(32 + (byte % 95))).join('');
}

function validateComparisonSettings(settings) {
  // Batasi jumlah iterasi dan alokasi agar eksperimen dapat dijalankan di browser biasa.
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
  // Urutan diperlukan untuk median; rata-rata/min/max memakai sampel yang sama.
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
  // Panjang batang dinormalisasi relatif terhadap nilai terbesar untuk metrik ini.
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
  // Ringkas waktu, payload, dan biaya membuat kunci untuk ditampilkan sebagai statistik.
  const stats = {
    rsaEncryptMs: comparisonStats(rows, 'rsaEncryptMs'),
    rsaDecryptMs: comparisonStats(rows, 'rsaDecryptMs'),
    rsaPayloadBytes: comparisonStats(rows, 'rsaPayloadBytes'),
    hybridEncryptMs: comparisonStats(rows, 'hybridEncryptMs'),
    hybridDecryptCrtMs: comparisonStats(rows, 'hybridDecryptCrtMs'),
    hybridPayloadBytes: comparisonStats(rows, 'hybridPayloadBytes'),
    keyGenerationMs: comparisonStats(rows, 'keyGenerationMs')
  };
  // Tabel ringkas menyandingkan empat statistik untuk setiap metrik utama.
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
  // Tabel detail mempertahankan setiap sampel agar dapat dianalisis satu per satu.
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

function downloadComparisonCsv() {
  // CSV mengekspor baris mentah, sehingga hasil eksperimen bisa dianalisis di spreadsheet.
  if (lastComparisonRows.length === 0) return;
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

// Membuat satu pesan hybrid: AES menyegel data, RSA membungkus tiap byte kunci sesi.
async function encryptWithBrowserHybrid(text, key) {
  // Catat total tahap hybrid, termasuk pembuatan key AES dan pembungkusan RSA per byte.
  const startedAt = performance.now();
  const aesPayload = await encryptWithBrowserAesGcm(text);
  if (key.n <= 255n) throw new Error('n RSA harus lebih besar dari 255 untuk membungkus byte kunci AES.');
  const wrappedKey = Array.from(aesPayload.rawKey, byte => modPow(BigInt(byte), key.e, key.n));
  const elapsedMs = performance.now() - startedAt;
  return { ...aesPayload, wrappedKey, elapsedMs };
}

// Penerima membuka byte kunci RSA dahulu, lalu AES-GCM memeriksa tag pesan.
async function decryptWithBrowserHybrid(payload, key) {
  // Pulihkan key 32 byte melalui RSA biasa, lalu serahkan validasi tag kepada AES-GCM.
  const startedAt = performance.now();
  const rawKey = Uint8Array.from(payload.wrappedKey.map(block => {
    const byte = modPow(block, key.d, key.n);
    if (byte < 0n || byte > 255n) throw new Error('RSA menghasilkan byte kunci AES yang tidak valid.');
    return Number(byte);
  }));
  const restored = await decryptWithBrowserAesGcm(payload, rawKey);
  return { text: restored.text, elapsedMs: performance.now() - startedAt };
}

// Varian hybrid ini membuka blok kunci AES dengan CRT, kemudian tetap memakai AES-GCM.
async function decryptWithBrowserHybridCrt(payload, key) {
  // Varian ini identik dari sisi payload, tetapi membuka tiap blok kunci memakai CRT.
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

function renderCrt() {
  content.innerHTML = `<div class="chat-stack">
    <div class="bubble"><strong>Dekripsi RSA dengan Chinese Remainder Theorem</strong><p>CRT tidak mengganti algoritma RSA atau mempercepat enkripsi. CRT mempercepat dekripsi dengan menghitung modulo p dan q secara terpisah, lalu menggabungkan kedua residu.</p></div>
    <section class="panel"><div class="panel-title">RSA biasa dibanding RSA-CRT</div><div class="panel-body">
      ${keyForm('crt')}
      <div class="field"><label>Pesan</label><textarea id="crtText">Halo CRT</textarea></div>
      <div class="actions"><button class="action-button" id="runCrt">Proses RSA dan CRT</button></div><div id="crtResult"></div>
    </div></section>
  </div>`;
  $('#runCrt').addEventListener('click', () => {
    const target = $('#crtResult');
    try {
      const key = makeKey(big($('#crtp').value, 'p'), big($('#crtq').value, 'q'), big($('#crte').value, 'e'));
      if (key.n <= 255n) throw new Error('Gunakan kunci dengan n > 255 untuk enkripsi pesan per byte.');
      const text = $('#crtText').value;
      const plain = encodeText(text);
      const cipher = encryptBlocks(plain, key);
      const startedStandard = performance.now();
      const standard = decryptBlocks(cipher, key);
      const standardMs = performance.now() - startedStandard;
      const startedCrt = performance.now();
      const traces = cipher.map(value => decryptBlockWithCrtTrace(value, key));
      const crtMs = performance.now() - startedCrt;
      const restored = traces.map(trace => trace.message);
      const rows = cipher.map((value, index) => {
        const trace = traces[index];
        return [index, plain[index], value, standard[index], trace.dp, trace.dq, trace.m1, trace.m2, trace.h, trace.message];
      });
      target.innerHTML = `${keyMetrics(key)}
        <div class="code">dp = d mod (p - 1) = ${positiveMod(key.d, key.p - 1n)}\ndq = d mod (q - 1) = ${positiveMod(key.d, key.q - 1n)}\nq⁻¹ mod p = ${modInverse(key.q, key.p)}\nPenggabungan: h = q⁻¹(m1 - m2) mod p, m = m2 + hq\nWaktu dekripsi RSA biasa: ${standardMs.toFixed(4)} ms\nWaktu dekripsi RSA-CRT: ${crtMs.toFixed(4)} ms\nHasil RSA biasa: ${html(decodeText(standard))}\nHasil RSA-CRT: ${html(decodeText(restored))}</div>
        ${table(['i', 'Byte asli', 'Cipher c', 'RSA biasa', 'dp', 'dq', 'm1 mod p', 'm2 mod q', 'h', 'Hasil CRT'], rows)}
        <div class="notice">Enkripsi sama pada kedua varian. CRT mengubah operasi private-key saat dekripsi. Pengukuran satu pesan pendek ini hanya demonstrasi; hasil waktu dapat berubah antar perangkat.</div>`;
    } catch (error) {
      target.innerHTML = `<div class="error">${html(error.message)}</div>`;
    }
  });
}

function renderComparison() {
  content.innerHTML = `<div class="chat-stack">
    <div class="bubble"><strong>Eksperimen RSA vs RSA + AES-GCM + CRT</strong><p>Setiap putaran membuat p dan q prima secara acak, sehingga n berubah. Kedua metode memakai pasangan kunci dan pesan acak yang sama. Pada metode hybrid, RSA membungkus kunci AES dan CRT dipakai saat membuka kunci tersebut.</p></div>
    <section class="panel"><div class="panel-title">Atur banyak percobaan acak</div><div class="panel-body">
      <div class="form-grid">
        <div class="field"><label>Jumlah putaran (1 sampai 1000)</label><input id="compareRuns" type="number" min="1" max="1000" value="100"></div>
        <div class="field"><label>Prima minimum (17 sampai 1.000.000)</label><input id="compareMinPrime" type="number" min="17" max="1000000" value="100"></div>
        <div class="field"><label>Prima maksimum (17 sampai 1.000.000)</label><input id="compareMaxPrime" type="number" min="17" max="1000000" value="999"></div>
        <div class="field"><label>Panjang pesan acak (byte, 1 sampai 4096)</label><input id="compareMessageBytes" type="number" min="1" max="4096" value="128"></div>
      </div>
      <div class="actions"><button class="action-button" id="runComparison">Jalankan Eksperimen</button><button class="action-button secondary" id="downloadComparison" type="button" disabled>Unduh CSV</button></div>
      <div id="comparisonResult"></div>
    </div></section>
  </div>`;
  $('#runComparison').addEventListener('click', async () => {
    const target = $('#comparisonResult');
    const button = $('#runComparison');
    try {
      requireBrowserCrypto();
      // Input diparsing sebagai angka dan divalidasi sebelum kerja kriptografi dimulai.
      const settings = {
        runs: Number($('#compareRuns').value),
        minPrime: Number($('#compareMinPrime').value),
        maxPrime: Number($('#compareMaxPrime').value),
        messageBytes: Number($('#compareMessageBytes').value)
      };
      validateComparisonSettings(settings);
      // Cek jumlah pasangan prima agar setiap putaran dapat memperoleh n yang belum dipakai.
      const primes = browserListPrimes(settings.minPrime, settings.maxPrime);
      if (primes.length < 2) throw new Error('Rentang prima harus memuat setidaknya dua bilangan prima berbeda.');
      const distinctModuli = (primes.length * (primes.length - 1)) / 2;
      if (settings.runs > distinctModuli) {
        throw new Error(`Rentang ini hanya menyediakan ${distinctModuli} pasangan n unik. Kurangi percobaan atau perlebar rentang.`);
      }
      // Kunci tombol untuk mencegah dua batch berjalan bersamaan dan mencampur hasil.
      button.disabled = true;
      $('#downloadComparison').disabled = true;
      lastComparisonRows = [];
      target.innerHTML = '<div class="notice" id="comparisonProgress">Menyiapkan eksperimen acak...</div>';
      const rows = [];
      const usedModuli = new Set();

      // Satu putaran: buat n baru, lalu jalankan dua skema pada kunci dan pesan yang sama.
      for (let index = 0; index < settings.runs; index++) {
        let p;
        let q;
        let modulus;
        let foundUniqueModulus = false;
        for (let attempt = 0; attempt < 10000; attempt++) {
          p = primes[browserRandomInt(0, primes.length - 1)];
          q = primes[browserRandomInt(0, primes.length - 1)];
          if (p === q) continue;
          modulus = (p * q).toString();
          if (usedModuli.has(modulus)) continue;
          foundUniqueModulus = true;
          break;
        }
        if (!foundUniqueModulus) {
          throw new Error('Rentang prima terlalu sempit untuk menghasilkan n unik sebanyak itu. Kurangi percobaan atau perlebar rentang.');
        }
        usedModuli.add(modulus);
        // Pembuatan pasangan RSA dicatat tersendiri, bukan dimasukkan hanya ke satu skema.
        const keyStartedAt = performance.now();
        const key = makeKey(p, q, null);
        const keyGenerationMs = performance.now() - keyStartedAt;
        const message = browserRandomMessage(settings.messageBytes);
        const plain = encodeText(message);

        // RSA mandiri memproses byte pesan satu per satu dengan public exponent e.
        const rsaEncryptStartedAt = performance.now();
        const rsaCipher = encryptBlocks(plain, key);
        const rsaEncryptMs = performance.now() - rsaEncryptStartedAt;
        const rsaDecryptStartedAt = performance.now();
        const rsaRestored = decodeText(decryptBlocks(rsaCipher, key));
        const rsaDecryptMs = performance.now() - rsaDecryptStartedAt;
        const rsaPayloadBytes = browserPayloadSize(rsaCipher.map(String));

        // Hybrid memakai AES untuk data; dekripsi kunci sesi memakai implementasi CRT lokal.
        const hybrid = await encryptWithBrowserHybrid(message, key);
        const hybridRestored = await decryptWithBrowserHybridCrt(hybrid, key);
        const hybridEncryptMs = hybrid.elapsedMs;
        const hybridDecryptCrtMs = hybridRestored.elapsedMs;
        const hybridPayloadBytes = browserPayloadSize({
          algorithm: 'aes-256-gcm',
          wrappedKey: hybrid.wrappedKey.map(String),
          iv: bytesToHex(hybrid.iv),
          ciphertext: bytesToHex(hybrid.ciphertext),
          authTag: bytesToHex(hybrid.authTag)
        });

        // Simpan faktor, modulus, ukuran data, waktu, ukuran payload, dan validitas hasil.
        rows.push({
          run: index + 1,
          p: p.toString(),
          q: q.toString(),
          n: key.n.toString(),
          messageBytes: new TextEncoder().encode(message).length,
          keyGenerationMs,
          rsaEncryptMs,
          rsaDecryptMs,
          rsaPayloadBytes,
          hybridEncryptMs,
          hybridDecryptCrtMs,
          hybridPayloadBytes,
          rsaRoundTrip: rsaRestored === message,
          hybridRoundTrip: hybridRestored.text === message
        });
        // Beri browser kesempatan memperbarui progress selama batch panjang berlangsung.
        if ((index + 1) % 5 === 0 || index + 1 === settings.runs) {
          $('#comparisonProgress').textContent = `Percobaan selesai: ${index + 1} dari ${settings.runs}`;
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      lastComparisonRows = rows;
      $('#downloadComparison').disabled = false;
      target.innerHTML = renderComparisonResults(settings, rows);
    } catch (error) {
      target.innerHTML = `<div class="error">${html(error.message)}</div>`;
    } finally {
      button.disabled = false;
    }
  });
  $('#downloadComparison').addEventListener('click', downloadComparisonCsv);
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
  crt: ['Dekripsi RSA-CRT', 'Bandingkan RSA biasa dengan CRT', renderCrt],
  compare: ['Eksperimen Acak', 'RSA biasa vs RSA + AES-GCM + CRT dengan banyak nilai n', renderComparison],
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
