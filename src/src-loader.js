(function () {
  // API global ini adalah tempat semua modul dari src disimpan agar bisa dipakai oleh halaman HTML.
  // Dengan cara ini, browser tidak perlu bundler; cukup memuat file .js satu per satu, lalu mengeksekusi
  // setiap file di lingkungan CommonJS buatan browser agar module.exports tetap terbaca.
  const api = window.RSA_GCM = window.RSA_GCM || {};

  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();

  function createBuffer(value, encoding = 'utf8') {
    let bytes;
    if (typeof value === 'string') {
      bytes = textEncoder.encode(value);
    } else if (value instanceof Uint8Array) {
      bytes = value;
    } else if (Array.isArray(value)) {
      bytes = Uint8Array.from(value);
    } else {
      bytes = new Uint8Array(0);
    }

    const buffer = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
    Object.defineProperty(buffer, 'toString', {
      value: (format = encoding) => {
        if (format === 'utf8' || format === 'utf-8') return textDecoder.decode(buffer);
        return Array.from(buffer).map(byte => String.fromCharCode(byte)).join('');
      },
      enumerable: false
    });
    return buffer;
  }

  const browserBuffer = {
    from(value, encoding = 'utf8') {
      return createBuffer(value, encoding);
    },
    isBuffer(value) {
      return value instanceof Uint8Array;
    },
    concat(chunks) {
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const output = new Uint8Array(totalLength);
      let offset = 0;
      chunks.forEach(chunk => {
        output.set(chunk, offset);
        offset += chunk.length;
      });
      return createBuffer(output);
    },
    byteLength(value) {
      if (typeof value === 'string') return textEncoder.encode(value).length;
      if (value instanceof Uint8Array) return value.length;
      if (Array.isArray(value)) return value.length;
      return 0;
    }
  };

  window.Buffer = browserBuffer;

  const browserCryptoCompat = {
    randomBytes(length) {
      const bytes = new Uint8Array(length);
      if (window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(bytes);
      }
      return bytes;
    },
    randomInt(minimum, maximum) {
      if (maximum <= minimum) throw new Error('randomInt membutuhkan batas atas lebih besar dari batas bawah.');
      const range = maximum - minimum + 1;
      const sample = new Uint32Array(1);
      if (!window.crypto || !window.crypto.getRandomValues) throw new Error('Web Crypto API tidak tersedia di browser ini.');
      window.crypto.getRandomValues(sample);
      return minimum + (sample[0] % range);
    },
    createCipheriv() {
      throw new Error('AES-GCM di browser harus memakai Web Crypto API. Gunakan helper UI browser-native, bukan Node crypto API.');
    },
    createDecipheriv() {
      throw new Error('AES-GCM di browser harus memakai Web Crypto API. Gunakan helper UI browser-native, bukan Node crypto API.');
    }
  };

  // Fungsi resolve bertindak seperti require() pada Node.js.
  // Ketika modul browser meminta './rsa', sistem akan mengambil nilai api.rsa yang sudah dimuat.
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
      './index': api.index,
      crypto: browserCryptoCompat,
      'crypto': browserCryptoCompat,
      buffer: browserBuffer,
      'buffer': browserBuffer
    };
    const target = map[specifier];
    if (target === undefined) {
      throw new Error(`Browser bridge tidak mengenali modul: ${specifier}`);
    }
    return target;
  };

  // loadScript membaca file dari disk lalu mengeksekusi dengan module fake.
  // Ini memungkinkan `module.exports = { ... }` pada file src bekerja di browser tanpa build tool.
  function loadScript(path, name) {
    return fetch(path, { cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error(`Gagal memuat ${path}`);
        return response.text();
      })
      .then(source => {
        const localModule = { exports: {} };
        const wrapped = new Function('require', 'module', 'exports', `${source}\n//# sourceURL=${path}`);
        wrapped(resolve, localModule, localModule.exports);
        api[name] = localModule.exports;
      });
  }

  // Mengganti require() di browser agar file GUI tetap bisa memakai path seperti './rsa'.
  window.require = resolve;

  // Queue ini menentukan urutan pemuatan file dari library inti.
  // Urutan dibuat sengaja agar modul yang dibutuhkan oleh modul lain tersedia terlebih dahulu.
  const queue = [
    ['../lib/math.js', 'math'],
    ['../lib/primality.js', 'primality'],
    ['../lib/rsa.js', 'rsa'],
    ['../lib/rsa-trace.js', 'trace'],
    ['../lib/message-codec.js', 'codec'],
    ['../lib/aes-gcm.js', 'aesGcm'],
    ['../lib/hybrid.js', 'hybrid'],
    ['../lib/comparison.js', 'comparison'],
    ['../lib/tamper.js', 'tamper'],
    ['../lib/server-simulator.js', 'simulator'],
    ['../lib/format.js', 'format'],
    ['../lib/index.js', 'index']
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
