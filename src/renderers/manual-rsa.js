(function () {
  'use strict';

  const shared = window.RSAUiShared;
  if (!shared) {
    throw new Error('ui-shared.js harus dimuat sebelum manual-rsa.js');
  }

  const { big, html, flowSteps, browserPayloadSize, makeKey, encryptBlocks, decryptBlocks, decodeText, encodeText } = shared;

  function renderManualRsa() {
    const content = () => document.getElementById('content');
    content().innerHTML = `<div class="lab-layout">
      <header class="lab-intro"><div><span class="eyebrow">PERCOBAAN UTAMA 01</span><h1>Enkripsi RSA biasa</h1></div><p>Pesan diubah menjadi byte, dienkripsi per blok dengan public key, lalu Bob memulihkannya menggunakan private key.</p></header>
      <section class="flow-panel"><h2>Alur pesan</h2>${flowSteps([
        { title: 'Bentuk kunci', description: 'Pilih p dan q, hitung n dan φ(n), lalu tentukan e dan d.' },
        { title: 'Ubah teks menjadi byte', description: 'Setiap byte UTF-8 menjadi satu blok pesan m.' },
        { title: 'Enkripsi di Alice', description: 'Hitung c = m^e mod n dengan public key Bob.' },
        { title: 'Kirim dan dekripsi di Bob', description: 'Kirim ciphertext; hitung m = c^d mod n untuk memulihkan teks.' }
      ])}</section>
      <article class="panel experiment-card">
        <div class="panel-title"><span class="method-mark rsa-mark">RSA</span><span><strong>Simulasi percakapan Alice dan Bob</strong><small>Textbook RSA per byte untuk pembelajaran</small></span></div>
        <div class="panel-body">
          <div class="compact-key-fields">
            <div class="field"><label for="manualRsap">Prima p</label><input id="manualRsap" value="61" inputmode="numeric"></div>
            <div class="field"><label for="manualRsaq">Prima q</label><input id="manualRsaq" value="53" inputmode="numeric"></div>
            <div class="field"><label for="manualRsae">Eksponen e</label><input id="manualRsae" value="17" inputmode="numeric"></div>
          </div>
          <div class="field message-field"><label for="manualRsaText">Pesan Alice</label><textarea id="manualRsaText">Halo Bob, ini pesan RSA.</textarea></div>
          <div class="actions"><button class="action-button" id="runManualRsa" type="button">Enkripsi dan kirim</button></div>
          <div class="chat-transcript" id="manualRsaResult" aria-live="polite"><div class="bubble"><strong>Bob</strong><p>Hasil enkripsi dan dekripsi akan muncul di sini.</p></div></div>
        </div>
      </article>
    </div>`;

    document.getElementById('runManualRsa').addEventListener('click', () => {
      const target = document.getElementById('manualRsaResult');
      try {
        const key = makeKey(big(document.getElementById('manualRsap').value, 'p'), big(document.getElementById('manualRsaq').value, 'q'), big(document.getElementById('manualRsae').value, 'e'));
        if (key.n <= 255n) throw new Error('Untuk memproses seluruh byte UTF-8, gunakan n > 255.');
        const text = document.getElementById('manualRsaText').value;
        const plain = encodeText(text);
        const encryptStartedAt = performance.now();
        const cipher = encryptBlocks(plain, key);
        const encryptMs = performance.now() - encryptStartedAt;
        const decryptStartedAt = performance.now();
        const restored = decryptBlocks(cipher, key);
        const decryptMs = performance.now() - decryptStartedAt;
        const received = decodeText(restored);
        const detail = `RSA per byte\np=${key.p}, q=${key.q}, n=${key.n}, phi(n)=${key.phi}\nPublic key : (e=${key.e}, n=${key.n})\nPrivate key: (d=${key.d}, n=${key.n})\nPesan UTF-8: ${plain.join(', ')}\nCipher     : ${cipher.join(', ')}\nRumus      : c = m^e mod n; m = c^d mod n\nByte pulih : ${restored.join(', ')}\nWaktu enkripsi: ${encryptMs.toFixed(4)} ms\nWaktu dekripsi: ${decryptMs.toFixed(4)} ms`;
        target.innerHTML = `<div class="bubble out"><strong>Alice • pesan terkirim</strong><p>${html(text)}</p><small>${plain.length} byte pesan</small></div>
          <div class="bubble"><strong>Bob • menerima ciphertext</strong><p class="transcript-data">${html(cipher.join(', '))}</p><small>Didekripsi dengan private exponent d</small></div>
          <div class="bubble ${received === text ? 'received' : 'error'}"><strong>Bob • pesan terbaca</strong><p>${html(received)}</p><small>${received === text ? 'Teks cocok dengan pesan asli' : 'Hasil tidak cocok'}</small></div>
          <div class="result-metrics"><span>Enkripsi <strong>${encryptMs.toFixed(4)} ms</strong></span><span>Dekripsi <strong>${decryptMs.toFixed(4)} ms</strong></span><span>Payload <strong>${browserPayloadSize(cipher.map(String))} byte</strong></span></div>
          <details class="data-details"><summary>Lihat data dan rumus RSA</summary><pre class="code">${html(detail)}</pre></details>`;
      } catch (error) {
        target.innerHTML = `<div class="error">${html(error.message)}</div>`;
      }
    });
  }

  window.RSAUiRenderers = window.RSAUiRenderers || {};
  window.RSAUiRenderers.manualRsa = renderManualRsa;
})();
