(function () {
  'use strict';

  const shared = window.RSAUiShared;
  if (!shared) {
    throw new Error('ui-shared.js harus dimuat sebelum dashboard.js');
  }

  const { supportLink, html } = shared;

  function renderDashboard() {
    const content = () => document.getElementById('content');
    content().innerHTML = `<div class="lab-layout">
      <header class="lab-intro">
        <div><span class="eyebrow">LAB KRIPTOGRAFI • MATDIS</span><h1>Bandingkan dua cara mengirim pesan</h1></div>
        <p>Pilih salah satu dari tiga percobaan utama. Setiap percobaan memiliki halaman dan hasilnya sendiri dengan tampilan percakapan WhatsApp.</p>
      </header>
      <div class="primary-links">
        <button class="primary-link" type="button" data-main-page="manualRsa"><span class="primary-link-icon">01</span><span><strong>RSA Manual</strong><small>Enkripsi dan dekripsi pesan langsung per byte</small></span><b>→</b></button>
        <button class="primary-link" type="button" data-main-page="manualHybrid"><span class="primary-link-icon">02</span><span><strong>AES-GCM + RSA-CRT</strong><small>Enkripsi hybrid dan buka kunci sesi dengan CRT</small></span><b>→</b></button>
        <button class="primary-link" type="button" data-main-page="compare"><span class="primary-link-icon">03</span><span><strong>Eksperimen Acak</strong><small>Grafik dan data perbandingan kedua skema</small></span><b>→</b></button>
      </div>
      <div class="support-panel">
        <div class="support-heading"><span class="support-icon">✳</span><div><h2>Modul pengamatan tambahan</h2><p>Rincian konsep, metode bantu, dan pemeriksaan data.</p></div></div>
        <div class="support-links">
          ${supportLink('keygen', 'Kunci RSA', 'Lihat n, φ(n), gcd, dan Extended Euclid')}
          ${supportLink('crt', 'Langkah CRT', 'Periksa residu m₁, m₂, dan penggabungan')}
          ${supportLink('prime', 'Uji bilangan prima', 'Telusuri pembagi sampai √n')}
          ${supportLink('modpow', 'Pangkat modular', 'Pelajari square-and-multiply')}
          ${supportLink('aes', 'AES-GCM mandiri', 'Uji authentication tag tanpa RSA')}
          ${supportLink('hybrid', 'Hybrid tanpa CRT', 'Bandingkan pembukaan kunci RSA biasa')}
          ${supportLink('send', 'Simulasi Alice–Bob', 'Lihat alur pesan lokal')}
          ${supportLink('tamper', 'Integritas data', 'Amati dampak perubahan byte')}
        </div>
      </div>
    </div>`;

    content().querySelectorAll('[data-main-page]').forEach(link => {
      link.addEventListener('click', () => window.RSAUi.go(link.dataset.mainPage));
    });
    content().querySelectorAll('[data-support-page]').forEach(link => {
      link.addEventListener('click', () => window.RSAUi.go(link.dataset.supportPage));
    });
  }

  window.RSAUiRenderers = window.RSAUiRenderers || {};
  window.RSAUiRenderers.dashboard = renderDashboard;
})();
