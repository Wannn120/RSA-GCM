(function () {
  'use strict';

  const shared = window.RSAUiShared;
  if (!shared) {
    throw new Error('ui-shared.js harus dimuat sebelum comparison.js');
  }

  const {
    html,
    table,
    flowSteps,
    browserPayloadSize,
    bytesToHex,
    requireBrowserCrypto,
    browserRandomInt,
    browserListPrimes,
    browserRandomMessage,
    comparisonStats,
    validateComparisonSettings,
    makeKey,
    encryptBlocks,
    decryptBlocks,
    encodeText,
    decodeText,
    big
  } = shared;

  const cryptoHelpers = window.RSAUiRenderers || {};
  const state = window.RSAUiState = window.RSAUiState || {};
  state.lastComparisonRows = state.lastComparisonRows || [];

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

  function downloadComparisonCsv() {
    if (state.lastComparisonRows.length === 0) return;
    const columns = [
      'run', 'p', 'q', 'n', 'messageBytes', 'keyGenerationMs',
      'rsaEncryptMs', 'rsaDecryptMs', 'rsaPayloadBytes',
      'hybridEncryptMs', 'hybridDecryptCrtMs', 'hybridPayloadBytes',
      'rsaRoundTrip', 'hybridRoundTrip'
    ];
    const escape = value => `"${String(value).replaceAll('"', '""')}"`;
    const csv = [columns, ...state.lastComparisonRows.map(row => columns.map(column => row[column]))]
      .map(row => row.map(escape).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'perbandingan-rsa-hybrid.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function renderComparison() {
    const content = () => document.getElementById('content');
    content().innerHTML = `<div class="lab-layout"><section class="panel comparison-panel">
        <div class="panel-title"><span class="method-mark experiment-mark">↔</span><span><strong>Eksperimen acak</strong><small>Bandingkan RSA biasa dengan AES-GCM + RSA-CRT</small></span></div>
        <div class="panel-body">
        <p class="comparison-intro">Setiap putaran memakai pasangan prima, kunci RSA, dan pesan acak yang sama untuk kedua metode. Hasilnya dibandingkan dari waktu enkripsi/dekripsi, ukuran payload, dan keberhasilan pemulihan pesan.</p>
        <div class="comparison-flow">${flowSteps([
          { title: 'Buat sampel', description: 'Pilih p dan q acak yang menghasilkan n unik.' },
          { title: 'Jalankan dua metode', description: 'Enkripsi pesan yang sama dengan RSA langsung dan hybrid AES-GCM + RSA-CRT.' },
          { title: 'Ukur dan verifikasi', description: 'Catat waktu, payload, dan apakah pesan berhasil dipulihkan.' },
          { title: 'Bandingkan hasil', description: 'Grafik merangkum rata-rata; tabel menunjukkan semua percobaan.' }
        ])}</div>
        <div class="form-grid">
          <div class="field"><label for="compareRuns">Jumlah percobaan (1–1000)</label><input id="compareRuns" type="number" min="1" max="1000" value="100"></div>
          <div class="field"><label>Prima minimum (17 sampai 1.000.000)</label><input id="compareMinPrime" type="number" min="17" max="1000000" value="100"></div>
          <div class="field"><label>Prima maksimum (17 sampai 1.000.000)</label><input id="compareMaxPrime" type="number" min="17" max="1000000" value="999"></div>
          <div class="field"><label>Panjang pesan acak (byte, 1 sampai 4096)</label><input id="compareMessageBytes" type="number" min="1" max="4096" value="128"></div>
        </div>
        <div class="actions"><button class="action-button" id="runComparison" type="button">Jalankan eksperimen</button><button class="action-button secondary" id="downloadComparison" type="button" disabled>Unduh CSV</button></div>
        <div id="comparisonResult"></div>
        </div>
      </section></div>`;

    document.getElementById('runComparison').addEventListener('click', async () => {
      const target = document.getElementById('comparisonResult');
      const button = document.getElementById('runComparison');
      try {
        requireBrowserCrypto();
        const settings = {
          runs: Number(document.getElementById('compareRuns').value),
          minPrime: Number(document.getElementById('compareMinPrime').value),
          maxPrime: Number(document.getElementById('compareMaxPrime').value),
          messageBytes: Number(document.getElementById('compareMessageBytes').value)
        };
        validateComparisonSettings(settings);
        const primes = browserListPrimes(settings.minPrime, settings.maxPrime);
        if (primes.length < 2) throw new Error('Rentang prima harus memuat setidaknya dua bilangan prima berbeda.');
        const distinctModuli = (primes.length * (primes.length - 1)) / 2;
        if (settings.runs > distinctModuli) {
          throw new Error(`Rentang ini hanya menyediakan ${distinctModuli} pasangan n unik. Kurangi percobaan atau perlebar rentang.`);
        }
        button.disabled = true;
        document.getElementById('downloadComparison').disabled = true;
        state.lastComparisonRows = [];
        target.innerHTML = '<div class="notice" id="comparisonProgress">Menyiapkan eksperimen acak...</div>';
        const rows = [];
        const usedModuli = new Set();

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
          const keyStartedAt = performance.now();
          const key = makeKey(p, q, null);
          const keyGenerationMs = performance.now() - keyStartedAt;
          const message = browserRandomMessage(settings.messageBytes);
          const plain = encodeText(message);

          const rsaEncryptStartedAt = performance.now();
          const rsaCipher = encryptBlocks(plain, key);
          const rsaEncryptMs = performance.now() - rsaEncryptStartedAt;
          const rsaDecryptStartedAt = performance.now();
          const rsaRestored = decodeText(decryptBlocks(rsaCipher, key));
          const rsaDecryptMs = performance.now() - rsaDecryptStartedAt;
          const rsaPayloadBytes = browserPayloadSize(rsaCipher.map(String));

          const hybrid = await cryptoHelpers.encryptWithBrowserHybrid(message, key);
          const hybridRestored = await cryptoHelpers.decryptWithBrowserHybridCrt(hybrid, key);
          const hybridEncryptMs = hybrid.elapsedMs;
          const hybridDecryptCrtMs = hybridRestored.elapsedMs;
          const hybridPayloadBytes = browserPayloadSize({
            algorithm: 'aes-256-gcm',
            wrappedKey: hybrid.wrappedKey.map(String),
            iv: bytesToHex(hybrid.iv),
            ciphertext: bytesToHex(hybrid.ciphertext),
            authTag: bytesToHex(hybrid.authTag)
          });

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
          if ((index + 1) % 5 === 0 || index + 1 === settings.runs) {
            document.getElementById('comparisonProgress').textContent = `Percobaan selesai: ${index + 1} dari ${settings.runs}`;
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }

        state.lastComparisonRows = rows;
        document.getElementById('downloadComparison').disabled = false;
        target.innerHTML = renderComparisonResults(settings, rows);
      } catch (error) {
        target.innerHTML = `<div class="error">${html(error.message)}</div>`;
      } finally {
        button.disabled = false;
      }
    });

    document.getElementById('downloadComparison').addEventListener('click', downloadComparisonCsv);
  }

  window.RSAUiRenderers = window.RSAUiRenderers || {};
  window.RSAUiRenderers.compare = renderComparison;
})();
