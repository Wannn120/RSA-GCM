'use strict';

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
