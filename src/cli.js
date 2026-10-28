'use strict';

const readline = require('readline');
const { generateKeyPairFromPrimes, encryptBlocks, decryptBlocks } = require('./rsa');
const { encodeText, decodeText, explainEncoding } = require('./message-codec');
const { traceKeyGeneration } = require('./rsa-trace');
const { trialDivisionTrace } = require('./primality');
const { gcdTrace, extendedGcd, modPowTrace } = require('./math');
const { stringify, table } = require('./format');
const { hybridEncrypt, hybridDecrypt } = require('./hybrid');
const { checksum, tamperBlock } = require('./tamper');
const { ServerSimulator } = require('./server-simulator');

function printTitle(text) {
  console.log(`\n${text}`);
}

function printKeyTrace(trace) {
  printTitle('Proses pembentukan kunci RSA');
  for (const line of trace.explanation) console.log(`• ${line}`);

  printTitle('Langkah Euclid untuk gcd(e, phi)');
  const gcdRows = trace.gcdSteps.map((s, i) => ({
    no: i + 1,
    a: s.a,
    b: s.b,
    q: s.q,
    r: s.r
  }));
  console.log(table(gcdRows, ['no', 'a', 'b', 'q', 'r']));

  printTitle('Hasil Extended Euclid');
  console.log(`gcd = ${trace.extendedGcd.gcd}`);
  console.log(`x = ${trace.extendedGcd.x}`);
  console.log(`y = ${trace.extendedGcd.y}`);
  console.log(`Pemeriksaan: e×x + phi×y = ${trace.e * trace.extendedGcd.x + trace.phi * trace.extendedGcd.y}`);
  console.log(`d = x mod phi = ${trace.d}`);
}

function runDemo() {
  const p = 61n;
  const q = 53n;
  const e = 17n;
  const message = 'MATDIS';
  const pair = generateKeyPairFromPrimes(p, q, e);
  const trace = traceKeyGeneration(p, q, e);
  const blocks = encodeText(message);
  const cipher = encryptBlocks(blocks, pair.publicKey);
  const restored = decryptBlocks(cipher, pair.privateKey);

  printTitle('Demo RSA lengkap');
  console.log(`Pesan: ${message}`);
  printKeyTrace(trace);

  printTitle('Encoding UTF-8');
  console.log(table(explainEncoding(message).map(row => ({
    index: row.index,
    byte: row.byte,
    hex: `0x${row.hex}`
  })), ['index', 'byte', 'hex']));

  printTitle('Enkripsi per blok');
  console.log(table(blocks.map((m, i) => ({
    index: i,
    m,
    rumus: `${m}^${pair.publicKey.e} mod ${pair.publicKey.n}`,
    c: cipher[i]
  })), ['index', 'm', 'rumus', 'c']));

  printTitle('Dekripsi per blok');
  console.log(table(cipher.map((c, i) => ({
    index: i,
    c,
    rumus: `${c}^${pair.privateKey.d} mod ${pair.privateKey.n}`,
    m: restored[i]
  })), ['index', 'c', 'rumus', 'm']));

  console.log(`\nPesan hasil dekripsi: ${decodeText(restored)}`);
}

function showHelp() {
  console.log(`
MATDIS RSA LAB CLI

Pemakaian:
  node src/cli.js
  node src/cli.js demo
  node src/cli.js prime <n>
  node src/cli.js gcd <a> <b>
  node src/cli.js egcd <a> <b>
  node src/cli.js modpow <base> <exp> <mod>
  node src/cli.js key <p> <q> [e]
  node src/cli.js encrypt <p> <q> <e> <pesan>
  node src/cli.js hybrid <p> <q> <e> <kunciXOR> <pesan>
  node src/cli.js tamper <pesan> <indexByte> <delta>
  node src/cli.js send <p> <q> <e> <pesan>

CLI interaktif akan muncul jika tidak ada argumen.
GUI terpisah ada di folder gui dan dapat dibuka lewat gui/index.html.
`);
}

