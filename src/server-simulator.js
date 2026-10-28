'use strict';

const { encodeText, decodeText } = require('./message-codec');
const { encryptBlocks, decryptBlocks } = require('./rsa');

class ServerSimulator {
  constructor(name, keyPair) {
    this.name = name;
    this.keyPair = keyPair;
    this.inbox = [];
  }

  getPublicKey() {
    return { ...this.keyPair.publicKey };
  }

  receiveCipher(from, cipherBlocks) {
    const plainBlocks = decryptBlocks(cipherBlocks, this.keyPair.privateKey);
    const text = decodeText(plainBlocks);
    const entry = { from, cipherBlocks, plainBlocks, text };
    this.inbox.push(entry);
    return entry;
  }

  sendTo(otherServer, text) {
    const blocks = encodeText(text);
    const publicKey = otherServer.getPublicKey();
    if (publicKey.n <= 255n) throw new RangeError('n tujuan harus lebih besar dari 255 agar setiap byte UTF-8 muat dalam satu blok.');
    const cipherBlocks = encryptBlocks(blocks, publicKey);
    return otherServer.receiveCipher(this.name, cipherBlocks);
  }
}

module.exports = { ServerSimulator };
