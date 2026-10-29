(function () {
  // API global ini adalah tempat semua modul dari src disimpan agar bisa dipakai oleh halaman HTML.
  // Dengan cara ini, browser tidak perlu bundler; cukup memuat file .js satu per satu lalu menempatkannya ke window.RSA_GCM.
  const api = window.RSA_GCM = window.RSA_GCM || {};

  // Fungsi resolve bertindak seperti require() pada Node.js.
  // Ketika modul browser meminta './rsa', maka sistem akan mengambil nilai api.rsa.
  // Hal ini memungkinkan kode GUI tetap bisa menggunakan pola module seperti CommonJS tanpa alat build tambahan.
  const resolve = (specifier) => {
    const map = {
      './math': api.math,
      './primality': api.primality,
      './rsa': api.rsa,
      './rsa-trace': api.trace,
      './message-codec': api.codec,
      './aes-gcm': api.aesGcm,
      './hybrid': api.hybrid,
      './comparison': api.comparison,
      './tamper': api.tamper,
      './server-simulator': api.simulator,
      './format': api.format,
      './index': api.index
    };
    const target = map[specifier];
    if (!target) {
      throw new Error(`Browser bridge tidak mengenali modul: ${specifier}`);
    }
    return target;
  };

  // loadScript memuat satu file JS dari src ke browser dan menyimpan export module-nya.
  // Setelah script selesai dimuat, `window.module.exports` diisi dengan API file tersebut,
  // lalu hasilnya dikopikan ke api[name] agar siap dipakai UI.
  function loadScript(path, name) {
    return new Promise((resolveLoad, rejectLoad) => {
      const script = document.createElement('script');
      script.src = path;
      script.async = false;
      script.onload = () => {
        api[name] = window.module && window.module.exports ? window.module.exports : {};
        window.module = { exports: {} };
        resolveLoad();
      };
      script.onerror = () => rejectLoad(new Error(`Gagal memuat ${path}`));
      document.head.appendChild(script);
    });
  }

  // Mengganti require() di browser agar file GUI tetap bisa memakai path seperti './rsa'.
  window.require = resolve;
  window.module = { exports: {} };

  // Queue ini menentukan urutan pemuatan file dari src.
  // Urutan dibuat sengaja agar modul yang dibutuhkan oleh modul lain tersedia terlebih dahulu.
  const queue = [
    ['../src/math.js', 'math'],
    ['../src/primality.js', 'primality'],
    ['../src/rsa.js', 'rsa'],
    ['../src/rsa-trace.js', 'trace'],
    ['../src/message-codec.js', 'codec'],
    ['../src/aes-gcm.js', 'aesGcm'],
    ['../src/hybrid.js', 'hybrid'],
    ['../src/comparison.js', 'comparison'],
    ['../src/tamper.js', 'tamper'],
    ['../src/server-simulator.js', 'simulator'],
    ['../src/format.js', 'format'],
    ['../src/index.js', 'index']
  ];

  // Setelah semua modul selesai dimuat, trigger event rsa-gcm-ready.
  // Event ini dibaca oleh app.js agar UI utama dapat dijalankan.
  (async function () {
    try {
      for (const [path, name] of queue) {
        await loadScript(path, name);
      }
      window.dispatchEvent(new CustomEvent('rsa-gcm-ready'));
    } catch (error) {
      console.error(error);
      window.dispatchEvent(new CustomEvent('rsa-gcm-ready', { detail: error }));
    }
  })();
})();