function runCommand(args) {
  const [command, ...rest] = args;
  if (!command) return false;

  switch (command.toLowerCase()) {
    case 'demo':
      runDemo();
      return true;
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      return true;
    case 'prime': {
      const result = trialDivisionTrace(BigInt(rest[0]));
      console.log(stringify(result));
      return true;
    }
    case 'gcd': {
      const result = gcdTrace(BigInt(rest[0]), BigInt(rest[1]));
      console.log(stringify(result));
      return true;
    }
    case 'egcd': {
      const result = extendedGcd(BigInt(rest[0]), BigInt(rest[1]));
      console.log(stringify(result));
      return true;
    }
    case 'modpow': {
      const result = modPowTrace(BigInt(rest[0]), BigInt(rest[1]), BigInt(rest[2]));
      console.log(stringify(result));
      return true;
    }
    case 'key': {
      const [p, q, e] = rest;
      const trace = traceKeyGeneration(BigInt(p), BigInt(q), e === undefined ? undefined : BigInt(e));
      printKeyTrace(trace);
      return true;
    }
    case 'encrypt': {
      const [p, q, e, ...messageParts] = rest;
      const message = messageParts.join(' ');
      const pair = generateKeyPairFromPrimes(BigInt(p), BigInt(q), BigInt(e));
      if (pair.publicKey.n <= 255n) throw new Error('n harus lebih besar dari 255 untuk mode teks per byte.');
      const blocks = encodeText(message);
      const cipher = encryptBlocks(blocks, pair.publicKey);
      console.log(`Pesan: ${message}`);
      console.log(`Blok UTF-8: ${blocks.join(', ')}`);
      console.log(`Cipher: ${cipher.join(', ')}`);
      console.log(`Dekripsi: ${decodeText(decryptBlocks(cipher, pair.privateKey))}`);
      return true;
    }
    case 'hybrid': {
      const [p, q, e, keyByte, ...parts] = rest;
      const pair = generateKeyPairFromPrimes(BigInt(p), BigInt(q), BigInt(e));
      const payload = hybridEncrypt(parts.join(' '), BigInt(keyByte), pair.publicKey);
      const output = hybridDecrypt(payload, pair.privateKey);
      console.log(stringify({ pesan: parts.join(' '), kunciXOR: keyByte, payload, hasil: output }));
      return true;
    }
    case 'tamper': {
      const [message, index, delta] = rest;
      const blocks = encodeText(message);
      const changed = tamperBlock(blocks, Number(index), BigInt(delta));
      console.log(stringify({ blocks, changed, checksumAwal: checksum(blocks), checksumBaru: checksum(changed) }));
      return true;
    }
    case 'send': {
      const [p, q, e, ...parts] = rest;
      const pair = generateKeyPairFromPrimes(BigInt(p), BigInt(q), BigInt(e));
      const alice = new ServerSimulator('Alice', pair);
      const bob = new ServerSimulator('Bob', pair);
      const received = alice.sendTo(bob, parts.join(' '));
      console.log(stringify({ pengirim: 'Alice', penerima: 'Bob', publicKeyBob: bob.getPublicKey(), received }));
      return true;
    }
    default:
      console.error(`Perintah tidak dikenal: ${command}`);
      showHelp();
      return true;
  }
}

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
}

async function interactive() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log('MATDIS RSA LAB');
    console.log('CLI interaktif untuk mempelajari pembentukan kunci, enkripsi, dan dekripsi RSA.');
    console.log('Ketik angka menu.');

    while (true) {
      console.log('\n1. Demo lengkap');
      console.log('2. Buat kunci dan tampilkan langkah hitung');
      console.log('3. Enkripsi lalu dekripsi teks');
      console.log('4. Uji bilangan prima');
      console.log('5. Hitung gcd dengan jejak Euclid');
      console.log('6. Modular exponentiation dengan jejak');
      console.log('0. Keluar');
      const choice = await ask(rl, 'Pilihan: ');

      try {
        if (choice === '0') break;
        if (choice === '1') runDemo();
        else if (choice === '2') {
          const p = await ask(rl, 'p (prima): ');
          const q = await ask(rl, 'q (prima): ');
          const e = await ask(rl, 'e (kosongkan agar dipilih otomatis): ');
          const trace = traceKeyGeneration(BigInt(p), BigInt(q), e ? BigInt(e) : undefined);
          printKeyTrace(trace);
        } else if (choice === '3') {
          const p = BigInt(await ask(rl, 'p (contoh 61): '));
          const q = BigInt(await ask(rl, 'q (contoh 53): '));
          const eText = await ask(rl, 'e (contoh 17, kosongkan untuk otomatis): ');
          const pair = generateKeyPairFromPrimes(p, q, eText ? BigInt(eText) : undefined);
          if (pair.publicKey.n <= 255n) throw new Error('Pilih p dan q sehingga n > 255 agar byte UTF-8 muat.');
          const message = await ask(rl, 'Pesan: ');
          const blocks = encodeText(message);
          const cipher = encryptBlocks(blocks, pair.publicKey);
          const restored = decryptBlocks(cipher, pair.privateKey);
          console.log(`n = ${pair.publicKey.n}, phi = ${pair.details.phi}, e = ${pair.publicKey.e}, d = ${pair.privateKey.d}`);
          console.log(`Blok pesan = ${blocks.join(', ')}`);
          console.log(`Cipher = ${cipher.join(', ')}`);
          console.log(`Blok hasil dekripsi = ${restored.join(', ')}`);
          console.log(`Teks hasil dekripsi = ${decodeText(restored)}`);
        } else if (choice === '4') {
          const n = BigInt(await ask(rl, 'Bilangan yang diuji: '));
          console.log(stringify(trialDivisionTrace(n)));
        } else if (choice === '5') {
          const a = BigInt(await ask(rl, 'a: '));
          const b = BigInt(await ask(rl, 'b: '));
          console.log(stringify(gcdTrace(a, b)));
        } else if (choice === '6') {
          const base = BigInt(await ask(rl, 'base: '));
          const exp = BigInt(await ask(rl, 'eksponen: '));
          const modulus = BigInt(await ask(rl, 'modulus: '));
          console.log(stringify(modPowTrace(base, exp, modulus)));
        } else {
          console.log('Pilihan tidak tersedia.');
        }
      } catch (error) {
        console.error(`Kesalahan: ${error.message}`);
      }
    }
  } finally {
    rl.close();
  }
}

try {
  const handled = runCommand(process.argv.slice(2));
  if (!handled) interactive();
} catch (error) {
  console.error(`Kesalahan: ${error.message}`);
  process.exitCode = 1;
}
