'use strict';

// index.js adalah export aggregator utama dari semua modul source.
// File ini memudahkan GUI/browser memanggil satu titik akses untuk semuanya,
// sekaligus menjaga struktur source tetap jelas dan terorganisir.
module.exports = {
  math: require('./math'),
  primality: require('./primality'),
  rsa: require('./rsa'),
  trace: require('./rsa-trace'),
  codec: require('./message-codec'),
  aesGcm: require('./aes-gcm'),
  hybrid: require('./hybrid'),
  comparison: require('./comparison'),
  tamper: require('./tamper'),
  simulator: require('./server-simulator')
};
