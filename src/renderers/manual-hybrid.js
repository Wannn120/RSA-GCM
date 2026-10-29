(function () {
  'use strict';

  const shared = window.RSAUiShared;
  if (!shared) {
    throw new Error('ui-shared.js harus dimuat sebelum manual-hybrid.js');
  }

  const { big, html, flowSteps, bytesToHex, browserPayloadSize, requireBrowserCrypto, makeKey } = shared;
  const cryptoHelpers = window.RSAUiRenderers || {};

  function renderManualHybrid() {
    const content = () => document.getElementById('content');
    content().innerHTML = `<div class="lab-layout">
      <header class="lab-intro"><div><span class="eyebrow">PERCOBAAN UTAMA 02</span><h1>AES-GCM + RSA-CRT</h1></div><p>AES-GCM mengenkripsi isi pesan. RSA membungkus kunci sesi AES, dan Bob memakai CRT untuk membuka kunci itu sebelum mendekripsi pesan.</p></header>
      <section class="flow-panel"><h2>Alur pesan hybrid</h2>${flowSteps([
        { title: 'Buat kunci sesi AES', description: 'Alice menghasilkan kunci AES-256 acak dan IV baru.' },
        { title: 'Enkripsi isi pesan', description: 'AES-GCM menghasilkan ciphertext dan authentication tag.' },
        { title: 'Bungkus kunci untuk Bob', description: 'Public key RSA Bob mengenkripsi byte kunci sesi.' },
        { title: 'Buka kunci dengan RSA-CRT', description: 'Bob menghitung residu modulo p dan q, lalu menggabungkannya untuk memulihkan kunci AES.' },
        { title: 'Verifikasi dan baca pesan', description: 'AES-GCM memeriksa tag; jika valid, plaintext ditampilkan.' }
      ])}</section>
      <article class="panel experiment-card">
        <div class="panel-title"><span class="method-mark hybrid-mark">HYB</span><span><strong>Simulasi percakapan Alice dan Bob</strong><small>AES melindungi pesan, RSA-CRT membuka kunci sesi</small></span></div>
        <div class="panel-body">
          <div class="compact-key-fields">
            <div class="field"><label for="manualHybridp">Prima p</label><input id="manualHybridp" value="61" inputmode="numeric"></div>
            <div class="field"><label for="manualHybridq">Prima q</label><input id="manualHybridq" value="53" inputmode="numeric"></div>
            <div class="field"><label for="manualHybride">Eksponen e</label><input id="manualHybride" value="17" inputmode="numeric"></div>
          </div>
          <div class="field message-field"><label for="manualHybridText">Pesan Alice</label><textarea id="manualHybridText">Halo Bob, pesan ini memakai AES-GCM.</textarea></div>
          <div class="actions"><button class="action-button" id="runManualHybrid" type="button">Enkripsi dan kirim</button></div>
          <div class="chat-transcript" id="manualHybridResult" aria-live="polite"><div class="bubble"><strong>Bob</strong><p>Hasil enkripsi dan dekripsi akan muncul di sini.</p></div></div>
        </div>
      </article>
    </div>`;

    document.getElementById('runManualHybrid').addEventListener('click', async event => {
      const target = document.getElementById('manualHybridResult');
      const button = event.currentTarget;
      button.disabled = true;
      try {
        requireBrowserCrypto();
        const key = makeKey(big(document.getElementById('manualHybridp').value, 'p'), big(document.getElementById('manualHybridq').value, 'q'), big(document.getElementById('manualHybride').value, 'e'));
        const text = document.getElementById('manualHybridText').value;
        const encrypted = await cryptoHelpers.encryptWithBrowserHybrid(text, key);
        const restored = await cryptoHelpers.decryptWithBrowserHybridCrt(encrypted, key);
        const payload = {
          algorithm: 'aes-256-gcm',
          wrappedKey: encrypted.wrappedKey.map(String),
          iv: bytesToHex(encrypted.iv),
          ciphertext: bytesToHex(encrypted.ciphertext),
          authTag: bytesToHex(encrypted.authTag)
        };
        const details = `HYBRID: AES-256-GCM + RSA-CRT\np=${key.p}, q=${key.q}, n=${key.n}, e=${key.e}, d=${key.d}\nKunci sesi: acak 256-bit, dibungkus RSA per byte (tidak ditampilkan)\nBlok kunci terenkripsi: ${encrypted.wrappedKey.join(', ')}\nIV: ${bytesToHex(encrypted.iv)}\nCiphertext: ${bytesToHex(encrypted.ciphertext)}\nAuthentication tag: ${bytesToHex(encrypted.authTag)}\nCRT: dp = d mod (p-1), dq = d mod (q-1)\nDekripsi kunci: m1 = c^dp mod p; m2 = c^dq mod q\nPenggabungan: h = q^-1(m1-m2) mod p; m = m2+hq\nPesan pulih: ${restored.text}`;
        target.innerHTML = `<div class="bubble out"><strong>Alice • pesan dienkripsi</strong><p>${html(text)}</p><small>Isi pesan dilindungi AES-256-GCM</small></div>
          <div class="bubble"><strong>Alice → Bob • paket terkirim</strong><p class="transcript-data">Kunci AES dibungkus RSA · IV ${bytesToHex(encrypted.iv)} · tag autentikasi tersedia</p><small>Ciphertext ${bytesToHex(encrypted.ciphertext).length / 2} byte · 32 blok kunci RSA</small></div>
          <div class="bubble received"><strong>Bob • kunci dan pesan berhasil dibuka</strong><p>${html(restored.text)}</p><small>Kunci sesi dibuka dengan CRT; tag GCM valid</small></div>
          <div class="result-metrics"><span>Enkripsi hybrid <strong>${encrypted.elapsedMs.toFixed(4)} ms</strong></span><span>Dekripsi CRT + GCM <strong>${restored.elapsedMs.toFixed(4)} ms</strong></span><span>Payload <strong>${browserPayloadSize(payload)} byte</strong></span></div>
          <details class="data-details"><summary>Lihat ciphertext, IV, tag, dan langkah CRT</summary><pre class="code">${html(details)}</pre></details>`;
      } catch (error) {
        target.innerHTML = `<div class="error">${html(error.message)}</div>`;
      } finally {
        button.disabled = false;
      }
    });
  }

  window.RSAUiRenderers = window.RSAUiRenderers || {};
  window.RSAUiRenderers.manualHybrid = renderManualHybrid;
})();
