(function () {
  'use strict';

  const shared = window.RSAUiShared;
  if (!shared) {
    throw new Error('ui-shared.js harus dimuat sebelum browser-crypto.js');
  }

  const { modPow, decryptBlockWithCrtTrace } = shared;

  async function encryptWithBrowserAesGcm(text) {
    const rawKey = window.crypto.getRandomValues(new Uint8Array(32));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const startedAt = performance.now();
    const cryptoKey = await window.crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt']);
    const encrypted = new Uint8Array(await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      cryptoKey,
      new TextEncoder().encode(text)
    ));
    const elapsedMs = performance.now() - startedAt;

    return {
      rawKey,
      iv,
      ciphertext: encrypted.slice(0, -16),
      authTag: encrypted.slice(-16),
      elapsedMs
    };
  }

  async function decryptWithBrowserAesGcm(payload, rawKey) {
    const startedAt = performance.now();
    const cryptoKey = await window.crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
    const authenticated = new Uint8Array(payload.ciphertext.length + payload.authTag.length);
    authenticated.set(payload.ciphertext);
    authenticated.set(payload.authTag, payload.ciphertext.length);
    const restored = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: payload.iv, tagLength: 128 },
      cryptoKey,
      authenticated
    );
    return {
      text: new TextDecoder('utf-8', { fatal: true }).decode(restored),
      elapsedMs: performance.now() - startedAt
    };
  }

  async function encryptWithBrowserHybrid(text, key) {
    const startedAt = performance.now();
    const aesPayload = await encryptWithBrowserAesGcm(text);
    if (key.n <= 255n) throw new Error('n RSA harus lebih besar dari 255 untuk membungkus byte kunci AES.');
    const wrappedKey = Array.from(aesPayload.rawKey, byte => modPow(BigInt(byte), key.e, key.n));
    const elapsedMs = performance.now() - startedAt;
    return { ...aesPayload, wrappedKey, elapsedMs };
  }

  async function decryptWithBrowserHybrid(payload, key) {
    const startedAt = performance.now();
    const rawKey = Uint8Array.from(payload.wrappedKey.map(block => {
      const byte = modPow(block, key.d, key.n);
      if (byte < 0n || byte > 255n) throw new Error('RSA menghasilkan byte kunci AES yang tidak valid.');
      return Number(byte);
    }));
    const restored = await decryptWithBrowserAesGcm(payload, rawKey);
    return { text: restored.text, elapsedMs: performance.now() - startedAt };
  }

  async function decryptWithBrowserHybridCrt(payload, key) {
    const startedAt = performance.now();
    const rawKey = Uint8Array.from(payload.wrappedKey.map(block => {
      const byte = decryptBlockWithCrtTrace(block, key).message;
      if (byte < 0n || byte > 255n) throw new Error('RSA-CRT menghasilkan byte kunci AES yang tidak valid.');
      return Number(byte);
    }));
    const restored = await decryptWithBrowserAesGcm(payload, rawKey);
    return { text: restored.text, elapsedMs: performance.now() - startedAt };
  }

  window.RSAUiRenderers = window.RSAUiRenderers || {};
  Object.assign(window.RSAUiRenderers, {
    encryptWithBrowserAesGcm,
    decryptWithBrowserAesGcm,
    encryptWithBrowserHybrid,
    decryptWithBrowserHybrid,
    decryptWithBrowserHybridCrt
  });
})();
