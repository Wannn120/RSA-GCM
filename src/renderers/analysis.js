(function () {
  'use strict';

  const shared = window.RSAUiShared;
  if (!shared) {
    throw new Error('ui-shared.js harus dimuat sebelum analysis.js');
  }

  const {
    big,
    html,
    table,
    keyMetrics,
    keyForm,
    flowSteps,
    bytesToHex,
    requireBrowserCrypto,
    makeKey,
    encryptBlocks,
    decryptBlocks,
    decryptBlockWithCrtTrace,
    modInverse,
    positiveMod,
    decodeText,
    encodeText,
    primeTrace,
    modPowTrace
  } = shared;

  const cryptoHelpers = window.RSAUiRenderers || {};

  function renderKeygen() {
    const content = () => document.getElementById('content');
    content().innerHTML = `<div class="chat-stack">
      <div class="bubble"><strong>Kenapa butuh p dan q?</strong><p>Dua bilangan prima dikalikan menjadi n. Nilai φ(n) dihitung dari (p − 1)(q − 1), lalu e dipilih agar gcd(e, φ(n)) = 1.</p></div>
      <section class="panel"><div class="panel-title">Pembentukan kunci dengan jejak hitung</div><div class="panel-body">
        ${keyForm('key')}
        <div class="actions"><button id="runKey" class="action-button" type="button">Bentuk Kunci</button></div>
        <div id="keyResult"></div>
      </div></section>
    </div>`;

    document.getElementById('runKey').addEventListener('click', () => {
      const target = document.getElementById('keyResult');
      try {
        const key = makeKey(big(document.getElementById('keyp').value), big(document.getElementById('keyq').value), big(document.getElementById('keye').value));
        window.RSAUiState = window.RSAUiState || {};
        window.RSAUiState.key = key;
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
    const content = () => document.getElementById('content');
    content().innerHTML = `<div class="chat-stack">
      <div class="bubble out"><strong>Mode pesan</strong><p>Satu byte UTF-8 dijadikan satu blok m. Setiap blok dienkripsi dengan c = m^e mod n dan didekripsi dengan m = c^d mod n.</p></div>
      <section class="panel"><div class="panel-title">Enkripsi dan dekripsi teks</div><div class="panel-body">
        ${keyForm('msg')}
        <div class="field" style="margin-top:12px"><label>Pesan yang diuji</label><textarea id="messageText">Halo Matdis</textarea></div>
        <div class="actions"><button id="runMessage" class="action-button" type="button">Proses Pesan</button></div>
        <div id="messageResult"></div>
      </div></section>
    </div>`;

    document.getElementById('runMessage').addEventListener('click', () => {
      const target = document.getElementById('messageResult');
      try {
        const key = makeKey(big(document.getElementById('msgp').value), big(document.getElementById('msgq').value), big(document.getElementById('msge').value));
        if (key.n <= 255n) throw new Error('n harus lebih besar dari 255 untuk menampung seluruh nilai byte 0 sampai 255.');
        const text = document.getElementById('messageText').value;
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
    const content = () => document.getElementById('content');
    content().innerHTML = `<div class="chat-stack">
      <div class="bubble"><strong>Uji prima manual</strong><p>Cukup mencoba pembagi sampai √n. Jika tidak ada pembagi yang menghasilkan sisa 0, n adalah prima.</p></div>
      <section class="panel"><div class="panel-title">Trial Division</div><div class="panel-body">
        <div class="form-grid two"><div class="field"><label>Bilangan n</label><input id="primeN" value="61"></div></div>
        <div class="actions"><button id="runPrime" class="action-button" type="button">Uji Prima</button></div>
        <div id="primeResult"></div>
      </div></section>
    </div>`;
    document.getElementById('runPrime').addEventListener('click', () => {
      const target = document.getElementById('primeResult');
      try {
        const n = big(document.getElementById('primeN').value, 'n');
        const result = primeTrace(n);
        target.innerHTML = `<div class="notice"><strong>${n} ${result.prime ? 'adalah prima' : 'bukan prima'}.</strong> ${html(result.reason)}</div>${table(['Pembagi yang dicoba', 'Sisa n mod pembagi'], result.tested.map(x => [x.divisor, x.remainder]))}`;
      } catch (error) {
        target.innerHTML = `<div class="error">${html(error.message)}</div>`;
      }
    });
  }

  function renderModPow() {
    const content = () => document.getElementById('content');
    content().innerHTML = `<div class="chat-stack">
      <div class="bubble out"><strong>Kenapa tidak menghitung base^exp langsung?</strong><p>Eksponen RSA dapat sangat besar. Square-and-multiply mengecilkan hasil dengan modulo pada setiap langkah sehingga perhitungan tetap efisien.</p></div>
      <section class="panel"><div class="panel-title">Square-and-Multiply</div><div class="panel-body">
        <div class="form-grid"><div class="field"><label>Base</label><input id="powBase" value="65"></div><div class="field"><label>Eksponen</label><input id="powExp" value="17"></div><div class="field"><label>Modulus</label><input id="powMod" value="3233"></div></div>
        <div class="actions"><button id="runPow" class="action-button" type="button">Hitung</button></div>
        <div id="powResult"></div>
      </div></section>
    </div>`;
    document.getElementById('runPow').addEventListener('click', () => {
      const target = document.getElementById('powResult');
      try {
        const base = big(document.getElementById('powBase').value);
        const exp = big(document.getElementById('powExp').value);
        const mod = big(document.getElementById('powMod').value);
        const result = modPowTrace(base, exp, mod);
        const rows = result.steps.map((s, i) => [i + 1, s.exponent, s.bit, s.base, s.before, s.after]);
        target.innerHTML = `<div class="metric-grid"><div class="metric"><span>Hasil</span><strong>${result.result}</strong></div><div class="metric"><span>Jumlah langkah</span><strong>${result.steps.length}</strong></div></div>${table(['Langkah', 'Eksponen saat ini', 'Bit', 'Base saat ini', 'Result sebelum', 'Result sesudah'], rows)}
        <div class="notice">Jika bit eksponen = 1, result dikalikan base lalu dimodulo. Setelah itu eksponen dibagi 2 dan base dikuadratkan modulo n.</div>`;
      } catch (error) {
        target.innerHTML = `<div class="error">${html(error.message)}</div>`;
      }
    });
  }

  function renderAesGcm() {
    const content = () => document.getElementById('content');
    content().innerHTML = `<div class="chat-stack">
      <div class="bubble"><strong>AES-256-GCM mandiri</strong><p>AES adalah enkripsi simetris: pengirim dan penerima memakai kunci rahasia yang sama. GCM juga menghasilkan authentication tag untuk mendeteksi ciphertext atau tag yang berubah.</p></div>
      <section class="panel"><div class="panel-title">Uji AES-GCM tanpa RSA</div><div class="panel-body">
        <div class="field"><label>Pesan</label><textarea id="aesText">Halo Matdis</textarea></div>
        <div class="actions"><button class="action-button" id="runAes">Enkripsi dan Dekripsi AES</button></div><div id="aesResult"></div>
      </div></section>
    </div>`;
    document.getElementById('runAes').addEventListener('click', async () => {
      const target = document.getElementById('aesResult');
      try {
        requireBrowserCrypto();
        const text = document.getElementById('aesText').value;
        const encrypted = await cryptoHelpers.encryptWithBrowserAesGcm(text);
        const restored = await cryptoHelpers.decryptWithBrowserAesGcm(encrypted, encrypted.rawKey);
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
    const content = () => document.getElementById('content');
    content().innerHTML = `<div class="chat-stack">
      <div class="bubble"><strong>Dekripsi RSA dengan Chinese Remainder Theorem</strong><p>CRT tidak mengganti algoritma RSA atau mempercepat enkripsi. CRT mempercepat dekripsi dengan menghitung modulo p dan q secara terpisah, lalu menggabungkan kedua residu.</p></div>
      <section class="panel"><div class="panel-title">RSA biasa dibanding RSA-CRT</div><div class="panel-body">
        ${keyForm('crt')}
        <div class="field"><label>Pesan</label><textarea id="crtText">Halo CRT</textarea></div>
        <div class="actions"><button class="action-button" id="runCrt">Proses RSA dan CRT</button></div><div id="crtResult"></div>
      </div></section>
    </div>`;
    document.getElementById('runCrt').addEventListener('click', () => {
      const target = document.getElementById('crtResult');
      try {
        const key = makeKey(big(document.getElementById('crtp').value, 'p'), big(document.getElementById('crtq').value, 'q'), big(document.getElementById('crte').value, 'e'));
        if (key.n <= 255n) throw new Error('Gunakan kunci dengan n > 255 untuk enkripsi pesan per byte.');
        const text = document.getElementById('crtText').value;
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

  function renderHybrid() {
    const content = () => document.getElementById('content');
    content().innerHTML = `<div class="chat-stack">
      <div class="bubble"><strong>Simulasi hybrid RSA + AES-GCM</strong><p>AES-GCM mengenkripsi pesan dan memeriksa authentication tag. Kunci AES acak 256-bit dibungkus RSA buatan proyek per byte karena modulus contoh yang kecil tidak cukup untuk satu bilangan kunci utuh.</p></div>
      <section class="panel"><div class="panel-title">RSA membungkus kunci sesi, AES-GCM mengenkripsi pesan</div><div class="panel-body">
        ${keyForm('hyb')}
        <div class="field"><label>Pesan</label><textarea id="hybText">Halo Matdis</textarea></div>
        <div class="actions"><button class="action-button" id="runHybrid">Proses Hybrid</button></div><div id="hybridResult"></div>
      </div></section></div>`;
    document.getElementById('runHybrid').addEventListener('click', async () => {
      const target = document.getElementById('hybridResult');
      try {
        requireBrowserCrypto();
        const key = makeKey(big(document.getElementById('hybp').value), big(document.getElementById('hybq').value), big(document.getElementById('hybe').value));
        const text = document.getElementById('hybText').value;
        const encrypted = await cryptoHelpers.encryptWithBrowserHybrid(text, key);
        const restored = await cryptoHelpers.decryptWithBrowserHybrid(encrypted, key);
        target.innerHTML = `${keyMetrics(key)}
          <div class="code">Algoritma data : AES-256-GCM\nKunci sesi     : dibuat acak, tidak ditampilkan\nBlok kunci RSA : ${encrypted.wrappedKey.join(', ')}\nIV             : ${bytesToHex(encrypted.iv)}\nCiphertext     : ${bytesToHex(encrypted.ciphertext)}\nAuthentication tag: ${bytesToHex(encrypted.authTag)}\nPesan kembali  : ${html(restored.text)}</div>
          ${table(['Indeks byte kunci', `Hasil RSA (e=${key.e}, n=${key.n})`], encrypted.wrappedKey.map((block, i) => [i, block]))}
          <div class="notice">AES-GCM menolak ciphertext atau tag yang diubah. Demo memakai RSA tanpa padding dan modulus kecil; RSA per byte hanya untuk menjelaskan alur, bukan pengamanan produksi.</div>`;
      } catch (error) { target.innerHTML = `<div class="error">${html(error.message)}</div>`; }
    });
  }

  function renderTamper() {
    const content = () => document.getElementById('content');
    content().innerHTML = `<div class="chat-stack"><div class="bubble"><strong>Simulasi integritas sederhana</strong><p>Checksum berbobot menambahkan (indeks + 1) × nilai blok, kemudian mengambil sisa modulo 1000003. Mengubah sebuah blok biasanya akan mengubah checksum, tetapi checksum ini bukan tanda tangan digital.</p></div>
      <section class="panel"><div class="panel-title">Uji perubahan byte</div><div class="panel-body">
        <div class="field"><label>Pesan</label><textarea id="tamperText">MATDIS</textarea></div>
        <div class="form-grid two"><div class="field"><label>Index byte (mulai dari 0)</label><input id="tamperIndex" value="0"></div><div class="field"><label>Delta perubahan</label><input id="tamperDelta" value="1"></div></div>
        <div class="actions"><button class="action-button" id="runTamper">Bandingkan Data</button></div><div id="tamperResult"></div>
      </div></section></div>`;
    document.getElementById('runTamper').addEventListener('click', () => {
      const target = document.getElementById('tamperResult');
      try {
        const plain = encodeText(document.getElementById('tamperText').value);
        const index = Number(big(document.getElementById('tamperIndex').value));
        const delta = big(document.getElementById('tamperDelta').value);
        if (!Number.isSafeInteger(index) || index < 0 || index >= plain.length) throw new Error('Index tidak valid untuk byte pesan ini.');
        const changed = plain.slice();
        changed[index] += delta;
        let total = 0n;
        const steps = [];
        plain.forEach((value, i) => {
          const term = BigInt(i + 1) * BigInt(value);
          total = (total + term) % 1000003n;
          steps.push({ index: i, value, weight: i + 1, term, subtotal: total });
        });
        let changedTotal = 0n;
        const changedSteps = [];
        changed.forEach((value, i) => {
          const term = BigInt(i + 1) * BigInt(value);
          changedTotal = (changedTotal + term) % 1000003n;
          changedSteps.push({ index: i, value, weight: i + 1, term, subtotal: changedTotal });
        });
        target.innerHTML = `<div class="metric-grid"><div class="metric"><span>Checksum asli</span><strong>${total}</strong></div><div class="metric"><span>Checksum diubah</span><strong>${changedTotal}</strong></div></div>
          ${table(['Index', 'Byte asli', 'Byte baru', 'Bobot', 'Kontribusi asli', 'Subtotal checksum asli'], steps.map((r, i) => [i, r.value, changed[i], r.weight, r.term, r.subtotal]))}
          <div class="notice">Perubahan ${total === changedTotal ? 'tidak' : 'berhasil'} terdeteksi melalui perbandingan checksum. Kolisi mungkin terjadi, sehingga jangan gunakan ini sebagai jaminan keamanan.</div>`;
      } catch (error) { target.innerHTML = `<div class="error">${html(error.message)}</div>`; }
    });
  }

  function renderSend() {
    const content = () => document.getElementById('content');
    content().innerHTML = `<div class="chat-stack"><div class="bubble out"><strong>Simulasi Alice mengirim pesan kepada Bob</strong><p>Alice mengambil public key Bob, mengenkripsi byte pesannya, lalu Bob memakai private key miliknya untuk membaca isi pesan.</p></div>
      <section class="panel"><div class="panel-title">Alur pengiriman</div><div class="panel-body">
        ${keyForm('send')}
        <div class="field"><label>Pesan Alice</label><textarea id="sendText">Halo Bob</textarea></div>
        <div class="actions"><button class="action-button" id="runSend">Kirim dan Dekripsi</button></div><div id="sendResult"></div>
      </div></section></div>`;
    document.getElementById('runSend').addEventListener('click', () => {
      const target = document.getElementById('sendResult');
      try {
        const key = makeKey(big(document.getElementById('sendp').value), big(document.getElementById('sendq').value), big(document.getElementById('sende').value));
        if (key.n <= 255n) throw new Error('n harus lebih besar dari 255.');
        const text = document.getElementById('sendText').value;
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

  window.RSAUiRenderers = window.RSAUiRenderers || {};
  Object.assign(window.RSAUiRenderers, {
    keygen: renderKeygen,
    message: renderMessage,
    prime: renderPrime,
    modpow: renderModPow,
    aes: renderAesGcm,
    crt: renderCrt,
    hybrid: renderHybrid,
    tamper: renderTamper,
    send: renderSend
  });
})();
