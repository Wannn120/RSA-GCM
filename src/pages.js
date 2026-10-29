(function () {
  'use strict';

  const state = {
    page: 'dashboard',
    key: null,
    lastMessage: null
  };

  const $ = selector => document.querySelector(selector);
  const renderers = window.RSAUiRenderers || {};

  const pages = {
    dashboard: ['Beranda Lab', 'Pilih percobaan utama atau modul pengamatan tambahan', renderers.dashboard],
    manualRsa: ['RSA Manual', 'Enkripsi langsung per byte dan dekripsi dengan private key', renderers.manualRsa],
    manualHybrid: ['AES-GCM + RSA-CRT', 'Enkripsi pesan dengan AES-GCM dan buka kunci sesi memakai CRT', renderers.manualHybrid],
    keygen: ['Pembentukan Kunci', 'Euclid dan Extended Euclid terlihat langkah demi langkah', renderers.keygen],
    message: ['Pesan RSA', 'Encoding UTF-8, cipher, dan hasil dekripsi', renderers.message],
    aes: ['AES-GCM Mandiri', 'Enkripsi simetris tanpa RSA', renderers.aes],
    crt: ['Dekripsi RSA-CRT', 'Bandingkan RSA biasa dengan CRT', renderers.crt],
    compare: ['Eksperimen Acak', 'Grafik dan data perbandingan RSA biasa vs AES-GCM + RSA-CRT', renderers.compare],
    prime: ['Uji Prima', 'Trial division tanpa library eksternal', renderers.prime],
    modpow: ['Modular Power', 'Square-and-multiply dengan tabel jejak', renderers.modpow],
    hybrid: ['Hybrid RSA + AES-GCM', 'RSA membungkus kunci sesi, AES-GCM mengautentikasi pesan', renderers.hybrid],
    tamper: ['Perubahan Data', 'Hitung checksum dan bandingkan byte', renderers.tamper],
    send: ['Pengiriman Pesan', 'Alice dan Bob bertukar pesan terenkripsi', renderers.send]
  };

  function go(page) {
    if (!pages[page] || typeof pages[page][2] !== 'function') return;
    state.page = page;
    document.querySelectorAll('.module-item').forEach(item => item.classList.toggle('active', item.dataset.page === page));
    const [title, subtitle, renderer] = pages[page];
    $('#pageTitle').textContent = title;
    $('#pageSubtitle').textContent = subtitle;
    renderer();
  }

  function init() {
    document.querySelectorAll('.module-item').forEach(item => item.addEventListener('click', () => go(item.dataset.page)));
    $('#searchModule').addEventListener('input', event => {
      const query = event.target.value.toLowerCase();
      document.querySelectorAll('.module-item').forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(query) ? '' : 'none';
      });
    });
    $('#themeButton').addEventListener('click', () => document.body.classList.toggle('light'));
    go('dashboard');
  }

  let initialized = false;

  function ensureInit() {
    if (initialized) return;
    if (!window.RSA_GCM || !window.RSA_GCM.math || !window.RSA_GCM.rsa) return;
    initialized = true;
    init();
  }

  window.RSAUi = { init, state, pages, go };
  window.addEventListener('rsa-gcm-ready', ensureInit, { once: true });
  ensureInit();
})();
