'use strict';

window.addEventListener('rsa-gcm-ready', () => {
  if (window.RSAUi && typeof window.RSAUi.init === 'function') {
    window.RSAUi.init();
  }
}, { once: true });